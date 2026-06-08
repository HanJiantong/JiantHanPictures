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

function formatShutter(exposureTime) {
    if (!exposureTime) return '';
    if (typeof exposureTime === 'number') {
        if (exposureTime >= 1) return `${Math.round(exposureTime)}"`;
        const denominator = Math.round(1 / exposureTime);
        return `1/${denominator}`;
    }
    return String(exposureTime);
}

function formatAperture(fNumber) {
    if (!fNumber) return '';
    if (typeof fNumber === 'number') return `f/${fNumber.toFixed(1)}`;
    return String(fNumber);
}

async function getPhotoMetadata(filePath) {
    try {
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
        const { date, shutter, aperture, iso } = await getPhotoMetadata(fullPath);
        const timestamp = date.getTime();
        const displayDate = `${date.getFullYear()}年 ${String(date.getMonth() + 1).padStart(2, '0')}月 ${String(date.getDate()).padStart(2, '0')}日`;
        const fileSizeKB = (fs.statSync(fullPath).size / 1024).toFixed(1);
        const intro = `拍摄于 ${displayDate} · ${fileSizeKB} KB`;
        photos.push({
            date: displayDate,
            intro: intro,
            location: '',
            shutter: shutter,
            aperture: aperture,
            iso: iso,
            imagePath: relativePath,
            timestamp: timestamp   // 保留用于排序
        });
    }
    photos.sort((a, b) => a.timestamp - b.timestamp);
    // 输出时不移除 timestamp 字段
    await fs.writeJson(outputFile, photos, { spaces: 2 });
    console.log(`✅ 已生成 ${outputFile}，共 ${photos.length} 张照片。`);
}

generate().catch(err => console.error(err));