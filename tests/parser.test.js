import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parseCtr, parseGscCsv, parseNumber, ParseError } from "../docs/js/parser.js";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

function load(name) {
  return readFileSync(join(fixtures, name), "utf8");
}

test("parses official Top queries headers and percent CTR", () => {
  const parsed = parseGscCsv(load("official-queries.csv"));
  assert.equal(parsed.kind, "queries");
  assert.equal(parsed.rows.length, 15);
  assert.equal(parsed.rows[0].key, "harbour books");
  assert.equal(parsed.rows[0].clicks, 98);
  assert.equal(parsed.rows[0].impressions, 890);
  assert.ok(Math.abs(parsed.rows[0].ctr - 0.1101) < 1e-6);
  assert.equal(parsed.rows[0].position, 1.4);
});

test("parses official Top pages headers", () => {
  const parsed = parseGscCsv(load("official-pages.csv"));
  assert.equal(parsed.kind, "pages");
  assert.equal(parsed.rows[0].key, "https://harbourbooks.example/");
  assert.equal(parsed.rows[0].clicks, 210);
});

test("accepts Query and Page aliases", () => {
  const queries = parseGscCsv(load("alias-query.csv"));
  const pages = parseGscCsv(load("alias-page.csv"));
  assert.equal(queries.kind, "queries");
  assert.equal(queries.rows[0].key, "alias query one");
  assert.ok(Math.abs(queries.rows[0].ctr - 0.123) < 1e-6);
  assert.ok(Math.abs(queries.rows[1].ctr - 0.05) < 1e-6);
  assert.equal(pages.kind, "pages");
  assert.equal(pages.rows[0].key, "https://harbourbooks.example/alias");
});

test("CTR accepts 12.3% or 0.123", () => {
  assert.ok(Math.abs(parseCtr("12.3%") - 0.123) < 1e-6);
  assert.ok(Math.abs(parseCtr("0.123") - 0.123) < 1e-6);
  assert.ok(Math.abs(parseCtr(0.123) - 0.123) < 1e-6);
  const parsed = parseGscCsv(load("ctr-decimal.csv"));
  assert.ok(Math.abs(parsed.rows[0].ctr - 0.12) < 1e-6);
  assert.ok(Math.abs(parsed.rows[1].ctr - 0.125) < 1e-6);
});

test("skips metadata rows above the official header", () => {
  const parsed = parseGscCsv(load("metadata-preamble.csv"));
  assert.equal(parsed.headerRowIndex, 2);
  assert.equal(parsed.rows[0].key, "preamble query");
});

test("keeps quoted commas and escaped quotes", () => {
  const parsed = parseGscCsv(load("quoted-commas.csv"));
  assert.equal(parsed.rows[0].key, "books, maps and prints");
  assert.equal(parsed.rows[1].key, 'a "quoted" title');
});

test("treats GSC ~ and - as zero", () => {
  assert.equal(parseNumber("~"), 0);
  assert.equal(parseNumber("-"), 0);
  const parsed = parseGscCsv(load("gsc-missing-values.csv"));
  assert.equal(parsed.rows[0].clicks, 0);
  assert.equal(parsed.rows[0].impressions, 0);
  assert.equal(parsed.rows[0].ctr, 0);
  assert.equal(parsed.rows[0].position, 0);
});

test("strips a UTF-8 BOM", () => {
  const parsed = parseGscCsv(`\uFEFFTop queries,Clicks,Impressions,CTR,Position\nbom,1,10,10%,2`);
  assert.equal(parsed.rows[0].key, "bom");
});

test("rejects files that are not GSC Performance tables", () => {
  assert.throws(() => parseGscCsv("foo,bar\n1,2"), ParseError);
  assert.throws(() => parseGscCsv(""), ParseError);
});

test("does not invent rows for an official header with no data", () => {
  const parsed = parseGscCsv("Top queries,Clicks,Impressions,CTR,Position\n");
  assert.equal(parsed.rows.length, 0);
});
