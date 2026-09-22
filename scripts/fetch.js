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

// Запрос с retry на 429
async function fetchWithRetry(url, retries = 3) {
    let delay = 5000;
    for (let i = 0; i < retries; i++) {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (nbu-rate-bot)' } });
        if (res.status === 429) {
            console.log('   429 → wait ' + (delay / 1000) + 's, retry ' + (i + 1) + '/' + retries);
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
            continue;
        }
        return res;
    }
    return null;
}

async function saveCrypto() {
    const IDs = [
        'bitcoin', 'ethereum', 'tether', 'binancecoin', 'solana',
        'usd-coin', 'ripple', 'cardano', 'dogecoin', 'avalanche-2',
        'tron', 'the-open-network', 'chainlink', 'polkadot', 'litecoin'
    ];

    // ==== 1. Текущие цены (один запрос) ====
    let coins = [];
    try {
        const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${IDs.join(',')}&sparkline=false&price_change_percentage=24h`;
        const res = await fetchWithRetry(url);
        if (!res || !res.ok) throw new Error('Cannot fetch prices');
        const data = await res.json();
        coins = data.map(c => ({
            id: c.id,
            symbol: (c.symbol || '').toUpperCase(),
            name: c.name,
            price: c.current_price,
            change24h: c.price_change_percentage_24h || 0,
            history: {}
        }));
        console.log('OK prices: ' + coins.length + ' coins');
    } catch (e) {
        console.error('FAIL prices: ' + e.message);
        return;
    }

    // ==== 2. BTC — приоритетно, отдельным запросом ====
    const btc = coins.find(c => c.symbol === 'BTC');
    if (btc) {
        try {
            const url = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily';
            const res = await fetchWithRetry(url);
            if (res && res.ok) {
                const json = await res.json();
                (json.prices || []).forEach(([ts, price]) => {
                    const iso = new Date(ts).toISOString().slice(0, 10);
                    btc.history[iso] = price;
                });
                console.log('OK BTC: ' + Object.keys(btc.history).length + ' pts');
            } else {
                console.log('SKIP BTC history');
            }
        } catch (e) {
            console.log('SKIP BTC history: ' + e.message);
        }
        await new Promise(r => setTimeout(r, 2500));
    }

    // ==== 3. Остальные монеты — по одной с паузой ====
    for (const coin of coins) {
        if (coin.symbol === 'BTC') continue; // уже сделали

        try {
            const url = `https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=365&interval=daily`;
            const res = await fetchWithRetry(url, 3);
            if (!res || !res.ok) {
                console.log('SKIP ' + coin.symbol + ' history');
                await new Promise(r => setTimeout(r, 3000));
                continue;
            }
            const json = await res.json();
            (json.prices || []).forEach(([ts, price]) => {
                const iso = new Date(ts).toISOString().slice(0, 10);
                coin.history[iso] = price;
            });
            console.log('OK ' + coin.symbol + ': ' + Object.keys(coin.history).length + ' pts');
        } catch (e) {
            console.log('SKIP ' + coin.symbol + ': ' + e.message);
        }
        await new Promise(r => setTimeout(r, 2500));
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
