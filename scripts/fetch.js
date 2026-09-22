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

async function saveCrypto() {
    const ids = [
        'bitcoin', 'ethereum', 'tether', 'binancecoin', 'solana',
        'usd-coin', 'ripple', 'cardano', 'dogecoin', 'avalanche-2',
        'tron', 'the-open-network', 'chainlink', 'polkadot', 'litecoin'
    ].join(',');

    const coins = [];
    try {
        const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=true&price_change_percentage=24h`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();

        data.forEach(c => {
            const sparkline = c.sparkline_in_7d?.price || [];
            const daily = {};
            const now = Date.now();
            sparkline.forEach((price, i) => {
                const hoursAgo = sparkline.length - 1 - i;
                const date = new Date(now - hoursAgo * 60 * 60 * 1000);
                const iso = date.toISOString().slice(0, 10);
                if (!daily[iso]) daily[iso] = [];
                daily[iso].push(price);
            });
            const history = {};
            Object.keys(daily).sort().forEach(iso => {
                const arr = daily[iso];
                history[iso] = arr.reduce((a, b) => a + b, 0) / arr.length;
            });
            coins.push({
                id: c.id,
                symbol: (c.symbol || '').toUpperCase(),
                name: c.name,
                price: c.current_price,
                change24h: c.price_change_percentage_24h || 0,
                history
            });
        });
        console.log('OK crypto markets: ' + coins.length + ' coins');
    } catch (e) {
        console.error('FAIL crypto markets: ' + e.message);
    }

    // BTC — 1 год дневной истории
    let btcHistory = {};
    try {
        const url = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily';
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (res.ok) {
            const json = await res.json();
            (json.prices || []).forEach(([ts, price]) => {
                const iso = new Date(ts).toISOString().slice(0, 10);
                btcHistory[iso] = price;
            });
            console.log('OK crypto BTC 1y: ' + Object.keys(btcHistory).length + ' points');
        }
    } catch (e) { console.error('BTC history: ' + e.message); }

    const btc = coins.find(c => c.symbol === 'BTC');
    if (btc && Object.keys(btcHistory).length > 0) {
        btc.history = { ...btc.history, ...btcHistory };
    }

    await fs.writeFile(path.join('data', 'crypto.json'), JSON.stringify({
        updatedAt: new Date().toISOString(),
        data: { coins }
    }, null, 2));
    console.log('OK crypto.json (coins: ' + coins.length + ')');
}

await save('nbu',    'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
await save('privat', 'https://api.privatbank.ua/p24api/pubinfo?exchange&json&coursid=11');
await save('mono',   'https://api.monobank.ua/bank/currency');
await saveCrypto();

console.log('Done.');
