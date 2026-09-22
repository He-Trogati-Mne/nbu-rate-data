import fs from 'node:fs/promises';
import path from 'node:path';

await fs.mkdir('data', { recursive: true });

async function save(name, url) {
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.text(); // Для LiqPay (XML) и Kuna (JSON) будем брать текст
        await fs.writeFile(
            path.join('data', name + '.json'),
            JSON.stringify({ updatedAt: new Date().toISOString(), data }, null, 2)
        );
        console.log('OK ' + name);
    } catch (e) {
        console.error('FAIL ' + name + ': ' + e.message);
    }
}

// ... (конец функции save)

await save('nbu',    'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
await save('privat', 'https://api.privatbank.ua/p24api/pubinfo?exchange&json&coursid=11');
await save('mono',   'https://api.monobank.ua/bank/currency');

// LiqPay — официальный эндпоинт возвращает XML (парсим его на стороне сайта)
await save('liqpay', 'https://www.liqpay.ua/api/3/checkout/currency-exchange');

// Kuna — используем API v3, который точно работает (v4 часто отдаёт 404)
await save('kuna',   'https://api.kuna.io/v3/tickers?symbols=btcuah');

console.log('Done.');
