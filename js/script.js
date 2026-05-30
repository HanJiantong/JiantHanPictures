// ---------- 📸 在这里配置您的照片 ----------
// 请按照以下格式填入您的照片信息，并按时间先后排列（显示顺序即数组顺序）
// 支持相对路径，例如 "images/spring.jpg"
const photos = [
    
];

// ---------- 以下为渲染与交互逻辑，一般情况下无需修改 ----------
const timelineContainer = document.getElementById('timelineContainer');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxCaption = document.getElementById('lightboxCaption');
const closeLightboxBtn = document.getElementById('closeLightboxBtn');

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
    if (!photos || photos.length === 0) {
        timelineContainer.innerHTML = `
            <div class="empty-state">
                <i class="far fa-images"></i>
                <p>还没有配置照片，请编辑 script.js 中的 photos 数组添加图片路径及信息。</p>
            </div>
        `;
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
                    <div class="card-description">
                        <i class="fas fa-camera"></i> ${safeDesc}
                    </div>
                </div>
            </div>
        `;
    });
    timelineContainer.innerHTML = html;
    attachLightboxEvents();
}

function attachLightboxEvents() {
    const cardImages = document.querySelectorAll('.card-image');
    cardImages.forEach(card => {
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
lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.style.display === 'flex') closeLightbox();
});

renderTimeline();