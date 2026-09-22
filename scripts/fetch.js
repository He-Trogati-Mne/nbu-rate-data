import fs from 'node:fs/promises';
import path from 'node:path';

await fs.mkdir('data', { recursive: true });

async function save(name, url, asText = false) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (nbu-rate-bot)' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = asText ? await res.text() : await res.json();
        await fs.writeFile(
            path.join('data', name + '.json'),
            JSON.stringify({ updatedAt: new Date().toISOString(), data }, null, 2)
        );
        console.log('OK ' + name);
        return true;
    } catch (e) {
        console.error('FAIL ' + name + ': ' + e.message);
        return false;
    }
}

// Попытка загрузить биткоин с разных источников
async function saveBitcoin() {
    const sources = [
        {
            url: 'https://whitebit.com/api/v4/public/ticker',
            parse: (data) => {
                const ticker = data.result?.BTC_USDT || data.result?.BTC_UAH;
                if (!ticker) throw new Error('No BTC ticker');
                return {
                    price: parseFloat(ticker.last_price || ticker.close),
                    change: parseFloat(ticker.change || 0)
                };
            }
        },
        {
            url: 'https://api.coinlore.net/api/ticker/?id=90',
            parse: (data) => {
                const item = Array.isArray(data) ? data[0] : data;
                if (!item) throw new Error('No data');
                return {
                    price: parseFloat(item.price_usd),
                    change: parseFloat(item.percent_change_24h || 0)
                };
            }
        },
        {
            url: 'https://api.coinpaprika.com/v1/tickers/btc-bitcoin',
            parse: (data) => {
                if (!data) throw new Error('No data');
                return {
                    price: data.quotes?.USD?.price || 0,
                    change: data.quotes?.USD?.percent_change_24h || 0
                };
            }
        }
    ];

    for (const src of sources) {
        try {
            const res = await fetch(src.url, { headers: { 'User-Agent': 'Mozilla/5.0 (nbu-rate-bot)' } });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const raw = await res.json();
            const parsed = src.parse(raw);
            await fs.writeFile(
                path.join('data', 'kuna.json'),
                JSON.stringify({
                    updatedAt: new Date().toISOString(),
                    data: { bitcoin: { uah: parsed.price, uah_24h_change: parsed.change } }
                }, null, 2)
            );
            console.log('OK kuna (via ' + src.url + ')');
            return;
        } catch (e) {
            console.error('FAIL kuna (' + src.url + '): ' + e.message);
        }
    }
    console.error('FAIL kuna: all sources failed');
}

// НБУ
await save('nbu', 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');

// ПриватБанк
await save('privat', 'https://api.privatbank.ua/p24api/pubinfo?exchange&json&coursid=11');

// МоноБанк
await save('mono', 'https://api.monobank.ua/bank/currency');

// LiqPay (XML)
await save('liqpay', 'https://www.liqpay.ua/api/3/checkout/currency-exchange', true);

// Биткоин — с резервными источниками
await saveBitcoin();

console.log('Done.');
