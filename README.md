# Journals

Self-hosted business expense journal for a field IT services business.
Upload receipt photos, scan them with local OCR (Tesseract), categorize,
mark write-offs, group by project and export to CSV.

## Features

- **Receipt upload** — phone camera or gallery (separate buttons), drag &
  drop, or PDF (first page is rendered for OCR and previews via poppler)
- **Local OCR** — Tesseract runs inside the container (no cloud, no API keys);
  several preprocessing variants and page-segmentation modes are tried and
  the highest-confidence read wins; detects amount, date, time and vendor,
  everything editable before saving
- **Grouped timeline** — expenses are grouped into day cards with daily
  totals, separated by week dividers (with weekly totals) and, in the
  all-time view, month headers with monthly totals
- **Supporting evidence** — attach extra photos/PDFs to an expense
  (invoices, serial numbers, before/after shots); stored in the same
  `YY/MM/DD` layout and exported alongside the receipt path
- **Smart vendor field** — suggests previously used vendors as you type
  (most used first) and auto-fills the vendor's usual category and account;
  OCR does the same when it recognizes a known vendor
- **Category icons** — monochrome Lucide icon set (~2000 icons) with a
  searchable picker in Settings; icons are tinted with the category color
  and shown on the expense list
- **Expense fields** — amount (USD), date & time, category, account,
  write-off flag with percentage, vendor, note
- **Write-off policies per category** — full, partial-only (e.g. Meals 50%,
  Fuel 80%) or non-deductible; the right default is applied automatically
- **Prefilled categories** for field IT work (tools, hardware, fuel, travel,
  subcontractors, …) — fully editable in Settings
- **Groups** — tag expenses by project / client / trip; one expense can be in
  several groups; per-group totals
- **CSV export** — by month, week, year, custom range, group, category,
  account or write-off status; includes a totals row; opens cleanly in Excel
- **Dark theme** (default) with light-mode toggle
- **Receipt file layout** — photos are stored as `receipts/YY/MM/DD/…` based
  on the expense date; files move automatically if you edit the date
- **SQLite** — the whole state is one folder (`./data`), trivial to back up

## Quick start (Docker Compose on OMV)

```bash
git clone <this repo> journals
cd journals
docker compose up -d --build
```

> **Upgrading from the "field-expenses" days?** The compose service,
> image and container are now named `journals`. Before pulling this
> version run `docker compose down` (or `docker rm -f field-expenses`)
> so the old container releases port 3444, then
> `git pull && docker compose up -d --build`. The `./data` folder is
> untouched — nothing to migrate.

The app listens on **port 3444** on the host. To customize the port,
timezone or volumes, don't edit `docker-compose.yml` — create a
`docker-compose.override.yml` next to it (gitignored, merged
automatically by compose), e.g.:

```yaml
services:
  journals:
    ports: !override
      - "8080:3000"
    environment:
      - TZ=Europe/Kyiv
```

All data lives in `./data`:

```
data/
├── db/expenses.db          # SQLite database
└── receipts/26/07/13/…     # receipt photos, YY/MM/DD by expense date
```

Back up = copy the `data` folder.

## Nginx Proxy Manager (host network mode) + Tailscale

Because NPM runs with `network_mode: host`, it can reach the app directly on
the host loopback. Create a **Proxy Host**:

| Setting                | Value                                  |
| ---------------------- | -------------------------------------- |
| Domain name            | `expenses.your-domain.tld` (subdomain) |
| Scheme                 | `http`                                 |
| Forward host           | `127.0.0.1` (or the OMV LAN IP)        |
| Forward port           | `3444`                                 |
| Block common exploits  | on                                     |
| Websockets support     | not required                           |

Then point the subdomain's DNS at your Tailscale IP (or use Tailscale
MagicDNS / a split-horizon DNS entry), and access the app from any device in
your tailnet.

> **Note on security:** the app intentionally has no login — it relies on the
> network being private (Tailscale). Don't publish the subdomain to the open
> internet; if you ever need to, put an Access List on the NPM proxy host.

In NPM also raise the upload limit if you shoot large photos: add
`client_max_body_size 30m;` in the proxy host's *Advanced* tab.

## OCR languages

The image ships with English (`eng`) trained data. For Ukrainian receipts:

1. In `Dockerfile`, change the apt line to also install `tesseract-ocr-ukr`.
2. In `docker-compose.yml`, set `OCR_LANGS=eng+ukr`.
3. `docker compose up -d --build`

OCR is best-effort by design — every detected field is shown in the form for
review before saving.

## Local development

```bash
npm install
npm run dev            # http://localhost:3000
```

OCR in dev requires the `tesseract` binary on your machine
(`apt install tesseract-ocr` / `brew install tesseract`). Without it the app
still works — only the *Scan receipt* button reports OCR as unavailable.

Data is written to `./data` (configurable via the `DATA_DIR` env var).

## API overview

| Endpoint                    | Purpose                                    |
| --------------------------- | ------------------------------------------ |
| `GET/POST /api/expenses`    | list (with filters + stats) / create       |
| `GET/PUT/DELETE /api/expenses/:id` | single expense                      |
| `POST /api/ocr`             | receipt photo → detected fields            |
| `GET/POST /api/categories`, `PUT/DELETE /api/categories/:id` | categories |
| `GET/POST /api/accounts`, `PUT/DELETE /api/accounts/:id`     | accounts   |
| `GET/POST /api/groups`, `PUT/DELETE /api/groups/:id`         | groups     |
| `GET /api/export?…`         | CSV download (same filters as list)        |
| `GET /api/receipts/YY/MM/DD/file` | serve receipt images               |
| `GET /api/health`           | container healthcheck                      |

List filters: `from`, `to` (YYYY-MM-DD), `category_id`, `account_id`,
`group_id`, `write_off` (`yes`/`no`), `q` (vendor/note search).
