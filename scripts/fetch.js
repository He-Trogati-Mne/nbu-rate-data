import fs from 'node:fs/promises';
import path from 'node:path';

await fs.mkdir('data', { recursive: true });

async function save(name, url) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (nbu-rate-bot)' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        await fs.writeFile(path.join('data', name + '.json'),
            JSON.stringify({ updatedAt: new Date().toISOString(), data }, null, 2));
        console.log('OK ' + name);
    } catch (e) {
        console.error('FAIL ' + name + ': ' + e.message);
    }
}

async function fetchWithRetry(url, retries = 4) {
    let delay = 4000;
    for (let i = 0; i < retries; i++) {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (nbu-rate-bot)' } });
        if (res.status === 429) {
            console.log('    429 → wait ' + (delay / 1000) + 's, retry ' + (i + 1) + '/' + retries);
            await new Promise(r => setTimeout(r, delay));
            delay *= 1.6;
            continue;
        }
        return res;
    }
    return null;
}

async function saveCrypto() {
    const IDS = [
        'bitcoin', 'ethereum', 'tether', 'binancecoin', 'solana',
        'usd-coin', 'ripple', 'cardano', 'dogecoin', 'avalanche-2',
        'tron', 'the-open-network', 'chainlink', 'polkadot', 'litecoin'
    ];

    let coins = [];
    try {
        const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${IDS.join(',')}&sparkline=true&price_change_percentage=24h`;
        const res = await fetchWithRetry(url);
        if (!res || !res.ok) throw new Error('Cannot fetch prices');
        const data = await res.json();

        coins = data.map(c => {
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

            return {
                id: c.id,
                symbol: (c.symbol || '').toUpperCase(),
                name: c.name,
                price: c.current_price,
                change24h: c.price_change_percentage_24h || 0,
                history
            };
        });
        console.log('OK prices + 7d fallback: ' + coins.length + ' coins');
    } catch (e) {
        console.error('FAIL prices: ' + e.message);
        return;
    }

    for (const coin of coins) {
        try {
            const url = `https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=365&interval=daily`;
            const res = await fetchWithRetry(url, 3);

            if (!res || !res.ok) {
                console.log('  ' + coin.symbol + ': 365d fail → оставляю 7d (' + Object.keys(coin.history).length + ' pts)');
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }

            const json = await res.json();
            const prices = json.prices || [];

            if (prices.length < 2) {
                console.log('  ' + coin.symbol + ': пусто → оставляю 7d (' + Object.keys(coin.history).length + ' pts)');
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }

            prices.forEach(([ts, price]) => {
                const iso = new Date(ts).toISOString().slice(0, 10);
                coin.history[iso] = price;
            });
            console.log('OK ' + coin.symbol + ': ' + Object.keys(coin.history).length + ' pts');
        } catch (e) {
            console.log('  ' + coin.symbol + ': ошибка → оставляю 7d (' + Object.keys(coin.history).length + ' pts)');
        }
        await new Promise(r => setTimeout(r, 2200));
    }

    await fs.writeFile(path.join('data', 'crypto.json'), JSON.stringify({
        updatedAt: new Date().toISOString(),
        data: { coins }
    }, null, 2));
    console.log('OK crypto.json (' + coins.length + ' coins)');
}

await save('nbu',    'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
await save('privat', 'https://api.privatbank.ua/p24api/pubinfo?exchange&json&coursid=11');
await save('mono',   'https://api.monobank.ua/bank/currency');
await saveCrypto();

console.log('Done.');

console.log('Done.');
