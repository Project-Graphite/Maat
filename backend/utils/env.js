import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });

const { MONGO_PASSWORD, REDIS_PASSWORD } = process.env;
if (MONGO_PASSWORD) {
	process.env.DATABASE_LOCAL ||= `mongodb://maat:${encodeURIComponent(MONGO_PASSWORD)}@127.0.0.1:27017/maat?authSource=admin`;
}
if (REDIS_PASSWORD) {
	process.env.REDIS_URL ||= `redis://:${encodeURIComponent(REDIS_PASSWORD)}@127.0.0.1:6379`;
}
process.env.S3_ENDPOINT ||= 'http://127.0.0.1:9000';
