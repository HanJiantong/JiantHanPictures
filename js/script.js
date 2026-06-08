// 全局变量
let photos = [];
let months = [];
let currentOpenMonth = null;

// DOM 元素
const timelineContainer = document.getElementById('timelineContainer');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxCaption = document.getElementById('lightboxCaption');
const closeLightboxBtn = document.getElementById('closeLightboxBtn');
const expandAllBtn = document.getElementById('expandAllBtn');
const collapseAllBtn = document.getElementById('collapseAllBtn');

let timelineWrapper = null;     // 时间轴外层容器（用于垂直居中）
let timelineElement = null;     // 时间轴实际元素

// 辅助函数
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
}

// 按月分组（升序）
function groupPhotosByMonth(photosArray) {
    const groups = new Map();
    photosArray.forEach(photo => {
        const match = photo.date.match(/(\d{4})年\s*(\d{1,2})月/);
        if (!match) return;
        const year = match[1];
        const month = match[2].padStart(2, '0');
        const yearMonth = `${year}-${month}`;
        const displayMonth = `${year}年 ${parseInt(month)}月`;
        if (!groups.has(yearMonth)) {
            groups.set(yearMonth, { yearMonth, displayMonth, items: [] });
        }
        groups.get(yearMonth).items.push(photo);
    });
    const sorted = Array.from(groups.values());
    sorted.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    return sorted;
}

// 居中时间轴（仅在无展开月份时生效）
function centerTimelineVertically() {
    if (!timelineWrapper || !timelineElement) return;
    if (currentOpenMonth !== null) return; // 展开时不做居中
    const viewportHeight = window.innerHeight;
    const timelineHeight = timelineElement.offsetHeight;
    const marginTop = Math.max(20, (viewportHeight - timelineHeight) / 2);
    timelineWrapper.style.marginTop = `${marginTop}px`;
}

// 渲染时间轴节点
function renderTimelineNodes() {
    const track = document.querySelector('.horizontal-timeline-track');
    if (!track) return;
    if (!months.length) {
        track.innerHTML = '<div class="empty-state">无照片数据</div>';
        return;
    }
    let html = '';
    months.forEach(month => {
        const activeClass = (currentOpenMonth === month.yearMonth) ? 'active' : '';
        html += `
            <div class="timeline-node ${activeClass}" data-month="${month.yearMonth}">
                <div class="node-dot"></div>
                <div class="node-label">${escapeHtml(month.displayMonth)}</div>
            </div>
        `;
    });
    track.innerHTML = html;
    // 绑定节点点击事件
    document.querySelectorAll('.timeline-node').forEach(node => {
        node.addEventListener('click', (e) => {
            e.stopPropagation();
            const monthKey = node.getAttribute('data-month');
            if (monthKey === currentOpenMonth) {
                collapsePhotoSection();
            } else {
                expandPhotoSection(monthKey);
            }
        });
    });
}

// 展开指定月份的照片区域
function expandPhotoSection(monthKey) {
    if (currentOpenMonth === monthKey) return;
    if (currentOpenMonth) {
        collapsePhotoSection();
    }
    const monthData = months.find(m => m.yearMonth === monthKey);
    if (!monthData || !monthData.items.length) return;
    currentOpenMonth = monthKey;

    // 更新节点高亮
    document.querySelectorAll('.timeline-node').forEach(node => {
        const m = node.getAttribute('data-month');
        if (m === currentOpenMonth) node.classList.add('active');
        else node.classList.remove('active');
    });

    // 让时间轴脱离居中（设置固定小边距）
    if (timelineWrapper) {
        timelineWrapper.style.marginTop = '20px';
    }

    const photoSection = document.getElementById('photoSection');
    if (!photoSection) return;
    photoSection.classList.add('expanded');

    let html = `<div class="section-header">
                    <span class="section-title">${escapeHtml(monthData.displayMonth)} · ${monthData.items.length}张</span>
                    <button class="close-section-btn"><i class="fas fa-times"></i></button>
                </div>
                <div class="horizontal-scroll">`;
    monthData.items.forEach(photo => {
        const safeDate = escapeHtml(photo.date);
        const safeIntro = escapeHtml(photo.intro || '');
        const safeLocation = escapeHtml(photo.location || '');
        const shutter = escapeHtml(photo.shutter || '');
        const aperture = escapeHtml(photo.aperture || '');
        const iso = escapeHtml(photo.iso || '');
        const imageUrl = photo.imagePath;
        let exifLine = '';
        if (shutter || aperture || iso) {
            exifLine = `${shutter} ${aperture} ${iso}`;
        }
        html += `
            <div class="timeline-card" 
                 data-img-large="${imageUrl}" 
                 data-img-date="${safeDate}" 
                 data-img-exif="${escapeHtml(exifLine)}" 
                 data-img-location="${safeLocation}" 
                 data-img-intro="${safeIntro}">
                <div class="card-image">
                    <img src="${imageUrl}" alt="照片" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20200%20150%22%3E%3Crect%20width%3D%22200%22%20height%3D%22150%22%20fill%3D%22%23eef2fa%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20fill%3D%22%2394a3b8%22%3E图片加载失败%3C%2Ftext%3E%3C%2Fsvg%3E'">
                    <div class="image-overlay-icon"><i class="fas fa-search-plus"></i> 点击查看详情</div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    photoSection.innerHTML = html;

    // 绑定缩略图点击事件（显示大图和详细信息）
    document.querySelectorAll('.timeline-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('.close-section-btn')) return;
            const largeUrl = card.getAttribute('data-img-large');
            const date = card.getAttribute('data-img-date');
            const exif = card.getAttribute('data-img-exif');
            const location = card.getAttribute('data-img-location');
            const intro = card.getAttribute('data-img-intro');
            if (largeUrl) {
                let captionHtml = `<div><i class="far fa-calendar-alt"></i> ${date}</div>`;
                if (exif) captionHtml += `<div><i class="fas fa-camera"></i> ${exif}</div>`;
                if (location) captionHtml += `<div><i class="fas fa-map-marker-alt"></i> ${location}</div>`;
                if (intro) captionHtml += `<div><i class="fas fa-pen"></i> ${intro}</div>`;
                lightboxCaption.innerHTML = captionHtml;
                lightboxImg.src = largeUrl;
                lightbox.style.display = 'flex';
                document.body.style.overflow = 'hidden';
            }
        });
    });

    // 绑定关闭按钮
    const closeBtn = photoSection.querySelector('.close-section-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            collapsePhotoSection();
        });
    }
}

// 收起照片区域，恢复时间轴垂直居中
function collapsePhotoSection() {
    const photoSection = document.getElementById('photoSection');
    if (photoSection) {
        photoSection.classList.remove('expanded');
        photoSection.innerHTML = '';
    }
    // 清除节点高亮
    document.querySelectorAll('.timeline-node').forEach(node => {
        node.classList.remove('active');
    });
    currentOpenMonth = null;
    // 恢复时间轴垂直居中
    if (timelineWrapper) {
        timelineWrapper.style.marginTop = '';
    }
    // 重新计算居中
    centerTimelineVertically();
}

// 初始化页面结构
function init() {
    if (!photos.length) {
        timelineContainer.innerHTML = `<div class="empty-state"><i class="far fa-images"></i><p>暂无照片，请运行 generate.js 生成 photos.json。</p></div>`;
        return;
    }
    months = groupPhotosByMonth(photos);
    if (!months.length) {
        timelineContainer.innerHTML = `<div class="empty-state"><i class="far fa-images"></i><p>没有有效的日期数据。</p></div>`;
        return;
    }
    timelineContainer.innerHTML = `
        <div class="timeline-wrapper" id="timelineWrapper">
            <div class="horizontal-timeline">
                <div class="horizontal-timeline-track"></div>
            </div>
        </div>
        <div id="photoSection" class="photo-section"></div>
    `;
    timelineWrapper = document.getElementById('timelineWrapper');
    timelineElement = timelineWrapper?.querySelector('.horizontal-timeline');
    renderTimelineNodes();
    // 初始垂直居中
    centerTimelineVertically();
    window.addEventListener('resize', () => centerTimelineVertically());
}

// 加载数据
fetch('photos.json')
    .then(res => res.json())
    .then(data => {
        photos = data;
        init();
    })
    .catch(err => {
        console.error(err);
        timelineContainer.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>未找到 photos.json，请运行 generate.js 生成。</p></div>`;
    });

// 隐藏不需要的按钮
if (expandAllBtn) expandAllBtn.style.display = 'none';
if (collapseAllBtn) collapseAllBtn.style.display = 'none';

// 灯箱关闭事件
closeLightboxBtn.addEventListener('click', () => {
    lightbox.style.display = 'none';
    document.body.style.overflow = '';
    lightboxImg.src = '';
});
lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
        lightbox.style.display = 'none';
        document.body.style.overflow = '';
        lightboxImg.src = '';
    }
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.style.display === 'flex') {
        lightbox.style.display = 'none';
        document.body.style.overflow = '';
        lightboxImg.src = '';
    }
});

// 主题切换（保持不变）
(function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
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
    if (savedTheme) setTheme(savedTheme);
    else setTheme(prefersDark ? 'dark' : 'light');
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) setTheme(e.matches ? 'dark' : 'light');
    });
    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        setTheme(isDark ? 'light' : 'dark');
    });
})();