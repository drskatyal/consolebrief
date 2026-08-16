/**
 * Build a ConsoleBrief from parsed GSC rows.
 * Empty blocks are omitted. Rows are never invented.
 */

export function median(values) {
  const nums = values.filter((n) => Number.isFinite(n)).slice().sort((a, b) => a - b);
  if (!nums.length) return 0;
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2 === 0) return (nums[mid - 1] + nums[mid]) / 2;
  return nums[mid];
}

export function fileTotals(rows) {
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const weighted = rows.reduce((sum, row) => sum + row.position * row.impressions, 0);
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? weighted / impressions : 0,
    rowCount: rows.length,
  };
}

export function topByClicks(rows, n = 10) {
  return rows
    .slice()
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, n)
    .map((row) => ({ ...row }));
}

export function comparePeriods(current, previous, n = 5) {
  const prevMap = new Map(previous.map((row) => [row.key, row]));
  const currentKeys = new Set(current.map((row) => row.key));

  const deltas = current.map((row) => {
    const prev = prevMap.get(row.key);
    const prevClicks = prev ? prev.clicks : 0;
    const prevImpressions = prev ? prev.impressions : 0;
    return {
      key: row.key,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
      prevClicks,
      prevImpressions,
      deltaClicks: row.clicks - prevClicks,
      deltaImpressions: row.impressions - prevImpressions,
      status: prev ? "both" : "new",
    };
  });

  for (const row of previous) {
    if (!currentKeys.has(row.key)) {
      deltas.push({
        key: row.key,
        clicks: 0,
        impressions: 0,
        ctr: 0,
        position: 0,
        prevClicks: row.clicks,
        prevImpressions: row.impressions,
        deltaClicks: -row.clicks,
        deltaImpressions: -row.impressions,
        status: "gone",
      });
    }
  }

  const movers = deltas
    .filter((row) => row.deltaClicks > 0)
    .sort((a, b) => b.deltaClicks - a.deltaClicks || b.deltaImpressions - a.deltaImpressions)
    .slice(0, n);

  const losers = deltas
    .filter((row) => row.deltaClicks < 0)
    .sort((a, b) => a.deltaClicks - b.deltaClicks || a.deltaImpressions - b.deltaImpressions)
    .slice(0, n);

  return { movers, losers };
}

/**
 * Near-win is a filter, not advice:
 * impressions ≥ file median, CTR below file median, position 4.0–15.0.
 */
export function nearWins(rows, { posMin = 4, posMax = 15, limit = 10 } = {}) {
  if (!rows.length) return { rows: [], impressionsMedian: 0, ctrMedian: 0 };
  const impressionsMedian = median(rows.map((row) => row.impressions));
  const ctrMedian = median(rows.map((row) => row.ctr));
  const matched = rows
    .filter(
      (row) =>
        row.impressions >= impressionsMedian &&
        row.ctr < ctrMedian &&
        row.position >= posMin &&
        row.position <= posMax
    )
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit)
    .map((row) => ({ ...row }));
  return { rows: matched, impressionsMedian, ctrMedian };
}

function section(id, title, rows, extra = {}) {
  if (!rows.length) return null;
  return { id, title, rows, ...extra };
}

export function buildBrief({
  queries = [],
  pages = [],
  prevQueries = null,
  prevPages = null,
} = {}) {
  const sections = [];
  const queryTotals = queries.length ? fileTotals(queries) : null;
  const pageTotals = pages.length ? fileTotals(pages) : null;

  const topQueries = section("topQueries", "Top 10 queries by clicks", topByClicks(queries, 10));
  const topPages = section("topPages", "Top 10 pages by clicks", topByClicks(pages, 10));
  if (topQueries) sections.push(topQueries);
  if (topPages) sections.push(topPages);

  if (prevQueries && prevQueries.length && queries.length) {
    const { movers, losers } = comparePeriods(queries, prevQueries, 5);
    const moverSec = section("queryMovers", "Query movers (clicks vs previous file)", movers);
    const loserSec = section("queryLosers", "Query losers (clicks vs previous file)", losers);
    if (moverSec) sections.push(moverSec);
    if (loserSec) sections.push(loserSec);
  }

  if (prevPages && prevPages.length && pages.length) {
    const { movers, losers } = comparePeriods(pages, prevPages, 5);
    const moverSec = section("pageMovers", "Page movers (clicks vs previous file)", movers);
    const loserSec = section("pageLosers", "Page losers (clicks vs previous file)", losers);
    if (moverSec) sections.push(moverSec);
    if (loserSec) sections.push(loserSec);
  }

  const queryNear = queries.length ? nearWins(queries) : { rows: [] };
  const pageNear = pages.length ? nearWins(pages) : { rows: [] };
  const nearRows = [
    ...queryNear.rows.map((row) => ({ ...row, type: "query" })),
    ...pageNear.rows.map((row) => ({ ...row, type: "page" })),
  ].sort((a, b) => b.impressions - a.impressions).slice(0, 10);

  const near = section(
    "nearWins",
    "Near-win filter (not advice)",
    nearRows,
    {
      filter:
        "Rows in this file with impressions at or above the file median, CTR below the file median, and average position 4.0–15.0. This is a filter, not advice.",
      queryMedians: queries.length
        ? { impressions: queryNear.impressionsMedian, ctr: queryNear.ctrMedian }
        : null,
      pageMedians: pages.length
        ? { impressions: pageNear.impressionsMedian, ctr: pageNear.ctrMedian }
        : null,
    }
  );
  if (near) sections.push(near);

  const queryCount = queries.length;
  const pageCount = pages.length;

  return {
    queryTotals,
    pageTotals,
    sections,
    queryCount,
    pageCount,
    truncated: queryCount >= 1000 || pageCount >= 1000,
    hasComparison: Boolean(
      (prevQueries && prevQueries.length && queries.length) ||
        (prevPages && prevPages.length && pages.length)
    ),
    capNote:
      "Google Search Console’s on-screen export is capped at 1,000 rows. This brief reports on the file we were given, not on Search Console’s chart totals (those include truncated and anonymised rows).",
  };
}
