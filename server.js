const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const initSqlJs = require('sql.js');

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data.db');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Создаём папку для загрузок
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ===== Настройка multer для загрузки файлов =====
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
    if (allowed.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Недопустимый формат файла'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 } // 50 МБ макс
});

// ===== Настройки авторизации =====
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'romance2026';
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 часа

// Хранилище сессий
const sessions = new Map();

// ===== База данных =====
let db = null;
let dbReady = false;

async function initDB() {
    try {
        const SQL = await initSqlJs();

        if (fs.existsSync(DB_PATH)) {
            const buffer = fs.readFileSync(DB_PATH);
            db = new SQL.Database(buffer);
            console.log('  ✓ БД загружена из файла');
        } else {
            db = new SQL.Database();
            console.log('  ✓ Создана новая БД');
        }

        // Создаём таблицы
        db.run(`
            CREATE TABLE IF NOT EXISTS books (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                genre TEXT DEFAULT '',
                badge TEXT DEFAULT '',
                description TEXT DEFAULT '',
                prologue TEXT DEFAULT '',
                litnet TEXT DEFAULT 'https://litnet.com/',
                litgorod TEXT DEFAULT 'https://litgorod.ru/',
                cover TEXT DEFAULT '',
                color TEXT DEFAULT '#9a3f55',
                sort_order INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now'))
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS posts (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                date TEXT DEFAULT '',
                content TEXT DEFAULT '',
                link TEXT DEFAULT '#',
                created_at TEXT DEFAULT (datetime('now'))
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT DEFAULT ''
            )
        `);

        // Дефолтные настройки соцсетей и QR
        const settingsCount = db.exec("SELECT COUNT(*) FROM settings")[0].values[0][0];
        if (settingsCount === 0) seedSettings();

        // Заполняем дефолтными данными если пусто
        const bookCount = db.exec("SELECT COUNT(*) FROM books")[0].values[0][0];
        if (bookCount === 0) seedBooks();

        const postCount = db.exec("SELECT COUNT(*) FROM posts")[0].values[0][0];
        if (postCount === 0) seedPosts();

        saveDB();
        dbReady = true;
        console.log('  ✓ БД инициализирована');
    } catch (err) {
        console.error('  ✗ Ошибка инициализации БД:', err.message);
        // Пробуем создать чистую БД
        try {
            const SQL = await initSqlJs();
            db = new SQL.Database();
            db.run(`CREATE TABLE IF NOT EXISTS books (id TEXT PRIMARY KEY, title TEXT NOT NULL, genre TEXT DEFAULT '', badge TEXT DEFAULT '', description TEXT DEFAULT '', prologue TEXT DEFAULT '', litnet TEXT DEFAULT '', litgorod TEXT DEFAULT '', cover TEXT DEFAULT '', color TEXT DEFAULT '#9a3f55', sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`);
            db.run(`CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, title TEXT NOT NULL, date TEXT DEFAULT '', content TEXT DEFAULT '', link TEXT DEFAULT '#', created_at TEXT DEFAULT (datetime('now')))`);
            seedBooks();
            seedPosts();
            saveDB();
            dbReady = true;
            console.log('  ✓ БД пересоздана с нуля');
        } catch (e2) {
            console.error('  ✗ Критическая ошибка БД:', e2.message);
        }
    }
}

function saveDB() {
    try {
        if (!db) return;
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    } catch (err) {
        console.error('Ошибка сохранения БД:', err.message);
    }
}

// Периодическое сохранение БД (каждые 5 минут)
setInterval(() => {
    if (dbReady) saveDB();
}, 5 * 60 * 1000);

function seedBooks() {
    const books = [
        { id: '1', title: 'Шёпот зимних роз', genre: 'Современный роман · Драма', badge: 'Новинка', description: 'Она искала тишину в заснеженном поместье. Он принёс с собой бурю.', prologue: 'Снег падал так тихо, что казалось — вселенная задержала дыхание. Лилит стояла у окна старого поместья и смотрела, как белые лепестки укрывают сад. Где-то там, под снегом, спали зимние розы — единственное, что согревало её в эту ночь.\n\nКамин потрескивал за её спиной. Часы в гостиной пробили полночь. И именно в этот миг во дворе, среди вьюги, появился силуэт — высокий, тёмный, чужой.\n\n«Он не должен был приехать», — прошептала она, прижимая ладонь к холодному стеклу. Но сердце уже знало: с этой минуты её тихая жизнь закончилась.', litnet: 'https://litnet.com/', litgorod: 'https://litgorod.ru/', cover: 'assets/book1.jpg.svg', color: '#1a2440', sort_order: 1 },
        { id: '2', title: 'Под светом южных звёзд', genre: 'Романтика · Путешествия', badge: 'Бестселлер', description: 'Случайная встреча в Лиссабоне, которая изменила всё.', prologue: 'Лиссабон встретил её ароматом моря и кофе. София шла по узкой улочке Альфамы, где фасады домов цвета охры спорили с синевой азулежу. Чемодан стучал по брусчатке, в груди стучало сердце — громче, чем нужно.\n\nНа углу маленького кафе она едва не столкнулась с ним. Высокий, в льняной рубашке, с книгой в руке. Их взгляды встретились на одно мгновение — и этого хватило.\n\n«Desculpe», — сказал он по-португальски. А потом добавил по-русски, с тёплой усмешкой: «Простите». И в этот момент София поняла: ни один её план на это лето уже не сбудется.', litnet: 'https://litnet.com/', litgorod: 'https://litgorod.ru/', cover: 'assets/book2.jpg.svg', color: '#ff8a5b', sort_order: 2 },
        { id: '3', title: 'Письма, которых не было', genre: 'Исторический роман', badge: '', description: 'Сто лет молчания и одно признание, способное всё перевернуть.', prologue: 'В пыльном чердаке бабушкиного дома Аня нашла шкатулку из вишнёвого дерева. Замок поддался с тихим щелчком — словно ждал её сто лет.\n\nВнутри лежали письма. Перевязанные выцветшей лентой, написанные чернилами, которые местами расплывались — то ли от времени, то ли от слёз. На первом конверте значилось: «Елене. Если ты когда-нибудь это прочитаешь — знай, я любил».\n\nАня осторожно развернула лист. Прочитала первую строку — и поняла, что бабушкина история была совсем не такой, как ей рассказывали.', litnet: 'https://litnet.com/', litgorod: 'https://litgorod.ru/', cover: 'assets/book3.jpg.svg', color: '#3a2818', sort_order: 3 },
        { id: '4', title: 'Танец на грани рассвета', genre: 'Городское фэнтези · Любовь', badge: 'Скоро', description: 'Между двумя мирами стоит лишь её сердце.', prologue: 'Город никогда не спал. Под неоновым дождём, между мирами, в час, когда звёзды стираются с неба, Эва выходила танцевать. Это был её ритуал — и её проклятие.\n\nСегодня в зал «Полуночи» вошёл он. Не такой, как все. Слишком тихий, слишком пристальный. И когда их взгляды встретились через дым и блики, Эва почувствовала, как реальность дрогнула.\n\n«Ты знаешь, кто я?» — спросил он, протягивая руку. Эва не знала. Но она шагнула навстречу.', litnet: 'https://litnet.com/', litgorod: 'https://litgorod.ru/', cover: 'assets/book4.jpg.svg', color: '#0a0a2a', sort_order: 4 }
    ];
    const stmt = db.prepare(`INSERT INTO books (id, title, genre, badge, description, prologue, litnet, litgorod, cover, color, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    books.forEach(b => { stmt.run([b.id, b.title, b.genre, b.badge, b.description, b.prologue, b.litnet, b.litgorod, b.cover, b.color, b.sort_order]); });
    stmt.free();
}

function seedPosts() {
    const posts = [
        { id: '1', title: 'Как рождалась героиня «Шёпота зимних роз»', date: '2026-05-12', content: 'Иногда персонаж сам стучится в дверь. Расскажу, как Лилит появилась из одного зимнего вечера и чашки горячего какао.', link: '#' },
        { id: '2', title: 'Лиссабон, который вы не знали', date: '2026-04-28', content: 'Маленькие улочки, синяя плитка азулежу и кафе, где я писала «Под светом южных звёзд». Личный гид.', link: '#' },
        { id: '3', title: 'Плейлист для романтических вечеров', date: '2026-04-05', content: 'Музыка, под которую пишутся самые трогательные сцены. Делюсь моими треками для долгих чтений.', link: '#' }
    ];
    const stmt = db.prepare(`INSERT INTO posts (id, title, date, content, link) VALUES (?, ?, ?, ?, ?)`);
    posts.forEach(p => { stmt.run([p.id, p.title, p.date, p.content, p.link]); });
    stmt.free();
}

function seedSettings() {
    const defaults = {
        'social_telegram': 'https://t.me/RenaRud',
        'social_vk': '',
        'social_instagram': '',
        'social_youtube': '',
        'social_tiktok': '',
        'telegram_channel': 'https://t.me/RenaRud',
        'telegram_username': '@RenaRud',
        'qr_image': '',
        'platform_litnet': 'https://litnet.com/ru/rena-rud-u3659590',
        'platform_litgorod': 'https://litgorod.ru/profile/680841/books',
        'contact_email': 'hello@heart-book.ru'
    };
    const stmt = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
    Object.entries(defaults).forEach(([k, v]) => { stmt.run([k, v]); });
    stmt.free();
}

// ===== Хелпер: получить все строки из запроса =====
function queryAll(sql, params = []) {
    if (!db) return [];
    try {
        const stmt = db.prepare(sql);
        if (params.length) stmt.bind(params);
        const rows = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
    } catch (err) {
        console.error('Ошибка запроса:', sql, err.message);
        return [];
    }
}

// ===== Express =====
const app = express();
app.use(express.json());

// ===== Health check (для Render и мониторинга) =====
app.get('/api/health', (req, res) => {
    res.json({
        status: dbReady ? 'ok' : 'starting',
        uptime: Math.floor(process.uptime()),
        memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB'
    });
});

// ===== Middleware: проверка готовности БД =====
function requireDB(req, res, next) {
    if (!dbReady) {
        return res.status(503).json({ error: 'Сервер запускается, подождите...' });
    }
    next();
}

// ===== Авторизация =====
function generateToken() {
    return crypto.randomBytes(48).toString('hex');
}

function parseCookies(req) {
    const cookies = {};
    const header = req.headers.cookie || '';
    header.split(';').forEach(c => {
        const [key, ...val] = c.trim().split('=');
        if (key) cookies[key] = val.join('=');
    });
    return cookies;
}

function getToken(req) {
    return req.headers['authorization']?.replace('Bearer ', '') ||
           req.query.token ||
           parseCookies(req)['admin_token'];
}

function isAuthenticated(req) {
    const token = getToken(req);
    if (!token || !sessions.has(token)) return false;
    const session = sessions.get(token);
    if (Date.now() > session.expires) {
        sessions.delete(token);
        return false;
    }
    return true;
}

function authMiddleware(req, res, next) {
    if (!isAuthenticated(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// --- Логин ---
app.post('/api/auth/login', (req, res) => {
    const { login, password } = req.body || {};
    if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
        const token = generateToken();
        sessions.set(token, { expires: Date.now() + SESSION_TTL });
        // Очищаем старые сессии
        for (const [t, s] of sessions) {
            if (Date.now() > s.expires) sessions.delete(t);
        }
        res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL / 1000)}`);
        return res.json({ success: true, token });
    }
    res.status(401).json({ error: 'Неверный логин или пароль' });
});

// --- Проверка сессии ---
app.get('/api/auth/check', (req, res) => {
    res.json({ authenticated: isAuthenticated(req) });
});

// --- Выход ---
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

// Статика
app.use(express.static(__dirname, {
    maxAge: IS_PRODUCTION ? '1h' : 0,
    etag: true
}));

// ===== API: Книги =====
app.get('/api/books', requireDB, (req, res) => {
    try {
        const books = queryAll('SELECT * FROM books ORDER BY sort_order ASC, created_at ASC');
        res.json(books);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка загрузки книг' });
    }
});

app.get('/api/books/:id', requireDB, (req, res) => {
    try {
        const rows = queryAll('SELECT * FROM books WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

app.post('/api/books', authMiddleware, requireDB, (req, res) => {
    try {
        const { title, genre, badge, description, prologue, litnet, litgorod, cover, color } = req.body;
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        const maxOrder = queryAll('SELECT MAX(sort_order) as m FROM books')[0]?.m || 0;
        db.run(`INSERT INTO books (id, title, genre, badge, description, prologue, litnet, litgorod, cover, color, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, title || '', genre || '', badge || '', description || '', prologue || '', litnet || 'https://litnet.com/', litgorod || 'https://litgorod.ru/', cover || '', color || '#9a3f55', maxOrder + 1]);
        saveDB();
        res.json({ id, success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка создания книги: ' + err.message });
    }
});

app.put('/api/books/:id', authMiddleware, requireDB, (req, res) => {
    try {
        const { title, genre, badge, description, prologue, litnet, litgorod, cover, color } = req.body;
        db.run(`UPDATE books SET title=?, genre=?, badge=?, description=?, prologue=?, litnet=?, litgorod=?, cover=?, color=? WHERE id=?`,
            [title || '', genre || '', badge || '', description || '', prologue || '', litnet || '', litgorod || '', cover || '', color || '#9a3f55', req.params.id]);
        saveDB();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка обновления: ' + err.message });
    }
});

app.delete('/api/books/:id', authMiddleware, requireDB, (req, res) => {
    try {
        db.run('DELETE FROM books WHERE id = ?', [req.params.id]);
        saveDB();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка удаления: ' + err.message });
    }
});

// ===== API: Посты =====
app.get('/api/posts', requireDB, (req, res) => {
    try {
        const posts = queryAll('SELECT * FROM posts ORDER BY date DESC, created_at DESC');
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка загрузки постов' });
    }
});

app.get('/api/posts/:id', requireDB, (req, res) => {
    try {
        const rows = queryAll('SELECT * FROM posts WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка' });
    }
});

app.post('/api/posts', authMiddleware, requireDB, (req, res) => {
    try {
        const { title, date, content, link } = req.body;
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        db.run(`INSERT INTO posts (id, title, date, content, link) VALUES (?, ?, ?, ?, ?)`,
            [id, title || '', date || new Date().toISOString().slice(0, 10), content || '', link || '#']);
        saveDB();
        res.json({ id, success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка создания поста: ' + err.message });
    }
});

app.put('/api/posts/:id', authMiddleware, requireDB, (req, res) => {
    try {
        const { title, date, content, link } = req.body;
        db.run(`UPDATE posts SET title=?, date=?, content=?, link=? WHERE id=?`,
            [title || '', date || '', content || '', link || '#', req.params.id]);
        saveDB();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка обновления: ' + err.message });
    }
});

app.delete('/api/posts/:id', authMiddleware, requireDB, (req, res) => {
    try {
        db.run('DELETE FROM posts WHERE id = ?', [req.params.id]);
        saveDB();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка удаления: ' + err.message });
    }
});

// ===== API: Загрузка файлов =====
app.post('/api/upload', authMiddleware, (req, res) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            if (err instanceof multer.MulterError) {
                return res.status(400).json({ error: 'Файл слишком большой (макс 50 МБ)' });
            }
            return res.status(400).json({ error: err.message || 'Ошибка загрузки' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'Файл не выбран' });
        }
        const fileUrl = '/uploads/' + req.file.filename;
        res.json({ success: true, url: fileUrl, filename: req.file.filename });
    });
});

// Раздача загруженных файлов
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' }));

// ===== API: Настройки (соцсети, QR, платформы) =====
app.get('/api/settings', requireDB, (req, res) => {
    try {
        const rows = queryAll('SELECT key, value FROM settings');
        const settings = {};
        rows.forEach(r => { settings[r.key] = r.value; });
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: 'Ошибка загрузки настроек' });
    }
});

app.put('/api/settings', authMiddleware, requireDB, (req, res) => {
    try {
        const settings = req.body;
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ error: 'Неверный формат данных' });
        }
        Object.entries(settings).forEach(([key, value]) => {
            db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, value || '']);
        });
        saveDB();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка сохранения настроек: ' + err.message });
    }
});

// Удаление загруженного файла
app.delete('/api/upload/:filename', authMiddleware, (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(UPLOADS_DIR, filename);
    // Защита от path traversal
    if (!filepath.startsWith(UPLOADS_DIR)) {
        return res.status(400).json({ error: 'Недопустимый путь' });
    }
    try {
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка удаления файла' });
    }
});

// ===== Обработка ошибок =====
app.use((err, req, res, next) => {
    console.error('Необработанная ошибка:', err.message);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// ===== Глобальная защита от крашей =====
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err.message);
    console.error(err.stack);
    // Не завершаем процесс — пусть работает дальше
});

process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION:', reason);
});

// ===== Keep-alive: пингуем сами себя каждые 14 минут (чтобы Render не усыплял) =====
function keepAlive() {
    if (!IS_PRODUCTION) return; // только на продакшене
    const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    setInterval(() => {
        const http = require('http');
        const https = require('https');
        const client = url.startsWith('https') ? https : http;
        client.get(`${url}/api/health`, (res) => {
            // просто пингуем
        }).on('error', () => {
            // игнорируем ошибки пинга
        });
    }, 14 * 60 * 1000); // каждые 14 минут
}

// ===== Запуск =====
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  ❦ Сервер запущен: http://localhost:${PORT}`);
    console.log(`  ❦ Админ-панель:   http://localhost:${PORT}/admin.html`);
    console.log(`  ❦ Режим: ${IS_PRODUCTION ? 'production' : 'development'}\n`);
    keepAlive();
});

// Увеличиваем таймауты для стабильности
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// Инициализируем БД после запуска сервера (чтобы Render видел, что порт открыт)
initDB();
