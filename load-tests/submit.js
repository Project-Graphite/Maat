// Judging load: correct solutions arrive at a constant rate, as if many users submitted at once.
// k6 measures how fast the API accepts them. How fast they are judged is read from MongoDB
// afterwards by measure.js, because a 202 only means the job was queued.
import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const RATE = Number(__ENV.RATE || 3);
const DURATION = __ENV.DURATION || '60s';
const USERS = Number(__ENV.USERS || 40);
const PASSWORD = __ENV.LOAD_TEST_PASSWORD;

export const options = {
    scenarios: {
        submit: {
            executor: 'constant-arrival-rate',
            rate: RATE,
            timeUnit: '1s',
            duration: DURATION,
            preAllocatedVUs: 20,
            maxVUs: 100,
        },
    },
    thresholds: {
        checks: ['rate>0.99'],
        'http_req_duration{name:submit}': ['p(95)<500'],
    },
};

// Seven in ten are Python, three in ten are C++, which also has to compile
const SOLUTIONS = [
    ['python3', 'print(sum(map(int, input().split())))'],
    ['cpp17', '#include <iostream>\nint main() { long long a, b; std::cin >> a >> b; std::cout << a + b << std::endl; }'],
];

export function setup() {
    if (!PASSWORD) throw new Error('Set LOAD_TEST_PASSWORD');
    const problem = http.get(`${BASE_URL}/api/v1/problems/sum-of-two-numbers`).json('data.problem._id');
    if (!problem) throw new Error('Run the seed script first: the problem sum-of-two-numbers is missing');

    // Each account may submit 10 times a minute, so the load is spread over many accounts
    const tokens = [];
    for (let i = 1; i <= USERS; i++) {
        const res = http.post(
            `${BASE_URL}/api/v1/auth/login`,
            JSON.stringify({ email: `loadtest-${i}@maat.local`, password: PASSWORD }),
            { headers: { 'Content-Type': 'application/json' } },
        );
        const cookie = res.cookies.jwt && res.cookies.jwt[0];
        if (!cookie) throw new Error(`Could not log in loadtest-${i}: ${res.status}`);
        tokens.push(cookie.value);
    }
    return { problem, tokens };
}

export default function ({ problem, tokens }) {
    const n = exec.scenario.iterationInTest;
    const [language, sourceCode] = n % 10 < 7 ? SOLUTIONS[0] : SOLUTIONS[1];

    const res = http.post(`${BASE_URL}/api/v1/submissions`, JSON.stringify({ problemId: problem, language, sourceCode }), {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokens[n % tokens.length]}` },
        tags: { name: 'submit' },
    });
    check(res, { 'accepted (202)': (r) => r.status === 202 });
}

export function handleSummary(data) {
    const submit = data.metrics['http_req_duration{name:submit}'] || data.metrics.http_req_duration;
    const accepted = data.metrics.checks ? data.metrics.checks.values.passes : 0;
    const line = {
        sent: data.metrics.iterations ? data.metrics.iterations.values.count : 0,
        accepted,
        acceptP95Ms: Math.round(submit.values['p(95)']),
        acceptAvgMs: Math.round(submit.values.avg),
    };
    return { stdout: `K6_RESULT ${JSON.stringify(line)}\n` };
}
