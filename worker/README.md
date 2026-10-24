# Worker

The worker is the judge. It pulls submissions off the queue, runs them against the hidden test cases inside locked-down Docker containers, and reports the verdict. It is stateless, so running more copies means judging more submissions at once.

## What it does

For every job it receives, the worker:

1. Loads the submission, the problem limits and the test cases from MongoDB
2. Writes the source code to a temporary job directory
3. For C++, compiles it in a compile container. A failure here is a Compile Error, and the compiler output is saved
4. Runs the program once per test case in a fresh container, with the test input on stdin
5. Classifies the result and stops at the first failing test
6. Saves the verdict, publishes it on the Redis `verdicts` channel for the backend to forward to the browser, and updates the contest leaderboard if the submission belongs to a contest
7. Deletes the job directory, whatever happened

## Verdicts

| Verdict | When |
| :--- | :--- |
| Accepted | The program exited cleanly and its output matches the expected output |
| Wrong Answer | The output differs, or the program printed far more than the output limit |
| Time Limit Exceeded | The program ran past the problem's time limit |
| Memory Limit Exceeded | The kernel killed the program for going over its memory limit |
| Runtime Error | The program exited with a non-zero code or crashed |
| Compile Error | The code did not compile |

Output is compared after removing carriage returns and trailing spaces on each line, and trimming blank lines at both ends, so harmless whitespace differences do not fail a correct solution.

## The sandbox

Each run is one `docker run` with these restrictions:

| Flag | Why |
| :--- | :--- |
| `--network=none` | The program cannot reach the internet or other containers |
| `--read-only` and a small `tmpfs` on `/tmp` | The program cannot change the image, and temporary space is capped at 16 MB |
| `--memory` and `--memory-swap` set to the same value | A hard memory ceiling with no swap to hide behind |
| `--cpus=1` | One program cannot take over the host |
| `--pids-limit=64` | A fork bomb runs out of processes quickly |
| `--cap-drop=ALL` and `no-new-privileges` | No Linux capabilities and no way to gain more |
| Non-root user, id 10001 | Even inside the container the program has no special rights |
| Job directory mounted read-only for runs | The program cannot overwrite its own binary or the tests |

Some details that are easy to get wrong:

- Commands are started with an argument array and never through a shell string, so nothing in a submission can inject a command
- Containers are not started with `--rm`. The worker needs to inspect the stopped container to see whether it was killed for running out of memory, because exit code 137 alone cannot tell a memory kill from a timeout. It removes the container right after
- Killing the `docker` client process does not stop the container, so on a timeout the worker runs `docker kill` on the container by name
- Output is capped at 1 MB. A program that floods stdout is killed and judged Wrong Answer

## Timing

Starting a container takes roughly 100 to 300 ms, which would make fast solutions look slow. At startup the worker runs a trivial program a few times, measures that overhead and subtracts it from reported times.

The number of sandboxes running at once is also capped, by default a little under the number of CPU cores. An overloaded host slows every program down and would turn correct solutions into false Time Limit verdicts.

## Running it

```sh
npm install
npm start
```

The worker needs:

- Access to the Docker daemon on the machine
- The two sandbox images built from `sandbox-images/`
- Network access to MongoDB and Redis

Build the images once:

```sh
docker build -f sandbox-images/cpp.Dockerfile -t maat-cpp sandbox-images
docker build -f sandbox-images/python.Dockerfile -t maat-python sandbox-images
```

When the worker itself runs in a container, mount the Docker socket and mount the job directory at the same path inside and outside, for example `/opt/maat-jobs:/opt/maat-jobs`. Volume paths in `docker run` are resolved by the host, so the two paths have to agree.

## Configuration

| Variable | Meaning |
| :--- | :--- |
| `DATABASE_LOCAL`, `MONGO_PASSWORD` | MongoDB connection |
| `REDIS_URL` | Redis connection used by the queue and for publishing verdicts |
| `JOBS_DIR` | Where job directories are created, `/opt/maat-jobs` by default |
| `WORKER_CONCURRENCY` | How many submissions this worker judges at once, 2 by default |

## Folder layout

```
worker/
├── src/
│   ├── server.js     Starts the BullMQ worker
│   ├── judge.js     Handles one submission from start to finish
│   ├── sandbox.js   Wraps docker run, timeouts and cleanup
│   ├── verdict.js   Output comparison and classification
│   └── models/      Small copies of the Submission, Problem and TestCase schemas
├── sandbox-images/  Dockerfiles for the C++ and Python runtimes
└── tests/adversarial/  Hostile programs and the verdict each must get
```

The worker builds in its own Docker context, which is why it keeps its own copies of the schemas. They need to stay in step with the backend's models.

## Adversarial tests

The strongest proof that the sandbox works is a set of programs that try to break it. Each one has an expected outcome, and the suite runs against real Docker in CI.

| Program | Expected |
| :--- | :--- |
| Infinite loop | Time Limit Exceeded |
| Fork bomb | Contained by the process limit, host stays healthy |
| Allocates 2 GB | Memory Limit Exceeded |
| Prints forever | Wrong Answer, stopped by the output cap |
| Opens a socket or runs curl | Fails, there is no network |
| Writes to `/` or reads `/etc/passwd` | The write fails, the read only shows the container's own files |
| Template recursion compile bomb | Compile Error, stopped by the compile timeout and memory limit |

```sh
npm test
```
