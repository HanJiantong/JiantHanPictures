// generate.js
const fs = require('fs-extra');
const path = require('path');
const exifr = require('exifr');

const imagesDir = path.join(__dirname, 'images');
const outputFile = path.join(__dirname, 'photos.json');

const supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];

async function getAllImageFiles(dir) {
    let results = [];
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            results = results.concat(await getAllImageFiles(fullPath));
        } else if (item.isFile()) {
            const ext = path.extname(item.name).toLowerCase();
            if (supportedExtensions.includes(ext)) {
                results.push(fullPath);
            }
        }
    }
    return results;
}

// 格式化快门速度（例如 1/125 或 0.3"）
function formatShutter(exposureTime) {
    if (!exposureTime) return '';
    if (typeof exposureTime === 'number') {
        if (exposureTime >= 1) return `${Math.round(exposureTime)}"`;
        // 转换为分数形式，如 1/125
        const denominator = Math.round(1 / exposureTime);
        return `1/${denominator}`;
    }
    return String(exposureTime);
}

// 格式化光圈（例如 f/2.8）
function formatAperture(fNumber) {
    if (!fNumber) return '';
    if (typeof fNumber === 'number') return `f/${fNumber.toFixed(1)}`;
    return String(fNumber);
}

async function getPhotoMetadata(filePath) {
    try {
        // 读取 EXIF 所需字段
        const exif = await exifr.parse(filePath, {
            pick: ['DateTimeOriginal', 'CreateDate', 'ExposureTime', 'FNumber', 'ISO']
        });
        let date = null;
        if (exif && (exif.DateTimeOriginal || exif.CreateDate)) {
            const dateStr = exif.DateTimeOriginal || exif.CreateDate;
            date = new Date(dateStr);
        }
        if (!date || isNaN(date.getTime())) {
            const stats = await fs.stat(filePath);
            date = new Date(stats.mtime);
        }
        const shutter = exif?.ExposureTime ? formatShutter(exif.ExposureTime) : '';
        const aperture = exif?.FNumber ? formatAperture(exif.FNumber) : '';
        const iso = exif?.ISO ? `ISO ${exif.ISO}` : '';
        return { date, shutter, aperture, iso };
    } catch (err) {
        console.warn(`无法读取EXIF: ${path.basename(filePath)}`, err.message);
        const stats = await fs.stat(filePath);
        return { date: new Date(stats.mtime), shutter: '', aperture: '', iso: '' };
    }
}

async function generate() {
    console.log('开始扫描图片文件夹...');
    const imageFiles = await getAllImageFiles(imagesDir);
    if (imageFiles.length === 0) {
        console.error('未找到任何图片，请将照片放入 images 文件夹');
        return;
    }
    console.log(`找到 ${imageFiles.length} 张图片，正在读取 EXIF...`);

    const photos = [];
    for (const fullPath of imageFiles) {
        const relativePath = path.relative(__dirname, fullPath).replace(/\\/g, '/');
        const fileName = path.basename(fullPath);
        const { date, shutter, aperture, iso } = await getPhotoMetadata(fullPath);
        const timestamp = date.getTime();
        const displayDate = `${date.getFullYear()}年 ${String(date.getMonth() + 1).padStart(2, '0')}月 ${String(date.getDate()).padStart(2, '0')}日`;

        // 固定标题（不显示文件名）
        const title = "📷 时光影像";
        // 自动生成简介（可后续手动覆盖）
        const intro = `拍摄于 ${displayDate} · 文件大小: ${(fs.statSync(fullPath).size / 1024).toFixed(1)} KB`;
        // 预留地点字段（初始为空）
        const location = "";

        photos.push({
            date: displayDate,
            title: title,
            intro: intro,          // 简介（可编辑）
            location: location,    // 地点（可编辑）
            shutter: shutter,
            aperture: aperture,
            iso: iso,
            imagePath: relativePath,
            timestamp: timestamp
        });
    }
    photos.sort((a, b) => a.timestamp - b.timestamp);
    const output = photos.map(({ timestamp, ...rest }) => rest);
    await fs.writeJson(outputFile, output, { spaces: 2 });
    console.log(`✅ 已生成 ${outputFile}，共 ${output.length} 张照片。`);
    console.log('提示：您可以手动编辑 photos.json 中的 location 和 intro 字段来补充地点和简介。');
}

generate().catch(err => console.error(err));