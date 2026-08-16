/**
 * Render a 2-page A4 ConsoleBrief PDF from a built brief.
 */

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;

export function formatInt(n) {
  return Math.round(n).toLocaleString("en-GB");
}

export function formatPct(ratio) {
  return `${(ratio * 100).toFixed(2)}%`;
}

export function formatPos(n) {
  return Number(n).toFixed(1);
}

function hexToRgb(hex) {
  const raw = String(hex || "#1f4d3a").replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const n = Number.parseInt(full.slice(0, 6), 16);
  if (!Number.isFinite(n)) return { r: 31, g: 77, b: 58 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function fitText(doc, text, maxWidth) {
  const value = String(text ?? "");
  if (doc.getTextWidth(value) <= maxWidth) return value;
  let cut = value;
  while (cut.length > 1 && doc.getTextWidth(`${cut}…`) > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

function drawFooter(doc, page, meta, ink) {
  doc.setDrawColor(ink.r, ink.g, ink.b);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, PAGE_H - 10, PAGE_W - MARGIN, PAGE_H - 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(90, 88, 80);
  doc.text(
    "Built by Earning Bot for Sanyam Katyal. File stayed in this browser.",
    MARGIN,
    PAGE_H - 6
  );
  doc.text(`${page} / 2`, PAGE_W - MARGIN, PAGE_H - 6, { align: "right" });
  if (meta.agencyName) {
    doc.text(meta.agencyName, PAGE_W / 2, PAGE_H - 6, { align: "center" });
  }
}

function metricCard(doc, x, y, w, h, label, value, accent) {
  doc.setFillColor(247, 244, 236);
  doc.roundedRect(x, y, w, h, 1.2, 1.2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(accent.r, accent.g, accent.b);
  doc.text(label.toUpperCase(), x + 3, y + 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 20, 15);
  doc.text(value, x + 3, y + 13);
}

function table(doc, { title, note, columns, rows, y, accent, ink }) {
  if (!rows.length) return y;
  const usable = PAGE_W - MARGIN * 2;
  const rowH = 5.1;
  const headerH = 6;
  const bottom = PAGE_H - 16;
  if (y + 16 > bottom) return y;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(ink.r, ink.g, ink.b);
  doc.text(title, MARGIN, y);
  y += 4;
  if (note) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.2);
    doc.setTextColor(90, 88, 80);
    const wrapped = doc.splitTextToSize(note, usable);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 3.2 + 1;
  }

  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(MARGIN, y, usable, headerH, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  let x = MARGIN + 1.5;
  for (const col of columns) {
    const align = col.align || "left";
    const tx = align === "right" ? x + col.width - 1.5 : x;
    doc.text(col.label, tx, y + 4, { align });
    x += col.width;
  }
  y += headerH;

  rows.forEach((row, i) => {
    if (y + rowH > bottom) return;
    if (i % 2 === 0) {
      doc.setFillColor(247, 244, 236);
      doc.rect(MARGIN, y, usable, rowH, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(20, 20, 15);
    x = MARGIN + 1.5;
    for (const col of columns) {
      const raw = col.value(row, i);
      const text = fitText(doc, raw, col.width - 2.2);
      const align = col.align || "left";
      const tx = align === "right" ? x + col.width - 1.5 : x;
      doc.text(text, tx, y + 3.6, { align });
      x += col.width;
    }
    y += rowH;
  });

  return y + 5;
}

function metricColumns() {
  return [
    { label: "Clicks", width: 18, align: "right", value: (row) => formatInt(row.clicks) },
    { label: "Impr.", width: 20, align: "right", value: (row) => formatInt(row.impressions) },
    { label: "CTR", width: 16, align: "right", value: (row) => formatPct(row.ctr) },
    { label: "Pos.", width: 14, align: "right", value: (row) => formatPos(row.position) },
  ];
}

function keyColumns(keyLabel, extra = []) {
  const used = extra.reduce((sum, col) => sum + col.width, 0);
  const keyWidth = 182 - 18 - 20 - 16 - 14 - used;
  return [
    { label: keyLabel, width: keyWidth, value: (row) => row.key },
    ...extra,
    ...metricColumns(),
  ];
}

export function renderBriefPdf(brief, meta, JsPDFCtor) {
  const JsPDF = JsPDFCtor || globalThis.jspdf?.jsPDF;
  if (!JsPDF) {
    throw new Error("jsPDF is not loaded.");
  }

  const accent = hexToRgb(meta.colour || "#1f4d3a");
  const ink = { r: 20, g: 20, b: 15 };
  const doc = new JsPDF({ unit: "mm", format: "a4", compress: true });

  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(0, 0, PAGE_W, 7, "F");

  let y = 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(ink.r, ink.g, ink.b);
  doc.text("CONSOLEBRIEF", MARGIN, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 88, 80);
  doc.text("Client performance brief  ·  from a Search Console CSV", MARGIN, y + 6);

  if (meta.logoDataUrl) {
    try {
      const fmt = meta.logoDataUrl.includes("image/png") ? "PNG" : "JPEG";
      doc.addImage(meta.logoDataUrl, fmt, PAGE_W - MARGIN - 28, 12, 28, 16, undefined, "FAST");
    } catch {
      // Ignore unreadable logos; the brief still renders.
    }
  }

  y = 32;
  const metaLines = [
    ["Client", meta.clientName || "—"],
    ["Property", meta.property || "—"],
    ["This period", meta.dateRange || "—"],
    ["Compared with", meta.compareRange || "No second-period file"],
  ];
  doc.setFillColor(247, 244, 236);
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, 22, 1.2, 1.2, "F");
  metaLines.forEach((pair, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + 4 + col * 92;
    const yy = y + 7 + row * 9;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(accent.r, accent.g, accent.b);
    doc.text(pair[0].toUpperCase(), x, yy - 2.4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(ink.r, ink.g, ink.b);
    doc.text(fitText(doc, pair[1], 86), x, yy + 2);
  });

  y = 62;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(ink.r, ink.g, ink.b);
  doc.text("File totals", MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(90, 88, 80);
  doc.text("Sum of rows in the file you provided — not GSC chart totals.", MARGIN + 28, y);
  y += 4;

  const cards = [];
  if (brief.queryTotals) {
    cards.push(["Query clicks", formatInt(brief.queryTotals.clicks)]);
    cards.push(["Query impressions", formatInt(brief.queryTotals.impressions)]);
    cards.push(["Query CTR", formatPct(brief.queryTotals.ctr)]);
    cards.push(["Query avg. position", formatPos(brief.queryTotals.position)]);
  }
  if (brief.pageTotals) {
    cards.push(["Page clicks", formatInt(brief.pageTotals.clicks)]);
    cards.push(["Page impressions", formatInt(brief.pageTotals.impressions)]);
    cards.push(["Page CTR", formatPct(brief.pageTotals.ctr)]);
    cards.push(["Page avg. position", formatPos(brief.pageTotals.position)]);
  }

  const cardW = 43.5;
  const cardH = 17;
  cards.slice(0, 8).forEach((card, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    metricCard(doc, MARGIN + col * (cardW + 3), y + row * (cardH + 3), cardW, cardH, card[0], card[1], accent);
  });
  y += Math.ceil(Math.min(cards.length, 8) / 4) * (cardH + 3) + 6;

  doc.setFillColor(255, 248, 230);
  const note = `${brief.capNote} Rows in this brief: ${brief.queryCount} ${
    brief.queryCount === 1 ? "query" : "queries"
  }, ${brief.pageCount} ${brief.pageCount === 1 ? "page" : "pages"}.${
    brief.truncated ? " At least one file hit the 1,000-row export cap." : ""
  }`;
  const noteLines = doc.splitTextToSize(note, PAGE_W - MARGIN * 2 - 6);
  const noteH = noteLines.length * 3.4 + 8;
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, noteH, 1.2, 1.2, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(ink.r, ink.g, ink.b);
  doc.text(noteLines, MARGIN + 3, y + 5.5);
  y += noteH + 8;

  const page1Ids = new Set(["topQueries", "topPages"]);
  const page1Sections = brief.sections.filter((s) => page1Ids.has(s.id));
  const page2Sections = brief.sections.filter((s) => !page1Ids.has(s.id));

  for (const sec of page1Sections) {
    y = table(doc, {
      title: sec.title,
      note: null,
      columns: keyColumns(sec.id === "topPages" ? "Page" : "Query"),
      rows: sec.rows,
      y,
      accent,
      ink,
    });
  }

  drawFooter(doc, 1, meta, ink);

  doc.addPage();
  doc.setFillColor(accent.r, accent.g, accent.b);
  doc.rect(0, 0, PAGE_W, 7, "F");
  y = 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(ink.r, ink.g, ink.b);
  doc.text("Movers, losers, and a near-win filter", MARGIN, y);
  y += 8;

  if (!page2Sections.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(90, 88, 80);
    doc.text(
      "No comparison files were provided, and no rows matched the near-win filter. This page is left blank on purpose — ConsoleBrief does not invent rows.",
      MARGIN,
      y,
      { maxWidth: PAGE_W - MARGIN * 2 }
    );
  }

  for (const sec of page2Sections) {
    const extra =
      sec.id.includes("Movers") || sec.id.includes("Losers")
        ? [
            {
              label: "+/- clicks",
              width: 20,
              align: "right",
              value: (row) => {
                const n = row.deltaClicks;
                return `${n > 0 ? "+" : ""}${formatInt(n)}`;
              },
            },
          ]
        : sec.id === "nearWins"
          ? [{ label: "Type", width: 16, value: (row) => row.type || "" }]
          : [];
    y = table(doc, {
      title: sec.title,
      note: sec.filter || null,
      columns: keyColumns(
        sec.id.startsWith("page") || (sec.id === "nearWins" && sec.rows[0]?.type === "page")
          ? "Page / query"
          : "Query / page",
        extra
      ),
      rows: sec.rows,
      y,
      accent,
      ink,
    });
  }

  drawFooter(doc, 2, meta, ink);

  while (doc.getNumberOfPages() > 2) {
    doc.deletePage(doc.getNumberOfPages());
  }
  if (doc.getNumberOfPages() < 2) {
    doc.addPage();
    drawFooter(doc, 2, meta, ink);
  }

  return doc;
}

export function pdfBlob(doc) {
  return doc.output("blob");
}

export function suggestedFilename(meta) {
  const client = (meta.clientName || "client").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `consolebrief-${client || "client"}.pdf`;
}
