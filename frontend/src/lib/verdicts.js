// How each status is shown. The tone picks the pigment; the label is always written out,
// so colour is never the only signal.
export const STATUS = {
  PENDING: { label: 'Waiting for a judge', tone: 'live', live: true },
  RUNNING: { label: 'Being weighed', tone: 'live', live: true },
  ACCEPTED: { label: 'Accepted', tone: 'good' },
  WRONG_ANSWER: { label: 'Wrong answer', tone: 'bad' },
  TLE: { label: 'Time limit exceeded', tone: 'limit' },
  MLE: { label: 'Memory limit exceeded', tone: 'limit' },
  RUNTIME_ERROR: { label: 'Runtime error', tone: 'bad' },
  COMPILE_ERROR: { label: 'Compile error', tone: 'bad' },
  SYSTEM_ERROR: { label: 'Judge error', tone: 'system' },
}

export const STATUS_OPTIONS = Object.entries(STATUS).map(([value, { label }]) => ({ value, label }))

export const isFinal = (status) => status !== 'PENDING' && status !== 'RUNNING'

export const LANGUAGES = {
  cpp17: { label: 'C++17', monaco: 'cpp' },
  python3: { label: 'Python 3', monaco: 'python' },
}

export const STARTERS = {
  cpp17: `#include <iostream>

int main() {
    std::ios::sync_with_stdio(false);
    std::cin.tie(nullptr);

    // Read from std::cin, write to std::cout
    return 0;
}
`,
  python3: `import sys

def main():
    data = sys.stdin.read().split()
    # Read from stdin, print the answer

main()
`,
}
