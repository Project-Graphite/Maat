import sharp from 'sharp';
import AppError from './appError.js';

export const MAX_INPUT_BYTES = 2 * 1024 * 1024;
const MAX_INPUT_PIXELS = 24_000_000;
const MAX_INPUT_SIDE = 8000;
const MIN_SIDE = 32;
const OUTPUT_SIZE = 512;
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);

sharp.cache(false);

const sniff = (buf) => {
    if (buf.length < 12) return null;
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
    if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return 'png';
    }
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
        return 'webp';
    }
    return null;
};

const reject = (message) => new AppError(message, 400);

/**
 * Turns an untrusted upload into a safe square WebP.
 *
 * The image is fully decoded and encoded again from raw pixels, so only the pixels survive:
 * EXIF/GPS, ICC profiles, XMP, comments, appended data and polyglot payloads are all dropped.
 * Returns { buffer, contentType, ext }.
 */
export const processAvatar = async (input) => {
    if (!Buffer.isBuffer(input) || input.length === 0) throw reject('No image uploaded.');
    if (input.length > MAX_INPUT_BYTES) throw reject('Profile picture must be 2 MB or smaller.');

    // 1. The real bytes must claim to be one of the allowed formats
    const sniffed = sniff(input);
    if (!sniffed) throw reject('Profile picture must be a JPEG, PNG or WebP image.');

    try {
        // 2. Read the header only, and check it against limits before any pixel is decoded
        const meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
        if (meta.format !== sniffed || !ALLOWED_FORMATS.has(meta.format)) {
            throw reject('Profile picture must be a JPEG, PNG or WebP image.');
        }
        if ((meta.pages || 1) > 1) throw reject('Animated images are not allowed.');
        const { width, height } = meta;
        if (!width || !height) throw reject('Could not read the image size.');
        if (width < MIN_SIDE || height < MIN_SIDE) throw reject('Image is too small.');
        if (width > MAX_INPUT_SIDE || height > MAX_INPUT_SIDE) throw reject('Image is too large.');

        // 3. Decode and re-encode. failOn 'error' makes truncated/corrupt files fail instead of
        // being guessed at. No withMetadata(), so nothing from the original is carried over.
        const buffer = await sharp(input, {
            limitInputPixels: MAX_INPUT_PIXELS,
            failOn: 'error',
            sequentialRead: true,
        })
            .rotate()
            .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'cover', position: 'attention' })
            .webp({ quality: 85 })
            .toBuffer();

        // 4. Check our own output, so a library bug can't let something else through
        if (sniff(buffer) !== 'webp') throw reject('Could not process the image.');
        return { buffer, contentType: 'image/webp', ext: 'webp' };
    } catch (err) {
        if (err instanceof AppError) throw err;
        throw reject('Invalid or corrupted image.');
    }
};
