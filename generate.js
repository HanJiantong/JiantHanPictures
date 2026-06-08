const fs = require('fs-extra');
const path = require('path');
const exifr = require('exifr');

const imagesDir = path.join(__dirname, 'images');
const csvFile = path.join(__dirname, 'photos.csv');
const jsonFile = path.join(__dirname, 'photos.json');

const supportedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];

// ---------- 工具函数 ----------
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

// ---------- CSV 读写（带公式解析）----------
// 将单元格值转换为 CSV 中的公式格式（针对易转换字段）
function toFormulaValue(raw) {
    if (raw === undefined || raw === null) raw = '';
    const str = String(raw);
    if (str === '') return '""';
    // 对于日期、快门、光圈、ISO 字段，用 ="value" 形式避免 Excel 误转换
    return `="${str.replace(/"/g, '""')}"`;
}

// 从 CSV 读取的原始值中提取真实内容（处理 ="..." 格式）
function parseFormulaValue(raw) {
    if (raw === undefined || raw === null) return '';
    const str = String(raw).trim();
    // 匹配 ="...", 或者 ="..." 格式（可能中间无空格）
    const match = str.match(/^="(.*)"$/);
    if (match) {
        // 还原内部双引号转义
        return match[1].replace(/""/g, '"');
    }
    return str;
}

async function writeCSV(photos) {
    const header = ['imagePath', 'date', 'intro', 'location', 'shutter', 'aperture', 'iso'];
    const rows = photos.map(p => {
        return header.map(field => {
            let val = p[field] || '';
            if (field === 'date' || field === 'shutter' || field === 'aperture' || field === 'iso') {
                return toFormulaValue(val);
            } else {
                if (val === '') return '""';
                return `"${val.replace(/"/g, '""')}"`;
            }
        }).join(',');
    });
    const csvContent = [header.map(h => `"${h}"`).join(','), ...rows].join('\n');
    await fs.writeFile(csvFile, '\uFEFF' + csvContent, 'utf8');
    console.log(`✅ 已生成 CSV 模板: ${csvFile}`);
}

async function readCSV() {
    const content = await fs.readFile(csvFile, 'utf8');
    const cleanContent = content.replace(/^\uFEFF/, '');
    const lines = cleanContent.split('\n').filter(l => l.trim());
    if (lines.length < 2) return [];
    const header = lines[0].split(',').map(h => h.replace(/^"|"$/g, ''));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // 简单的 CSV 解析（处理引号内逗号）
        const regex = /(".*?"|[^,]+)(?=\s*,|\s*$)/g;
        const matches = [];
        let match;
        while ((match = regex.exec(line)) !== null) {
            let val = match[0];
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1).replace(/""/g, '"');
            }
            matches.push(val);
        }
        if (matches.length === header.length) {
            const obj = {};
            header.forEach((key, idx) => {
                let raw = matches[idx];
                // 如果是 date/shutter/aperture/iso 字段，需要解析公式
                if (key === 'date' || key === 'shutter' || key === 'aperture' || key === 'iso') {
                    raw = parseFormulaValue(raw);
                }
                obj[key] = raw;
            });
            rows.push(obj);
        }
    }
    return rows;
}

// ---------- 核心流程 ----------
async function scanImagesAndGenerateCSV() {
    console.log('扫描图片文件夹，生成 CSV 模板...');
    const imageFiles = await getAllImageFiles(imagesDir);
    if (imageFiles.length === 0) throw new Error('未找到任何图片，请将照片放入 images 文件夹');
    const photos = [];
    for (const fullPath of imageFiles) {
        const relativePath = path.relative(__dirname, fullPath).replace(/\\/g, '/');
        const { date, shutter, aperture, iso } = await getPhotoMetadata(fullPath);
        const displayDate = `${date.getFullYear()}年 ${String(date.getMonth() + 1).padStart(2, '0')}月 ${String(date.getDate()).padStart(2, '0')}日`;
        const fileSizeKB = (fs.statSync(fullPath).size / 1024).toFixed(1);
        const intro = `拍摄于 ${displayDate} · ${fileSizeKB} KB`;
        photos.push({
            imagePath: relativePath,
            date: displayDate,
            intro: intro,
            location: '',
            shutter: shutter,
            aperture: aperture,
            iso: iso
        });
    }
    photos.sort((a, b) => new Date(a.date) - new Date(b.date));
    await writeCSV(photos);
    console.log('现在请用 Excel 编辑 photos.csv 中的 location 和 intro 列，然后重新运行脚本生成 JSON。');
}

async function convertCSVtoJSON() {
    const csvExists = await fs.pathExists(csvFile);
    if (!csvExists) {
        await scanImagesAndGenerateCSV();
        return;
    }
    console.log('读取 photos.csv...');
    const rows = await readCSV();
    if (rows.length === 0) throw new Error('CSV 文件为空');
    const photos = rows.map(row => ({
        date: row.date,
        intro: row.intro || '',
        location: row.location || '',
        shutter: row.shutter || '',
        aperture: row.aperture || '',
        iso: row.iso || '',
        imagePath: row.imagePath
    }));
    photos.sort((a, b) => new Date(a.date) - new Date(b.date));
    await fs.writeJson(jsonFile, photos, { spaces: 2 });
    console.log(`✅ 已生成 ${jsonFile}，共 ${photos.length} 张照片。`);
}

async function main() {
    try {
        await convertCSVtoJSON();
    } catch (err) {
        console.error('错误:', err.message);
    }
}

main();