const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { createClient } = require('@libsql/client');

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ===== Настройки авторизации =====
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'romance2026';
const SESSION_TTL = 24 * 60 * 60 * 1000;
const sessions = new Map();

// ===== Создаём папку для загрузок =====
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ===== Multer =====
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const name = Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8) + ext;
        cb(null, name);
    }
});
const fileFilter = (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.mp4', '.webm'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });

// ===== База данных (libSQL — работает и локально, и с Turso) =====
let db;
let dbReady = false;

function createDB() {
    // Если TURSO_URL задан — подключаемся к облачной БД Turso
    // Иначе — используем локальный файл SQLite
    if (process.env.TURSO_URL) {
        db = createClient({
            url: process.env.TURSO_URL,
            authToken: process.env.TURSO_AUTH_TOKEN || ''
        });
        console.log('  ✓ Подключение к Turso:', process.env.TURSO_URL);
    } else {
        db = createClient({ url: 'file:' + DB_PATH });
        console.log('  ✓ Локальная БД:', DB_PATH);
    }
}

async function initDB() {
    try {
        createDB();

        // Создаём таблицы
        await db.execute(`CREATE TABLE IF NOT EXISTS books (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            genre TEXT DEFAULT '',
            badge TEXT DEFAULT '',
            description TEXT DEFAULT '',
            prologue TEXT DEFAULT '',
            litnet TEXT DEFAULT '',
            litgorod TEXT DEFAULT '',
            litres TEXT DEFAULT '',
            btn_type TEXT DEFAULT 'buy',
            cover TEXT DEFAULT '',
            color TEXT DEFAULT '#9a3f55',
            sort_order INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        )`);

        await db.execute(`CREATE TABLE IF NOT EXISTS posts (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            date TEXT DEFAULT '',
            content TEXT DEFAULT '',
            link TEXT DEFAULT '#',
            created_at TEXT DEFAULT (datetime('now'))
        )`);

        await db.execute(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT DEFAULT ''
        )`);

        // Миграции для существующих БД
        const migrations = [
            `ALTER TABLE books ADD COLUMN litres TEXT DEFAULT ''`,
            `ALTER TABLE books ADD COLUMN btn_type TEXT DEFAULT 'buy'`
        ];
        for (const sql of migrations) {
            try { await db.execute(sql); } catch (e) { /* уже есть */ }
        }

        // Seed если пусто
        const bookCount = (await db.execute('SELECT COUNT(*) as c FROM books')).rows[0].c;
        if (bookCount === 0) await seedBooks();

        const postCount = (await db.execute('SELECT COUNT(*) as c FROM posts')).rows[0].c;
        if (postCount === 0) await seedPosts();

        const settingsCount = (await db.execute('SELECT COUNT(*) as c FROM settings')).rows[0].c;
        if (settingsCount === 0) await seedSettings();

        // Добавляем новые настройки если их нет
        const newSettings = ['social_dzen', 'platform_litres', 'author_name', 'author_text1', 'author_text2', 'author_photo'];
        for (const key of newSettings) {
            await db.execute({ sql: `INSERT OR IGNORE INTO settings (key, value) VALUES (?, '')`, args: [key] });
        }

        dbReady = true;
        console.log('  ✓ БД инициализирована');
    } catch (err) {
        console.error('  ✗ Ошибка инициализации БД:', err.message);
    }
}

async function seedBooks() {
    const books = [
        { id: '1', title: 'Шёпот зимних роз', genre: 'Современный роман · Драма', badge: 'Новинка', description: 'Она искала тишину в заснеженном поместье. Он принёс с собой бурю.', prologue: 'Снег падал так тихо, что казалось — вселенная задержала дыхание...', litnet: '', litgorod: '', litres: '', btn_type: 'buy', cover: 'assets/book1.jpg.svg', color: '#1a2440', sort_order: 1 },
        { id: '2', title: 'Под светом южных звёзд', genre: 'Романтика · Путешествия', badge: 'Бестселлер', description: 'Случайная встреча в Лиссабоне, которая изменила всё.', prologue: 'Лиссабон встретил её ароматом моря и кофе...', litnet: '', litgorod: '', litres: '', btn_type: 'buy', cover: 'assets/book2.jpg.svg', color: '#ff8a5b', sort_order: 2 },
        { id: '3', title: 'Письма, которых не было', genre: 'Исторический роман', badge: '', description: 'Сто лет молчания и одно признание.', prologue: 'В пыльном чердаке бабушкиного дома Аня нашла шкатулку...', litnet: '', litgorod: '', litres: '', btn_type: 'buy', cover: 'assets/book3.jpg.svg', color: '#3a2818', sort_order: 3 },
        { id: '4', title: 'Танец на грани рассвета', genre: 'Городское фэнтези · Любовь', badge: 'Скоро', description: 'Между двумя мирами стоит лишь её сердце.', prologue: 'Город никогда не спал...', litnet: '', litgorod: '', litres: '', btn_type: 'buy', cover: 'assets/book4.jpg.svg', color: '#0a0a2a', sort_order: 4 }
    ];
    for (const b of books) {
        await db.execute({ sql: `INSERT INTO books (id, title, genre, badge, description, prologue, litnet, litgorod, litres, btn_type, cover, color, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, args: [b.id, b.title, b.genre, b.badge, b.description, b.prologue, b.litnet, b.litgorod, b.litres, b.btn_type, b.cover, b.color, b.sort_order] });
    }
}

async function seedPosts() {
    const posts = [
        { id: '1', title: 'Как рождалась героиня', date: '2026-05-12', content: 'Иногда персонаж сам стучится в дверь...', link: '#' },
        { id: '2', title: 'Лиссабон, который вы не знали', date: '2026-04-28', content: 'Маленькие улочки, синяя плитка азулежу...', link: '#' },
        { id: '3', title: 'Плейлист для романтических вечеров', date: '2026-04-05', content: 'Музыка, под которую пишутся самые трогательные сцены.', link: '#' }
    ];
    for (const p of posts) {
        await db.execute({ sql: `INSERT INTO posts (id, title, date, content, link) VALUES (?, ?, ?, ?, ?)`, args: [p.id, p.title, p.date, p.content, p.link] });
    }
}

async function seedSettings() {
    const defaults = {
        social_telegram: 'https://t.me/RenaRud', social_vk: '', social_instagram: '', social_youtube: '', social_tiktok: '', social_dzen: '',
        telegram_channel: 'https://t.me/RenaRud', telegram_username: '@RenaRud', qr_image: '',
        platform_litnet: 'https://litnet.com/ru/rena-rud-u3659590', platform_litgorod: 'https://litgorod.ru/profile/680841/books', platform_litres: '',
        contact_email: '', author_name: 'Рена Руд',
        author_text1: 'Мой писательский путь начался чуть больше года назад.',
        author_text2: 'Пишу молодёжные, современные и женские романы с уклоном в драму.',
        author_photo: 'assets/avatar_2_kopia.png'
    };
    for (const [key, value] of Object.entries(defaults)) {
        await db.execute({ sql: `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`, args: [key, value] });
    }
}

// ===== Express =====
const app = express();
app.use(express.json());

// ===== Health check =====
app.get('/api/health', (req, res) => {
    res.json({ status: dbReady ? 'ok' : 'starting', uptime: Math.floor(process.uptime()) });
});

// ===== No-cache для API =====
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    next();
});

// ===== Middleware =====
function requireDB(req, res, next) {
    if (!dbReady) return res.status(503).json({ error: 'Сервер запускается...' });
    next();
}

function parseCookies(req) {
    const cookies = {};
    (req.headers.cookie || '').split(';').forEach(c => { const [k, ...v] = c.trim().split('='); if (k) cookies[k] = v.join('='); });
    return cookies;
}

function getToken(req) {
    return req.headers['authorization']?.replace('Bearer ', '') || req.query.token || parseCookies(req)['admin_token'];
}

function isAuthenticated(req) {
    const token = getToken(req);
    if (!token || !sessions.has(token)) return false;
    if (Date.now() > sessions.get(token).expires) { sessions.delete(token); return false; }
    return true;
}

function authMiddleware(req, res, next) {
    if (!isAuthenticated(req)) return res.status(401).json({ error: 'Unauthorized' });
    next();
}

// ===== Auth API =====
app.post('/api/auth/login', (req, res) => {
    const { login, password } = req.body || {};
    if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
        const token = crypto.randomBytes(48).toString('hex');
        sessions.set(token, { expires: Date.now() + SESSION_TTL });
        for (const [t, s] of sessions) { if (Date.now() > s.expires) sessions.delete(t); }
        res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL / 1000)}`);
        return res.json({ success: true, token });
    }
    res.status(401).json({ error: 'Неверный логин или пароль' });
});

app.get('/api/auth/check', (req, res) => { res.json({ authenticated: isAuthenticated(req) }); });

app.post('/api/auth/logout', (req, res) => {
    const token = parseCookies(req)['admin_token'];
    if (token) sessions.delete(token);
    res.setHeader('Set-Cookie', 'admin_token=; Path=/; HttpOnly; Max-Age=0');
    res.json({ success: true });
});

// ===== Защита админки =====
app.get('/admin.html', (req, res, next) => {
    if (isAuthenticated(req)) return next();
    res.sendFile(path.join(__dirname, 'login.html'));
});

// ===== Статика =====
app.use(express.static(__dirname, {
    etag: true, lastModified: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) { res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); }
        else if (filePath.endsWith('.css') || filePath.endsWith('.js')) { res.setHeader('Cache-Control', 'no-cache, must-revalidate'); }
        else if (/\.(jpg|jpeg|png|gif|svg|webp|mp4|webm|ico)$/i.test(filePath)) { res.setHeader('Cache-Control', 'public, max-age=86400'); }
    }
}));

// ===== API: Книги =====
app.get('/api/books', requireDB, async (req, res) => {
    try {
        const result = await db.execute('SELECT * FROM books ORDER BY sort_order ASC, created_at ASC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/books/:id', requireDB, async (req, res) => {
    try {
        const result = await db.execute({ sql: 'SELECT * FROM books WHERE id = ?', args: [req.params.id] });
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/books', authMiddleware, requireDB, async (req, res) => {
    try {
        const { title, genre, badge, description, prologue, litnet, litgorod, litres, btn_type, cover, color } = req.body;
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        const maxResult = await db.execute('SELECT MAX(sort_order) as m FROM books');
        const maxOrder = maxResult.rows[0]?.m || 0;
        await db.execute({ sql: `INSERT INTO books (id, title, genre, badge, description, prologue, litnet, litgorod, litres, btn_type, cover, color, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [id, title||'', genre||'', badge||'', description||'', prologue||'', litnet||'', litgorod||'', litres||'', btn_type||'buy', cover||'', color||'#9a3f55', maxOrder+1] });
        res.json({ id, success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/books/:id', authMiddleware, requireDB, async (req, res) => {
    try {
        const { title, genre, badge, description, prologue, litnet, litgorod, litres, btn_type, cover, color } = req.body;
        const cur = (await db.execute({ sql: 'SELECT * FROM books WHERE id = ?', args: [req.params.id] })).rows[0];
        if (!cur) return res.status(404).json({ error: 'Not found' });
        await db.execute({ sql: `UPDATE books SET title=?, genre=?, badge=?, description=?, prologue=?, litnet=?, litgorod=?, litres=?, btn_type=?, cover=?, color=? WHERE id=?`,
            args: [title!==undefined?title:cur.title, genre!==undefined?genre:cur.genre, badge!==undefined?badge:cur.badge, description!==undefined?description:cur.description, prologue!==undefined?prologue:cur.prologue, litnet!==undefined?litnet:cur.litnet, litgorod!==undefined?litgorod:cur.litgorod, litres!==undefined?litres:cur.litres, btn_type!==undefined?btn_type:(cur.btn_type||'buy'), cover!==undefined?cover:cur.cover, color!==undefined?color:(cur.color||'#9a3f55'), req.params.id] });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/books/:id', authMiddleware, requireDB, async (req, res) => {
    try {
        await db.execute({ sql: 'DELETE FROM books WHERE id = ?', args: [req.params.id] });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== API: Посты =====
app.get('/api/posts', requireDB, async (req, res) => {
    try {
        const result = await db.execute('SELECT * FROM posts ORDER BY date DESC, created_at DESC');
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/posts/:id', requireDB, async (req, res) => {
    try {
        const result = await db.execute({ sql: 'SELECT * FROM posts WHERE id = ?', args: [req.params.id] });
        if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/posts', authMiddleware, requireDB, async (req, res) => {
    try {
        const { title, date, content, link } = req.body;
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        await db.execute({ sql: `INSERT INTO posts (id, title, date, content, link) VALUES (?, ?, ?, ?, ?)`,
            args: [id, title||'', date||new Date().toISOString().slice(0,10), content||'', link||'#'] });
        res.json({ id, success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/posts/:id', authMiddleware, requireDB, async (req, res) => {
    try {
        const { title, date, content, link } = req.body;
        await db.execute({ sql: `UPDATE posts SET title=?, date=?, content=?, link=? WHERE id=?`,
            args: [title||'', date||'', content||'', link||'#', req.params.id] });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/posts/:id', authMiddleware, requireDB, async (req, res) => {
    try {
        await db.execute({ sql: 'DELETE FROM posts WHERE id = ?', args: [req.params.id] });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== API: Настройки =====
app.get('/api/settings', requireDB, async (req, res) => {
    try {
        const result = await db.execute('SELECT key, value FROM settings');
        const settings = {};
        result.rows.forEach(r => { settings[r.key] = r.value; });
        res.json(settings);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/settings', authMiddleware, requireDB, async (req, res) => {
    try {
        const settings = req.body;
        for (const [key, value] of Object.entries(settings)) {
            await db.execute({ sql: `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, args: [key, value || ''] });
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== API: Загрузка файлов =====
app.post('/api/upload', authMiddleware, (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) return res.status(400).json({ error: err.message || 'Ошибка загрузки' });
        if (!req.file) return res.status(400).json({ error: 'Файл не выбран' });
        res.json({ success: true, url: '/uploads/' + req.file.filename, filename: req.file.filename });
    });
});

app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

app.delete('/api/upload/:filename', authMiddleware, (req, res) => {
    const filepath = path.join(UPLOADS_DIR, req.params.filename);
    if (!filepath.startsWith(UPLOADS_DIR)) return res.status(400).json({ error: 'Недопустимый путь' });
    try { if (fs.existsSync(filepath)) fs.unlinkSync(filepath); res.json({ success: true }); }
    catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== Обработка ошибок =====
app.use((err, req, res, next) => { console.error('Error:', err.message); res.status(500).json({ error: 'Внутренняя ошибка' }); });
process.on('uncaughtException', (err) => { console.error('UNCAUGHT:', err.message); });
process.on('unhandledRejection', (reason) => { console.error('UNHANDLED:', reason); });

// ===== Keep-alive =====
function keepAlive() {
    if (!IS_PRODUCTION) return;
    const url = process.env.RENDER_EXTERNAL_URL;
    if (!url) return;
    setInterval(() => {
        const client = url.startsWith('https') ? require('https') : require('http');
        client.get(`${url}/api/health`, () => {}).on('error', () => {});
    }, 14 * 60 * 1000);
}

// ===== Запуск =====
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  ❦ Сервер запущен: http://localhost:${PORT}`);
    console.log(`  ❦ Режим: ${IS_PRODUCTION ? 'production' : 'development'}\n`);
    keepAlive();
});
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

initDB();
