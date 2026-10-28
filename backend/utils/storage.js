import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectsCommand,
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

const avatarKey = (userId, ext) => `avatars/${userId}.${ext}`;
const allAvatarKeys = (userId) => Object.values(AVATAR_TYPES).map((ext) => avatarKey(userId, ext));

const remove = (keys) =>
    client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true } }));

export const checkConnection = () => client.send(new HeadBucketCommand({ Bucket }));

export const putAvatar = async (userId, buffer) => {
    const { buffer: body, ext, contentType } = await processAvatar(buffer);
    const key = avatarKey(userId, ext);
    await client.send(new PutObjectCommand({ Bucket, Key: key, Body: body, ContentType: contentType }));
    await remove(allAvatarKeys(userId).filter((k) => k !== key));
    return key;
};

export const removeAvatar = (userId) => remove(allAvatarKeys(userId));

export const sendAvatar = async (key, res) => {
    let object;
    try {
        object = await client.send(new GetObjectCommand({ Bucket, Key: key }));
    } catch (err) {
        if (err.name === 'NoSuchKey') throw new AppError('File not found.', 404);
        throw err;
    }

    res.set({
        'Content-Type': object.ContentType || 'image/webp',
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
    });
    if (object.ContentLength !== undefined) res.set('Content-Length', String(object.ContentLength));

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
