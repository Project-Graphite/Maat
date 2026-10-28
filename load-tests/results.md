# Results

Measured on 27 October 2026 with `RATE=4 DURATION=60s BROWSE_RATE=300 bash load-tests/run.sh`.

## Setup

Due to limited resources, everything ran locally in Docker Desktop, with the caps from `compose.yaml` modelling a small server:

| Part | Limit |
| :--- | :--- |
| Sandboxes | All share 4 cores (`SANDBOX_CPUSET=0-3`), one CPU and the problem's memory limit each |
| Each worker | 0.5 CPU, 256 MB, judging 2 submissions at a time |
| Backend | 1 CPU, 512 MB |
| MongoDB | 1 CPU, 1 GB |
| Redis | 0.5 CPU, 256 MB |
| nginx | 0.25 CPU, 128 MB |

The load generator ran on the same machine. Each run sent 240 correct solutions to "Sum of two numbers" over 60 seconds, 4 a second: seven in ten in Python, three in ten in C++. Every submission runs 5 tests.

## Judging

| Workers | Judged per minute | Average wait for a verdict | Median | 95th percentile |
| :--- | ---: | ---: | ---: | ---: |
| 1 | 56 | 99.0 s | 100.1 s | 187.4 s |
| 2 | 95 | 45.2 s | 44.4 s | 87.8 s |
| 4 | 153 | 17.8 s | 17.2 s | 33.3 s |
| 8 | 181 | 12.2 s | 12.3 s | 20.1 s |

All 962 submissions were judged, and every one was Accepted. No correct solution was turned into a false Time Limit Exceeded, even with eight workers fighting over four cores.

The submissions arrived at 240 a minute, faster than any configuration could judge them, so the queue grew during every run. That is why the waits are long: they include time spent in the queue, not only the time to judge.

## Accepting submissions

| Workers | Accepted | Average | 95th percentile |
| :--- | ---: | ---: | ---: |
| 1 | 241 of 241 | 10 ms | 13 ms |
| 2 | 240 of 240 | 10 ms | 14 ms |
| 4 | 241 of 241 | 13 ms | 18 ms |
| 8 | 240 of 240 | 18 ms | 32 ms |

The API stays fast however far behind the judge falls, because it only stores the submission and queues it. It slows slightly at eight workers, as the busy CPUs are shared with it.

## Reading

300 requests a second for 60 seconds across the problem list, problem pages, the contest list and the home page:

| Requests | Failed | Average | 95th percentile |
| ---: | ---: | ---: | ---: |
| 18,001 | 0 | 3 ms | 5 ms |

## What the numbers say

Throughput grows with workers, but less with each step: doubling from one to two workers gave 1.7 times as much, two to four gave 1.6 times, and four to eight only 1.2 times. With four cores for the sandboxes and two submissions per worker, eight workers want sixteen sandboxes at once, so they mostly wait for each other. This is the CPU-bound plateau: beyond about one sandbox per core, more workers on the same machine add little. Judging more means adding machines, each with its own workers.

Reading is cheap by comparison. A capped single backend serves several hundred requests a second with single-digit millisecond responses, so the judge, not the API, decides how many users the site can handle.
