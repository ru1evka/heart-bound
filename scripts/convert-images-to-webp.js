/**
 * Конвертирует растровые изображения в uploads/ и assets/ в WebP
 * и обновляет пути в локальной data.db (если есть).
 *
 * Запуск: node scripts/convert-images-to-webp.js
 */
const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');
const { convertFileToWebp, webpUrl, RASTER_EXT } = require('../lib/image-optimize');

const ROOT = path.join(__dirname, '..');
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'data.db');
const DIRS = [
    path.join(ROOT, 'uploads'),
    path.join(ROOT, 'assets')
];

function walkRasterFiles(dir) {
    const found = [];
    if (!fs.existsSync(dir)) return found;
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (!fs.statSync(full).isFile()) continue;
        const ext = path.extname(name).toLowerCase();
        if (RASTER_EXT.has(ext)) found.push(full);
    }
    return found;
}

async function updateDatabase() {
    if (!fs.existsSync(DB_PATH)) {
        console.log('  (data.db не найдена — пропуск обновления БД)');
        return;
    }
    const db = createClient({ url: 'file:' + DB_PATH });
    const books = (await db.execute('SELECT id, cover FROM books')).rows;
    for (const row of books) {
        const next = webpUrl(row.cover);
        if (next && next !== row.cover) {
            await db.execute({ sql: 'UPDATE books SET cover = ? WHERE id = ?', args: [next, row.id] });
            console.log(`  book ${row.id}: ${row.cover} → ${next}`);
        }
    }
    const settings = (await db.execute("SELECT key, value FROM settings WHERE key = 'author_photo' OR key = 'qr_image'")).rows;
    for (const row of settings) {
        const next = webpUrl(row.value);
        if (next && next !== row.value) {
            await db.execute({ sql: 'UPDATE settings SET value = ? WHERE key = ?', args: [next, row.key] });
            console.log(`  setting ${row.key}: ${row.value} → ${next}`);
        }
    }
}

async function main() {
    console.log('\nКонвертация изображений в WebP...\n');
    let count = 0;
    for (const dir of DIRS) {
        for (const file of walkRasterFiles(dir)) {
            try {
                const out = await convertFileToWebp(file);
                console.log(`  ✓ ${path.relative(ROOT, file)} → ${path.basename(out)}`);
                count++;
            } catch (err) {
                console.error(`  ✗ ${file}: ${err.message}`);
            }
        }
    }
    await updateDatabase();
    console.log(`\nГотово: ${count} файл(ов) конвертировано.\n`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
