// generate-photos.js
const fs = require('fs-extra');
const path = require('path');
const exifr = require('exifr');

const imagesDir = path.join(__dirname, 'images');
const outputFile = path.join(__dirname, 'photos.json');

// 支持的图片扩展名
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

async function getPhotoDate(filePath) {
    try {
        const exif = await exifr.parse(filePath, { pick: ['DateTimeOriginal', 'CreateDate'] });
        if (exif && (exif.DateTimeOriginal || exif.CreateDate)) {
            const dateStr = exif.DateTimeOriginal || exif.CreateDate;
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) return date;
        }
    } catch (err) {
        console.warn(`无法读取EXIF: ${path.basename(filePath)}`, err.message);
    }
    // 回退到文件修改时间
    const stats = await fs.stat(filePath);
    return new Date(stats.mtime);
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
        const relativePath = path.relative(__dirname, fullPath).replace(/\\/g, '/'); // 相对路径
        const fileName = path.basename(fullPath);
        const dateObj = await getPhotoDate(fullPath);
        const timestamp = dateObj.getTime();
        const displayDate = `${dateObj.getFullYear()}年 ${String(dateObj.getMonth() + 1).padStart(2, '0')}月 ${String(dateObj.getDate()).padStart(2, '0')}日`;
        let title = "";
        const description = `拍摄于 ${displayDate} · 文件大小: ${(fs.statSync(fullPath).size / 1024).toFixed(1)} KB`;
        photos.push({
            date: displayDate,
            title: title,
            description: description,
            imagePath: relativePath,
            timestamp: timestamp
        });
    }
    // 按时间戳升序排序（旧照片在前）
    photos.sort((a, b) => a.timestamp - b.timestamp);
    // 移除临时 timestamp 字段
    const output = photos.map(({ timestamp, ...rest }) => rest);
    await fs.writeJson(outputFile, output, { spaces: 2 });
    console.log(`✅ 已生成 ${outputFile}，共 ${output.length} 张照片。`);
}

generate().catch(err => console.error(err));
