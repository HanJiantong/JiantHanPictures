const timelineContainer = document.getElementById('timelineContainer');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxCaption = document.getElementById('lightboxCaption');
const closeLightboxBtn = document.getElementById('closeLightboxBtn');

let photos = []; // 将从 JSON 加载

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function renderTimeline() {
    if (!photos.length) {
        timelineContainer.innerHTML = `<div class="empty-state"><i class="far fa-images"></i><p>暂无照片，请运行 generate-photos.js 生成配置。</p></div>`;
        return;
    }
    let html = '';
    photos.forEach(photo => {
        const safeDate = escapeHtml(photo.date);
        const safeTitle = escapeHtml(photo.title);
        const safeDesc = escapeHtml(photo.description);
        const imageUrl = photo.imagePath;
        html += `
            <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-card">
                    <div class="card-header">
                        <span class="card-date"><i class="far fa-calendar-alt"></i> ${safeDate}</span>
                        <h2 class="card-title">${safeTitle}</h2>
                    </div>
                    <div class="card-image" data-large="${imageUrl}" data-title="${safeTitle}" data-date="${safeDate}">
                        <img src="${imageUrl}" alt="${safeTitle}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20200%20150%22%3E%3Crect%20width%3D%22200%22%20height%3D%22150%22%20fill%3D%22%23eef2fa%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20fill%3D%22%2394a3b8%22%3E图片加载失败%3C%2Ftext%3E%3C%2Fsvg%3E'">
                        <div class="image-overlay-icon"><i class="fas fa-search-plus"></i> 点击放大</div>
                    </div>
                    <div class="card-description"><i class="fas fa-camera"></i> ${safeDesc}</div>
                </div>
            </div>
        `;
    });
    timelineContainer.innerHTML = html;
    attachLightboxEvents();
}

function attachLightboxEvents() {
    document.querySelectorAll('.card-image').forEach(card => {
        card.removeEventListener('click', lightboxHandler);
        card.addEventListener('click', lightboxHandler);
    });
}

function lightboxHandler(e) {
    const largeUrl = this.getAttribute('data-large');
    const title = this.getAttribute('data-title');
    const date = this.getAttribute('data-date');
    if (largeUrl) {
        lightboxImg.src = largeUrl;
        lightboxCaption.innerHTML = `<i class="far fa-calendar-alt"></i> ${date}  ·  ${title}`;
        lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeLightbox() {
    lightbox.style.display = 'none';
    document.body.style.overflow = '';
    lightboxImg.src = '';
}

closeLightboxBtn.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && lightbox.style.display === 'flex') closeLightbox(); });

// 加载 photos.json
fetch('photos.json')
    .then(res => res.json())
    .then(data => {
        photos = data;
        renderTimeline();
    })
    .catch(err => {
        console.error('加载 photos.json 失败，请运行 generate-photos.js', err);
        timelineContainer.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>未找到 photos.json，请运行 node generate-photos.js 生成配置。</p></div>`;
    });
// 主题切换功能
(function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;

    // 读取保存的主题偏好
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // 设置主题
    function setTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            themeToggle.innerHTML = '<i class="fas fa-sun"></i> 亮色模式';
        } else {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
            themeToggle.innerHTML = '<i class="fas fa-moon"></i> 暗色模式';
        }
    }

    // 初始应用
    if (savedTheme) {
        setTheme(savedTheme);
    } else {
        // 跟随系统
        if (prefersDark) {
            setTheme('dark');
        } else {
            setTheme('light');
        }
    }

    // 监听系统主题变化（当没有手动覆盖时）
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const currentManual = localStorage.getItem('theme');
        if (!currentManual) {
            setTheme(e.matches ? 'dark' : 'light');
        }
    });

    // 切换按钮点击
    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        setTheme(isDark ? 'light' : 'dark');
    });
})();