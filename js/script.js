// ---------- 全局变量 ----------
let photos = [];           // 原始照片数据
let groupedPhotos = [];    // 分组后的数据 { yearMonth, displayMonth, items }
let collapsedGroups = new Set();  // 存储折叠的组的 key (yearMonth)

// DOM 元素
const timelineContainer = document.getElementById('timelineContainer');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxCaption = document.getElementById('lightboxCaption');
const closeLightboxBtn = document.getElementById('closeLightboxBtn');
const expandAllBtn = document.getElementById('expandAllBtn');
const collapseAllBtn = document.getElementById('collapseAllBtn');

// 辅助函数
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// 将照片按年月分组 (年-月)
function groupPhotosByMonth(photosArray) {
    const groups = new Map();
    photosArray.forEach(photo => {
        // 从日期字符串中提取年月，格式如 "2023年 04月 15日" -> "2023-04"
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
    // 按年月降序排序（最新的在上方）
    const sortedGroups = Array.from(groups.values());
    sortedGroups.sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
    return sortedGroups;
}

// 加载折叠状态
function loadCollapsedState() {
    const saved = localStorage.getItem('collapsedGroups');
    if (saved) {
        const arr = JSON.parse(saved);
        collapsedGroups = new Set(arr);
    } else {
        // 默认全部展开，也可以设置默认全部折叠，这里设为全部展开
        collapsedGroups.clear();
    }
}

// 保存折叠状态
function saveCollapsedState() {
    localStorage.setItem('collapsedGroups', JSON.stringify(Array.from(collapsedGroups)));
}

// 切换组的折叠状态
function toggleGroup(yearMonth) {
    if (collapsedGroups.has(yearMonth)) {
        collapsedGroups.delete(yearMonth);
    } else {
        collapsedGroups.add(yearMonth);
    }
    saveCollapsedState();
    renderTimeline();  // 重新渲染
}

// 全部展开
function expandAll() {
    collapsedGroups.clear();
    saveCollapsedState();
    renderTimeline();
}

// 全部折叠
function collapseAll() {
    groupedPhotos.forEach(group => {
        collapsedGroups.add(group.yearMonth);
    });
    saveCollapsedState();
    renderTimeline();
}

// 渲染时间轴（分组折叠版）
function renderTimeline() {
    if (!timelineContainer) return;
    if (!photos.length) {
        timelineContainer.innerHTML = `<div class="empty-state"><i class="far fa-images"></i><p>暂无照片，请运行 generate.js 生成 photos.json。</p></div>`;
        return;
    }

    groupedPhotos = groupPhotosByMonth(photos);
    if (groupedPhotos.length === 0) {
        timelineContainer.innerHTML = `<div class="empty-state"><i class="far fa-images"></i><p>没有有效的照片日期数据。</p></div>`;
        return;
    }

    let html = '';
    groupedPhotos.forEach(group => {
        const isCollapsed = collapsedGroups.has(group.yearMonth);
        const collapseIcon = isCollapsed ? 'fa-chevron-right' : 'fa-chevron-down';
        const groupContentStyle = isCollapsed ? 'display: none;' : '';

        html += `
            <div class="timeline-group" data-yearmonth="${group.yearMonth}">
                <div class="timeline-group-header" data-yearmonth="${group.yearMonth}">
                    <i class="fas ${collapseIcon} group-toggle-icon"></i>
                    <span class="group-title">${escapeHtml(group.displayMonth)}</span>
                    <span class="group-count">${group.items.length} 张照片</span>
                </div>
                <div class="timeline-group-content" style="${groupContentStyle}">
                    ${renderGroupItems(group.items)}
                </div>
            </div>
        `;
    });

    timelineContainer.innerHTML = html;

    // 绑定组头部点击事件
    document.querySelectorAll('.timeline-group-header').forEach(header => {
        header.removeEventListener('click', headerClickHandler);
        header.addEventListener('click', headerClickHandler);
    });

    // 绑定图片灯箱事件（动态内容）
    attachLightboxEvents();
}

function renderGroupItems(items) {
    let itemsHtml = '';
    items.forEach(photo => {
        const safeDate = escapeHtml(photo.date);
        const safeTitle = escapeHtml(photo.title);
        const safeIntro = escapeHtml(photo.intro || '');
        const safeLocation = escapeHtml(photo.location || '');
        const shutter = escapeHtml(photo.shutter || '');
        const aperture = escapeHtml(photo.aperture || '');
        const iso = escapeHtml(photo.iso || '');
        const imageUrl = photo.imagePath;

        // 构建参数行（只有非空才显示）
        let exifLine = '';
        if (shutter || aperture || iso) {
            exifLine = `<div class="exif-info"><i class="fas fa-camera"></i> ${shutter} ${aperture} ${iso}</div>`;
        }
        let locationLine = '';
        if (safeLocation) {
            locationLine = `<div class="location-info"><i class="fas fa-map-marker-alt"></i> ${safeLocation}</div>`;
        }

        itemsHtml += `
            <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-card">
                    <div class="card-header">
                        <span class="card-date"><i class="far fa-calendar-alt"></i> ${safeDate}</span>
                    </div>
                    <div class="card-image" data-large="${imageUrl}" data-title="${safeTitle}" data-date="${safeDate}">
                        <img src="${imageUrl}" alt="${safeTitle}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20200%20150%22%3E%3Crect%20width%3D%22200%22%20height%3D%22150%22%20fill%3D%22%23eef2fa%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2250%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20fill%3D%22%2394a3b8%22%3E图片加载失败%3C%2Ftext%3E%3C%2Fsvg%3E'">
                        <div class="image-overlay-icon"><i class="fas fa-search-plus"></i> 点击放大</div>
                    </div>
                    <div class="card-description">
                        ${exifLine}
                        ${locationLine}
                        <div class="intro-text"><i class="fas fa-pen"></i> ${safeIntro}</div>
                    </div>
                </div>
            </div>
        `;
    });
    return itemsHtml;
}

function headerClickHandler(e) {
    const yearMonth = this.getAttribute('data-yearmonth');
    if (yearMonth) {
        toggleGroup(yearMonth);
    }
}

// 灯箱事件（同前）
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

// 初始化加载数据
fetch('photos.json')
    .then(res => res.json())
    .then(data => {
        photos = data;
        loadCollapsedState();
        renderTimeline();
    })
    .catch(err => {
        console.error('加载 photos.json 失败', err);
        timelineContainer.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>未找到 photos.json，请运行 generate.js 生成。</p></div>`;
    });

// 绑定全部展开/折叠按钮（如果存在）
if (expandAllBtn) expandAllBtn.addEventListener('click', expandAll);
if (collapseAllBtn) collapseAllBtn.addEventListener('click', collapseAll);

// 灯箱关闭事件
closeLightboxBtn.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && lightbox.style.display === 'flex') closeLightbox(); });

// 主题切换功能
(function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) {
        console.warn('未找到 themeToggle 按钮，请确认 HTML 中存在 id="themeToggle" 的元素');
        return;
    }

    // 读取保存的主题偏好
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

    // 初始应用
    if (savedTheme) {
        setTheme(savedTheme);
    } else {
        setTheme(prefersDark ? 'dark' : 'light');
    }

    // 监听系统主题变化（仅当用户未手动设置时）
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            setTheme(e.matches ? 'dark' : 'light');
        }
    });

    // 按钮点击事件
    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        setTheme(isDark ? 'light' : 'dark');
    });
})();