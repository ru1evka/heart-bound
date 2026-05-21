const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const RASTER_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif']);
const SKIP_EXT = new Set(['.webp', '.svg', '.mp4', '.webm', '.ico']);

function isRasterImage(filePath) {
    return RASTER_EXT.has(path.extname(filePath).toLowerCase());
}

async function convertFileToWebp(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (!RASTER_EXT.has(ext)) return filePath;
    const outPath = filePath.replace(/\.[^.]+$/i, '.webp');
    await sharp(filePath, { animated: ext === '.gif' })
        .webp({ quality: 82, effort: 4 })
        .toFile(outPath);
    if (outPath !== filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return outPath;
}

async function optimizeUploadedImage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (SKIP_EXT.has(ext) || !RASTER_EXT.has(ext)) return path.basename(filePath);
    const outPath = await convertFileToWebp(filePath);
    return path.basename(outPath);
}

function webpUrl(url) {
    if (!url || typeof url !== 'string') return url;
    return url.replace(/\.(jpe?g|png|gif)(\?.*)?$/i, '.webp$2');
}

/** Пути assets/ и /uploads/ после конвертации в WebP */
function normalizeImageUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (/^assets\/.+\.(jpe?g|png|gif)$/i.test(trimmed) || /^\/uploads\/.+\.(jpe?g|png|gif)$/i.test(trimmed)) {
        return webpUrl(trimmed);
    }
    return trimmed;
}

module.exports = { isRasterImage, convertFileToWebp, optimizeUploadedImage, webpUrl, normalizeImageUrl, RASTER_EXT };
