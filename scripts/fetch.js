import fs from 'node:fs/promises';
import path from 'node:path';

await fs.mkdir('data', { recursive: true });

async function save(name, url) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        await fs.writeFile(
            path.join('data', name + '.json'),
            JSON.stringify({ updatedAt: new Date().toISOString(), data }, null, 2)
        );
        console.log('OK ' + name);
    } catch (e) {
        console.error('FAIL ' + name + ': ' + e.message);
    }
}

await Promise.all([
    save('nbu',    'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json'),
    save('privat', 'https://api.privatbank.ua/p24api/pubinfo?exchange&json&coursid=11'),
    save('mono',   'https://api.monobank.ua/bank/currency'),
    save('liqpay', 'https://api.liqpay.ua/doc/api/public/exchange?json'),
    save('kuna',   'https://api.kuna.io/v4/markets/public/tickers?pairs=BTC_UAH')
]);

console.log('Done.');
