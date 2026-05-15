// ===== Проверка авторизации =====
(async function checkAuth() {
    try {
        const res = await fetch('/api/auth/check');
        const data = await res.json();
        if (!data.authenticated) {
            window.location.href = '/admin.html'; // сервер отдаст login.html
            return;
        }
    } catch (e) {
        window.location.href = '/admin.html';
        return;
    }
})();

// ===== Выход =====
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
});

// ===== Данные =====
let booksData = [];
let postsData = [];

// ===== API-запросы =====
async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    return res.json();
}

async function loadBooks() {
    booksData = await apiFetch('/api/books');
    renderBooks();
}

async function loadPosts() {
    postsData = await apiFetch('/api/posts');
    renderPosts();
}

// ===== Табы =====
document.querySelectorAll('.sidebar__link[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.sidebar__link[data-tab]').forEach(b => b.classList.remove('is-active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('is-active'));
        btn.classList.add('is-active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('is-active');
    });
});

// ===== Модалки =====
function openModal(id) {
    document.getElementById(id).classList.add('is-open');
}
function closeModalById(id) {
    document.getElementById(id).classList.remove('is-open');
}

document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModalById(btn.dataset.closeModal));
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('is-open');
    });
});

// ===== Рендер книг =====
function renderBooks() {
    const list = document.getElementById('booksList');
    if (booksData.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="empty-state__icon">📚</div><p>Книг пока нет. Добавьте первую!</p></div>`;
        return;
    }
    list.innerHTML = booksData.map(book => `
        <div class="admin-card">
            <div class="admin-card__info">
                <h3>${escHtml(book.title)}${book.badge ? `<span class="badge">${escHtml(book.badge)}</span>` : ''}</h3>
                <p>${escHtml(book.genre)} — ${escHtml(book.description || '')}</p>
            </div>
            <div class="admin-card__actions">
                <button class="btn btn--ghost btn--small" onclick="editBook('${book.id}')">Редактировать</button>
                <button class="btn btn--danger btn--small" onclick="deleteBook('${book.id}')">Удалить</button>
            </div>
        </div>
    `).join('');
}

// ===== Рендер постов =====
function renderPosts() {
    const list = document.getElementById('postsList');
    if (postsData.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="empty-state__icon">✍️</div><p>Записей пока нет. Добавьте первую!</p></div>`;
        return;
    }
    list.innerHTML = postsData.map(post => `
        <div class="admin-card">
            <div class="admin-card__info">
                <h3>${escHtml(post.title)}</h3>
                <p>${formatDate(post.date)} — ${escHtml(post.content || '').slice(0, 80)}...</p>
            </div>
            <div class="admin-card__actions">
                <button class="btn btn--ghost btn--small" onclick="editPost('${post.id}')">Редактировать</button>
                <button class="btn btn--danger btn--small" onclick="deletePost('${post.id}')">Удалить</button>
            </div>
        </div>
    `).join('');
}

// ===== Книги: CRUD =====
document.getElementById('addBookBtn').addEventListener('click', () => {
    resetBookForm();
    document.getElementById('bookModalTitle').textContent = 'Добавить книгу';
    openModal('bookModal');
});

function editBook(id) {
    const book = booksData.find(b => b.id === id);
    if (!book) return;
    document.getElementById('bookId').value = book.id;
    document.getElementById('bookTitle').value = book.title;
    document.getElementById('bookGenre').value = book.genre || '';
    document.getElementById('bookBadge').value = book.badge || '';
    document.getElementById('bookDesc').value = book.description || '';
    document.getElementById('bookPrologue').value = book.prologue || '';
    document.getElementById('bookLitnet').value = book.litnet || '';
    document.getElementById('bookLitgorod').value = book.litgorod || '';
    document.getElementById('bookCover').value = book.cover || '';
    document.getElementById('bookColor').value = book.color || '#9a3f55';
    document.getElementById('bookModalTitle').textContent = 'Редактировать книгу';
    openModal('bookModal');
}

async function deleteBook(id) {
    if (!confirm('Удалить эту книгу?')) return;
    await apiFetch('/api/books/' + id, { method: 'DELETE' });
    await loadBooks();
}

document.getElementById('bookForm').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('bookId').value;
    const body = {
        title: document.getElementById('bookTitle').value.trim(),
        genre: document.getElementById('bookGenre').value.trim(),
        badge: document.getElementById('bookBadge').value,
        description: document.getElementById('bookDesc').value.trim(),
        prologue: document.getElementById('bookPrologue').value.trim(),
        litnet: document.getElementById('bookLitnet').value.trim() || 'https://litnet.com/',
        litgorod: document.getElementById('bookLitgorod').value.trim() || 'https://litgorod.ru/',
        cover: document.getElementById('bookCover').value.trim(),
        color: document.getElementById('bookColor').value
    };

    if (id) {
        await apiFetch('/api/books/' + id, { method: 'PUT', body: JSON.stringify(body) });
    } else {
        await apiFetch('/api/books', { method: 'POST', body: JSON.stringify(body) });
    }

    await loadBooks();
    closeModalById('bookModal');
});

function resetBookForm() {
    document.getElementById('bookId').value = '';
    document.getElementById('bookForm').reset();
    document.getElementById('bookColor').value = '#9a3f55';
}

// ===== Посты: CRUD =====
document.getElementById('addPostBtn').addEventListener('click', () => {
    resetPostForm();
    document.getElementById('postModalTitle').textContent = 'Добавить запись';
    openModal('postModal');
});

function editPost(id) {
    const post = postsData.find(p => p.id === id);
    if (!post) return;
    document.getElementById('postId').value = post.id;
    document.getElementById('postTitle').value = post.title;
    document.getElementById('postDate').value = post.date || '';
    document.getElementById('postContent').value = post.content || '';
    document.getElementById('postLink').value = post.link || '';
    document.getElementById('postModalTitle').textContent = 'Редактировать запись';
    openModal('postModal');
}

async function deletePost(id) {
    if (!confirm('Удалить эту запись?')) return;
    await apiFetch('/api/posts/' + id, { method: 'DELETE' });
    await loadPosts();
}

document.getElementById('postForm').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('postId').value;
    const body = {
        title: document.getElementById('postTitle').value.trim(),
        date: document.getElementById('postDate').value || new Date().toISOString().slice(0, 10),
        content: document.getElementById('postContent').value.trim(),
        link: document.getElementById('postLink').value.trim() || '#'
    };

    if (id) {
        await apiFetch('/api/posts/' + id, { method: 'PUT', body: JSON.stringify(body) });
    } else {
        await apiFetch('/api/posts', { method: 'POST', body: JSON.stringify(body) });
    }

    await loadPosts();
    closeModalById('postModal');
});

function resetPostForm() {
    document.getElementById('postId').value = '';
    document.getElementById('postForm').reset();
}

// ===== Утилиты =====
function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return `${d.getDate()} ${months[d.getMonth()]}`;
}

// ===== Первый рендер =====
loadBooks();
loadPosts();
