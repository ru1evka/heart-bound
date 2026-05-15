// ===== Загрузка данных из API с retry =====
let booksData = [];
let postsData = [];

async function fetchWithRetry(url, retries = 3, delay = 1500) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url);
            if (res.status === 503) {
                // Сервер ещё запускается
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e) {
            if (i < retries - 1) {
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    return null;
}

async function loadBooks() {
    const data = await fetchWithRetry('/api/books');
    booksData = data || [];
    renderBookCards();
    observeAnimated();
}

async function loadPosts() {
    const data = await fetchWithRetry('/api/posts');
    postsData = data || [];
    renderBlogPosts();
    observeAnimated();
}

// ===== Динамический рендер книг =====
function renderBookCards() {
    const grid = document.querySelector('.book-grid');
    if (!grid) return;

    if (booksData.length === 0) {
        grid.innerHTML = '<p style="text-align:center;color:#5a4756;padding:40px;">Книги скоро появятся...</p>';
        return;
    }

    grid.innerHTML = booksData.map(book => {
        const cover = book.cover || '';
        const isVideo = cover.endsWith('.mp4') || cover.endsWith('.webm');
        const isGif = cover.endsWith('.gif');

        let mediaHtml = '';
        if (isVideo) {
            mediaHtml = `<video class="book-card__media" autoplay muted loop playsinline><source src="${escAttr(cover)}" type="video/mp4"></video>`;
        } else if (cover) {
            mediaHtml = `<img class="book-card__media" src="${escAttr(cover)}" alt="${escAttr(book.title)}">`;
        }

        const badgeHtml = book.badge
            ? `<span class="book-card__badge${book.badge === 'Бестселлер' ? ' book-card__badge--gold' : ''}">${escHtml(book.badge)}</span>`
            : '';

        return `
        <article class="book-card" data-book="${escAttr(book.id)}">
            <div class="book-card__cover" style="background: ${book.color || '#9a3f55'}">
                ${mediaHtml}
                ${badgeHtml}
            </div>
            <div class="book-card__body">
                <h3>${escHtml(book.title)}</h3>
                <p class="book-card__genre">${escHtml(book.genre)}</p>
                <p class="book-card__desc">${escHtml(book.description)}</p>
                <button class="btn btn--small open-book" data-book="${escAttr(book.id)}">Читать пролог</button>
            </div>
        </article>`;
    }).join('');
}

// ===== Динамический рендер блога =====
function renderBlogPosts() {
    const grid = document.querySelector('.blog-grid');
    if (!grid) return;

    if (postsData.length === 0) {
        grid.innerHTML = '<p style="text-align:center;color:#5a4756;padding:40px;">Записи скоро появятся...</p>';
        return;
    }

    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    grid.innerHTML = postsData.map(post => {
        let dateStr = '';
        if (post.date) {
            const d = new Date(post.date);
            if (!isNaN(d)) dateStr = `${d.getDate()} ${months[d.getMonth()]}`;
        }
        return `
        <article class="post" data-post="${escAttr(post.id)}">
            <div class="post__date">${escHtml(dateStr)}</div>
            <h3>${escHtml(post.title)}</h3>
            <p>${escHtml(post.content)}</p>
            <button class="btn btn--small post__more-btn" data-post="${escAttr(post.id)}">Читать →</button>
        </article>`;
    }).join('');
}

// ===== Инициализация =====
loadBooks();
loadPosts();

// ===== Модальное окно книги =====
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalGenre = document.getElementById('modalGenre');
const modalPrologue = document.getElementById('modalPrologue');
const modalMedia = document.getElementById('modalMedia');
const modalFallback = document.getElementById('modalFallback');
const linkLitnet = document.getElementById('linkLitnet');
const linkLitgorod = document.getElementById('linkLitgorod');

function openBook(id) {
    const book = booksData.find(b => b.id === id || b.id === String(id));
    if (!book) return;
    modalTitle.textContent = book.title;
    modalGenre.textContent = book.genre;

    // Пролог: разбиваем по \n\n на параграфы
    const paragraphs = (book.prologue || '').split(/\n\n+/).filter(Boolean).map(p => `<p>${escHtml(p)}</p>`).join('');
    modalPrologue.innerHTML = paragraphs;

    // Медиа в модалке
    const cover = book.cover || '';
    const isVideo = cover.endsWith('.mp4') || cover.endsWith('.webm');
    if (isVideo) {
        modalMedia.style.display = '';
        modalMedia.src = cover;
        modalMedia.load();
        modalFallback.style.display = 'none';
    } else {
        modalMedia.style.display = 'none';
        modalFallback.style.display = '';
        modalFallback.src = cover;
        modalFallback.alt = book.title;
    }

    linkLitnet.href = book.litnet || 'https://litnet.com/';
    linkLitgorod.href = book.litgorod || 'https://litgorod.ru/';

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
}

function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    modalMedia.pause();
}

// ===== Модальное окно поста =====
const postModal = document.getElementById('postModalView');

function openPost(id) {
    const post = postsData.find(p => p.id === id || p.id === String(id));
    if (!post) return;

    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    let dateStr = '';
    if (post.date) {
        const d = new Date(post.date);
        if (!isNaN(d)) dateStr = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    }

    document.getElementById('postViewTitle').textContent = post.title;
    document.getElementById('postViewDate').textContent = dateStr;
    document.getElementById('postViewContent').innerHTML = (post.content || '').split(/\n\n+/).filter(Boolean).map(p => `<p>${escHtml(p)}</p>`).join('') || `<p>${escHtml(post.content)}</p>`;

    postModal.classList.add('is-open');
    postModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
}

function closePostModal() {
    postModal.classList.remove('is-open');
    postModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
}

// ===== Делегирование событий =====
document.addEventListener('click', e => {
    // Кнопка «Читать пролог»
    const bookBtn = e.target.closest('.open-book');
    if (bookBtn) { e.preventDefault(); e.stopPropagation(); openBook(bookBtn.dataset.book); return; }

    // Клик по карточке книги
    const card = e.target.closest('.book-card');
    if (card && !e.target.closest('.open-book')) { e.preventDefault(); openBook(card.dataset.book); return; }

    // Кнопка «Читать» в блоге
    const postBtn = e.target.closest('.post__more-btn');
    if (postBtn) { e.preventDefault(); e.stopPropagation(); openPost(postBtn.dataset.post); return; }

    // Клик по карточке поста
    const postCard = e.target.closest('.post');
    if (postCard && postCard.dataset.post) { e.preventDefault(); openPost(postCard.dataset.post); return; }
});

// Закрытие модалок
modal.addEventListener('click', e => {
    if (e.target.dataset.close !== undefined) closeModal();
});

postModal.addEventListener('click', e => {
    if (e.target.dataset.close !== undefined) closePostModal();
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        if (modal.classList.contains('is-open')) closeModal();
        if (postModal.classList.contains('is-open')) closePostModal();
    }
});

// ===== Бургер-меню =====
const burger = document.getElementById('burger');
const nav = document.querySelector('.nav');
burger.addEventListener('click', () => nav.classList.toggle('is-open'));
nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => nav.classList.remove('is-open'));
});

// ===== Плавное появление при скролле =====
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, { threshold: 0.12 });

function observeAnimated() {
    document.querySelectorAll('.book-card, .post, .tg-qr, .about__inner').forEach(el => {
        if (el.dataset.observed) return;
        el.dataset.observed = '1';
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity .8s ease, transform .8s ease';
        observer.observe(el);
    });
}
observeAnimated();

// ===== Утилиты =====
function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}
function escAttr(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
