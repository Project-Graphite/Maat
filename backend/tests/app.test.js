import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../app.js';

describe('app', () => {
	it('reports health when mongo and redis are up', async () => {
		const res = await request(app).get('/health');
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ status: 'ok', mongo: 'up', redis: 'up' });
	});

	it('answers an unknown route with a 404', async () => {
		const res = await request(app).get('/nothing-here');
		expect(res.status).toBe(404);
		expect(res.body.status).toBe('fail');
	});
});
