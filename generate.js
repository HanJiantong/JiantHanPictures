// generate.js - 照片元数据提取脚本
const fs = require('fs-extra');
const path = require('path');
const exifr = require('exifr');

const imagesDir = path.join(__dirname, 'images');      // 图片源文件夹
const outputFile = path.join(__dirname, 'photos.json'); // 输出文件路径
const supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];

/**
 * 递归获取目录下所有支持的图片文件路径
 * @param {string} dir 目录路径
 * @returns {Promise<string[]>} 图片文件完整路径数组
 */
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

/**
 * 格式化快门速度
 * @param {number|string} exposureTime EXIF曝光时间
 * @returns {string} 格式化后的快门字符串，如 "1/125" 或 '2"'
 */
function formatShutter(exposureTime) {
    if (!exposureTime) return '';
    if (typeof exposureTime === 'number') {
        if (exposureTime >= 1) return `${Math.round(exposureTime)}"`;
        const denominator = Math.round(1 / exposureTime);
        return `1/${denominator}`;
    }
    return String(exposureTime);
}

/**
 * 格式化光圈值
 * @param {number|string} fNumber EXIF光圈值
 * @returns {string} 格式化后的光圈字符串，如 "f/2.8"
 */
function formatAperture(fNumber) {
    if (!fNumber) return '';
    if (typeof fNumber === 'number') return `f/${fNumber.toFixed(1)}`;
    return String(fNumber);
}

/**
 * 提取单张照片的元数据（日期、快门、光圈、ISO、文件大小）
 * @param {string} filePath 图片文件路径
 * @returns {Promise<{date: Date, shutter: string, aperture: string, iso: string, size: number}>}
 */
async function getPhotoMetadata(filePath) {
    // 一次性获取文件状态，用于后续日期回退和文件大小
    const stats = await fs.stat(filePath);
    let date = null;
    let shutter = '';
    let aperture = '';
    let iso = '';

    try {
        const exif = await exifr.parse(filePath, {
            pick: ['DateTimeOriginal', 'CreateDate', 'ExposureTime', 'FNumber', 'ISO']
        });
        if (exif && (exif.DateTimeOriginal || exif.CreateDate)) {
            const dateStr = exif.DateTimeOriginal || exif.CreateDate;
            date = new Date(dateStr);
        }
        shutter = exif?.ExposureTime ? formatShutter(exif.ExposureTime) : '';
        aperture = exif?.FNumber ? formatAperture(exif.FNumber) : '';
        iso = exif?.ISO ? `ISO ${exif.ISO}` : '';
    } catch (err) {
        console.warn(`无法读取EXIF: ${path.basename(filePath)}`, err.message);
    }

    // 无有效拍摄日期则回退使用文件修改时间
    if (!date || isNaN(date.getTime())) {
        date = new Date(stats.mtime);
    }

    return { date, shutter, aperture, iso, size: stats.size };
}

/**
 * 主函数：扫描图片、提取信息、生成 JSON 数据
 */
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
        const { date, shutter, aperture, iso/*, size*/ } = await getPhotoMetadata(fullPath);
        const timestamp = date.getTime();
        const displayDate = `${date.getFullYear()}年 ${String(date.getMonth() + 1).padStart(2, '0')}月 ${String(date.getDate()).padStart(2, '0')}日`;
        // const fileSizeKB = (size / 1024).toFixed(1);
        // const intro = `拍摄于 ${displayDate} · ${fileSizeKB} KB`;

        photos.push({
            date: displayDate,
            intro: '',
            location: '',          // 位置信息可手动补充
            shutter: shutter,
            aperture: aperture,
            iso: iso,
            imagePath: relativePath,
            timestamp: timestamp   // 用于按时间排序
        });
    }

    // 按时间升序排列
    photos.sort((a, b) => a.timestamp - b.timestamp);
    await fs.writeJson(outputFile, photos, { spaces: 2 });
    console.log(`✅ 已生成 ${outputFile}，共 ${photos.length} 张照片。`);
}

generate().catch(err => console.error(err));