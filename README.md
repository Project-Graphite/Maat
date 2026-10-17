# Ma'at

Ma'at is a distributed online judge. You write a solution in C++ or Python, submit it, and a few seconds later you see whether it was right. It is named after the Egyptian goddess of truth and justice, which seemed fitting for a system whose whole job is to deliver a fair verdict.

The hard part of a judge is running code written by strangers without trusting it. Every submission here runs in its own throwaway Docker container with no network, a read-only filesystem and strict limits on CPU, memory and processes. The container is destroyed as soon as the run ends.

## What it does

- Browse problems, read the statement and write a solution in an in-browser editor
- Submit C++17 or Python 3 code and watch the verdict arrive live, test by test, without refreshing
- Get one of seven outcomes: Accepted, Wrong Answer, Time Limit Exceeded, Memory Limit Exceeded, Runtime Error, Compile Error, or Pending while it waits its turn
- Join timed contests with ICPC-style scoring and a leaderboard that updates as submissions are judged
- Upload a profile picture, which is re-encoded before it is stored
- Manage problems and hidden test cases from an admin area

## How it works

```
                 ┌──────────┐   HTTP / WebSocket   ┌───────────┐
                 │ Frontend │ ◄──────────────────► │  Backend  │
                 └──────────┘                      │ (Express) │
                                                   └─────┬─────┘
                                      saves submission   │   enqueues job
                                  ┌──────────────────────┼──────────────┐
                                  ▼                      ▼              ▼
                            ┌──────────┐           ┌──────────┐   ┌──────────┐
                            │ MongoDB  │           │  Redis   │   │  MinIO   │
                            └────▲─────┘           │ queue +  │   │ profile  │
                                 │                 │ pub/sub  │   │ pictures │
                                 │ verdicts        └────┬─────┘   └──────────┘
                            ┌────┴─────┐  pulls jobs    │
                            │ Workers  │ ◄──────────────┘
                            └────┬─────┘
                                 │ docker run, one per test
                                 ▼
                          ┌─────────────┐
                          │   Sandbox   │
                          └─────────────┘
```

1. The backend validates the submission, saves it as `PENDING` and puts a job on a BullMQ queue. It answers right away with `202 Accepted`.
2. A worker takes the job, compiles the code if needed, then runs it against each test case in a fresh sandbox container.
3. The worker compares the output with the expected answer, saves the verdict to MongoDB and publishes it on a Redis channel.
4. The backend receives that message and pushes it to the browser over Socket.IO. If the socket drops, the frontend falls back to polling.

Because workers are stateless and only talk to the queue, more capacity is just more workers. Judging is CPU-bound, so throughput climbs with each worker until the host runs out of cores. [load-tests](load-tests) shows where that happens.

## Tech stack

| Part | Choice |
| :--- | :--- |
| Frontend | React, Vite, Tailwind, Monaco editor |
| API | Node.js, Express, Mongoose |
| Database | MongoDB |
| Queue and leaderboard | Redis, BullMQ, sorted sets |
| Live updates | Socket.IO |
| File storage | MinIO (S3 compatible) |
| Sandbox | Docker |
| Load testing | k6 |
| CI/CD | GitHub Actions, Docker Compose |

## Repository layout

| Folder | What it is |
| :--- | :--- |
| [frontend](frontend) | The React app |
| [backend](backend) | The REST API and the Socket.IO server |
| [worker](worker) | The judge: pulls jobs and runs code in sandboxes |
| [load-tests](load-tests) | k6 scripts and the recorded benchmarks |
| [infra](infra) | Setup scripts for supporting services such as MinIO |

## Running it locally

You need Node.js 20 or newer and Docker.

1. Copy `.env.example` to `.env` and fill in the values. Do the same in `backend/` if you run the API on its own.
2. Start MongoDB, Redis and MinIO with Docker Compose.
3. In `backend/`, run `npm install` and then `npm start`.
4. In `worker/`, run `npm install` and then `npm start`. The worker needs access to the Docker daemon.
5. In `frontend/`, run `npm install` and then `npm run dev`.

Each folder has its own README with the details.

## Security

Running other people's code is the main risk, so the design assumes every submission is hostile.

- Sandboxes run with no network, a read-only root filesystem, all Linux capabilities dropped, no privilege escalation, and limits on memory, CPU, process count and output size
- Commands are started with argument arrays rather than shell strings, so nothing in a submission can inject a command
- Hidden test data is never returned by any public route, only the sample cases
- Users can only read their own submissions, and sockets can only join the room of a submission they own
- Uploaded images are decoded and rebuilt from raw pixels, so metadata and hidden payloads do not survive
- Requests are sanitized against NoSQL and XSS injection, rate limited, and checked against the allowed frontend origin

## License

Released under the terms of the [LICENSE](LICENSE) file.
