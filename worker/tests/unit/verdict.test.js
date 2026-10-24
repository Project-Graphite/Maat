import { describe, expect, it } from 'vitest';
import { classify, normalize } from '../../src/verdict.js';

const ok = (stdout, overrides = {}) => ({
	stdout,
	exitCode: 0,
	timedOut: false,
	truncated: false,
	oomKilled: false,
	...overrides,
});

describe('normalize', () => {
	it('ignores carriage returns', () => {
		expect(normalize('1 2\r\n3\r\n')).toBe('1 2\n3');
	});

	it('ignores trailing spaces on each line', () => {
		expect(normalize('a   \nb\t\n')).toBe('a\nb');
	});

	it('trims blank lines at both ends but keeps inner ones', () => {
		expect(normalize('\n\na\n\nb\n\n')).toBe('a\n\nb');
	});

	it('keeps leading spaces and the space between words', () => {
		expect(normalize('  a  b')).toBe('a  b');
	});
});

describe('classify', () => {
	it('accepts matching output', () => {
		expect(classify(ok('3\n'), '3\n')).toBe('ACCEPTED');
	});

	it('accepts output that differs only in harmless whitespace', () => {
		expect(classify(ok('3  \r\n\r\n'), '3')).toBe('ACCEPTED');
	});

	it('rejects different output', () => {
		expect(classify(ok('4\n'), '3\n')).toBe('WRONG_ANSWER');
	});

	it('rejects missing output', () => {
		expect(classify(ok(''), '3\n')).toBe('WRONG_ANSWER');
	});

	it('does not ignore a space inside a line', () => {
		expect(classify(ok('1  2'), '1 2')).toBe('WRONG_ANSWER');
	});

	it('gives Runtime Error for a non-zero exit code', () => {
		expect(classify(ok('3\n', { exitCode: 1 }), '3\n')).toBe('RUNTIME_ERROR');
	});

	it('gives Time Limit Exceeded when the program timed out', () => {
		expect(classify(ok('', { timedOut: true, exitCode: 137 }), '3\n')).toBe('TLE');
	});

	it('gives Memory Limit Exceeded when the program was OOM-killed', () => {
		expect(classify(ok('', { oomKilled: true, exitCode: 137 }), '3\n')).toBe('MLE');
	});

	it('gives Wrong Answer when the output hit the cap', () => {
		expect(classify(ok('x', { truncated: true, exitCode: 137 }), 'x')).toBe('WRONG_ANSWER');
	});

	it('prefers Time Limit over the exit code of a killed program', () => {
		expect(classify(ok('3\n', { timedOut: true, exitCode: 137 }), '3\n')).toBe('TLE');
	});

	it('prefers Memory Limit over a plain non-zero exit', () => {
		expect(classify(ok('', { oomKilled: true, exitCode: 137 }), '')).toBe('MLE');
	});
});
