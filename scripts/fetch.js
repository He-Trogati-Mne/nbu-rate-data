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

    let coins = [];
    try {
        const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=false&price_change_percentage=24h`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
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

    for (const coin of coins) {
        try {
            const url = `https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=365&interval=daily`;
            const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const json = await res.json();
            (json.prices || []).forEach(([ts, price]) => {
                const iso = new Date(ts).toISOString().slice(0, 10);
                coin.history[iso] = price;
            });
            console.log('  ' + coin.symbol + ': ' + Object.keys(coin.history).length + ' pts');
        } catch (e) {
            console.error('  ' + coin.symbol + ': ' + e.message);
        }

        await new Promise(r => setTimeout(r, 1500));
    }

    await fs.writeFile(path.join('data', 'crypto.json'), JSON.stringify({
        updatedAt: new Date().toISOString(),
        data: { coins }
    }, null, 2));
    console.log('OK crypto.json (total ' + coins.length + ' coins)');
}

await save('nbu',    'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
await save('privat', 'https://api.privatbank.ua/p24api/pubinfo?exchange&json&coursid=11');
await save('mono',   'https://api.monobank.ua/bank/currency');
await saveCrypto();

console.log('Done.');
