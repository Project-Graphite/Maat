# Results

Measured on 29 October 2026 with the default settings: `bash load-tests/run.sh`.

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

The load generator ran on the same machine. Each run sent about 180 correct solutions to "Sum of two numbers" over 60 seconds, 3 a second, from 40 accounts: seven in ten in Python, three in ten in C++. Every submission runs 5 tests.

## Judging

| Workers | Judged per minute | Average wait for a verdict | Median | 95th percentile |
| :--- | ---: | ---: | ---: | ---: |
| 1 | 58 | 64.3 s | 65.1 s | 120.5 s |
| 2 | 93 | 29.3 s | 29.9 s | 54.5 s |
| 4 | 149 | 7.6 s | 7.5 s | 12.7 s |
| 8 | 172 | 4.2 s | 4.1 s | 5.7 s |

All 723 submissions were judged, and every one was Accepted. No correct solution was turned into a false Time Limit Exceeded, even with eight workers fighting over four cores.

The submissions arrived at 180 a minute. With one, two or four workers that is faster than they can judge, so the queue grew during the run and the waits include time spent in it. Eight workers came close to keeping up, so the queue hardly grew and every verdict came back within six seconds.

## Accepting submissions

| Workers | Accepted | Average | 95th percentile | Slowest |
| :--- | ---: | ---: | ---: | ---: |
| 1 | 181 of 181 | 10 ms | 14 ms | 36 ms |
| 2 | 181 of 181 | 12 ms | 16 ms | 21 ms |
| 4 | 180 of 180 | 15 ms | 22 ms | 35 ms |
| 8 | 181 of 181 | 19 ms | 31 ms | 53 ms |

Every submission was accepted, and the rate held at 3 a second in every 10-second slice of every run. The API stays fast however far behind the judge falls, because it only stores the submission and queues it. It slows slightly as workers are added, because the busy sandboxes share the CPU with it, but even the slowest submission took about a twentieth of a second.

These times are for submitting only. The 40 logins before each run take about 180 ms each, as password hashing is slow on purpose, and are left out.

## Reading

100 requests a second for 60 seconds across the problem list, problem pages, the contest list and the home page:

| Requests | Failed | Average | 95th percentile | 99th percentile | Slowest |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 6,000 | 0 | 4 ms | 5 ms | 10 ms | 145 ms |

After the first 10 seconds, while the backend warmed up, the 95th percentile stayed at 4 to 5 ms, so the API did not slow down under sustained load.

## What the numbers say

Throughput grows with workers, but less with each step: doubling from one to two workers gave 1.6 times as much, two to four gave 1.6 times again, and four to eight only 1.15 times. With four cores for the sandboxes and two submissions per worker, eight workers want sixteen sandboxes at once, so they mostly wait for each other. This is the CPU-bound plateau: beyond about one sandbox per core, more workers on the same machine add little. Judging more means adding machines, each with its own workers.

Accepting and reading are cheap by comparison. A capped single backend answers in a few milliseconds, so the judge, not the API, decides how many users the site can handle.
