import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parseGscCsv } from "../docs/js/parser.js";
import {
  buildBrief,
  comparePeriods,
  fileTotals,
  median,
  nearWins,
  topByClicks,
} from "../docs/js/report.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

function rows(name) {
  return parseGscCsv(readFileSync(join(fixtures, name), "utf8")).rows;
}

test("file totals are the sum of the given rows", () => {
  const totals = fileTotals(rows("official-queries.csv"));
  assert.equal(totals.rowCount, 15);
  assert.equal(totals.clicks, 555);
  assert.equal(totals.impressions, 15425);
  assert.ok(Math.abs(totals.ctr - 555 / 15425) < 1e-9);
});

test("top 10 is by clicks and never pads missing rows", () => {
  const top = topByClicks(rows("official-pages.csv"), 10);
  assert.equal(top.length, 8);
  assert.equal(top[0].key, "https://harbourbooks.example/");
  assert.ok(top.every((row) => row.clicks >= top[top.length - 1].clicks));
});

test("movers and losers come from the two files, including new and gone keys", () => {
  const { movers, losers } = comparePeriods(rows("official-queries.csv"), rows("previous-queries.csv"), 5);
  assert.equal(movers[0].key, "independent bookshop whitstable");
  assert.equal(movers[0].deltaClicks, 52);
  assert.equal(losers[0].key, "vanished spring sale");
  assert.equal(losers[0].deltaClicks, -25);
  assert.equal(losers[0].status, "gone");
  assert.ok(movers.every((row) => row.deltaClicks > 0));
  assert.ok(losers.every((row) => row.deltaClicks < 0));
});

test("near-win is the documented filter, not a ranking promise", () => {
  const fixture = [
    { key: "high impr low ctr mid pos", clicks: 10, impressions: 1000, ctr: 0.01, position: 8 },
    { key: "high impr high ctr", clicks: 200, impressions: 1000, ctr: 0.2, position: 8 },
    { key: "low impr", clicks: 1, impressions: 10, ctr: 0.15, position: 8 },
    { key: "position 2", clicks: 5, impressions: 1000, ctr: 0.18, position: 2 },
    { key: "position 20", clicks: 5, impressions: 1000, ctr: 0.16, position: 20 },
  ];
  const result = nearWins(fixture);
  assert.equal(result.impressionsMedian, 1000);
  assert.ok(result.rows.every((row) => row.key === "high impr low ctr mid pos"));
  assert.equal(result.rows.length, 1);
});

test("buildBrief drops empty blocks and does not invent rows", () => {
  const queriesOnly = buildBrief({ queries: rows("official-queries.csv") });
  const ids = queriesOnly.sections.map((s) => s.id);
  assert.ok(ids.includes("topQueries"));
  assert.ok(!ids.includes("topPages"));
  assert.ok(!ids.includes("queryMovers"));
  assert.equal(queriesOnly.pageTotals, null);
  assert.equal(queriesOnly.pageCount, 0);

  const emptyPages = buildBrief({
    queries: rows("official-queries.csv"),
    pages: [],
    prevQueries: rows("previous-queries.csv"),
  });
  assert.ok(!emptyPages.sections.some((s) => s.id.startsWith("page")));
  assert.ok(emptyPages.sections.some((s) => s.id === "nearWins"));
  const near = emptyPages.sections.find((s) => s.id === "nearWins");
  assert.match(near.filter, /not advice/i);
});

test("median is the middle of the file we were given", () => {
  assert.equal(median([1, 3, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), 0);
});

test("flags the 1,000-row GSC UI cap without inventing extra rows", () => {
  const queries = Array.from({ length: 1000 }, (_, i) => ({
    key: `q${i}`,
    clicks: 1,
    impressions: 10,
    ctr: 0.1,
    position: 5,
  }));
  const brief = buildBrief({ queries });
  assert.equal(brief.queryCount, 1000);
  assert.equal(brief.truncated, true);
  assert.equal(brief.sections.find((s) => s.id === "topQueries").rows.length, 10);
});
