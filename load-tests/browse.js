// Reading load: visitors browsing problems and contests. These requests never reach the judge,
// so this measures the API, MongoDB and nginx on their own.
import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const RATE = Number(__ENV.RATE || 100);
const DURATION = __ENV.DURATION || '60s';

export const options = {
    scenarios: {
        browse: {
            executor: 'constant-arrival-rate',
            rate: RATE,
            timeUnit: '1s',
            duration: DURATION,
            preAllocatedVUs: 50,
            maxVUs: 300,
        },
    },
    thresholds: {
        checks: ['rate>0.99'],
        http_req_duration: ['p(95)<300'],
    },
};

const PAGES = [
    '/api/v1/problems',
    '/api/v1/problems?difficulty=easy',
    '/api/v1/problems/sum-of-two-numbers',
    '/api/v1/problems/count-the-primes',
    '/api/v1/contests',
    '/',
];

export default function () {
    const page = PAGES[Math.floor(Math.random() * PAGES.length)];
    const res = http.get(`${BASE_URL}${page}`, { tags: { name: page } });
    check(res, { 'status 200': (r) => r.status === 200 });
}

export function handleSummary(data) {
    const d = data.metrics.http_req_duration.values;
    const line = {
        requests: data.metrics.http_reqs.values.count,
        perSecond: Math.round(data.metrics.http_reqs.values.rate),
        failed: data.metrics.checks.values.fails,
        avgMs: Math.round(d.avg),
        p95Ms: Math.round(d['p(95)']),
    };
    return { stdout: `K6_RESULT ${JSON.stringify(line)}\n` };
}
