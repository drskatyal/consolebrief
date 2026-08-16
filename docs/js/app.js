import { parseGscCsv, ParseError } from "./parser.js";
import { buildBrief } from "./report.js";
import { formatInt, formatPct, formatPos, renderBriefPdf, suggestedFilename } from "./pdf.js";

const state = {
  current: { queries: null, pages: null, queryName: "", pageName: "" },
  previous: { queries: null, pages: null, queryName: "", pageName: "" },
  logoDataUrl: "",
};

const $ = (id) => document.getElementById(id);

function formatRange(fromId, toId) {
  const from = $(fromId).value;
  const to = $(toId).value;
  if (!from && !to) return "";
  const fmt = (iso) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
  };
  if (from && to) return `${fmt(from)} – ${fmt(to)}`;
  return fmt(from || to);
}

function collectMeta() {
  return {
    clientName: $("clientName").value.trim(),
    property: $("property").value.trim(),
    dateRange: formatRange("dateFrom", "dateTo"),
    compareRange: formatRange("prevFrom", "prevTo"),
    agencyName: $("agencyName").value.trim(),
    colour: $("agencyColour").value,
    logoDataUrl: state.logoDataUrl,
  };
}

function briefFromState() {
  const queries = state.current.queries?.rows ?? [];
  const pages = state.current.pages?.rows ?? [];
  if (!queries.length && !pages.length) return null;
  return buildBrief({
    queries,
    pages,
    prevQueries: state.previous.queries?.rows ?? null,
    prevPages: state.previous.pages?.rows ?? null,
  });
}

function setStatus(message, isError = false) {
  const el = $("toolStatus");
  el.textContent = message;
  el.classList.toggle("is-error", isError);
}

function fileChip(parsed, filename) {
  const n = parsed.rows.length;
  const kind = parsed.kind === "pages" ? "Pages" : "Queries";
  const cap = n >= 1000 ? " · 1,000-row cap likely" : "";
  return `${kind} · ${filename} · ${n} row${n === 1 ? "" : "s"}${cap}`;
}

function assignParsed(slot, parsed, filename) {
  if (parsed.kind === "pages") {
    slot.pages = parsed;
    slot.pageName = filename;
  } else {
    slot.queries = parsed;
    slot.queryName = filename;
  }
}

async function ingestFiles(fileList, period) {
  const files = [...fileList].filter((f) => f.name.toLowerCase().endsWith(".csv"));
  if (!files.length) {
    setStatus("Drop a .csv file. If Search Console gave you a ZIP, open it and use Queries.csv and/or Pages.csv.", true);
    return;
  }
  const slot = period === "previous" ? state.previous : state.current;
  const notes = [];
  for (const file of files) {
    try {
      const text = await file.text();
      const parsed = parseGscCsv(text);
      assignParsed(slot, parsed, file.name);
      notes.push(fileChip(parsed, file.name));
    } catch (err) {
      const msg = err instanceof ParseError ? err.message : "Could not read that file.";
      setStatus(msg, true);
      renderPreview();
      return;
    }
  }
  setStatus(`Loaded ${notes.join(" · ")}. Files stayed in this browser.`);
  renderPreview();
}

function renderPreview() {
  const brief = briefFromState();
  const empty = $("emptyState");
  const preview = $("preview");
  const button = $("downloadPdf");
  if (!brief) {
    empty.hidden = false;
    preview.hidden = true;
    button.disabled = true;
    $("fileList").replaceChildren();
    return;
  }
  empty.hidden = true;
  preview.hidden = false;
  button.disabled = false;

  const chips = [];
  if (state.current.queries) chips.push(fileChip(state.current.queries, state.current.queryName));
  if (state.current.pages) chips.push(fileChip(state.current.pages, state.current.pageName));
  if (state.previous.queries) chips.push(`Previous ${fileChip(state.previous.queries, state.previous.queryName)}`);
  if (state.previous.pages) chips.push(`Previous ${fileChip(state.previous.pages, state.previous.pageName)}`);
  $("fileList").replaceChildren(
    ...chips.map((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      return li;
    })
  );

  const totals = [];
  if (brief.queryTotals) {
    totals.push(`Queries file: ${formatInt(brief.queryTotals.clicks)} clicks, ${formatInt(brief.queryTotals.impressions)} impressions, ${formatPct(brief.queryTotals.ctr)} CTR, pos. ${formatPos(brief.queryTotals.position)}`);
  }
  if (brief.pageTotals) {
    totals.push(`Pages file: ${formatInt(brief.pageTotals.clicks)} clicks, ${formatInt(brief.pageTotals.impressions)} impressions, ${formatPct(brief.pageTotals.ctr)} CTR, pos. ${formatPos(brief.pageTotals.position)}`);
  }
  $("totalsPreview").textContent = totals.join(" ");

  const labels = {
    topQueries: "Top 10 queries",
    topPages: "Top 10 pages",
    queryMovers: "Query movers",
    queryLosers: "Query losers",
    pageMovers: "Page movers",
    pageLosers: "Page losers",
    nearWins: "Near-win filter",
  };
  $("sectionList").replaceChildren(
    ...brief.sections.map((sec) => {
      const li = document.createElement("li");
      li.textContent = `${labels[sec.id] || sec.title} · ${sec.rows.length} row${sec.rows.length === 1 ? "" : "s"}`;
      return li;
    })
  );
  if (!brief.sections.length) {
    const li = document.createElement("li");
    li.textContent = "No tables to print — the file had headers but no rows.";
    $("sectionList").append(li);
  }
}

function bindDrop(id, period) {
  const zone = $(id);
  const prevent = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  ["dragenter", "dragover"].forEach((type) => {
    zone.addEventListener(type, (e) => {
      prevent(e);
      zone.classList.add("is-over");
    });
  });
  ["dragleave", "drop"].forEach((type) => {
    zone.addEventListener(type, (e) => {
      prevent(e);
      zone.classList.remove("is-over");
    });
  });
  zone.addEventListener("drop", (e) => ingestFiles(e.dataTransfer.files, period));
  zone.querySelector("input[type=file]").addEventListener("change", (e) => {
    ingestFiles(e.target.files, period);
    e.target.value = "";
  });
}

async function loadSample() {
  const names = [
    ["samples/queries.csv", "current"],
    ["samples/pages.csv", "current"],
    ["samples/queries-previous.csv", "previous"],
    ["samples/pages-previous.csv", "previous"],
  ];
  try {
    for (const [path, period] of names) {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`Missing ${path}`);
      const text = await res.text();
      const parsed = parseGscCsv(text);
      const slot = period === "previous" ? state.previous : state.current;
      assignParsed(slot, parsed, path.split("/").pop());
    }
    $("clientName").value = "Harbour Books";
    $("property").value = "sc-domain:harbourbooks.example";
    $("dateFrom").value = "2026-07-01";
    $("dateTo").value = "2026-07-31";
    $("prevFrom").value = "2026-06-01";
    $("prevTo").value = "2026-06-30";
    $("agencyName").value = "North Quay Studio";
    $("agencyColour").value = "#1f4d3a";
    setStatus("Loaded fictional Harbour Books sample CSVs (official GSC column names). Nothing was uploaded.");
    renderPreview();
  } catch (err) {
    setStatus(err.message || "Could not load sample CSVs.", true);
  }
}

function downloadPdf() {
  const brief = briefFromState();
  if (!brief) return;
  if (!globalThis.jspdf?.jsPDF) {
    setStatus("The PDF library did not load. Check your network or use the vendored copy in docs/vendor.", true);
    return;
  }
  const meta = collectMeta();
  const doc = renderBriefPdf(brief, meta);
  doc.save(suggestedFilename(meta));
  setStatus("PDF saved on this device. The CSV never left the browser.");
}

function onLogo(file) {
  if (!file) {
    state.logoDataUrl = "";
    $("logoName").textContent = "No logo";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    state.logoDataUrl = String(reader.result || "");
    $("logoName").textContent = file.name;
  };
  reader.readAsDataURL(file);
}

function resetTool() {
  state.current = { queries: null, pages: null, queryName: "", pageName: "" };
  state.previous = { queries: null, pages: null, queryName: "", pageName: "" };
  state.logoDataUrl = "";
  $("logo").value = "";
  $("logoName").textContent = "No logo";
  setStatus("Cleared. Files were only in memory.");
  renderPreview();
}

bindDrop("dropCurrent", "current");
bindDrop("dropPrevious", "previous");
$("loadSample").addEventListener("click", loadSample);
$("downloadPdf").addEventListener("click", downloadPdf);
$("resetTool").addEventListener("click", resetTool);
$("logo").addEventListener("change", (e) => onLogo(e.target.files[0]));
$("polarButton").addEventListener("click", (e) => {
  e.preventDefault();
  $("polarNote").focus();
});
["clientName", "property", "dateFrom", "dateTo", "prevFrom", "prevTo", "agencyName", "agencyColour"].forEach((id) => {
  $(id).addEventListener("input", () => {
    if (briefFromState()) renderPreview();
  });
});
renderPreview();
