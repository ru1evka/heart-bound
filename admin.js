// ===== Проверка авторизации =====
(async function checkAuth() {
    try {
        const res = await fetch('/api/auth/check');
        const data = await res.json();
        if (!data.authenticated) {
            window.location.href = '/admin.html';
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
let settingsData = {};

// ===== API =====
async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options
    });
    return res.json();
}

async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    return res.json();
}

function getBookAgeRating(book) {
    return (book && (book.age_rating ?? book.ageRating ?? '')) || '';
}

function ageRatingNum(rating) {
    return String(rating || '').replace('+', '');
}

function ageRatingBadgeHtml(rating) {
    if (!rating) return '';
    const num = ageRatingNum(rating);
    return `<span class="badge badge--age badge--age-${num}">${escHtml(rating)}</span>`;
}

function updateAgeRatingPreview() {
    const preview = document.getElementById('ageRatingPreview');
    const select = document.getElementById('bookAgeRating');
    if (!preview || !select) return;
    const rating = select.value;
    if (!rating) {
        preview.innerHTML = '<span class="age-rating-preview__empty">Плашка не будет показана на сайте</span>';
        return;
    }
    preview.innerHTML = ageRatingBadgeHtml(rating);
}

async function loadBooks() {
    const data = await apiFetch('/api/books');
    booksData = Array.isArray(data) ? data : [];
    renderBooks();
}

async function loadPosts() {
    postsData = await apiFetch('/api/posts');
    renderPosts();
}

async function loadSettings() {
    settingsData = await apiFetch('/api/settings');
    fillSettingsForm();
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
function openModal(id) { document.getElementById(id).classList.add('is-open'); }
function closeModalById(id) { document.getElementById(id).classList.remove('is-open'); }

document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModalById(btn.dataset.closeModal));
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('is-open'); });
});

// ===== Рендер книг =====
function renderBooks() {
    const list = document.getElementById('booksList');
    if (booksData.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-state__icon">📚</div><p>Книг пока нет. Добавьте первую!</p></div>';
        return;
    }
    list.innerHTML = booksData.map(book => `
        <div class="admin-card">
            <div class="admin-card__info">
                <h3>${escHtml(book.title)}${book.badge ? `<span class="badge">${escHtml(book.badge)}</span>` : ''}</h3>
                <p>${escHtml(book.genre)} — ${escHtml(book.description || '')}</p>
                <p class="admin-card__meta">Возраст: ${getBookAgeRating(book) ? ageRatingBadgeHtml(getBookAgeRating(book)) : '<span class="admin-card__age-none">не указано</span>'}</p>
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
        list.innerHTML = '<div class="empty-state"><div class="empty-state__icon">✍️</div><p>Записей пока нет. Добавьте первую!</p></div>';
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

// ===== Загрузка обложки книги =====
const coverFileInput = document.getElementById('coverFileInput');
const coverUploadBtn = document.getElementById('coverUploadBtn');
const coverRemoveBtn = document.getElementById('coverRemoveBtn');
const coverPreview = document.getElementById('coverPreview');
const bookCoverHidden = document.getElementById('bookCover');
const bookCoverUrl = document.getElementById('bookCoverUrl');

coverUploadBtn.addEventListener('click', () => coverFileInput.click());

coverFileInput.addEventListener('change', async () => {
    const file = coverFileInput.files[0];
    if (!file) return;
    coverUploadBtn.textContent = 'Загрузка...';
    coverUploadBtn.disabled = true;
    const result = await uploadFile(file);
    coverUploadBtn.textContent = 'Загрузить обложку';
    coverUploadBtn.disabled = false;
    if (result.success) {
        bookCoverHidden.value = result.url;
        bookCoverUrl.value = result.url;
        showCoverPreview(result.url);
        coverRemoveBtn.style.display = '';
    } else {
        alert('Ошибка: ' + (result.error || 'не удалось загрузить'));
    }
});

coverRemoveBtn.addEventListener('click', () => {
    bookCoverHidden.value = '';
    bookCoverUrl.value = '';
    coverPreview.innerHTML = '';
    coverRemoveBtn.style.display = 'none';
});

bookCoverUrl.addEventListener('input', () => {
    bookCoverHidden.value = bookCoverUrl.value;
    if (bookCoverUrl.value) {
        showCoverPreview(bookCoverUrl.value);
        coverRemoveBtn.style.display = '';
    }
});

function showCoverPreview(url) {
    if (!url) { coverPreview.innerHTML = ''; return; }
    if (url.endsWith('.mp4') || url.endsWith('.webm')) {
        coverPreview.innerHTML = `<video src="${escAttr(url)}" style="max-height:120px;border-radius:8px" autoplay muted loop></video>`;
    } else {
        coverPreview.innerHTML = `<img src="${escAttr(url)}" style="max-height:120px;border-radius:8px" alt="preview">`;
    }
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
    document.getElementById('bookAgeRating').value = getBookAgeRating(book);
    updateAgeRatingPreview();
    document.getElementById('bookDesc').value = book.description || '';
    document.getElementById('bookPrologue').value = book.prologue || '';
    document.getElementById('bookLitnet').value = book.litnet || '';
    document.getElementById('bookLitgorod').value = book.litgorod || '';
    document.getElementById('bookLitres').value = book.litres || '';
    document.getElementById('bookBtnType').value = book.btn_type || 'buy';
    bookCoverHidden.value = book.cover || '';
    bookCoverUrl.value = book.cover || '';
    document.getElementById('bookColor').value = book.color || '#9a3f55';
    showCoverPreview(book.cover);
    coverRemoveBtn.style.display = book.cover ? '' : 'none';
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
    const cover = bookCoverHidden.value || bookCoverUrl.value;
    const body = {
        title: document.getElementById('bookTitle').value.trim(),
        genre: document.getElementById('bookGenre').value.trim(),
        badge: document.getElementById('bookBadge').value,
        age_rating: document.getElementById('bookAgeRating').value,
        description: document.getElementById('bookDesc').value.trim(),
        prologue: document.getElementById('bookPrologue').value.trim(),
        litnet: document.getElementById('bookLitnet').value.trim(),
        litgorod: document.getElementById('bookLitgorod').value.trim(),
        litres: document.getElementById('bookLitres').value.trim(),
        btn_type: document.getElementById('bookBtnType').value,
        cover: cover.trim(),
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
    bookCoverHidden.value = '';
    bookCoverUrl.value = '';
    coverPreview.innerHTML = '';
    coverRemoveBtn.style.display = 'none';
    updateAgeRatingPreview();
}

document.getElementById('bookAgeRating')?.addEventListener('change', updateAgeRatingPreview);
updateAgeRatingPreview();

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

// ===== Настройки =====
const qrFileInput = document.getElementById('qrFileInput');
const qrUploadBtn = document.getElementById('qrUploadBtn');
const qrRemoveBtn = document.getElementById('qrRemoveBtn');
const qrPreview = document.getElementById('qrPreview');
const qrImageHidden = document.getElementById('sQrImage');

const authorFileInput = document.getElementById('authorFileInput');
const authorUploadBtn = document.getElementById('authorUploadBtn');
const authorRemoveBtn = document.getElementById('authorRemoveBtn');
const authorPreview = document.getElementById('authorPreview');
const authorPhotoHidden = document.getElementById('sAuthorPhoto');

qrUploadBtn.addEventListener('click', () => qrFileInput.click());

qrFileInput.addEventListener('change', async () => {
    const file = qrFileInput.files[0];
    if (!file) return;
    qrUploadBtn.textContent = 'Загрузка...';
    qrUploadBtn.disabled = true;
    const result = await uploadFile(file);
    qrUploadBtn.textContent = 'Загрузить QR-код';
    qrUploadBtn.disabled = false;
    if (result.success) {
        qrImageHidden.value = result.url;
        qrPreview.innerHTML = `<img src="${escAttr(result.url)}" style="max-height:100px;border-radius:8px" alt="QR">`;
        qrRemoveBtn.style.display = '';
    } else {
        alert('Ошибка: ' + (result.error || 'не удалось загрузить'));
    }
});

qrRemoveBtn.addEventListener('click', () => {
    qrImageHidden.value = '';
    qrPreview.innerHTML = '';
    qrRemoveBtn.style.display = 'none';
});

// Author photo upload
authorUploadBtn.addEventListener('click', () => authorFileInput.click());

authorFileInput.addEventListener('change', async () => {
    const file = authorFileInput.files[0];
    if (!file) return;
    authorUploadBtn.textContent = 'Загрузка...';
    authorUploadBtn.disabled = true;
    const result = await uploadFile(file);
    authorUploadBtn.textContent = 'Загрузить фото';
    authorUploadBtn.disabled = false;
    if (result.success) {
        authorPhotoHidden.value = result.url;
        authorPreview.innerHTML = `<img src="${escAttr(result.url)}" style="max-height:100px;border-radius:8px" alt="Author">`;
        authorRemoveBtn.style.display = '';
    } else {
        alert('Ошибка: ' + (result.error || 'не удалось загрузить'));
    }
});

authorRemoveBtn.addEventListener('click', () => {
    authorPhotoHidden.value = '';
    authorPreview.innerHTML = '';
    authorRemoveBtn.style.display = 'none';
});

function fillSettingsForm() {
    document.getElementById('sTelegram').value = settingsData.social_telegram || '';
    document.getElementById('sVk').value = settingsData.social_vk || '';
    document.getElementById('sInstagram').value = settingsData.social_instagram || '';
    document.getElementById('sYoutube').value = settingsData.social_youtube || '';
    document.getElementById('sTiktok').value = settingsData.social_tiktok || '';
    document.getElementById('sDzen').value = settingsData.social_dzen || '';
    document.getElementById('sTgChannel').value = settingsData.telegram_channel || '';
    document.getElementById('sTgUsername').value = settingsData.telegram_username || '';
    document.getElementById('sPlatformLitnet').value = settingsData.platform_litnet || '';
    document.getElementById('sPlatformLitgorod').value = settingsData.platform_litgorod || '';
    document.getElementById('sPlatformLitres').value = settingsData.platform_litres || '';
    document.getElementById('sEmail').value = settingsData.contact_email || '';
    document.getElementById('sAuthorName').value = settingsData.author_name || '';
    document.getElementById('sAuthorText1').value = settingsData.author_text1 || '';
    document.getElementById('sAuthorText2').value = settingsData.author_text2 || '';
    // QR
    qrImageHidden.value = settingsData.qr_image || '';
    if (settingsData.qr_image) {
        qrPreview.innerHTML = `<img src="${escAttr(settingsData.qr_image)}" style="max-height:100px;border-radius:8px" alt="QR">`;
        qrRemoveBtn.style.display = '';
    }
    // Author photo
    authorPhotoHidden.value = settingsData.author_photo || '';
    if (settingsData.author_photo) {
        authorPreview.innerHTML = `<img src="${escAttr(settingsData.author_photo)}" style="max-height:100px;border-radius:8px" alt="Author">`;
        authorRemoveBtn.style.display = '';
    }
}

document.getElementById('settingsForm').addEventListener('submit', async e => {
    e.preventDefault();
    const body = {
        social_telegram: document.getElementById('sTelegram').value.trim(),
        social_vk: document.getElementById('sVk').value.trim(),
        social_instagram: document.getElementById('sInstagram').value.trim(),
        social_youtube: document.getElementById('sYoutube').value.trim(),
        social_tiktok: document.getElementById('sTiktok').value.trim(),
        social_dzen: document.getElementById('sDzen').value.trim(),
        telegram_channel: document.getElementById('sTgChannel').value.trim(),
        telegram_username: document.getElementById('sTgUsername').value.trim(),
        qr_image: qrImageHidden.value,
        platform_litnet: document.getElementById('sPlatformLitnet').value.trim(),
        platform_litgorod: document.getElementById('sPlatformLitgorod').value.trim(),
        platform_litres: document.getElementById('sPlatformLitres').value.trim(),
        contact_email: document.getElementById('sEmail').value.trim(),
        author_name: document.getElementById('sAuthorName').value.trim(),
        author_text1: document.getElementById('sAuthorText1').value.trim(),
        author_text2: document.getElementById('sAuthorText2').value.trim(),
        author_photo: authorPhotoHidden.value
    };
    const result = await apiFetch('/api/settings', { method: 'PUT', body: JSON.stringify(body) });
    if (result.success) {
        alert('Настройки сохранены!');
        settingsData = body;
    } else {
        alert('Ошибка: ' + (result.error || 'не удалось сохранить'));
    }
});

// ===== Утилиты =====
function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}
function escAttr(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function formatDate(dateStr) {
    if (!dateStr) return '';
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return `${d.getDate()} ${months[d.getMonth()]}`;
}

// ===== Инициализация =====
loadBooks();
loadPosts();
loadSettings();
