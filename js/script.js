// script.js - 时光影集前端交互逻辑
let photos = [];           // 存储所有照片元数据
let months = [];           // 按月分组后的数组
let currentOpenMonth = null;  // 当前展开的月份标识

// DOM 元素
const coverSection = document.getElementById('coverSection');
const timelineSection = document.getElementById('timelineSection');
const timelineContainer = document.getElementById('timelineContainer');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxCaption = document.getElementById('lightboxCaption');
const closeLightboxBtn = document.getElementById('closeLightboxBtn');

// 简易防XSS工具函数
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[m] || m));
}

// 从已加载的照片中随机抽取一张作为封面背景
function setRandomCoverBackground(photosData) {
    if (photosData && photosData.length > 0) {
        const randomIndex = Math.floor(Math.random() * photosData.length);
        const randomPhoto = photosData[randomIndex];
        coverSection.style.backgroundImage = `url('${randomPhoto.imagePath}')`;
        coverSection.style.backgroundSize = 'cover';
        coverSection.style.backgroundPosition = 'center';
    } else {
        coverSection.style.backgroundColor = '#2c5a6e';
    }
}

// 页面滚动切换（两屏结构：封面<->时间轴）
let currentSectionIndex = 0;
const sections = document.querySelectorAll('.section');
function scrollToSection(index) {
    if (index < 0 || index >= sections.length) return;
    sections[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
    currentSectionIndex = index;
}

let wheelTimer = null;
function bindWheelPageSwitch() {
    window.addEventListener('wheel', (e) => {
        // 若鼠标在照片区域或卡片上滚动，不触发全局翻页
        if (e.target.closest('.photo-section, .horizontal-scroll, .timeline-card')) return;
        if (wheelTimer) return;
        wheelTimer = setTimeout(() => { wheelTimer = null; }, 300);
        const delta = e.deltaY;
        if (delta > 0 && currentSectionIndex === 0) scrollToSection(1);
        else if (delta < 0 && currentSectionIndex === 1) scrollToSection(0);
    });
}

// 按年月分组照片（仅依赖日期字符串格式："2025年 03月 15日"）
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
    // 组内按时间戳排序
    for (let group of groups.values()) {
        group.items.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    }
    // 按时间升序排列月份组
    const sortedGroups = Array.from(groups.values());
    sortedGroups.sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));
    return sortedGroups;
}

// 渲染时间轴节点（横向圆点+标签）
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

    // 绑定点击事件：点击节点展开/收起对应的照片区域
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

// 展开指定月份的照片列表
function expandPhotoSection(monthKey) {
    if (currentOpenMonth === monthKey) return;
    if (currentOpenMonth) collapsePhotoSection();

    const monthData = months.find(m => m.yearMonth === monthKey);
    if (!monthData || !monthData.items.length) return;

    currentOpenMonth = monthKey;
    // 激活对应节点的样式
    document.querySelectorAll('.timeline-node').forEach(node => {
        const m = node.getAttribute('data-month');
        node.classList.toggle('active', m === currentOpenMonth);
    });
    timelineSection.classList.add('timeline-expanded');

    const photoSection = document.getElementById('photoSection');
    if (!photoSection) return;
    photoSection.classList.add('expanded');

    // 构建照片卡片HTML
    let html = `<div class="section-header">
                    <span class="section-title">${escapeHtml(monthData.displayMonth)} · ${monthData.items.length}张</span>
                    <button class="close-section-btn"><i class="fas fa-times"></i></button>
                </div>
                <div class="horizontal-scroll">`;

    monthData.items.forEach(photo => {
        const safeDate = escapeHtml(photo.date);
        const safeIntro = escapeHtml(photo.intro || '');
        const safeLocation = escapeHtml(photo.location || '');
        const shutter = photo.shutter || '';
        const aperture = photo.aperture || '';
        const iso = photo.iso || '';
        const exifRaw = `${shutter} ${aperture} ${iso}`.trim();
        const exifEscaped = escapeHtml(exifRaw);
        const imageUrl = photo.imagePath;

        html += `
            <div class="timeline-card" 
                 data-img-large="${imageUrl}" 
                 data-img-date="${safeDate}" 
                 data-img-exif="${exifEscaped}" 
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

    // 为每张卡片绑定灯箱打开事件
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

    // 绑定月份面板的关闭按钮
    const closeBtn = photoSection.querySelector('.close-section-btn');
    if (closeBtn) closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        collapsePhotoSection();
    });

    enableHorizontalWheelScroll(); // 启用横向滚动优化
}

// 收起当前打开的照片区域
function collapsePhotoSection() {
    const photoSection = document.getElementById('photoSection');
    if (photoSection) {
        photoSection.classList.remove('expanded');
        photoSection.innerHTML = '';
    }
    document.querySelectorAll('.timeline-node').forEach(node => node.classList.remove('active'));
    currentOpenMonth = null;
    timelineSection.classList.remove('timeline-expanded');
}

// 允许在横向滚动容器中使用鼠标滚轮横向滚动
function enableHorizontalWheelScroll() {
    const containers = document.querySelectorAll('.horizontal-scroll');
    containers.forEach(container => {
        if (container._wheelBound) return;
        container._wheelBound = true;
        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            let delta = e.deltaY || e.detail || 0;
            if (e.deltaMode === 0 && Math.abs(delta) < 50) delta *= 18;
            container.scrollLeft += delta;
        }, { passive: false });
    });
}

// 初始化时间轴（构建月份分组，渲染节点，准备照片区域）
function initTimeline() {
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
    renderTimelineNodes();
}

// 加载照片数据并启动应用
fetch('photos.json')
    .then(res => res.json())
    .then(data => {
        photos = data;
        setRandomCoverBackground(photos);   // 使用已加载的数据设置封面
        initTimeline();
        bindWheelPageSwitch();
    })
    .catch(err => {
        console.error(err);
        timelineContainer.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>未找到 photos.json，请运行 generate.js 生成。</p></div>`;
        coverSection.style.backgroundColor = '#2c5a6e';
        bindWheelPageSwitch();
    });

// 灯箱关闭逻辑
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

// 主题切换（深色/浅色模式）初始化及监听
(function initTheme() {
    const themeCheckbox = document.getElementById('themeToggleCheckbox');
    if (!themeCheckbox) return;
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    function setTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            themeCheckbox.checked = true;
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
            themeCheckbox.checked = false;
        }
    }

    if (savedTheme) setTheme(savedTheme);
    else setTheme(prefersDark ? 'dark' : 'light');

    themeCheckbox.addEventListener('change', (e) => setTheme(e.target.checked ? 'dark' : 'light'));
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) setTheme(e.matches ? 'dark' : 'light');
    });
})();