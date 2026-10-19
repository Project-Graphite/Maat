import Redis from 'ioredis';

const URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const createRedis = (options = {}) => {
    const client = new Redis(URL, options);
    client.on('error', (err) => console.log('Redis error:', err.message));
    return client;
};

export const redis = createRedis();