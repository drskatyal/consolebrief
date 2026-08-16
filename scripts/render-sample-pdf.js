import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { jsPDF } from "jspdf";
import { parseGscCsv } from "../docs/js/parser.js";
import { buildBrief } from "../docs/js/report.js";
import { renderBriefPdf } from "../docs/js/pdf.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function rows(rel) {
  return parseGscCsv(readFileSync(join(root, rel), "utf8")).rows;
}

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

const outDir = join(root, "out");
mkdirSync(outDir, { recursive: true });
const dest = join(outDir, "harbour-books-sample.pdf");
writeFileSync(dest, Buffer.from(doc.output("arraybuffer")));
console.log(`Wrote ${dest} (${doc.getNumberOfPages()} pages)`);
