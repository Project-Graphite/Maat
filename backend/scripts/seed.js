import 'dotenv/config';
import mongoose from 'mongoose';
import { pathToFileURL } from 'url';
import Contest from '../models/contestModel.js';
import Problem from '../models/problemModel.js';
import TestCase from '../models/testCaseModel.js';
import User from '../models/userModel.js';

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

const randomWord = (length, letters = 'abcdefghijklmnopqrstuvwxyz') =>
    Array.from({ length }, () => letters[random(letters.length)]).join('');

const isBalanced = (text) => {
    const stack = [];
    for (const char of text) {
        const open = '([{'.indexOf(char);
        if (open >= 0) stack.push(open);
        else if (stack.pop() !== ')]}'.indexOf(char)) return false;
    }
    return stack.length === 0;
};
const balancedBrackets = (pairs) => {
    const stack = [];
    let text = '';
    let opened = 0;
    while (text.length < 2 * pairs) {
        if (opened < pairs && (!stack.length || random(2))) {
            const kind = random(3);
            text += '([{'[kind];
            stack.push(kind);
            opened++;
        } else {
            text += ')]}'[stack.pop()];
        }
    }
    return text;
};

const maxSubarray = (numbers) => {
    let best = -Infinity;
    let current = 0;
    for (const x of numbers) {
        current = Math.max(x, current + x);
        best = Math.max(best, current);
    }
    return best;
};
const longestIncreasing = (numbers) => {
    const tails = [];
    for (const x of numbers) {
        let lo = 0;
        let hi = tails.length;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (tails[mid] < x) lo = mid + 1;
            else hi = mid;
        }
        tails[lo] = x;
    }
    return tails.length;
};
const countInversions = (numbers) => {
    if (numbers.length < 2) return { sorted: numbers, count: 0 };
    const middle = numbers.length >> 1;
    const left = countInversions(numbers.slice(0, middle));
    const right = countInversions(numbers.slice(middle));
    const sorted = [];
    let count = left.count + right.count;
    let i = 0;
    let j = 0;
    while (i < left.sorted.length || j < right.sorted.length) {
        if (j === right.sorted.length || (i < left.sorted.length && left.sorted[i] <= right.sorted[j])) {
            sorted.push(left.sorted[i++]);
        } else {
            count += left.sorted.length - i;
            sorted.push(right.sorted[j++]);
        }
    }
    return { sorted, count };
};

const listInput = (numbers) => `${numbers.length}\n${numbers.join(' ')}\n`;
const reverseCase = (text) => ({ input: `${text}\n`, expectedOutput: `${[...text].reverse().join('')}\n` });
const vowelCase = (text) => ({ input: `${text}\n`, expectedOutput: `${text.replace(/[^aeiou]/g, '').length}\n` });
const bracketCase = (text) => ({ input: `${text}\n`, expectedOutput: isBalanced(text) ? 'YES\n' : 'NO\n' });
const subarrayCase = (numbers) => ({ input: listInput(numbers), expectedOutput: `${maxSubarray(numbers)}\n` });
const increasingCase = (numbers) => ({ input: listInput(numbers), expectedOutput: `${longestIncreasing(numbers)}\n` });
const inversionCase = (numbers) => ({ input: listInput(numbers), expectedOutput: `${countInversions(numbers).count}\n` });

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

// The practice contest's own problems stay out of the problem set until an admin publishes them
const CONTEST_PROBLEMS = [
    {
        slug: 'reverse-the-word',
        title: 'Reverse the word',
        difficulty: 'easy',
        timeLimitMs: 1000,
        memoryLimitMb: 64,
        statementMd: `Print a word backwards.

## Input

One word of lowercase letters, between 1 and 100,000 letters long.

## Output

The same letters in reverse order.`,
        tests: () => [reverseCase('pyramid'), reverseCase('a'), reverseCase('level'), reverseCase(randomWord(1000)), reverseCase(randomWord(100000))],
    },
    {
        slug: 'count-the-vowels',
        title: 'Count the vowels',
        difficulty: 'easy',
        timeLimitMs: 1000,
        memoryLimitMb: 64,
        statementMd: `Count how many letters of a word are vowels: \`a\`, \`e\`, \`i\`, \`o\` or \`u\`.

## Input

One word of lowercase letters, between 1 and 100,000 letters long.

## Output

The number of vowels in the word.`,
        tests: () => [vowelCase('hieroglyph'), vowelCase('rhythm'), vowelCase('aeiou'), vowelCase(randomWord(1000)), vowelCase(randomWord(100000))],
    },
    {
        slug: 'balanced-brackets',
        title: 'Balanced brackets',
        difficulty: 'medium',
        timeLimitMs: 1000,
        memoryLimitMb: 128,
        statementMd: `A string of brackets is balanced when every opening bracket is closed by the matching closing bracket, in the right order. \`([]{})\` is balanced, \`([)]\` is not.

## Input

One line of up to 100,000 characters, each one of \`()[]{}\`.

## Output

\`YES\` if the brackets are balanced, otherwise \`NO\`.`,
        tests: () => {
            const long = balancedBrackets(50000);
            return [
                bracketCase('([]{})'),
                bracketCase('([)]'),
                bracketCase('(('),
                bracketCase(long),
                bracketCase(`${long.slice(0, -1)}${long.endsWith(')') ? ']' : ')'}`),
            ];
        },
    },
    {
        slug: 'best-stretch',
        title: 'Best stretch',
        difficulty: 'medium',
        timeLimitMs: 1000,
        memoryLimitMb: 128,
        statementMd: `A caravan records its profit for each day, which can be negative. Find the largest total profit over a run of consecutive days. The run must have at least one day.

## Input

The first line has \`n\`, between 1 and 100,000. The second line has \`n\` integers, each between −1,000,000,000 and 1,000,000,000.

## Output

The largest sum of a run of consecutive values.`,
        tests: () => [
            subarrayCase([2, -5, 3, 4, -1, 2]),
            subarrayCase([-7]),
            subarrayCase([-3, -1, -2]),
            subarrayCase(randomInts(1000, 1000)),
            subarrayCase(randomInts(100000, 1000000000)),
        ],
    },
    {
        slug: 'rising-sequence',
        title: 'Rising sequence',
        difficulty: 'hard',
        timeLimitMs: 2000,
        memoryLimitMb: 256,
        statementMd: `Remove as many values as you like from a list so that what is left is strictly increasing. How long can the remaining list be?

## Input

The first line has \`n\`, between 1 and 100,000. The second line has \`n\` integers, each between −1,000,000,000 and 1,000,000,000.

## Output

The length of the longest strictly increasing subsequence.

## Note

Comparing every pair of positions is too slow for the largest tests.`,
        tests: () => [
            increasingCase([3, 1, 4, 1, 5, 9, 2, 6]),
            increasingCase([5, 5, 5]),
            increasingCase([1, 2, 3, 4]),
            increasingCase(randomInts(1000, 1000000)),
            increasingCase(randomInts(100000, 1000000000)),
        ],
    },
    {
        slug: 'out-of-order',
        title: 'Out of order',
        difficulty: 'hard',
        timeLimitMs: 2000,
        memoryLimitMb: 256,
        statementMd: `Count the pairs of positions \`i < j\` where the value at \`i\` is greater than the value at \`j\`.

## Input

The first line has \`n\`, between 1 and 100,000. The second line has \`n\` integers, each between −1,000,000,000 and 1,000,000,000.

## Output

The number of such pairs. It can be larger than 2,147,483,647.

## Note

Comparing every pair of positions is too slow for the largest tests.`,
        tests: () => [
            inversionCase([3, 1, 2]),
            inversionCase([1, 2, 3]),
            inversionCase([4, 4, 1]),
            inversionCase(randomInts(1000, 1000000)),
            inversionCase(Array.from({ length: 100000 }, (_, i) => 100000 - i)),
        ],
    },
];

const seedProblems = async (definitions, visible) => {
    const problems = [];
    for (const { tests, ...fields } of definitions) {
        const problem = await Problem.findOneAndUpdate(
            { slug: fields.slug },
            { ...fields, visible },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
        );
        await TestCase.deleteMany({ problemId: problem._id });
        await TestCase.insertMany(
            tests().map((test, i) => ({ ...test, problemId: problem._id, ordinal: i + 1, isSample: i === 0 })),
        );
        console.log(`Problem ready: ${fields.title}`);
        problems.push(problem);
    }
    return problems;
};

// Saved without a start time, so only admins see it until one schedules or starts it
const seedContest = async () => {
    const problems = await seedProblems(CONTEST_PROBLEMS, false);
    if (await Contest.exists({ title: 'Practice contest' })) return;
    await Contest.create({
        title: 'Practice contest',
        problems: problems.map((problem, i) => ({ problemId: problem._id, label: 'ABCDEF'[i] })),
    });
    console.log('Contest ready: Practice contest');
};

const seedAdmin = async () => {
    const { SEED_ADMIN_EMAIL: email, SEED_ADMIN_PASSWORD: password } = process.env;
    if (!email || !password) {
        console.log('No super admin made: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create one.');
        return;
    }
    const existing = await User.findOne({ email });
    if (existing) {
        await User.updateOne({ _id: existing._id }, { role: 'superadmin' });
    } else {
        await User.create({ name: 'Administrator', email, password, passwordConfirm: password, role: 'superadmin' });
    }
    console.log(`Super admin ready: ${email}`);
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
    await seedProblems(PROBLEMS, true);
    await seedContest();
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
