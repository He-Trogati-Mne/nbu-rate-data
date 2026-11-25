# NBU Rate Data

[![English](https://img.shields.io/badge/English-active-2563eb?style=for-the-badge)](README.md) [![Українська](https://img.shields.io/badge/%D0%A3%D0%BA%D1%80%D0%B0%D1%97%D0%BD%D1%81%D1%8C%D0%BA%D0%B0-yellow?style=for-the-badge)](README.uk.md)

[![Update data](https://github.com/He-Trogati-Mne/nbu-rate-data/actions/workflows/update.yml/badge.svg)](https://github.com/He-Trogati-Mne/nbu-rate-data/actions/workflows/update.yml)
[![Bank refresh](https://github.com/He-Trogati-Mne/nbu-rate-data/actions/workflows/update-banks.yml/badge.svg)](https://github.com/He-Trogati-Mne/nbu-rate-data/actions/workflows/update-banks.yml)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Core refresh](https://img.shields.io/badge/core%20refresh-30%20min-2563eb)](#update-schedule)
[![History](https://img.shields.io/badge/NBU%20history-since%202003-16a34a)](#nbu-history)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

An independent, public JSON dataset powering **NBU Rate** — a Ukrainian currency converter and financial information service. The repository collects exchange rates, bank quotes, cryptocurrency prices and stock market data using automated GitHub Actions workflows.

**[Website — nbu-rate.info](https://nbu-rate.info/)** · **[Web app source](https://github.com/He-Trogati-Mne/NBU-Rate)** · **[Data files](data/)** · **[Workflow runs](https://github.com/He-Trogati-Mne/nbu-rate-data/actions)**

> Незалежний проєкт з відкритими JSON-даними: офіційні курси НБУ, курси українських банків, криптовалюти, акції та історія котирувань. Не є офіційним сервісом НБУ або брокером.

## Overview

| Coverage | Description |
| --- | --- |
| Official exchange rates | National Bank of Ukraine (NBU) |
| Historical exchange rates | Available NBU records starting in 2003 |
| Bank rates | 48 configured bank sources, plus dedicated PrivatBank and monobank feeds |
| Cryptocurrencies | 25 configured assets, USD prices and daily historical snapshots |
| Stocks | 10 configured tickers across Ukrainian-linked and international companies |
| Infrastructure | Node.js, Playwright/Chromium, GitHub Actions and static JSON |

Coverage means configured sources, not guaranteed availability. Not all banks, coins or stocks necessarily return fresh data on every run.

## Datasets

| File | Upstream source | Scheduled refresh target |
| --- | --- | --- |
| [`nbu.json`](data/nbu.json) | [NBU public exchange API](https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json) | Every 30 min |
| [`nbu-history.json`](data/nbu-history.json) | [NBU historical exchange API](https://bank.gov.ua/NBU_Exchange/exchange_site) | Daily, incremental |
| [`privat.json`](data/privat.json) | [PrivatBank card rates API](https://api.privatbank.ua/p24api/pubinfo?exchange&json&coursid=11) | Every 30 min |
| [`mono.json`](data/mono.json) | [monobank public currency API](https://api.monobank.ua/bank/currency) | Every 30 min |
| `data/<bank-id>.json` | Official bank websites and public bank APIs | Hourly for selected banks; full scan daily |
| [`crypto.json`](data/crypto.json) | [CoinGecko](https://www.coingecko.com/en/api), [CryptoCompare](https://min-api.cryptocompare.com) | Prices every 30 min; deep history daily |
| [`stocks.json`](data/stocks.json) | Yahoo Finance chart endpoint (unofficial) | Every 30 min, best effort |
| [`whitebit.json`](data/whitebit.json) | [WhiteBIT ticker API](https://whitebit.com/api/v4/public/ticker) | Core/full refresh as configured |
| [`kuna.json`](data/kuna.json) | Legacy Kuna endpoints | Daily/manual, best effort |
| [`liqpay.json`](data/liqpay.json) | [LiqPay](https://www.liqpay.ua/) | Daily/manual, best effort |

All refresh intervals are targets, not service-level guarantees. A scheduled check does not imply that the upstream provider has published a new quote.

## Public JSON access

Use GitHub Raw for direct access or jsDelivr as a CDN alternative. These are static files, not a live trading API. Reading the public JSON files does not require an API key.

| Endpoint | Base URL |
| --- | --- |
| GitHub Raw | `https://raw.githubusercontent.com/He-Trogati-Mne/nbu-rate-data/main/data` |
| jsDelivr | `https://cdn.jsdelivr.net/gh/He-Trogati-Mne/nbu-rate-data@main/data` |

### JavaScript

```js
const BASE = 'https://raw.githubusercontent.com/He-Trogati-Mne/nbu-rate-data/main/data';

async function getDataset(file) {
  const response = await fetch(`${BASE}/${file}.json`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

const nbu = await getDataset('nbu');
const usd = nbu.data.find(row => row.cc === 'USD');
console.log(usd?.rate, usd?.exchangedate, nbu.updatedAt);

const bank = await getDataset('a-bank');
console.log(bank.data?.USD, bank.rateType);

const stocks = await getDataset('stocks');
console.log(stocks.data?.AAPL?.price, stocks.data?.AAPL?.asOf);
```

### Python

```python
import json
from urllib.request import urlopen

base = 'https://raw.githubusercontent.com/He-Trogati-Mne/nbu-rate-data/main/data'
with urlopen(f'{base}/nbu.json', timeout=15) as response:
    payload = json.load(response)

usd = next((row for row in payload['data'] if row['cc'] == 'USD'), None)
print(usd, payload['updatedAt'])
```

Both distribution endpoints can serve cached responses. Clients should validate schemas and timestamps before replacing newer local data, handle network failures, and avoid polling more frequently than needed. For a reproducible snapshot, use a specific commit SHA rather than the moving `main` branch.

## Data formats

Most market data files use an `updatedAt` timestamp and a `data` container. The container may be an array or an object; status reports have separate schemas. The following examples are illustrative, not live prices.

### NBU exchange rates

`data/nbu.json` contains an array of official NBU records:

```json
{
  "updatedAt": "2026-11-25T03:00:00.000Z",
  "data": [
    {"cc": "USD", "txt": "Долар США", "rate": 45.1, "exchangedate": "25.11.2026"}
  ]
}
```

`rate` is expressed in UAH. `exchangedate` is the date for which the rate applies; it is not the time the collector downloaded the file.

### NBU history

`data/nbu-history.json` stores dated records using ISO date keys:

```json
{
  "formatVersion": 2,
  "updatedAt": "2026-11-25T03:00:00.000Z",
  "data": {
    "2003-01-03": {"USD": 5.33, "EUR": 5.54},
    "2026-11-25": {"USD": 45.1, "EUR": 49.5}
  }
}
```

The collector normalizes historical rates per unit and appends new available dates. Coverage varies by currency and period; do not assume that every calendar day or currency is present. The dataset includes major currencies, other regional currencies, XDR and precious-metal codes XAU, XAG, XPT and XPD. For metal conversions, verify the upstream quotation unit.

### Bank rates

Bank data is collected from banks themselves, not from Minfin, Finance.ua or other bank-rate aggregators. Depending on the institution, the collector reads a public JSON endpoint, an HTML table, or a JavaScript-rendered public page using Playwright.

Dedicated JSON adapters are implemented for:

| Bank ID | Bank | Primary rate type |
| --- | --- | --- |
| `a-bank` | A-Bank | Cash; additional card data when available |
| `tas` | TASCOMBANK | Card |
| `procredit` | ProCredit Bank | Online/mobile |
| `sky` | Sky Bank | Cash (specified branch); additional card data when available |

The collector also has specialized page parsers for `sense`, `pravex`, `altbank`, `agroprosperis`, `clearing` and `credit-dnipro`. Other configured banks use the general bank collection logic. See [`scripts/fetch.js`](scripts/fetch.js) for source URLs and validation rules.

Example normalized bank snapshot (`data/a-bank.json`):

```json
{
  "updatedAt": "2026-11-25T03:00:00.000Z",
  "source": "a-bank.com.ua",
  "via": "api",
  "rateDate": "2026-11-25",
  "rateType": "cash",
  "data": {
    "USD": {"buy": 45.0, "sell": 45.7},
    "EUR": {"buy": 49.4, "sell": 50.2}
  },
  "ratesByType": {
    "card": {"USD": {"buy": 45.2, "sell": 45.62}}
  }
}
```

| Field | Meaning |
| --- | --- |
| `buy` / `sell` | Bank's buying and selling prices in UAH per currency unit |
| `source` | Upstream hostname |
| `via` | Collection method (`api`, `html`, `browser`) |
| `rateDate` | Publication/effective date, when identifiable |
| `rateType` | `cash`, `card` or `online`, when explicitly identified |
| `ratesByType` | Optional additional rate categories |
| `branch` | Optional office or branch name |

Older snapshots and generic parsers may not provide every metadata field. An absent `rateType` must not be interpreted automatically as cash or card. Rates may differ by branch and customer channel. USD, EUR, GBP and PLN are targeted by the normalized bank collector, subject to availability.

<details>
<summary>Configured bank IDs (48)</summary>

```text
oschad, pumb, raif, ukrsib, sense, ukrgas, ukrexim, pivdenny,
credit-agricole, globus, lviv, a-bank, kredo, otp, pravex, tas,
piraeus, idea, komin, alliance, poltava, polikom, ukrcapital,
krystal, bank34, grant, industrial, asvio, vostok, mtb, accord,
radabank, credit-dnipro, procredit, unex, altbank, universal, mib,
agroprosperis, avangard, bizbank, metabank, oksi, family,
trust-capital, clearing, pinbank, sky
```

PrivatBank (`privat`) and monobank (`mono`) use separate collectors and are not included in this 48-source list.

</details>

PrivatBank and monobank retain their provider-specific array formats:

```json
{"ccy": "USD", "base_ccy": "UAH", "buy": "45.00", "sale": "45.70"}
```

```json
{"currencyCodeA": 840, "currencyCodeB": 980, "rateBuy": 45.0, "rateSell": 45.7}
```

Numeric currency codes follow ISO 4217 (USD: 840, EUR: 978, UAH: 980). Some monobank pairs use a cross rate instead of a buy/sell pair.

### Cryptocurrencies

`data/crypto.json` combines USD market prices with accumulated dated price observations.

```json
{
  "updatedAt": "2026-11-25T03:00:00.000Z",
  "historyDate": "2026-11-25",
  "data": {
    "coins": [
      {
        "id": "bitcoin",
        "symbol": "BTC",
        "name": "Bitcoin",
        "price": 65000,
        "change24h": 1.5,
        "history": {"2026-11-24": 64000, "2026-11-25": 65000}
      }
    ]
  }
}
```

The fast collector retains existing daily history for returned assets, and the full collector attempts deeper backfill. The current day's observation can change during the day and should not be treated as a finalized daily closing price.

Configured assets: BTC, ETH, USDT, BNB, SOL, USDC, XRP, ADA, DOGE, AVAX, TRX, TON, LINK, DOT, LTC, SHIB, DAI, WBTC, UNI, NEAR, APT, ARB, OP, SUI, XLM.

WhiteBIT and legacy Kuna datasets contain ticker arrays when normalized, with fields such as `pair`, `last`, `buy`, `sell` and, where available, `vol`, `low`, `high`. Check the source-specific response before consuming legacy data. On complete Kuna failure, the collector retains any previous snapshot and writes `kuna-status.json`.

### Stocks

`data/stocks.json` contains historical daily prices keyed by provider ticker. The collector requests up to five years of daily observations and merges new records with previously saved history.

| Company | Ticker | Market |
| --- | --- | --- |
| Kyivstar | `KYIV` | US |
| MHP | `MHPC.L` | London |
| Ferrexpo | `FXPO.L` | London |
| Astarta | `AST.WA` | Warsaw |
| Apple | `AAPL` | US |
| Microsoft | `MSFT` | US |
| NVIDIA | `NVDA` | US |
| Alphabet | `GOOGL` | US |
| Tesla | `TSLA` | US |
| Amazon | `AMZN` | US |

```json
{
  "schemaVersion": 1,
  "updatedAt": "2026-11-25T03:00:00.000Z",
  "checkedAt": "2026-11-25T03:00:00.000Z",
  "source": "Yahoo Finance chart (unofficial, delayed)",
  "data": {
    "AAPL": {
      "price": 200.5,
      "currency": "USD",
      "exchange": "NMS",
      "asOf": "2026-11-24T21:00:00.000Z",
      "changePct": 0.25,
      "history": {"2026-11-23": 200, "2026-11-24": 200.5},
      "source": "Yahoo Finance chart (unofficial, delayed)"
    }
  }
}
```

`asOf` represents the timestamp of the last valid price observation. `changePct` is computed from the reference close supplied by the provider; it is not guaranteed to represent a verified one-day return. Preserve the supplied `currency` (including pence-denominated London quotes, if present). A failed request does not imply a zero price.

> Stock prices are best-effort, potentially delayed and obtained through an unofficial Yahoo Finance endpoint. They are not exchange-certified real-time quotes. For production trading or redistribution, review provider terms and use an appropriately licensed market data service.

## Update schedule

GitHub Actions uses UTC. The primary and bank workflows share a concurrency group to prevent simultaneous writes to the dataset.

| Workflow | Trigger | Tasks |
| --- | --- | --- |
| [`update.yml`](.github/workflows/update.yml) | `13,43 * * * *` | Core data and stocks; bank health report |
| `update.yml` | Manual dispatch | Core and stocks, full bank check, additional feeds and NBU history |
| [`update-banks.yml`](.github/workflows/update-banks.yml) | `29 * * * *` | Selected banks and health report |
| `update-banks.yml` | `47 2 * * *` | Selected banks, full collector and historical backfill |
| `update-banks.yml` | Manual dispatch | Selected banks; `deep=true` enables the full collector |
| [`bank-diagnostics.yml`](.github/workflows/bank-diagnostics.yml) | Manual dispatch | Inspect public bank sources and upload a diagnostic artifact |
| [`static.yml`](.github/workflows/static.yml) | Push to `main` / manual | GitHub Pages deployment |

The hourly selection is `asvio,a-bank,alliance,idea,komin,pumb`. Data-writing workflows commit changed files to `main` using the GitHub Actions bot. Scheduled jobs may be delayed or skipped by GitHub or fail because of upstream limits.

## Monitoring and data quality

| Report | Purpose |
| --- | --- |
| [`core-status.json`](data/core-status.json) | Core collector failures and successful check count |
| [`bank-fetch-status.json`](data/bank-fetch-status.json) | Full bank collection result and per-bank errors |
| [`selected-bank-status.json`](data/selected-bank-status.json) | Results for the hourly bank selection |
| [`bank-health.json`](data/bank-health.json) | Freshness and suspicious identical rates for six selected banks |
| [`stocks-status.json`](data/stocks-status.json) | Stock update count and per-ticker errors |
| `kuna-status.json` | Diagnostic attempts when legacy endpoints fail |
| `diagnostics/bank-api-report.json` | Manual diagnostic output, available as a workflow artifact |

- Collectors validate responses and try to preserve existing valid snapshots when a source fails.
- Dedicated bank adapters check valid currency pairs, plausible values, and source dates when available. General parsing has different validation requirements.
- Missing or stale rates must not be displayed as live data. Use source timestamps and reports together; `checkedAt` means an attempt was made, not that every quote is fresh.
- NBU reference rates can be used for validation, not as invented bank buy/sell values.
- Public bank sites may return HTTP 403, rate limits, changed page formats or timeouts. The collector does not use bank-rate aggregators and does not guarantee universal access.

## Repository structure

```text
nbu-rate-data/
├── .github/workflows/
│   ├── update.yml
│   ├── update-banks.yml
│   ├── bank-diagnostics.yml
│   └── static.yml
├── data/                         # Market snapshots and status reports
├── scripts/
│   ├── fetch.js                   # Full collector and bank adapters
│   ├── fetch-core.mjs             # Fast market refresh
│   ├── fetch-selected-banks.mjs   # Selected bank refresh
│   ├── fetch-stocks.mjs           # Stock prices and history
│   ├── bank-health.mjs            # Bank freshness checks
│   └── bank-diagnostics.mjs       # Public bank source diagnostics
├── LICENSE
├── README.md
└── README.uk.md
```

## Local development

Use Node.js **22**, matching the current GitHub Actions runtime. Install Playwright and Chromium for JavaScript-rendered bank pages and diagnostics.

```bash
git clone https://github.com/He-Trogati-Mne/nbu-rate-data.git
cd nbu-rate-data
npm install --no-save --no-package-lock playwright
npx playwright install chromium
```

On Linux, `npx playwright install --with-deps chromium` also installs required browser libraries.

| Command | Purpose |
| --- | --- |
| `node scripts/fetch-core.mjs` | Core market snapshots |
| `node scripts/fetch-stocks.mjs` | Stock snapshots and history |
| `node scripts/fetch-selected-banks.mjs` | Six-bank refresh |
| `node scripts/fetch.js` | Full legacy/main collector, including historical data; stocks are separate |
| `node scripts/bank-health.mjs` | Generate selected bank health status |
| `node scripts/bank-diagnostics.mjs` | Run bank diagnostics |

For a targeted run, use the environment variables supported by the main collector. Example for Bash:

```bash
NBU_FETCH_MODE=banks NBU_BANK_IDS=a-bank,sky node scripts/fetch.js
NBU_FETCH_MODE=extras node scripts/fetch.js
BANK_IDS=sky,ukrsib node scripts/bank-diagnostics.mjs
```

Windows PowerShell equivalent for a targeted bank run:

```powershell
$env:NBU_FETCH_MODE = 'banks'
$env:NBU_BANK_IDS = 'a-bank,sky'
node scripts/fetch.js
Remove-Item Env:NBU_FETCH_MODE, Env:NBU_BANK_IDS
```

`NBU_BANK_STATUS_FILE` optionally selects the bank status report filename under `data/`. `BANK_IDS` is the separate diagnostic filter; use `all` for the configured diagnostic set, not the entire bank registry. The diagnostic workflow uploads `bank-api-report` and does not publish its findings into the main data files.

## Contributing

If a bank changes its API or a quote looks incorrect, please [open an issue](https://github.com/He-Trogati-Mne/nbu-rate-data/issues/new) with the dataset filename, source URL, observed date, expected value and relevant status report. Do not include passwords, cookies, tokens or private account information.

Pull requests improving official source coverage, rate-type identification, schema validation, or reliability are welcome. Keep existing file names and consumer compatibility in mind.

## License and disclaimer

Repository code is released under the [MIT License](LICENSE). Third-party market data, bank quotes, trademarks and other provider content remain subject to their respective rights, terms of use and redistribution restrictions; the repository license does not grant additional rights to third-party data.

NBU Rate is an independent informational project, not affiliated with the National Bank of Ukraine, any bank, exchange or broker. Data may be delayed, incomplete or incorrect. Nothing in the dataset constitutes investment advice or an executable transaction quote. Verify rates and prices directly with the relevant institution before exchanging currency or trading.

---

Maintained by [He_Trogati_Mne](https://github.com/He-Trogati-Mne) · [nbu-rate.info](https://nbu-rate.info/)
