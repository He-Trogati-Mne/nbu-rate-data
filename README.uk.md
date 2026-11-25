# NBU Rate Data

[![English](https://img.shields.io/badge/English-blue?style=for-the-badge)](README.md) [![Українська](https://img.shields.io/badge/%D0%A3%D0%BA%D1%80%D0%B0%D1%97%D0%BD%D1%81%D1%8C%D0%BA%D0%B0-%D0%B0%D0%BA%D1%82%D0%B8%D0%B2%D0%BD%D0%B0-facc15?style=for-the-badge)](README.uk.md)

[![Update data](https://github.com/He-Trogati-Mne/nbu-rate-data/actions/workflows/update.yml/badge.svg)](https://github.com/He-Trogati-Mne/nbu-rate-data/actions/workflows/update.yml)
[![Bank refresh](https://github.com/He-Trogati-Mne/nbu-rate-data/actions/workflows/update-banks.yml/badge.svg)](https://github.com/He-Trogati-Mne/nbu-rate-data/actions/workflows/update-banks.yml)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Core refresh](https://img.shields.io/badge/core%20refresh-30%20min-2563eb)](#розклад-оновлення)
[![History](https://img.shields.io/badge/NBU%20history-since%202003-16a34a)](#історія-курсів-нбу)
[![License](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

Незалежний публічний набір JSON-даних, на якому працює **NBU Rate** — український конвертер валют та інформаційний фінансовий сервіс. Репозиторій збирає курси валют, банківські котирування, ціни криптовалют і дані фондового ринку за допомогою автоматизованих процесів GitHub Actions.

**[Сайт — nbu-rate.info](https://nbu-rate.info/)** · **[Вихідний код вебзастосунку](https://github.com/He-Trogati-Mne/NBU-Rate)** · **[Файли даних](data/)** · **[Запуски GitHub Actions](https://github.com/He-Trogati-Mne/nbu-rate-data/actions)**

> Незалежний проєкт з відкритими JSON-даними: офіційні курси НБУ, курси українських банків, криптовалюти, акції та історія котирувань. Не є офіційним сервісом НБУ або брокером.

## Огляд

| Охоплення | Опис |
| --- | --- |
| Офіційні курси валют | Національний банк України (НБУ) |
| Історичні курси валют | Доступні записи НБУ починаючи з 2003 року |
| Курси банків | 48 налаштованих банківських джерел, а також окремі джерела ПриватБанку та monobank |
| Криптовалюти | 25 налаштованих активів, ціни в USD та щоденні історичні знімки |
| Акції | 10 налаштованих тикерів українських та міжнародних компаній |
| Інфраструктура | Node.js, Playwright/Chromium, GitHub Actions і статичні JSON-файли |

Охоплення означає кількість налаштованих джерел, а не гарантовану доступність. Не всі банки, криптовалюти чи акції обов’язково надають свіжі дані під час кожного запуску.

## Набори даних

| Файл | Первинне джерело | Запланована частота оновлення |
| --- | --- | --- |
| [`nbu.json`](data/nbu.json) | [Публічний API курсів НБУ](https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json) | Кожні 30 хв |
| [`nbu-history.json`](data/nbu-history.json) | [API історичних курсів НБУ](https://bank.gov.ua/NBU_Exchange/exchange_site) | Щодня, з додаванням нових записів |
| [`privat.json`](data/privat.json) | [API карткових курсів ПриватБанку](https://api.privatbank.ua/p24api/pubinfo?exchange&json&coursid=11) | Кожні 30 хв |
| [`mono.json`](data/mono.json) | [Публічний API валют monobank](https://api.monobank.ua/bank/currency) | Кожні 30 хв |
| `data/<bank-id>.json` | Офіційні сайти та публічні API банків | Вибрані банки — щогодини; повна перевірка — щодня |
| [`crypto.json`](data/crypto.json) | [CoinGecko](https://www.coingecko.com/en/api), [CryptoCompare](https://min-api.cryptocompare.com) | Ціни кожні 30 хв; повна історія щодня |
| [`stocks.json`](data/stocks.json) | Неофіційний endpoint графіків Yahoo Finance | Кожні 30 хв, за можливості |
| [`whitebit.json`](data/whitebit.json) | [API тикерів WhiteBIT](https://whitebit.com/api/v4/public/ticker) | Основне/повне оновлення за налаштуваннями |
| [`kuna.json`](data/kuna.json) | Застарілі endpoint-и Kuna | Щодня/вручну, за можливості |
| [`liqpay.json`](data/liqpay.json) | [LiqPay](https://www.liqpay.ua/) | Щодня/вручну, за можливості |

Усі інтервали оновлення є запланованими, а не гарантованим рівнем обслуговування. Запланована перевірка не означає, що постачальник опублікував нове котирування.

## Публічний доступ до JSON

Використовуйте GitHub Raw для прямого доступу або jsDelivr як альтернативний CDN. Це статичні файли, а не торговий API реального часу. Для читання публічних JSON-файлів ключ API не потрібен.

| Endpoint | Базова URL-адреса |
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

Обидва канали розповсюдження можуть повертати кешовані відповіді. Клієнтам варто перевіряти схеми й часові позначки перед заміною новіших локальних даних, обробляти мережеві помилки та не робити запити частіше, ніж потрібно. Для відтворюваного знімка використовуйте SHA конкретного коміту замість змінюваної гілки `main`.

## Формати даних

Більшість файлів ринкових даних містять часову позначку `updatedAt` та контейнер `data`. Контейнер може бути масивом або об’єктом; звіти про стан мають окремі схеми. Наведені нижче приклади ілюстративні й не є актуальними цінами.

### Курси валют НБУ

`data/nbu.json` містить масив офіційних записів НБУ:

```json
{
  "updatedAt": "2026-11-25T03:00:00.000Z",
  "data": [
    {"cc": "USD", "txt": "Долар США", "rate": 45.1, "exchangedate": "25.11.2026"}
  ]
}
```

`rate` виражено в гривнях. `exchangedate` — дата, на яку діє курс, а не час завантаження файлу збирачем.

### Історія курсів НБУ

`data/nbu-history.json` зберігає записи за датами у форматі ISO:

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

Збирач нормалізує історичні курси на одну одиницю та додає нові доступні дати. Охоплення залежить від валюти й періоду; не слід припускати наявність кожного календарного дня чи валюти. Набір містить основні та інші регіональні валюти, XDR і коди дорогоцінних металів XAU, XAG, XPT та XPD. Для конвертації металів перевіряйте одиницю котирування в первинному джерелі.

### Курси банків

Банківські дані збираються безпосередньо з джерел самих банків, а не з Мінфіну, Finance.ua чи інших агрегаторів банківських курсів. Залежно від установи збирач читає публічний JSON-endpoint, HTML-таблицю або публічну сторінку, відображену JavaScript за допомогою Playwright.

Окремі JSON-адаптери реалізовано для таких банків:

| ID банку | Банк | Основний тип курсу |
| --- | --- | --- |
| `a-bank` | А-Банк | Готівковий; додаткові карткові дані за наявності |
| `tas` | ТАСКОМБАНК | Картковий |
| `procredit` | ПроКредит Банк | Онлайн/мобільний |
| `sky` | Скай Банк | Готівковий (визначене відділення); додаткові карткові дані за наявності |

Збирач також містить спеціалізовані парсери сторінок для `sense`, `pravex`, `altbank`, `agroprosperis`, `clearing` і `credit-dnipro`. Решта налаштованих банків використовує загальну логіку збору. URL джерел і правила перевірки наведено у [`scripts/fetch.js`](scripts/fetch.js).

Приклад нормалізованого знімка банківських курсів (`data/a-bank.json`):

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

| Поле | Значення |
| --- | --- |
| `buy` / `sell` | Курси купівлі та продажу банком у гривнях за одиницю валюти |
| `source` | Ім’я хоста первинного джерела |
| `via` | Метод збору (`api`, `html`, `browser`) |
| `rateDate` | Дата публікації або дії курсу, якщо її визначено |
| `rateType` | `cash`, `card` або `online`, якщо тип явно визначено |
| `ratesByType` | Необов’язкові додаткові категорії курсів |
| `branch` | Необов’язкова назва офісу або відділення |

Старі знімки та загальні парсери можуть не містити всіх полів метаданих. Відсутність `rateType` не можна автоматично тлумачити як готівковий чи картковий курс. Курси можуть відрізнятися залежно від відділення та каналу обслуговування. Нормалізований збирач банківських курсів орієнтується на USD, EUR, GBP і PLN за їх наявності.

<details>
<summary>Налаштовані ID банків (48)</summary>

```text
oschad, pumb, raif, ukrsib, sense, ukrgas, ukrexim, pivdenny,
credit-agricole, globus, lviv, a-bank, kredo, otp, pravex, tas,
piraeus, idea, komin, alliance, poltava, polikom, ukrcapital,
krystal, bank34, grant, industrial, asvio, vostok, mtb, accord,
radabank, credit-dnipro, procredit, unex, altbank, universal, mib,
agroprosperis, avangard, bizbank, metabank, oksi, family,
trust-capital, clearing, pinbank, sky
```

ПриватБанк (`privat`) і monobank (`mono`) використовують окремі збирачі та не входять до цього списку з 48 джерел.

</details>

ПриватБанк і monobank зберігають власні формати масивів постачальників:

```json
{"ccy": "USD", "base_ccy": "UAH", "buy": "45.00", "sale": "45.70"}
```

```json
{"currencyCodeA": 840, "currencyCodeB": 980, "rateBuy": 45.0, "rateSell": 45.7}
```

Числові коди валют відповідають ISO 4217 (USD: 840, EUR: 978, UAH: 980). Деякі валютні пари monobank використовують крос-курс замість курсів купівлі та продажу.

### Криптовалюти

`data/crypto.json` поєднує ринкові ціни в USD з накопиченими спостереженнями за цінами за датами.

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

Швидкий збирач зберігає наявну щоденну історію для отриманих активів, а повний збирач намагається доповнити давніші записи. Спостереження за поточний день може змінюватися протягом дня, тому його не слід вважати остаточною ціною закриття.

Налаштовані активи: BTC, ETH, USDT, BNB, SOL, USDC, XRP, ADA, DOGE, AVAX, TRX, TON, LINK, DOT, LTC, SHIB, DAI, WBTC, UNI, NEAR, APT, ARB, OP, SUI, XLM.

Нормалізовані набори WhiteBIT та застарілий набір Kuna містять масиви тикерів із полями `pair`, `last`, `buy`, `sell` та, за наявності, `vol`, `low`, `high`. Перед використанням застарілих даних перевіряйте формат відповіді джерела. У разі повної відмови Kuna збирач зберігає попередній знімок, якщо він є, і записує `kuna-status.json`.

### Акції

`data/stocks.json` містить історичні щоденні ціни за тикерами постачальника. Збирач запитує до п’яти років щоденних спостережень і об’єднує нові записи з раніше збереженою історією.

| Компанія | Тикер | Ринок |
| --- | --- | --- |
| Київстар | `KYIV` | США |
| МХП | `MHPC.L` | Лондон |
| Ferrexpo | `FXPO.L` | Лондон |
| Астарта | `AST.WA` | Варшава |
| Apple | `AAPL` | США |
| Microsoft | `MSFT` | США |
| NVIDIA | `NVDA` | США |
| Alphabet | `GOOGL` | США |
| Tesla | `TSLA` | США |
| Amazon | `AMZN` | США |

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

`asOf` — час останнього дійсного спостереження ціни. `changePct` обчислюється відносно базової ціни закриття, наданої постачальником, і не гарантує перевіреної одноденної дохідності. Зберігайте вихідне значення `currency` (зокрема для лондонських котирувань у пенсах, якщо вони є). Невдалий запит не означає нульову ціну.

> Ціни акцій надаються за можливості, можуть бути затриманими та отримуються з неофіційного endpoint Yahoo Finance. Це не сертифіковані біржею котирування реального часу. Для реальної торгівлі чи повторного розповсюдження перевіряйте умови постачальника та використовуйте належно ліцензований сервіс ринкових даних.

## Розклад оновлення

GitHub Actions використовує UTC. Основний і банківський робочі процеси мають спільну групу паралельності, щоб уникнути одночасного запису до набору даних.

| Робочий процес | Тригер | Завдання |
| --- | --- | --- |
| [`update.yml`](.github/workflows/update.yml) | `13,43 * * * *` | Основні дані й акції; звіт про стан банків |
| `update.yml` | Ручний запуск | Основні дані й акції, повна перевірка банків, додаткові джерела та історія НБУ |
| [`update-banks.yml`](.github/workflows/update-banks.yml) | `29 * * * *` | Вибрані банки та звіт про їхній стан |
| `update-banks.yml` | `47 2 * * *` | Вибрані банки, повний збирач і доповнення історії |
| `update-banks.yml` | Ручний запуск | Вибрані банки; `deep=true` вмикає повний збирач |
| [`bank-diagnostics.yml`](.github/workflows/bank-diagnostics.yml) | Ручний запуск | Перевірка публічних джерел банків і завантаження діагностичного артефакту |
| [`static.yml`](.github/workflows/static.yml) | Push до `main` / вручну | Публікація GitHub Pages |

Щогодинна вибірка: `asvio,a-bank,alliance,idea,komin,pumb`. Робочі процеси запису даних фіксують змінені файли в `main` за допомогою бота GitHub Actions. Заплановані завдання можуть затримуватися, пропускатися GitHub або завершуватися помилками через обмеження джерел.

## Моніторинг та якість даних

| Звіт | Призначення |
| --- | --- |
| [`core-status.json`](data/core-status.json) | Помилки основного збирача та кількість успішних перевірок |
| [`bank-fetch-status.json`](data/bank-fetch-status.json) | Результат повного збору банківських курсів і помилки окремих банків |
| [`selected-bank-status.json`](data/selected-bank-status.json) | Результати щогодинної вибірки банків |
| [`bank-health.json`](data/bank-health.json) | Свіжість та підозрілі однакові курси шести вибраних банків |
| [`stocks-status.json`](data/stocks-status.json) | Кількість оновлених акцій і помилки окремих тикерів |
| `kuna-status.json` | Діагностичні спроби в разі відмови застарілих endpoint-ів |
| `diagnostics/bank-api-report.json` | Результат ручної діагностики, доступний як артефакт робочого процесу |

- Збирачі перевіряють відповіді й намагаються зберегти наявні дійсні знімки в разі відмови джерела.
- Окремі банківські адаптери перевіряють коректність валютних пар, правдоподібність значень та дати джерела за наявності. Загальний парсинг має інші вимоги до перевірки.
- Відсутні або застарілі курси не можна відображати як актуальні. Використовуйте часові позначки джерел разом зі звітами; `checkedAt` означає, що перевірка відбулася, а не те, що всі котирування свіжі.
- Довідкові курси НБУ можна використовувати для перевірки, але не для вигадування банківських курсів купівлі та продажу.
- Публічні сайти банків можуть повертати HTTP 403, обмежувати частоту запитів, змінювати формати сторінок або не відповідати вчасно. Збирач не використовує агрегатори банківських курсів і не гарантує універсального доступу.

## Структура репозиторію

```text
nbu-rate-data/
├── .github/workflows/
│   ├── update.yml
│   ├── update-banks.yml
│   ├── bank-diagnostics.yml
│   └── static.yml
├── data/                         # Знімки ринкових даних і звіти
├── scripts/
│   ├── fetch.js                   # Повний збирач і банківські адаптери
│   ├── fetch-core.mjs             # Швидке оновлення ринкових даних
│   ├── fetch-selected-banks.mjs   # Оновлення вибраних банків
│   ├── fetch-stocks.mjs           # Ціни акцій та історія
│   ├── bank-health.mjs            # Перевірка свіжості курсів банків
│   └── bank-diagnostics.mjs       # Діагностика публічних джерел банків
├── LICENSE
├── README.md
└── README.uk.md
```

## Локальна розробка

Використовуйте Node.js **22**, що відповідає поточному середовищу GitHub Actions. Установіть Playwright і Chromium для банківських сторінок, що відображаються JavaScript, та діагностики.

```bash
git clone https://github.com/He-Trogati-Mne/nbu-rate-data.git
cd nbu-rate-data
npm install --no-save --no-package-lock playwright
npx playwright install chromium
```

У Linux команда `npx playwright install --with-deps chromium` також установлює потрібні бібліотеки браузера.

| Команда | Призначення |
| --- | --- |
| `node scripts/fetch-core.mjs` | Основні знімки ринкових даних |
| `node scripts/fetch-stocks.mjs` | Знімки цін акцій та історія |
| `node scripts/fetch-selected-banks.mjs` | Оновлення шести банків |
| `node scripts/fetch.js` | Повний основний/попередній збирач, зокрема історичні дані; акції збираються окремо |
| `node scripts/bank-health.mjs` | Формування звіту про стан вибраних банків |
| `node scripts/bank-diagnostics.mjs` | Запуск діагностики банків |

Для цільового запуску використовуйте змінні середовища, які підтримує основний збирач. Приклад для Bash:

```bash
NBU_FETCH_MODE=banks NBU_BANK_IDS=a-bank,sky node scripts/fetch.js
NBU_FETCH_MODE=extras node scripts/fetch.js
BANK_IDS=sky,ukrsib node scripts/bank-diagnostics.mjs
```

Відповідний приклад для Windows PowerShell:

```powershell
$env:NBU_FETCH_MODE = 'banks'
$env:NBU_BANK_IDS = 'a-bank,sky'
node scripts/fetch.js
Remove-Item Env:NBU_FETCH_MODE, Env:NBU_BANK_IDS
```

`NBU_BANK_STATUS_FILE` дає змогу необов’язково вибрати назву файлу звіту про стан банків у `data/`. `BANK_IDS` — окремий фільтр діагностики; `all` означає весь налаштований діагностичний набір, а не повний реєстр банків. Діагностичний робочий процес завантажує артефакт `bank-api-report` і не публікує результати в основних файлах даних.

## Як долучитися

Якщо банк змінив API або котирування здається некоректним, будь ласка, [створіть issue](https://github.com/He-Trogati-Mne/nbu-rate-data/issues/new) із назвою файлу, URL джерела, датою спостереження, очікуваним значенням та відповідним звітом про стан. Не додавайте паролі, cookies, токени чи приватні дані облікового запису.

Вітаються pull request-и, що покращують охоплення офіційних джерел, визначення типів курсів, перевірку схем або надійність. Зберігайте наявні назви файлів і сумісність із клієнтами.

## Ліцензія та застереження

Код репозиторію поширюється за [ліцензією MIT](LICENSE). Сторонні ринкові дані, банківські котирування, торговельні марки та інший вміст постачальників регулюються відповідними правами, умовами використання й обмеженнями на розповсюдження; ліцензія репозиторію не надає додаткових прав на сторонні дані.

NBU Rate — незалежний інформаційний проєкт, не пов’язаний із Національним банком України, будь-яким банком, біржею чи брокером. Дані можуть бути затриманими, неповними або неточними. Жодна інформація набору даних не є інвестиційною порадою чи котируванням, за яким гарантовано можна здійснити операцію. Перед обміном валют або торгівлею перевіряйте курси та ціни безпосередньо у відповідній установі.

---

Підтримка проєкту: [He_Trogati_Mne](https://github.com/He-Trogati-Mne) · [nbu-rate.info](https://nbu-rate.info/)
