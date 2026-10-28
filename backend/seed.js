import 'dotenv/config';
import mongoose from 'mongoose';
import { pathToFileURL } from 'url';
import Problem from './models/problemModel.js';
import TestCase from './models/testCaseModel.js';
import User from './models/userModel.js';

let state = 20261027;
const random = (max) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state % max;
};
const randomInts = (count, max) => Array.from({ length: count }, () => random(2 * max + 1) - max);

const countPrimes = (n) => {
    const composite = new Uint8Array(n + 1);
    let count = 0;
    for (let i = 2; i <= n; i++) {
        if (composite[i]) continue;
        count++;
        for (let j = i * i; j <= n; j += i) composite[j] = 1;
    }
    return count;
};

const sumCase = (a, b) => ({ input: `${a} ${b}\n`, expectedOutput: `${a + b}\n` });
const sortCase = (numbers) => ({
    input: `${numbers.length}\n${numbers.join(' ')}\n`,
    expectedOutput: `${[...numbers].sort((x, y) => x - y).join(' ')}\n`,
});
const primeCase = (n) => ({ input: `${n}\n`, expectedOutput: `${countPrimes(n)}\n` });

const PROBLEMS = [
    {
        slug: 'sum-of-two-numbers',
        title: 'Sum of two numbers',
        difficulty: 'easy',
        timeLimitMs: 1000,
        memoryLimitMb: 64,
        statementMd: `Read two integers and print their sum.

## Input

One line with two integers \`a\` and \`b\`, each between −1,000,000,000 and 1,000,000,000.

## Output

One line with \`a + b\`.`,
        tests: () => [sumCase(1, 2), sumCase(-5, 5), sumCase(1000000000, 1000000000), sumCase(-1000000000, -999999999), sumCase(123456789, -987654321)],
    },
    {
        slug: 'sort-the-numbers',
        title: 'Sort the numbers',
        difficulty: 'medium',
        timeLimitMs: 2000,
        memoryLimitMb: 256,
        statementMd: `Sort a list of integers in increasing order.

## Input

The first line has \`n\`, between 1 and 80,000. The second line has \`n\` integers, each between −1,000,000,000 and 1,000,000,000.

## Output

The same integers in increasing order, separated by spaces.`,
        tests: () => [
            sortCase([3, 1, 2]),
            sortCase([5]),
            sortCase([-1, -1, 0, -1]),
            sortCase(randomInts(1000, 1000000000)),
            sortCase(randomInts(80000, 1000000000)),
        ],
    },
    {
        slug: 'count-the-primes',
        title: 'Count the primes',
        difficulty: 'hard',
        timeLimitMs: 2000,
        memoryLimitMb: 256,
        statementMd: `Count the prime numbers that are less than or equal to \`n\`.

## Input

One integer \`n\`, between 1 and 10,000,000.

## Output

How many primes are less than or equal to \`n\`.

## Note

Checking every number for divisors one by one is too slow for the largest tests.`,
        tests: () => [primeCase(10), primeCase(1), primeCase(100), primeCase(1000000), primeCase(10000000)],
    },
];

const seedProblems = async () => {
    for (const { tests, ...fields } of PROBLEMS) {
        const problem = await Problem.findOneAndUpdate(
            { slug: fields.slug },
            { ...fields, visible: true },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
        );
        await TestCase.deleteMany({ problemId: problem._id });
        await TestCase.insertMany(
            tests().map((test, i) => ({ ...test, problemId: problem._id, ordinal: i + 1, isSample: i === 0 })),
        );
        console.log(`Problem ready: ${fields.title}`);
    }
};

const seedAdmin = async () => {
    const { SEED_ADMIN_EMAIL: email, SEED_ADMIN_PASSWORD: password } = process.env;
    if (!email || !password) {
        console.log('No admin made: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create one.');
        return;
    }
    const existing = await User.findOne({ email });
    if (existing) {
        await User.updateOne({ _id: existing._id }, { role: 'admin' });
    } else {
        await User.create({ name: 'Administrator', email, password, passwordConfirm: password, role: 'admin' });
    }
    console.log(`Admin ready: ${email}`);
};

// Only for the load tests (load-tests/): SEED_LOAD_USERS=40 makes loadtest-1@maat.local and so on,
// all with the password in LOAD_TEST_PASSWORD. Never set these on a public server
const seedLoadUsers = async () => {
    const count = Number(process.env.SEED_LOAD_USERS) || 0;
    const password = process.env.LOAD_TEST_PASSWORD;
    if (!count) return;
    if (!password) throw new Error('Set LOAD_TEST_PASSWORD together with SEED_LOAD_USERS.');

    for (let i = 1; i <= count; i++) {
        const email = `loadtest-${i}@maat.local`;
        if (await User.exists({ email })) continue;
        await User.create({ name: `Load tester ${i}`, email, password, passwordConfirm: password });
    }
    console.log(`Load test users ready: ${count}`);
};

export const seed = async () => {
    await seedAdmin();
    await seedProblems();
    await seedLoadUsers();
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    await mongoose.connect(process.env.DATABASE_LOCAL);
    try {
        await seed();
    } finally {
        await mongoose.disconnect();
    }
}
