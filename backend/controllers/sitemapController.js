import Problem from '../models/problemModel.js';
import catchAsync from '../utils/catchAsync.js';
import { allowedOrigins } from '../utils/sameOrigin.js';

const getProblemSitemap = catchAsync(async (req, res) => {
    const site = [...allowedOrigins][0] || 'http://localhost:8080';
    const problems = await Problem.find({ visible: true }).select('slug updatedAt').sort('slug').limit(50000).lean();

    const urls = problems.map(
        (p) => `  <url><loc>${site}/problems/${p.slug}</loc><lastmod>${p.updatedAt.toISOString()}</lastmod></url>`,
    );
    res.type('application/xml').send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
    );
});

export { getProblemSitemap };
