import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectsCommand,
    ListObjectsV2Command,
    HeadBucketCommand,
} from '@aws-sdk/client-s3';
import AppError from './appError.js';
import { processAvatar } from './imageProcessor.js';

const client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'us-east-1',
    forcePathStyle: true,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || '',
        secretAccessKey: process.env.S3_SECRET_KEY || '',
    },
});
const Bucket = process.env.S3_BUCKET || 'maat';

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

export const keys = {
    avatar: (userId, ext) => `avatars/${userId}.${ext}`,
};

export const checkConnection = async () => {
    await client.send(new HeadBucketCommand({ Bucket }));
};

export const put = async (key, body, contentType) => {
    await client.send(
        new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType }),
    );
};

export const getBuffer = async (key) => {
    try {
        const res = await client.send(new GetObjectCommand({ Bucket, Key: key }));
        return Buffer.from(await res.Body.transformToByteArray());
    } catch (err) {
        if (err.name === 'NoSuchKey') return null;
        throw err;
    }
};

export const pipeTo = async (key, res, headers) => {
    let object;
    try {
        object = await client.send(new GetObjectCommand({ Bucket, Key: key }));
    } catch (err) {
        if (err.name === 'NoSuchKey') {
            throw new AppError('File not found.', 404);
        }
        throw err;
    }

    res.set(headers);
    if (object.ContentLength !== undefined) {
        res.set('Content-Length', String(object.ContentLength));
    }
    await new Promise((resolve, reject) => {
        object.Body.on('error', reject);
        res.on('finish', resolve);
        res.on('close', () => {
            object.Body.destroy();
            resolve();
        });
        object.Body.pipe(res);
    });
};

export const list = async (after) => {
    const res = await client.send(
        new ListObjectsV2Command({ Bucket, MaxKeys: 100, ContinuationToken: after }),
    );
    return {
        files: (res.Contents || []).map((o) => ({
            key: o.Key,
            size: o.Size,
            lastModified: o.LastModified,
        })),
        next: res.NextContinuationToken || null,
    };
};

export const remove = async (keyList) => {
    const list = keyList.filter(Boolean);
    for (let i = 0; i < list.length; i += 1000) {
        await client.send(
            new DeleteObjectsCommand({
                Bucket,
                Delete: {
                    Objects: list.slice(i, i + 1000).map((Key) => ({ Key })),
                    Quiet: true,
                },
            }),
        );
    }
};

export const detectImageType = (buf) => {
    if (buf.length < 12) return null;
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
    if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return 'image/png';
    }
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
        return 'image/webp';
    }
    return null;
};

export const putAvatar = async (userId, buffer) => {
    const image = await processAvatar(buffer);
    const { ext, contentType } = image;
    const key = keys.avatar(userId, ext);
    await put(key, image.buffer, contentType);

    const stale = Object.values(AVATAR_TYPES)
        .filter((e) => e !== ext)
        .map((e) => keys.avatar(userId, e));
    await remove(stale);
    return key;
};

export const sendAvatar = (key, res) =>
    pipeTo(key, res, {
        'Content-Type': key.endsWith('.png')
            ? 'image/png'
            : key.endsWith('.webp')
              ? 'image/webp'
              : 'image/jpeg',
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
    });

export const removeAvatar = (userId) =>
    remove(Object.values(AVATAR_TYPES).map((ext) => keys.avatar(userId, ext)));
