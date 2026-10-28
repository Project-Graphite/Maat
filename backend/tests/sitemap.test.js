import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../app.js';
import { createProblem } from './helpers.js';

describe('problem sitemap', () => {
	it('lists every visible problem and no hidden one', async () => {
		await createProblem({ slug: 'shown', title: 'Shown' });
		await createProblem({ slug: 'secret', title: 'Secret', visible: false });

		const res = await request(app).get('/sitemap-problems.xml');

		expect(res.status).toBe(200);
		expect(res.headers['content-type']).toMatch(/application\/xml/);
		expect(res.text).toMatch(/<loc>http:\/\/localhost:8080\/problems\/shown<\/loc><lastmod>[\d-]+T/);
		expect(res.text).not.toContain('secret');
	});

	it('uses the configured address, not the Host header', async () => {
		await createProblem({ slug: 'shown' });
		const res = await request(app).get('/sitemap-problems.xml').set('Host', 'evil.example');
		expect(res.text).not.toContain('evil.example');
	});
});
