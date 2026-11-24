// Вибіркова перевірка шести банків із загального збирача.
// Застосовуються лише офіційні адреси, старі JSON не видаляються.
process.env.NBU_FETCH_MODE = 'banks';
process.env.NBU_BANK_IDS = 'asvio,a-bank,alliance,idea,komin,pumb';
process.env.NBU_BANK_STATUS_FILE = 'selected-bank-status.json';
await import('./fetch.js');
