import { execFile } from 'node:child_process';
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { LANGUAGES, compile, measureBaseline, run, runInSandbox } from '../../src/sandbox.js';

const execFileAsync = promisify(execFile);
const fixtures = path.dirname(fileURLToPath(import.meta.url));

vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

const dirs = [];

const judge = async (
	language,
	{ fixture, source, input = '', timeLimitMs = 1000, memoryLimitMb = 128, expectCompileError = false },
) => {
	const workDir = await mkdtemp(path.join(os.tmpdir(), 'maat-test-'));
	dirs.push(workDir);
	const target = path.join(workDir, LANGUAGES[language].sourceFile);
	if (fixture) await copyFile(path.join(fixtures, fixture), target);
	else await writeFile(target, source);

	const compiled = await compile({ language, workDir });
	if (!compiled.ok && !expectCompileError) throw new Error(`compile failed: ${compiled.output}`);
	if (!compiled.ok) return { compiled };
	const result = await run({ language, workDir, input, timeLimitMs, memoryLimitMb });
	return { compiled, result };
};

beforeAll(async () => {
	await measureBaseline(3);
});

afterAll(async () => {
	await Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('sandbox sanity', () => {
	it('runs a correct C++ program', async () => {
		const { result } = await judge('cpp17', {
			source: '#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b<<std::endl;}',
			input: '1 2\n',
		});
		expect(result.stdout.trim()).toBe('3');
		expect(result.exitCode).toBe(0);
	});

	it('runs a correct Python program', async () => {
		const { result } = await judge('python3', {
			source: 'a, b = map(int, input().split())\nprint(a + b)\n',
			input: '5 7\n',
		});
		expect(result.stdout.trim()).toBe('12');
		expect(result.exitCode).toBe(0);
	});

	it('treats a sandbox that cannot start as a judge failure', async () => {
		const start = (image, command) => runInSandbox({ image, command: [command], timeoutMs: 10_000, memoryMb: 64 });
		await expect(start('maat-no-such-image', 'true')).rejects.toThrow('Could not start');
	});

	it('reports a syntax error as a failed compile', async () => {
		const { compiled } = await judge('cpp17', { source: 'int main( {', expectCompileError: true });
		expect(compiled.ok).toBe(false);
		expect(compiled.output).toContain('error');
	});
});

describe('time limit', () => {
	it('never fails a program that finishes inside the limit, however slow Docker is', async () => {
		const source = 'import time\ntime.sleep(0.6)\nprint(1)\n';
		const runs = await Promise.all(
			Array.from({ length: 12 }, () => judge('python3', { source, timeLimitMs: 1000 })),
		);
		expect(runs.map(({ result }) => [result.timedOut, result.exitCode])).toEqual(runs.map(() => [false, 0]));
	});

	it('stops a program that goes over the limit', async () => {
		const { result } = await judge('python3', { source: 'import time\ntime.sleep(1.4)\n', timeLimitMs: 1000 });
		expect(result.timedOut).toBe(true);
		expect(result.timeMs).toBe(1000);
	});

	it.each([
		['segfault', 'import os, signal\nos.kill(os.getpid(), signal.SIGSEGV)\n'],
		['killing itself', 'import os, signal\nos.kill(os.getpid(), signal.SIGKILL)\n'],
		['signalling the timer', 'import os, signal, time\nos.kill(1, signal.SIGALRM)\ntime.sleep(5)\n'],
	])('%s is a runtime error, not a time limit', async (_, source) => {
		const { result } = await judge('python3', { source, timeLimitMs: 2000 });
		expect(result.timedOut).toBe(false);
		expect(result.exitCode).not.toBe(0);
	});

	it('cannot be escaped by attacking the timer', async () => {
		const source = [
			'import os, signal, time',
			'for s in (signal.SIGSTOP, signal.SIGKILL):',
			'    try: os.kill(1, s)',
			'    except OSError: pass',
			'time.sleep(30)',
		].join('\n');
		const { result } = await judge('python3', { source, timeLimitMs: 1000 });
		expect(result.timedOut).toBe(true);
	});
});

describe('adversarial programs', () => {
	it('infinite loop times out', async () => {
		const { result } = await judge('cpp17', { fixture: 'infinite-loop.cpp' });
		expect(result.timedOut).toBe(true);
	});

	it('fork bomb is contained and leaves no containers behind', async () => {
		const { result } = await judge('cpp17', { fixture: 'fork-bomb.cpp' });
		expect(result.timedOut).toBe(true);
		const { stdout } = await execFileAsync('docker', ['ps', '-aq', '--filter', 'name=^maat-[0-9a-f]{16}$']);
		expect(stdout.trim()).toBe('');
	});

	it('memory bomb is killed for running out of memory', async () => {
		const { result } = await judge('cpp17', { fixture: 'memory-bomb.cpp', timeLimitMs: 5000 });
		expect(result.oomKilled).toBe(true);
		expect(result.exitCode).toBe(137);
	});

	it('infinite output is cut off at the output cap', async () => {
		const { result } = await judge('cpp17', { fixture: 'infinite-print.cpp', timeLimitMs: 5000 });
		expect(result.truncated).toBe(true);
		expect(result.stdout.length).toBeLessThanOrEqual(1024 * 1024);
	});

	it('cannot reach the network', async () => {
		const { result } = await judge('python3', { fixture: 'network.py' });
		expect(result.stdout.trim()).toBe('BLOCKED');
	});

	it('cannot write to the filesystem', async () => {
		const { result } = await judge('python3', { fixture: 'write-root.py' });
		expect(result.stdout.trim()).toBe('BLOCKED');
	});

	it('cannot compile a binary big enough to fill the disk', async () => {
		const { compiled } = await judge('cpp17', { fixture: 'big-binary.cpp', expectCompileError: true });
		expect(compiled.ok).toBe(false);
		expect(compiled.output).toContain('File size limit exceeded');
	});

	it('compile bomb fails to compile instead of hanging', async () => {
		const { compiled } = await judge('cpp17', { fixture: 'compile-bomb.cpp', expectCompileError: true });
		expect(compiled.ok).toBe(false);
	});
});
