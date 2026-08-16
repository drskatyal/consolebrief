# ConsoleBrief

Drop a Search Console CSV. Get a 2-page client PDF. The file never leaves the browser.

A local-first static site: no Google OAuth, no GA4, no rank-tracker APIs. Built by an autonomous AI agent (Earning Bot) for Sanyam Katyal.

Public site: GitHub Pages from this repository  
(`https://drskatyal.github.io/consolebrief/` once Pages is on).

## Run locally

```bash
npm install
npm test
npm start
```

`npm start` serves the `docs/` folder (the same files Pages hosts). Open the printed URL, click **Load sample data**, then **Download 2-page PDF**.

To write a sample PDF from the fixtures without a browser:

```bash
npm run pdf:sample
```

That writes `out/harbour-books-sample.pdf`.

## What it reads

Google Search Console → Performance → Search results → Export → Download CSV.

If the download is a ZIP, open it and use `Queries.csv` and/or `Pages.csv`. Official column names:

```
Top queries,Clicks,Impressions,CTR,Position
Top pages,Clicks,Impressions,CTR,Position
```

Aliases `Query` / `Page` are accepted. CTR may be `12.3%` or `0.123`. Values shown as `~` or `-` in GSC become zero, matching [Google’s export notes](https://support.google.com/webmasters/answer/12919797).

The UI export is capped at 1,000 rows. ConsoleBrief reports on the file you gave it and says so on the PDF. Totals are the sum of those rows, not Search Console’s chart totals.

Sample CSVs (fictional bookshop, official headers) live in `docs/samples/`. Parser fixtures are in `fixtures/`.

## What’s in the PDF

1. Cover: client name, property, date range, agency logo/colour, file totals, 1,000-row note.
2. Top 10 queries, top 10 pages, month-on-month movers/losers (if a second period is provided), and a **near-win filter** (impressions ≥ file median, CTR below median, position 4.0–15.0). That table is a filter, not advice.

If a block has no rows, it is omitted. Rows are never invented.

## GitHub Pages

The site is the `docs/` directory (vanilla HTML/JS, vendored jsPDF). A workflow deploys it on every push to `main`.

**Enable Pages** (repo admin), if it is not already on:

1. GitHub → **Settings** → **Pages**
2. **Build and deployment** → **Source:** GitHub Actions

Fallback if Actions Pages is unavailable:

1. **Source:** Deploy from a branch
2. **Branch:** `main` / folder `/docs`

The first deploy after enabling Pages can take a few minutes. The Actions workflow needs the `github-pages` environment (GitHub creates it on first run).

## Price

Intended later: £19 one-time. There is no paywall. The Polar button on the page is labelled as not live yet.

## Tests

`npm test` runs Node’s built-in test runner against the fixtures (official headers, aliases, CTR shapes, preamble rows, quoted commas, movers/losers, near-win filter, 2-page PDF).
