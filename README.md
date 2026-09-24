# nbu-rate-data

![Update rates](https://github.com/He-Trogati-Mne/nbu-rate-data/actions/workflows/update.yml/badge.svg)
![Datasets](https://img.shields.io/badge/datasets-8-informational)
![Refresh](https://img.shields.io/badge/refresh-30%20min-blue)
![History](https://img.shields.io/badge/history-2003%E2%80%93now-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

Public dataset with official NBU exchange rates, PrivatBank and MonoBank card
rates, crypto quotes with daily history, and Ukrainian exchange tickers.

Consumed by the [NBU Rate](https://github.com/He-Trogati-Mne/NBU-Rate) browser
extension and web app through jsDelivr CDN.

## Data files

| File | Source | Refresh |
| --- | --- | --- |
| `data/nbu.json` | [bank.gov.ua](https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json) | every 30 min |
| `data/nbu-history.json` | [bank.gov.ua](https://bank.gov.ua/NBU_Exchange/exchange_site) | incremental, full 2003+ history |
| `data/privat.json` | [api.privatbank.ua](https://api.privatbank.ua/p24api/pubinfo?exchange&json&coursid=11) | every 30 min |
| `data/mono.json` | [api.monobank.ua](https://api.monobank.ua/bank/currency) | every 30 min |
| `data/kuna.json` | [api.kuna.io](https://api.kuna.io/v3/tickers) | every 30 min |
| `data/whitebit.json` | [whitebit.com](https://whitebit.com/api/v4/public/ticker) | every 30 min |
| `data/liqpay.json` | [liqpay.ua](https://www.liqpay.ua/) | every 30 min, best-effort |
| `data/crypto.json` | [api.coingecko.com](https://www.coingecko.com/en/api) + [cryptocompare.com](https://min-api.cryptocompare.com) | prices 30 min, deep history daily |

## Schema

Every file shares a common envelope:

```json
{
  "updatedAt": "2026-09-24T12:00:00.000Z",
  "data": [ ]
}
```

Some files carry extra top-level fields, described below.

### nbu.json

Array of official NBU rates, refreshed multiple times a day:

```json
{
  "cc": "USD",
  "txt": "Долар США",
  "rate": 41.2345,
  "exchangedate": "24.09.2026"
}
```

### nbu-history.json

Full daily history from 2003-01-01 to today, keyed by ISO date. Every value is
normalised to a rate per 1 unit of currency (unlike the raw NBU API, which
sometimes returns rates per 100 units for fiat and per 1 for metals).

```json
{
  "formatVersion": 2,
  "updatedAt": "2026-09-24T...",
  "data": {
    "2003-01-03": { "USD": 5.33, "EUR": 5.54, "XAU": 6300.5 },
    "2003-01-06": { "USD": 5.33, "EUR": 5.55, "XAU": 6350.1 },
    "2026-09-24": { "USD": 41.23, "EUR": 48.11, "XAU": 193295.79 }
  }
}
```

Currencies covered (40 total): all majors, CEE, MENA, Asia-Pacific, plus XDR
and the four metals XAU, XAG, XPT, XPD.

### privat.json

Card rates from PrivatBank:

```json
{
  "ccy": "USD",
  "base_ccy": "UAH",
  "buy": "41.10",
  "sale": "41.65"
}
```

### mono.json

Card rates from MonoBank:

```json
{
  "currencyCodeA": 840,
  "currencyCodeB": 980,
  "rateBuy": 41.20,
  "rateSell": 41.60
}
```

`currencyCodeA` and `currencyCodeB` follow ISO 4217 numeric codes
(980 = UAH, 840 = USD, 978 = EUR).

### kuna.json

Normalised tickers from the Kuna exchange:

```json
{
  "pair": "btcuah",
  "last": 2680000,
  "low": 2650000,
  "high": 2700000,
  "vol": 12.4,
  "buy": 2675000,
  "sell": 2685000
}
```

If all endpoints fail, the file is replaced with a diagnostic snapshot listing
HTTP status codes and body previews of each attempt:

```json
{
  "error": "all endpoints failed",
  "attempts": [ { "tag": "v3+symbols", "status": 404, "ms": 120 } ],
  "data": []
}
```

### whitebit.json

Tickers from Whitebit, filtered to `_UAH`, `_USDT`, and `_BTC` pairs:

```json
{
  "pair": "BTC_UAH",
  "last": 2685000,
  "buy": 2680000,
  "sell": 2690000,
  "vol": 12.4
}
```

### liqpay.json

Best-effort snapshot of the LiqPay public rates widget. LiqPay does not publish
a documented rates API, so this file is not guaranteed to update on every run.
When the request fails, the previous snapshot is preserved.

### crypto.json

Object with a `coins` array. Each coin carries current quote and daily history:

```json
{
  "historyDate": "2026-09-24",
  "updatedAt": "2026-09-24T...",
  "data": {
    "coins": [
      {
        "id": "bitcoin",
        "symbol": "BTC",
        "name": "Bitcoin",
        "price": 63412.55,
        "change24h": 1.84,
        "history": {
          "2010-07-17": 0.05,
          "2010-07-18": 0.07,
          "2026-09-24": 63412.55
        }
      }
    ]
  }
}
```

25 coins are tracked: BTC, ETH, USDT, BNB, SOL, USDC, XRP, ADA, DOGE, AVAX,
TRX, TON, LINK, DOT, LTC, SHIB, DAI, WBTC, UNI, NEAR, APT, ARB, OP, SUI, XLM.

History is merged across runs, so it can grow past the CoinGecko 365-day
free-tier cap. Prices come from CoinGecko every 30 minutes. Deep history
(2000-day pages from CryptoCompare) is refreshed once per calendar day,
guarded by the top-level `historyDate` field.

## Consuming from a browser

```js
const BASE = 'https://cdn.jsdelivr.net/gh/He-Trogati-Mne/nbu-rate-data@latest/data';

const nbu = await fetch(`${BASE}/nbu.json`).then(r => r.json());
console.log(nbu.updatedAt, nbu.data.length);

const history = await fetch(`${BASE}/nbu-history.json`).then(r => r.json());
console.log(history.data['2003-01-03'].USD); // 5.33
```

Append `?t=<timestamp>` to bypass the jsDelivr edge cache when you need the
freshest possible copy. `raw.githubusercontent.com` never caches and can be
used as a fallback:

```js
const RAW = 'https://raw.githubusercontent.com/He-Trogati-Mne/nbu-rate-data/main/data';
```

## Local run

Requires Node.js 20 or newer. No API keys, no environment variables.

```bash
node scripts/fetch.js
```

## Automation

- `.github/workflows/update.yml` runs every 30 minutes. It executes
  `scripts/fetch.js`, commits changed files back to `main` as
  `github-actions[bot]`, and pushes. Manual dispatch is enabled.
- `.github/workflows/static.yml` publishes the repository via GitHub Pages.

## Rate limits

CoinGecko Demo plan allows 30 requests per minute and 10 000 per month. The
script stays well under the monthly cap:

- prices: 1 request per run, 48 runs per day
- deep history: 25 requests, once per calendar day

CryptoCompare free tier: 100 000 requests per month, unauthenticated. The
script uses 25 to 200 requests per day for deep history backfill.

## Data integrity

All data comes from official public APIs (NBU, PrivatBank, MonoBank, CoinGecko,
CryptoCompare, Kuna, Whitebit, LiqPay). No user data is collected, no
authentication is required. If you spot incorrect data, open an issue.

## License

Released under the MIT License. See [LICENSE](LICENSE) for details.
