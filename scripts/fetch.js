import fs from 'node:fs/promises';
import path from 'node:path';

await fs.mkdir('data', { recursive: true });

async function save(name, url) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        await fs.writeFile(path.join('data', name + '.json'),
            JSON.stringify({ updatedAt: new Date().toISOString(), data }, null, 2));
        console.log('OK ' + name);
    } catch (e) {
        console.error('FAIL ' + name + ': ' + e.message);
    }
}

async function saveBitcoin() {
    const sources = [
        { url: 'https://whitebit.com/api/v4/public/ticker',
          parse: (d) => { const t = d.result?.BTC_USDT; return { price: +t.last_price, change: +t.change }; } },
        { url: 'https://api.coinlore.net/api/ticker/?id=90',
          parse: (d) => { const i = Array.isArray(d) ? d[0] : d; return { price: +i.price_usd, change: +i.percent_change_24h }; } },
        { url: 'https://api.coinpaprika.com/v1/tickers/btc-bitcoin',
          parse: (d) => ({ price: d.quotes.USD.price, change: d.quotes.USD.percent_change_24h }) }
    ];

    let ticker = null;
    for (const src of sources) {
        try {
            const res = await fetch(src.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            ticker = src.parse(await res.json());
            if (ticker.price) break;
        } catch (e) { console.error('  ' + src.url + ': ' + e.message); }
    }

    // 1 год истории от CoinGecko
    let history = {};
    try {
        const res = await fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (res.ok) {
            const json = await res.json();
            (json.prices || []).forEach(([ts, price]) => {
                const iso = new Date(ts).toISOString().slice(0, 10);
                history[iso] = { BTC: price };
            });
        }
    } catch (e) { console.error('  history: ' + e.message); }

    if (!ticker || !ticker.price) {
        console.error('FAIL kuna: no data');
        return;
    }

    await fs.writeFile(path.join('data', 'kuna.json'), JSON.stringify({
        updatedAt: new Date().toISOString(),
        data: { bitcoin: { uah: ticker.price, uah_24h_change: ticker.change }, history }
    }, null, 2));
    console.log('OK kuna (history points: ' + Object.keys(history).length + ')');
}

await save('nbu',    'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
await save('privat', 'https://api.privatbank.ua/p24api/pubinfo?exchange&json&coursid=11');
await save('mono',   'https://api.monobank.ua/bank/currency');
await saveBitcoin();

console.log('Done.');
