const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const initSqlJs = require('sql.js');

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data.db');

// ===== Настройки авторизации =====
// Измените логин и пароль на свои!
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'romance2026';
// Секрет для подписи токенов сессии
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
// Время жизни сессии (24 часа)
const SESSION_TTL = 24 * 60 * 60 * 1000;

// Хранилище сессий (в памяти — при перезапуске сервера нужно залогиниться заново)
const sessions = new Map();

let db;

async function initDB() {
    const SQL = await initSqlJs();

    // Если файл БД существует — загружаем, иначе создаём новую
    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
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

    // Если таблицы пустые — заполняем дефолтными данными
    const bookCount = db.exec("SELECT COUNT(*) FROM books")[0].values[0][0];
    if (bookCount === 0) {
        seedBooks();
    }

    const postCount = db.exec("SELECT COUNT(*) FROM posts")[0].values[0][0];
    if (postCount === 0) {
        seedPosts();
    }

    saveDB();
}

function saveDB() {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

function seedBooks() {
    const books = [
        {
            id: '1', title: 'Шёпот зимних роз', genre: 'Современный роман · Драма',
            badge: 'Новинка', description: 'Она искала тишину в заснеженном поместье. Он принёс с собой бурю.',
            prologue: 'Снег падал так тихо, что казалось — вселенная задержала дыхание. Лилит стояла у окна старого поместья и смотрела, как белые лепестки укрывают сад. Где-то там, под снегом, спали зимние розы — единственное, что согревало её в эту ночь.\n\nКамин потрескивал за её спиной. Часы в гостиной пробили полночь. И именно в этот миг во дворе, среди вьюги, появился силуэт — высокий, тёмный, чужой.\n\n«Он не должен был приехать», — прошептала она, прижимая ладонь к холодному стеклу. Но сердце уже знало: с этой минуты её тихая жизнь закончилась.',
            litnet: 'https://litnet.com/', litgorod: 'https://litgorod.ru/',
            cover: 'assets/book1.jpg.svg', color: '#1a2440', sort_order: 1
        },
        {
            id: '2', title: 'Под светом южных звёзд', genre: 'Романтика · Путешествия',
            badge: 'Бестселлер', description: 'Случайная встреча в Лиссабоне, которая изменила всё.',
            prologue: 'Лиссабон встретил её ароматом моря и кофе. София шла по узкой улочке Альфамы, где фасады домов цвета охры спорили с синевой азулежу. Чемодан стучал по брусчатке, в груди стучало сердце — громче, чем нужно.\n\nНа углу маленького кафе она едва не столкнулась с ним. Высокий, в льняной рубашке, с книгой в руке. Их взгляды встретились на одно мгновение — и этого хватило.\n\n«Desculpe», — сказал он по-португальски. А потом добавил по-русски, с тёплой усмешкой: «Простите». И в этот момент София поняла: ни один её план на это лето уже не сбудется.',
            litnet: 'https://litnet.com/', litgorod: 'https://litgorod.ru/',
            cover: 'assets/book2.jpg.svg', color: '#ff8a5b', sort_order: 2
        },
        {
            id: '3', title: 'Письма, которых не было', genre: 'Исторический роман',
            badge: '', description: 'Сто лет молчания и одно признание, способное всё перевернуть.',
            prologue: 'В пыльном чердаке бабушкиного дома Аня нашла шкатулку из вишнёвого дерева. Замок поддался с тихим щелчком — словно ждал её сто лет.\n\nВнутри лежали письма. Перевязанные выцветшей лентой, написанные чернилами, которые местами расплывались — то ли от времени, то ли от слёз. На первом конверте значилось: «Елене. Если ты когда-нибудь это прочитаешь — знай, я любил».\n\nАня осторожно развернула лист. Прочитала первую строку — и поняла, что бабушкина история была совсем не такой, как ей рассказывали.',
            litnet: 'https://litnet.com/', litgorod: 'https://litgorod.ru/',
            cover: 'assets/book3.jpg.svg', color: '#3a2818', sort_order: 3
        },
        {
            id: '4', title: 'Танец на грани рассвета', genre: 'Городское фэнтези · Любовь',
            badge: 'Скоро', description: 'Между двумя мирами стоит лишь её сердце.',
            prologue: 'Город никогда не спал. Под неоновым дождём, между мирами, в час, когда звёзды стираются с неба, Эва выходила танцевать. Это был её ритуал — и её проклятие.\n\nСегодня в зал «Полуночи» вошёл он. Не такой, как все. Слишком тихий, слишком пристальный. И когда их взгляды встретились через дым и блики, Эва почувствовала, как реальность дрогнула.\n\n«Ты знаешь, кто я?» — спросил он, протягивая руку. Эва не знала. Но она шагнула навстречу.',
            litnet: 'https://litnet.com/', litgorod: 'https://litgorod.ru/',
            cover: 'assets/book4.jpg.svg', color: '#0a0a2a', sort_order: 4
        }
    ];

    const stmt = db.prepare(`INSERT INTO books (id, title, genre, badge, description, prologue, litnet, litgorod, cover, color, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    books.forEach(b => {
        stmt.run([b.id, b.title, b.genre, b.badge, b.description, b.prologue, b.litnet, b.litgorod, b.cover, b.color, b.sort_order]);
    });
    stmt.free();
}

function seedPosts() {
    const posts = [
        { id: '1', title: 'Как рождалась героиня «Шёпота зимних роз»', date: '2026-05-12', content: 'Иногда персонаж сам стучится в дверь. Расскажу, как Лилит появилась из одного зимнего вечера и чашки горячего какао.', link: '#' },
        { id: '2', title: 'Лиссабон, который вы не знали', date: '2026-04-28', content: 'Маленькие улочки, синяя плитка азулежу и кафе, где я писала «Под светом южных звёзд». Личный гид.', link: '#' },
        { id: '3', title: 'Плейлист для романтических вечеров', date: '2026-04-05', content: 'Музыка, под которую пишутся самые трогательные сцены. Делюсь моими треками для долгих чтений.', link: '#' }
    ];

    const stmt = db.prepare(`INSERT INTO posts (id, title, date, content, link) VALUES (?, ?, ?, ?, ?)`);
    posts.forEach(p => {
        stmt.run([p.id, p.title, p.date, p.content, p.link]);
    });
    stmt.free();
}

// ===== Хелпер: получить все строки из запроса =====
function queryAll(sql, params = []) {
    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}

// ===== Express =====
const app = express();
app.use(express.json());

// ===== Авторизация =====
function generateToken() {
    return crypto.randomBytes(48).toString('hex');
}

function authMiddleware(req, res, next) {
    const token = req.headers['authorization']?.replace('Bearer ', '') ||
                  req.query.token ||
                  parseCookies(req)['admin_token'];
    if (!token || !sessions.has(token)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const session = sessions.get(token);
    if (Date.now() > session.expires) {
        sessions.delete(token);
        return res.status(401).json({ error: 'Session expired' });
    }
    next();
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

// --- Логин ---
app.post('/api/auth/login', (req, res) => {
    const { login, password } = req.body;
    if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
        const token = generateToken();
        sessions.set(token, { expires: Date.now() + SESSION_TTL });
        res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL / 1000}`);
        return res.json({ success: true, token });
    }
    res.status(401).json({ error: 'Неверный логин или пароль' });
});

// --- Проверка сессии ---
app.get('/api/auth/check', (req, res) => {
    const token = req.headers['authorization']?.replace('Bearer ', '') ||
                  req.query.token ||
                  parseCookies(req)['admin_token'];
    if (token && sessions.has(token) && Date.now() <= sessions.get(token).expires) {
        return res.json({ authenticated: true });
    }
    res.json({ authenticated: false });
});

// --- Выход ---
app.post('/api/auth/logout', (req, res) => {
    const token = parseCookies(req)['admin_token'];
    if (token) sessions.delete(token);
    res.setHeader('Set-Cookie', 'admin_token=; Path=/; HttpOnly; Max-Age=0');
    res.json({ success: true });
});

// ===== Защита админки =====
// Блокируем доступ к admin.html без авторизации
app.get('/admin.html', (req, res, next) => {
    const token = parseCookies(req)['admin_token'];
    if (token && sessions.has(token) && Date.now() <= sessions.get(token).expires) {
        return next(); // пропускаем к статике
    }
    // Отдаём страницу логина
    res.sendFile(path.join(__dirname, 'login.html'));
});

// Статика (после проверки admin.html)
app.use(express.static(__dirname));

// Защита всех API-эндпоинтов записи (POST/PUT/DELETE)
app.use('/api/books', (req, res, next) => {
    if (req.method === 'GET') return next();
    authMiddleware(req, res, next);
});
app.use('/api/posts', (req, res, next) => {
    if (req.method === 'GET') return next();
    authMiddleware(req, res, next);
});

// --- API: Книги ---
app.get('/api/books', (req, res) => {
    const books = queryAll('SELECT * FROM books ORDER BY sort_order ASC, created_at ASC');
    res.json(books);
});

app.get('/api/books/:id', (req, res) => {
    const rows = queryAll('SELECT * FROM books WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
});

app.post('/api/books', (req, res) => {
    const { title, genre, badge, description, prologue, litnet, litgorod, cover, color } = req.body;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const maxOrder = queryAll('SELECT MAX(sort_order) as m FROM books')[0].m || 0;
    db.run(`INSERT INTO books (id, title, genre, badge, description, prologue, litnet, litgorod, cover, color, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, title || '', genre || '', badge || '', description || '', prologue || '', litnet || 'https://litnet.com/', litgorod || 'https://litgorod.ru/', cover || '', color || '#9a3f55', maxOrder + 1]);
    saveDB();
    res.json({ id, success: true });
});

app.put('/api/books/:id', (req, res) => {
    const { title, genre, badge, description, prologue, litnet, litgorod, cover, color } = req.body;
    db.run(`UPDATE books SET title=?, genre=?, badge=?, description=?, prologue=?, litnet=?, litgorod=?, cover=?, color=? WHERE id=?`,
        [title || '', genre || '', badge || '', description || '', prologue || '', litnet || '', litgorod || '', cover || '', color || '#9a3f55', req.params.id]);
    saveDB();
    res.json({ success: true });
});

app.delete('/api/books/:id', (req, res) => {
    db.run('DELETE FROM books WHERE id = ?', [req.params.id]);
    saveDB();
    res.json({ success: true });
});

// --- API: Посты ---
app.get('/api/posts', (req, res) => {
    const posts = queryAll('SELECT * FROM posts ORDER BY date DESC, created_at DESC');
    res.json(posts);
});

app.get('/api/posts/:id', (req, res) => {
    const rows = queryAll('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
});

app.post('/api/posts', (req, res) => {
    const { title, date, content, link } = req.body;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    db.run(`INSERT INTO posts (id, title, date, content, link) VALUES (?, ?, ?, ?, ?)`,
        [id, title || '', date || new Date().toISOString().slice(0, 10), content || '', link || '#']);
    saveDB();
    res.json({ id, success: true });
});

app.put('/api/posts/:id', (req, res) => {
    const { title, date, content, link } = req.body;
    db.run(`UPDATE posts SET title=?, date=?, content=?, link=? WHERE id=?`,
        [title || '', date || '', content || '', link || '#', req.params.id]);
    saveDB();
    res.json({ success: true });
});

app.delete('/api/posts/:id', (req, res) => {
    db.run('DELETE FROM posts WHERE id = ?', [req.params.id]);
    saveDB();
    res.json({ success: true });
});

// ===== Запуск =====
initDB().then(() => {
    app.listen(PORT, () => {
        console.log(`\n  ❦ Сервер запущен: http://localhost:${PORT}`);
        console.log(`  ❦ Админ-панель:   http://localhost:${PORT}/admin.html\n`);
    });
}).catch(err => {
    console.error('Ошибка инициализации БД:', err);
    process.exit(1);
});
