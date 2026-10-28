import { spawn, execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import os from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const OUTPUT_LIMIT_BYTES = 1024 * 1024;
const STDERR_LIMIT_BYTES = 64 * 1024;
const COMPILE_OUTPUT_LIMIT_CHARS = 8 * 1024;
const COMPILE = { timeoutMs: 15_000, memoryMb: 512, tmpfsMb: 128 };

export const LANGUAGES = {
	cpp17: {
		image: 'maat-cpp',
		sourceFile: 'main.cpp',
		compile: ['g++', '-O2', '-std=c++17', 'main.cpp', '-o', 'main'],
		run: ['./main'],
	},
	python3: {
		image: 'maat-python',
		sourceFile: 'main.py',
		run: ['python', 'main.py'],
	},
};

const MAX_SANDBOXES = Math.max(1, os.cpus().length - 1);
let active = 0;
const waiting = [];

const acquire = () => {
	if (active < MAX_SANDBOXES) {
		active++;
		return Promise.resolve();
	}
	return new Promise((resolve) => waiting.push(resolve));
};

const release = () => {
	const next = waiting.shift();
	if (next) next();
	else active--;
};

const wasOomKilled = async (name) => {
	try {
		const { stdout } = await execFileAsync('docker', [
			'inspect',
			'-f',
			'{{.State.OOMKilled}}',
			name,
		]);
		return stdout.trim() === 'true';
	} catch {
		return false;
	}
};

const removeContainer = (name) =>
	execFileAsync('docker', ['rm', '-f', name]).catch(() => {});

const STALE_AFTER_MS = 2 * 60 * 1000;

export const removeStaleSandboxes = async () => {
	const { stdout } = await execFileAsync('docker', [
		'ps',
		'-a',
		'--filter',
		'name=^maat-[0-9a-f]{16}$',
		'--format',
		'{{.ID}}',
	]);

	let removed = 0;
	for (const id of stdout.split('\n').filter(Boolean)) {
		try {
			const { stdout: info } = await execFileAsync('docker', [
				'inspect',
				'-f',
				'{{.State.Running}} {{.Created}}',
				id,
			]);
			const [running, created] = info.trim().split(' ');
			const stale = running !== 'true' || Date.now() - Date.parse(created) > STALE_AFTER_MS;
			if (stale) {
				await removeContainer(id);
				removed++;
			}
		} catch {
		}
	}
	return removed;
};

const execute = (
	name,
	{ image, command, workDir, writable, stdin, timeoutMs, memoryMb, tmpfsMb },
) =>
	new Promise((resolve, reject) => {
		// No --rm: the container has to survive its exit so we can ask whether it was OOM-killed
		const args = [
			'run',
			'--name',
			name,
			'-i',
			'--network=none',
			'--read-only',
			`--memory=${memoryMb}m`,
			`--memory-swap=${memoryMb}m`,
			'--cpus=1',
			'--pids-limit=64',
			'--cap-drop=ALL',
			'--security-opt=no-new-privileges',
			...(process.env.SANDBOX_CPUSET ? [`--cpuset-cpus=${process.env.SANDBOX_CPUSET}`] : []),
			'--tmpfs',
			`/tmp:rw,size=${tmpfsMb}m`,
		];
		if (workDir)
			args.push('-v', `${workDir}:/work:${writable ? 'rw' : 'ro'}`);
		args.push('-w', '/work', image, ...command);

		const started = Date.now();
		// spawn with an argument array: nothing in a submission can reach a shell
		const child = spawn('docker', args, {
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		const out = [];
		const err = [];
		let outBytes = 0;
		let errBytes = 0;
		let timedOut = false;
		let truncated = false;
		let closed = false;

		const kill = (attempt = 0) => {
			if (closed || attempt > 20) return;
			execFile('docker', ['kill', name], (error) => {
				if (error && !closed) setTimeout(() => kill(attempt + 1), 100);
			});
		};

		const timer = setTimeout(() => {
			timedOut = true;
			kill();
		}, timeoutMs);

		child.stdout.on('data', (chunk) => {
			if (truncated) return;
			const room = OUTPUT_LIMIT_BYTES - outBytes;
			if (chunk.length > room) {
				out.push(chunk.subarray(0, room));
				outBytes = OUTPUT_LIMIT_BYTES;
				truncated = true;
				kill();
				return;
			}
			out.push(chunk);
			outBytes += chunk.length;
		});

		child.stderr.on('data', (chunk) => {
			const room = STDERR_LIMIT_BYTES - errBytes;
			if (room <= 0) return;
			err.push(chunk.subarray(0, room));
			errBytes += Math.min(chunk.length, room);
		});

		child.stdin.on('error', () => {});
		child.stdin.end(stdin);

		child.on('error', (error) => {
			closed = true;
			clearTimeout(timer);
			reject(error);
		});

		child.on('close', (exitCode) => {
			closed = true;
			clearTimeout(timer);
			resolve({
				stdout: Buffer.concat(out).toString(),
				stderr: Buffer.concat(err).toString(),
				exitCode,
				timedOut,
				truncated,
				timeMs: Date.now() - started,
			});
		});
	});

/**
 * Runs `command` in a throwaway container with no network, a read-only filesystem and hard
 * memory, CPU and process limits. `workDir` is mounted at /work, read-only unless `writable`.
 * Resolves with { stdout, stderr, exitCode, timedOut, truncated, oomKilled, timeMs }.
 */
export const runInSandbox = async ({
	image,
	command,
	workDir,
	writable = false,
	stdin = '',
	timeoutMs,
	memoryMb,
	tmpfsMb = 16,
}) => {
	await acquire();
	const name = `maat-${randomBytes(8).toString('hex')}`;
	try {
		const result = await execute(name, {
			image,
			command,
			workDir,
			writable,
			stdin,
			timeoutMs,
			memoryMb,
			tmpfsMb,
		});
		result.oomKilled = await wasOomKilled(name);
		return result;
	} finally {
		await removeContainer(name);
		release();
	}
};

// Starting a container costs ~100-300ms, which would make fast solutions look slow. Run a
// trivial command a few times at startup and subtract the typical cost from reported times
let baselineMs = 0;

export const measureBaseline = async (samples = 5) => {
	const times = [];
	for (let i = 0; i < samples; i++) {
		const result = await runInSandbox({
			image: LANGUAGES.python3.image,
			command: ['true'],
			timeoutMs: 10_000,
			memoryMb: 64,
		});
		times.push(result.timeMs);
	}
	times.sort((a, b) => a - b);
	baselineMs = times[Math.floor(times.length / 2)];
	return baselineMs;
};

/**
 * Compiles the source saved in `workDir` (it must be writable by uid 10001). Python needs no
 * compile step. Resolves with { ok, output, timedOut }.
 */
export const compile = async ({ language, workDir }) => {
	const lang = LANGUAGES[language];
	if (!lang.compile) return { ok: true, output: '', timedOut: false };

	const result = await runInSandbox({
		image: lang.image,
		command: lang.compile,
		workDir,
		writable: true,
		timeoutMs: COMPILE.timeoutMs,
		memoryMb: COMPILE.memoryMb,
		tmpfsMb: COMPILE.tmpfsMb,
	});
	return {
		ok: result.exitCode === 0 && !result.timedOut && !result.oomKilled,
		output: (result.stderr + result.stdout).slice(
			0,
			COMPILE_OUTPUT_LIMIT_CHARS,
		),
		timedOut: result.timedOut,
	};
};

/**
 * Runs the compiled program on one input. The time limit applies to the program itself, so the
 * container startup cost is added to the deadline and taken off the reported time.
 */
export const run = async ({
	language,
	workDir,
	input,
	timeLimitMs,
	memoryLimitMb,
}) => {
	const lang = LANGUAGES[language];
	const result = await runInSandbox({
		image: lang.image,
		command: lang.run,
		workDir,
		stdin: input,
		timeoutMs: timeLimitMs + baselineMs,
		memoryMb: memoryLimitMb,
	});
	return { ...result, timeMs: Math.max(0, result.timeMs - baselineMs) };
};