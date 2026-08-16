/**
 * Parse a Google Search Console Performance UI CSV (Queries or Pages).
 * Official headers: "Top queries" / "Top pages", Clicks, Impressions, CTR, Position.
 * Aliases: Query / Page. CTR may be "12.3%" or 0.123.
 */

const QUERY_KEYS = new Set(["top queries", "query", "queries"]);
const PAGE_KEYS = new Set(["top pages", "page", "pages"]);
const CLICK_KEYS = new Set(["clicks"]);
const IMPR_KEYS = new Set(["impressions"]);
const CTR_KEYS = new Set(["ctr", "click through rate", "click-through rate"]);
const POS_KEYS = new Set(["position", "average position"]);

export class ParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "ParseError";
  }
}

export function parseCsv(text) {
  const source = String(text ?? "").replace(/^\uFEFF/, "");
  return rowsFromCsv(source);
}

function rowsFromCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch === "\r") {
      // swallow; \n handles CRLF
    } else {
      field += ch;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => String(cell).trim() !== ""));
}

function normHeader(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase();
}

function findColumn(headers, names) {
  return headers.findIndex((h) => names.has(normHeader(h)));
}

function findHeaderRow(rows) {
  const scan = Math.min(rows.length, 25);
  for (let i = 0; i < scan; i += 1) {
    const headers = rows[i];
    const dim = detectDimension(headers);
    const clicks = findColumn(headers, CLICK_KEYS);
    const impressions = findColumn(headers, IMPR_KEYS);
    if (dim && clicks !== -1 && impressions !== -1) {
      return { index: i, headers, kind: dim.kind, keyIndex: dim.index };
    }
  }
  return null;
}

function detectDimension(headers) {
  const queryIndex = findColumn(headers, QUERY_KEYS);
  const pageIndex = findColumn(headers, PAGE_KEYS);
  if (queryIndex !== -1 && pageIndex !== -1) {
    return { kind: "mixed", index: queryIndex, pageIndex };
  }
  if (queryIndex !== -1) return { kind: "queries", index: queryIndex };
  if (pageIndex !== -1) return { kind: "pages", index: pageIndex };
  return null;
}

export function parseNumber(value) {
  if (value == null) return 0;
  const raw = String(value).trim();
  if (raw === "" || raw === "-" || raw === "~" || raw === "n/a" || raw === "N/A") {
    return 0;
  }
  const cleaned = raw.replace(/[%\s,]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * CTR from GSC UI is usually "12.3%". API-style exports use 0.123.
 * A bare number > 1 is treated as a percent (12.3 → 0.123).
 */
export function parseCtr(value) {
  if (value == null) return 0;
  const raw = String(value).trim();
  if (raw === "" || raw === "-" || raw === "~") return 0;
  const hasPercent = raw.includes("%");
  const n = parseNumber(raw);
  if (hasPercent) return n / 100;
  if (n > 1) return n / 100;
  return n;
}

export function parseGscCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) {
    throw new ParseError("This file is empty.");
  }

  const header = findHeaderRow(rows);
  if (!header) {
    throw new ParseError(
      "This file does not look like a Search Console Performance Queries or Pages export. Expected a column named Top queries, Top pages, Query, or Page, plus Clicks and Impressions."
    );
  }

  const { headers, kind, keyIndex, index } = header;
  const clicksIndex = findColumn(headers, CLICK_KEYS);
  const impressionsIndex = findColumn(headers, IMPR_KEYS);
  const ctrIndex = findColumn(headers, CTR_KEYS);
  const positionIndex = findColumn(headers, POS_KEYS);
  const pageIndex = header.pageIndex ?? -1;

  const parsed = [];
  for (const cells of rows.slice(index + 1)) {
    const key = String(cells[keyIndex] ?? "").trim();
    if (!key) continue;
    const clicks = parseNumber(cells[clicksIndex]);
    const impressions = parseNumber(cells[impressionsIndex]);
    const ctr =
      ctrIndex === -1
        ? impressions > 0
          ? clicks / impressions
          : 0
        : parseCtr(cells[ctrIndex]);
    const position = positionIndex === -1 ? 0 : parseNumber(cells[positionIndex]);
    const row = { key, clicks, impressions, ctr, position };
    if (kind === "mixed" && pageIndex !== -1) {
      row.page = String(cells[pageIndex] ?? "").trim();
    }
    parsed.push(row);
  }

  return {
    kind: kind === "mixed" ? "queries" : kind,
    sourceKind: kind,
    headers: headers.map((h) => String(h).trim()),
    rows: parsed,
    headerRowIndex: index,
  };
}

export function describeFile(parsed) {
  const label = parsed.kind === "pages" ? "pages" : "queries";
  return {
    kind: parsed.kind,
    label,
    rowCount: parsed.rows.length,
    truncated: parsed.rows.length >= 1000,
  };
}
