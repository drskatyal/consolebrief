import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { jsPDF } from "jspdf";
import { parseGscCsv } from "../docs/js/parser.js";
import { buildBrief } from "../docs/js/report.js";
import { renderBriefPdf, suggestedFilename } from "../docs/js/pdf.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function rows(rel) {
  return parseGscCsv(readFileSync(join(root, rel), "utf8")).rows;
}

test("sample CSVs produce a real 2-page A4 PDF", () => {
  const brief = buildBrief({
    queries: rows("docs/samples/queries.csv"),
    pages: rows("docs/samples/pages.csv"),
    prevQueries: rows("docs/samples/queries-previous.csv"),
    prevPages: rows("docs/samples/pages-previous.csv"),
  });
  const doc = renderBriefPdf(
    brief,
    {
      clientName: "Harbour Books",
      property: "sc-domain:harbourbooks.example",
      dateRange: "1 Jul 2026 – 31 Jul 2026",
      compareRange: "1 Jun 2026 – 30 Jun 2026",
      agencyName: "North Quay Studio",
      colour: "#1f4d3a",
    },
    jsPDF
  );
  assert.equal(doc.getNumberOfPages(), 2);
  const buf = Buffer.from(doc.output("arraybuffer"));
  assert.ok(buf.subarray(0, 5).toString() === "%PDF-");
  assert.ok(buf.length > 1000);
});

test("PDF stays at 2 pages when optional blocks are empty", () => {
  const brief = buildBrief({ queries: rows("fixtures/alias-query.csv") });
  const doc = renderBriefPdf(
    brief,
    { clientName: "Test", property: "https://example.com", dateRange: "August 2026" },
    jsPDF
  );
  assert.equal(doc.getNumberOfPages(), 2);
});

test("suggested filename is filesystem-safe", () => {
  assert.equal(suggestedFilename({ clientName: "Harbour Books" }), "consolebrief-harbour-books.pdf");
});
