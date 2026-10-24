export const normalize = (text) =>
	text
		.replace(/\r/g, '')
		.split('\n')
		.map((line) => line.trimEnd())
		.join('\n')
		.trim();

export const classify = (result, expectedOutput) => {
	if (result.timedOut) return 'TLE';
	if (result.oomKilled) return 'MLE';
	if (result.truncated) return 'WRONG_ANSWER';
	if (result.exitCode !== 0) return 'RUNTIME_ERROR';
	return normalize(result.stdout) === normalize(expectedOutput)
		? 'ACCEPTED'
		: 'WRONG_ANSWER';
};