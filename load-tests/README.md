# Load tests

Scripts and results for measuring how much Ma'at can judge and serve.

## Two numbers, not one

A load test against the API alone is misleading. The API accepts a submission in a few milliseconds and answers `202`, but that only means the job was queued. Nobody has a verdict yet. So two things are measured:

- **Acceptance.** How fast the API takes in submissions. This comes from k6.
- **Judged throughput.** How many submissions per minute actually reach a final verdict, and how long each one waited. This is what users feel, and it is read back from MongoDB after the run.

A third test measures reading on its own: visitors browsing problems and contests, which never touches the judge.

## Where they ran

Due to limited resources, the tests run locally against the capped Docker Compose setup rather than on separate cloud machines. Every service in `compose.yaml` has a CPU and memory limit that together model a small server, and every sandbox is pinned to the same 4 cores (`SANDBOX_CPUSET=0-3`). The numbers below therefore describe a server with roughly 4 vCPU and 3 GB of memory, not the development machine they were measured on.

The load comes from the same machine, so k6 competes for it too. Treat the figures as the order of magnitude a small server reaches, not as exact capacity.

## Running them

You need Docker. k6 runs from its official image, so nothing else has to be installed.

```sh
bash load-tests/run.sh
```

The script:

1. Rebuilds and starts the stack with the load test settings: sandboxes pinned to 4 cores and the per-IP request limit lifted, because all the load comes from one address
2. Seeds the example problems and 40 load test accounts. Each account may submit 10 times a minute, so the load is spread across them
3. For 1, 2, 4 and 8 workers: sends correct solutions to "Sum of two numbers" at a constant rate (seven in ten in Python, three in ten in C++, which also has to compile), waits until every one has a verdict, then reads the results from MongoDB
4. Runs the reading test against the public pages and API
5. Removes the load test accounts and their submissions

Settings can be changed through environment variables:

| Variable | Default | Meaning |
| :--- | :--- | :--- |
| `WORKERS` | `1 2 4 8` | Worker counts to test |
| `RATE` | `3` | Submissions per second |
| `DURATION` | `60s` | How long submissions are sent for |
| `BROWSE_RATE` | `100` | Requests per second in the reading test |
| `SANDBOX_CPUSET` | `0-3` | Cores the sandboxes share |

When it finishes, start the stack again with your normal settings: `docker compose up -d`.

## Files

| File | Purpose |
| :--- | :--- |
| `run.sh` | Runs everything and prints one line per run |
| `submit.js` | k6: correct submissions at a constant arrival rate |
| `browse.js` | k6: visitors reading problems and contests |
| `measure.js` | mongosh: judged throughput and latency for a run |
| `cleanup.js` | mongosh: removes the load test accounts and their submissions |
| `results.md` | The measured results |

## What to expect

Judging is CPU-bound. Each submission starts real containers and runs real programs, so every extra worker helps only while there are free cores. Throughput rises at first, then flattens near the number of cores the sandboxes share. Past that point more workers just compete for the same CPUs, and waiting time grows instead of shrinking.

The plateau is a property of the hardware, not a bug. To judge more, add machines, not workers on the same one. See [results.md](results.md) for the measured numbers.
