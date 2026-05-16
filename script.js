// ===== Загрузка данных из API с retry =====
let booksData = [];
let postsData = [];
let siteSettings = {};

// Пагинация
const PAGE_SIZE = 6;
let booksShown = PAGE_SIZE;
let postsShown = PAGE_SIZE;

async function fetchWithRetry(url, retries = 3, delay = 1500) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url);
            if (res.status === 503) {
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
    booksShown = PAGE_SIZE;
    renderBookCards();
    observeAnimated();
}

async function loadPosts() {
    const data = await fetchWithRetry('/api/posts');
    postsData = data || [];
    postsShown = PAGE_SIZE;
    renderBlogPosts();
    observeAnimated();
}

async function loadSettings() {
    const data = await fetchWithRetry('/api/settings');
    siteSettings = data || {};
    renderSocials();
    renderTgQr();
    renderFooterLinks();
}

// ===== Динамический рендер книг с пагинацией =====
function renderBookCards() {
    const grid = document.querySelector('.book-grid');
    const loadMoreWrap = document.getElementById('booksLoadMoreWrap');
    if (!grid) return;

    if (booksData.length === 0) {
        grid.innerHTML = '<p style="text-align:center;color:#5a4756;padding:40px;">Книги скоро появятся...</p>';
        if (loadMoreWrap) loadMoreWrap.style.display = 'none';
        return;
    }

    const visible = booksData.slice(0, booksShown);
    grid.innerHTML = visible.map(book => {
        const cover = book.cover || '';
        const isVideo = cover.endsWith('.mp4') || cover.endsWith('.webm');
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
                <button class="btn btn--small open-book" data-book="${escAttr(book.id)}">Читать аннотацию</button>
            </div>
        </article>`;
    }).join('');

    // Показать/скрыть кнопку «Загрузить ещё»
    if (loadMoreWrap) {
        loadMoreWrap.style.display = booksData.length > booksShown ? '' : 'none';
    }
}

// ===== Динамический рендер блога с пагинацией =====
function renderBlogPosts() {
    const grid = document.querySelector('.blog-grid');
    const loadMoreWrap = document.getElementById('postsLoadMoreWrap');
    if (!grid) return;

    if (postsData.length === 0) {
        grid.innerHTML = '<p style="text-align:center;color:#5a4756;padding:40px;">Записи скоро появятся...</p>';
        if (loadMoreWrap) loadMoreWrap.style.display = 'none';
        return;
    }

    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    const visible = postsData.slice(0, postsShown);
    grid.innerHTML = visible.map(post => {
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

    if (loadMoreWrap) {
        loadMoreWrap.style.display = postsData.length > postsShown ? '' : 'none';
    }
}

// ===== Кнопки «Загрузить ещё» =====
document.getElementById('booksLoadMore')?.addEventListener('click', () => {
    booksShown += PAGE_SIZE;
    renderBookCards();
    observeAnimated();
});

document.getElementById('postsLoadMore')?.addEventListener('click', () => {
    postsShown += PAGE_SIZE;
    renderBlogPosts();
    observeAnimated();
});

// ===== Инициализация =====
loadBooks();
loadPosts();
loadSettings();

// ===== Модальное окно книги =====
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalGenre = document.getElementById('modalGenre');
const modalPrologue = document.getElementById('modalPrologue');
const modalMedia = document.getElementById('modalMedia');
const modalFallback = document.getElementById('modalFallback');
const linkLitnet = document.getElementById('linkLitnet');
const linkLitgorod = document.getElementById('linkLitgorod');
const linkLitres = document.getElementById('linkLitres');

function openBook(id) {
    const book = booksData.find(b => b.id === id || b.id === String(id));
    if (!book) return;
    modalTitle.textContent = book.title;
    modalGenre.textContent = book.genre;

    const paragraphs = (book.prologue || '').split(/\n\n+/).filter(Boolean).map(p => `<p>${escHtml(p)}</p>`).join('');
    modalPrologue.innerHTML = paragraphs;

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
    linkLitnet.style.display = book.litnet ? '' : 'none';
    linkLitgorod.href = book.litgorod || 'https://litgorod.ru/';
    linkLitgorod.style.display = book.litgorod ? '' : 'none';

    // Литрес
    if (linkLitres) {
        if (book.litres) {
            linkLitres.href = book.litres;
            linkLitres.style.display = '';
        } else {
            linkLitres.style.display = 'none';
        }
    }

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
    const bookBtn = e.target.closest('.open-book');
    if (bookBtn) { e.preventDefault(); e.stopPropagation(); openBook(bookBtn.dataset.book); return; }
    const card = e.target.closest('.book-card');
    if (card && !e.target.closest('.open-book')) { e.preventDefault(); openBook(card.dataset.book); return; }
    const postBtn = e.target.closest('.post__more-btn');
    if (postBtn) { e.preventDefault(); e.stopPropagation(); openPost(postBtn.dataset.post); return; }
    const postCard = e.target.closest('.post');
    if (postCard && postCard.dataset.post) { e.preventDefault(); openPost(postCard.dataset.post); return; }
});

modal.addEventListener('click', e => { if (e.target.dataset.close !== undefined) closeModal(); });
postModal.addEventListener('click', e => { if (e.target.dataset.close !== undefined) closePostModal(); });
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

// ===== Рендер соцсетей из настроек =====
function renderSocials() {
    const container = document.querySelector('.socials__row');
    if (!container) return;

    const socials = [
        { key: 'social_telegram', name: 'Telegram', cls: 'social--tg', icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 4.5L2.5 12l5.5 1.8L17 7.5 9.5 14l-.3 4.5 3-2.7 4.5 3.4z"/></svg>' },
        { key: 'social_vk', name: 'ВКонтакте', cls: 'social--vk', icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.7 17h1.2c.4 0 .6-.2.6-.6 0-.7.4-1.3 1-1.3.7 0 1.5 1.6 2.4 2 .3.1.7-.1.8-.5l.4-1.4c.1-.4-.1-.7-.5-.8l-2-.9c-.6-.3-.5-.7 0-1.4 1.2-1.6 2.5-3.4 2-3.9-.3-.3-1.7-.2-3.2-.2-.4 0-.7.2-.9.6-.7 1.5-2 3.4-2.5 3.4-.5 0-.6-2.4-.6-3.4 0-.4-.4-.6-.7-.6H7.6c-.4 0-.7.3-.7.6 0 1.4 1.6 2 1.6 4.2 0 1-.2 1.7-.7 1.7-1 0-2.3-2.5-3-4.6-.1-.3-.4-.6-.8-.6H2c-.4 0-.7.3-.6.7C2.5 13 6 17 12.7 17z"/></svg>' },
        { key: 'social_instagram', name: 'Instagram', cls: 'social--inst', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>' },
        { key: 'social_youtube', name: 'YouTube', cls: 'social--yt', icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23 7s-.2-1.5-.9-2.2c-.8-.8-1.7-.8-2.1-.9C16.9 3.6 12 3.6 12 3.6s-4.9 0-8 .3c-.4.1-1.3.1-2.1.9C1.2 5.5 1 7 1 7S.7 8.8.7 10.5v1.5c0 1.7.3 3.5.3 3.5s.2 1.5.9 2.2c.8.8 1.9.8 2.4.9 1.7.2 7.7.3 7.7.3s4.9 0 8-.3c.4-.1 1.3-.1 2.1-.9.7-.7.9-2.2.9-2.2s.3-1.8.3-3.5v-1.5C23.3 8.8 23 7 23 7zM9.7 14.5V8.4l6.4 3.1-6.4 3z"/></svg>' },
        { key: 'social_tiktok', name: 'TikTok', cls: 'social--tt', icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.88 2.89 2.89 0 01-2.88-2.88 2.89 2.89 0 012.88-2.88c.28 0 .56.04.82.1v-3.5a6.37 6.37 0 00-.82-.05A6.34 6.34 0 003.15 15.7a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.4a8.16 8.16 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.83z"/></svg>' },
        { key: 'social_dzen', name: 'Дзен', cls: 'social--dzen', icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.1 0 2 .9 2 2v2.5L16.5 12 14 14.5V17c0 1.1-.9 2-2 2s-2-.9-2-2v-2.5L7.5 12 10 9.5V7c0-1.1.9-2 2-2z"/></svg>' }
    ];

    const html = socials
        .filter(s => siteSettings[s.key])
        .map(s => `<a href="${escAttr(siteSettings[s.key])}" class="social ${s.cls}" aria-label="${s.name}" target="_blank" rel="noopener">${s.icon}<span>${s.name}</span></a>`)
        .join('');

    container.innerHTML = html || '<p style="color:#5a4756">Соцсети не настроены</p>';
}

// ===== Рендер QR-блока из настроек =====
function renderTgQr() {
    const tgLink = document.querySelector('.tg-qr__text .btn--primary');
    const tgUsername = document.querySelector('.tg-qr__code p');
    const tgQrImg = document.querySelector('.tg-qr__code img');

    if (tgLink && siteSettings.telegram_channel) {
        tgLink.href = siteSettings.telegram_channel;
    }
    if (tgUsername && siteSettings.telegram_username) {
        tgUsername.textContent = siteSettings.telegram_username;
    }
    if (tgQrImg) {
        if (siteSettings.qr_image) {
            tgQrImg.src = siteSettings.qr_image;
        } else if (siteSettings.telegram_channel) {
            tgQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(siteSettings.telegram_channel)}&color=2a1a2e&bgcolor=fdf6f0&margin=2`;
        }
    }
}

// ===== Рендер футера из настроек =====
function renderFooterLinks() {
    // Платформы в футере
    const footerCols = document.querySelectorAll('.footer__col');
    footerCols.forEach(col => {
        const links = col.querySelectorAll('a[target="_blank"]');
        links.forEach(link => {
            if (link.textContent.includes('Литнет') && siteSettings.platform_litnet) {
                link.href = siteSettings.platform_litnet;
            }
            if (link.textContent.includes('ЛитГород') && siteSettings.platform_litgorod) {
                link.href = siteSettings.platform_litgorod;
            }
        });
    });

    // Блок «Связь» — рендерим динамически из соцсетей
    const contactCol = document.getElementById('footerContact');
    if (!contactCol) return;

    let html = '<h4>Связь</h4>';

    // Email
    if (siteSettings.contact_email) {
        html += `<a href="mailto:${escAttr(siteSettings.contact_email)}">${escHtml(siteSettings.contact_email)}</a>`;
    }

    // Все соцсети
    const socialLinks = [
        { key: 'social_telegram', name: 'Telegram' },
        { key: 'social_vk', name: 'ВКонтакте' },
        { key: 'social_instagram', name: 'Instagram' },
        { key: 'social_youtube', name: 'YouTube' },
        { key: 'social_tiktok', name: 'TikTok' },
        { key: 'social_dzen', name: 'Дзен' }
    ];

    socialLinks.forEach(s => {
        if (siteSettings[s.key]) {
            html += `<a href="${escAttr(siteSettings[s.key])}" target="_blank" rel="noopener">${s.name}</a>`;
        }
    });

    contactCol.innerHTML = html;
}

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
