import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../app.js';

const clientIp = (forwarded) =>
	Object.create(app.request, {
		app: { value: app },
		socket: { value: { remoteAddress: '172.18.0.4' } },
		connection: { value: { remoteAddress: '172.18.0.4' } },
		headers: { value: { 'x-forwarded-for': forwarded } },
	}).ip;

describe('app', () => {
	it('reports health when mongo and redis are up', async () => {
		const res = await request(app).get('/health');
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ status: 'ok', mongo: 'up', redis: 'up', workers: 1 });
	});

	it('answers an unknown route with a 404', async () => {
		const res = await request(app).get('/nothing-here');
		expect(res.status).toBe(404);
		expect(res.body.status).toBe('fail');
	});

	it('sees the visitor behind one proxy or two', () => {
		expect(clientIp('203.0.113.7')).toBe('203.0.113.7');
		expect(clientIp('203.0.113.7, 172.18.0.1')).toBe('203.0.113.7');
	});

	it('ignores an address the visitor made up', () => {
		expect(clientIp('198.51.100.1, 203.0.113.7')).toBe('203.0.113.7');
		expect(clientIp('10.0.0.1, 203.0.113.7, 172.18.0.1')).toBe('203.0.113.7');
	});
});
