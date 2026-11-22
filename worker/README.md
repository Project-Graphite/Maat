# Worker

The worker is the judge. It pulls submissions off the queue, runs them against the hidden test cases inside locked-down Docker containers, and reports the verdict. It is stateless, so running more copies means judging more submissions at once.

## What it does

For every job it receives, the worker:

1. Loads the submission, the problem limits and the test cases from MongoDB
2. Writes the source code to a temporary job directory
3. For C++, compiles it in a compile container. A failure here is a Compile Error, and the compiler output is saved
4. Runs the program once per test case in a fresh container, with the test input on stdin
5. Classifies the result and stops at the first failing test
6. Saves the verdict and the result of each test it ran. For the test that failed it also saves what the program printed and its stderr, so the author can see them. A passed test printed the expected output, so nothing more is kept for it
7. Publishes the verdict on the Redis `verdicts` channel for the backend to forward to the browser, and updates the contest leaderboard if the submission belongs to a contest
8. Deletes the job directory, whatever happened

## Verdicts

| Verdict | When |
| :--- | :--- |
| Accepted | The program exited cleanly and its output matches the expected output |
| Wrong Answer | The output differs, or the program printed far more than the output limit |
| Time Limit Exceeded | The program ran past the problem's time limit |
| Memory Limit Exceeded | The kernel killed the program for going over its memory limit |
| Runtime Error | The program exited with a non-zero code or crashed |
| Compile Error | The code did not compile |
| Judge Error | Judging failed on our side, for example Docker was down. Set after the retry also fails, so a submission never stays stuck as running. It does not count in contests |

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
| `--ulimit=fsize` | No file can pass 64 MB, so a compile cannot write a huge binary to the host's disk |
| `--log-driver=none` | Docker does not copy what the program prints into a log on the host's disk |
| `--ulimit=core=0` | A crash writes no core dump |
| `--pull=never` | A missing image is an error, never a download |
| `--cap-drop=ALL` and `no-new-privileges` | No Linux capabilities and no way to gain more |
| Non-root user, id 10001 | Even inside the container the program has no special rights |
| Job directory mounted read-only for runs | The program cannot overwrite its own binary or the tests |

Some details that are easy to get wrong:

- Commands are started with an argument array and never through a shell string, so nothing in a submission can inject a command
- Containers are not started with `--rm`. The worker needs to inspect the stopped container to see whether it was killed for running out of memory, because exit code 137 alone cannot tell a memory kill from a timeout. It removes the container right after
- The time limit is enforced inside the container by `timeout`, as process 1, which the program cannot kill or stop. As a backstop the worker runs `docker kill` by name 10 seconds later, because killing the `docker` client process does not stop the container
- Output is capped at 1 MB. A program that floods stdout is killed and judged Wrong Answer
- A binary over 64 MB is a Compile Error. Zero-initialized arrays take no space in the file, but a huge array with initial values does
- If a container could not be started at all, that is a Judge Error and never the author's Compile or Runtime Error

## Timing

Setting up and removing a container usually takes a few hundred milliseconds and can take several seconds on a busy host. None of it counts: the limit is a timer inside the container that starts with the program, and a program that finishes before it fires is never a Time Limit Exceeded.

The reported time is Docker's own start-to-finish time for the container, less the cost of an empty program, which the worker measures at startup. It is approximate, and never shown above the limit.

The number of sandboxes running at once is also capped, by default a little under the number of CPU cores. An overloaded host slows every program down and would turn correct solutions into false Time Limit verdicts.

## Running it

The whole stack runs with Docker Compose from the [repository root](../README.md#running-it-locally). To run only the worker on a Linux machine, with Node.js 24:

```sh
cd worker
docker build -f sandbox-images/cpp.Dockerfile -t maat-cpp sandbox-images
docker build -f sandbox-images/python.Dockerfile -t maat-python sandbox-images
npm ci
npm start
```

It needs MongoDB, Redis, access to Docker, and a `JOBS_DIR` it can write to. It reads the root `.env`.

In a container the worker runs as the `node` user. It needs:

- The Docker socket, and the socket's group through `DOCKER_GID`
- The job directory mounted at the same path inside and outside, for example `/opt/maat-jobs:/opt/maat-jobs`. Volume paths in `docker run` are resolved by the host, so the two paths have to agree
- That directory owned by uid 1000. The `jobs-init` service in Compose does this

At startup it runs a trivial program in both sandbox images and exits if either cannot start. While it is healthy it touches `/tmp/worker-healthy` every 10 seconds, which the container's health check reads along with Docker's availability. On `SIGTERM` it finishes the submissions in hand before exiting, for up to two minutes under Compose.

## Configuration

Everything comes from the root `.env`, loaded by `src/env.js`. A variable already set in the environment wins.

| Variable | Meaning |
| :--- | :--- |
| `DATABASE_LOCAL` | MongoDB connection. Built from `MONGO_PASSWORD` when unset |
| `REDIS_URL` | Redis connection used by the queue and for publishing verdicts. Built from `REDIS_PASSWORD` when unset |
| `JOBS_DIR` | Where job directories are created, `/opt/maat-jobs` by default |
| `WORKER_CONCURRENCY` | How many submissions this worker judges at once, 2 by default |
| `SANDBOX_CPUSET` | Optional cores every sandbox is pinned to, for example `2-3`. Empty means any core |

## Folder layout

```
worker/
├── src/
│   ├── server.js     Starts the BullMQ worker
│   ├── env.js       Loads the root .env
│   ├── judge.js     Handles one submission from start to finish
│   ├── sandbox.js   Wraps docker run, timeouts and cleanup
│   ├── verdict.js   Output comparison and classification
│   ├── models/      Small copies of the Submission, Problem, TestCase and Contest schemas
│   └── services/    Redis and the contest standings
├── sandbox-images/  Dockerfiles for the C++ and Python runtimes
└── tests/
    ├── unit/         Verdict rules
    ├── integration/  Contest scoring against Redis
    └── adversarial/  Hostile programs and the verdict each must get
```

The worker builds in its own Docker context, which is why it keeps its own copies of the schemas. They need to stay in step with the backend's models.

## Adversarial tests

The strongest proof that the sandbox works is a set of programs that try to break it. Each one has an expected outcome, and the suite runs against real Docker.

| Program | Expected |
| :--- | :--- |
| Infinite loop | Time Limit Exceeded |
| Signals or stops the timer | Cannot get past the time limit |
| Finishes inside the limit while Docker is slow | Never Time Limit Exceeded |
| Fork bomb | Contained by the process limit, Time Limit Exceeded |
| Compiles to a 100 MB binary | Compile Error, stopped by the file size limit |
| Allocates 2 GB | Memory Limit Exceeded |
| Prints forever | Wrong Answer, stopped by the output cap |
| Opens a socket to the internet | Fails, there is no network |
| Writes to `/` | Fails, the filesystem is read-only |
| The sandbox cannot start | An error on our side, reported as Judge Error |
| Compile-time computation that never ends | Compile Error, stopped by the compile timeout and memory limit |

```sh
npm run ad                 # the hostile programs, needs Docker and the sandbox images
npm test                   # verdict rules, and contest scoring when Redis is running
```
