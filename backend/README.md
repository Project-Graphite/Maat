# Backend

The API behind Ma'at. It handles accounts, problems, submissions and contests, puts judging jobs on the queue, and pushes verdicts to the browser as they arrive. It never runs submitted code itself. That is the worker's job.

## What it is built with

- Node.js with ES modules, Express 4
- MongoDB through Mongoose
- Redis and BullMQ for the judging queue
- Socket.IO for live verdicts and contest standings
- MinIO through the AWS S3 client for profile pictures
- Sharp for image processing
- JWT in cookies for sessions, bcrypt for passwords

## Folder layout

```
backend/
├── controllers/   Request handlers and the global error handler
├── models/        Mongoose schemas: User, Problem, TestCase, Submission, Contest
├── routes/        Route definitions
├── services/      Redis, the judging queue, contest standings, problem status, topics, account cleanup, publishing contest problems
├── sockets/       Socket.IO: login check, rooms, verdict forwarding
├── utils/         Shared helpers
├── scripts/       seed.js: example problems, a practice contest and the super admin account
├── tests/         API tests
├── app.js         Express app and middleware stack
└── server.js      Loads the environment, connects to MongoDB and starts listening
```

Helpers in `utils/`:

| File | Purpose |
| :--- | :--- |
| `appError.js` | Error class that carries an HTTP status for the error handler |
| `catchAsync.js` | Wraps async route handlers so rejected promises reach the error handler |
| `storage.js` | MinIO access: upload, stream, list and delete objects, plus profile picture helpers |
| `imageProcessor.js` | Validates and re-encodes uploaded images |
| `sameOrigin.js` | Blocks state-changing requests that come from another website |
| `rateLimits.js` | Every rate limit in one place |
| `email.js` | Sends password reset emails |
| `env.js` | Loads the root `.env` |
| `apiFeatures.js` | Search, sorting and pagination for list endpoints. A search puts the closest matches first |

## Running it

The whole stack runs with Docker Compose from the [repository root](../README.md#running-it-locally). To run only the API on your machine, with Node.js 24, fill in the root `.env`, then from the repository root:

```sh
docker compose up -d mongo redis minio minio-init
cd backend
npm ci
npm start
```

`npm start` uses nodemon and reloads on changes. `npm run start:prod` runs it once, as production does. The API exits if it cannot reach MongoDB at startup, so that Docker restarts it until it can.

`GET /health` answers 200 when MongoDB and Redis are up, 503 otherwise, and says how many workers are connected.

## Configuration

Everything comes from the root `.env`, loaded by `utils/env.js`. A variable already set in the environment wins.

| Variable | Meaning |
| :--- | :--- |
| `NODE_ENV` | `development` or `production`. Production hides error details and marks the cookie Secure |
| `PORT` | Port the API listens on, 5000 by default |
| `DATABASE_LOCAL` | MongoDB connection string. Built from `MONGO_PASSWORD` when unset |
| `REDIS_URL` | Redis connection for the queue, standings and verdicts. Built from `REDIS_PASSWORD` when unset |
| `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_COOKIE_EXPIRES_IN` | Token signing secret, token lifetime, and cookie lifetime in days |
| `FRONTEND_URL` | Public address of the frontend. Used in reset links and as the only origin allowed to make changes. Several can be separated by commas |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USERNAME`, `EMAIL_PASSWORD`, `EMAIL_FROM` | SMTP settings. Leave `EMAIL_HOST` empty in development and emails are printed to the log |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | MinIO connection and the restricted account the API uses. The endpoint is `http://127.0.0.1:9000` when unset |
| `S3_REGION` | Optional, `us-east-1` by default |
| `API_RATE_LIMIT` | Requests allowed per IP per hour across the API. 1000 by default |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Read by `seed.js` only, to create the super admin. The email must not be registered to anyone else |
| `SEED_LOAD_USERS`, `LOAD_TEST_PASSWORD` | Read by `seed.js` only, for load tests. Never set them on a public server |

## API overview

| Area | Routes | Access |
| :--- | :--- | :--- |
| Auth | Register, log in, log out, forgot and reset password | Public |
| Problems | List visible problems (search, filter by difficulty or topic), read one with its sample cases, list its shared solutions, open one solution | Public |
| Submissions | Create a submission, run code on the examples, share or hide one, read one, read the full data of a test it ran, list your own | Logged in |
| Account | Profile, progress stats, photo, password, delete account | Logged in |
| Contests | List, read, standings | Public |
| Admin | Problems, test cases, contests, users and their roles | Admin only |

Submitting returns `202 Accepted` with the submission id straight away. The verdict arrives later over the socket, or by polling `GET /submissions/:id`.

`POST /submissions/run` is different: it runs the code on the problem's examples only, waits for the worker (up to a minute) and answers with each example's output and logs. Nothing is stored.

`GET /submissions/:id/tests/:ordinal` returns one test the submission ran: its full input and expected output, and for the test it failed, what the code printed and its stderr. A submission's `tests` list is every test up to and including the one it failed, since judging stops there.

## Design notes

**Submissions go through a queue.** The API only validates and stores a submission, then adds a job. A slow or overloaded judge cannot make the API slow, and a failed job is retried once.

**Hidden tests are only shown to the people who ran them.** Public routes return sample cases and nothing else. The author of a submission, and admins, can open the full data of each test it ran, so a failure can be understood. While a contest with the problem is still to come or running, hidden tests stay closed even to the author, so nobody can collect them and hardcode the answers. Examples are always open.

**Only the failed test's output is kept.** A test that passed printed the expected output anyway. The worker saves what the code printed on the test it failed (up to 1 MB) and its stderr, in `failedOutput` and `failedLogs`. Both are left out of every query except the one for that test, so lists and live verdicts stay small. Test data itself is read from the problem when it is opened, so an edited test shows its new version.

**Topics.** A problem has up to six topics from a fixed list in `problemModel.js` (greedy, graphs, dynamic programming and so on). The frontend keeps the same list in `src/lib/topics.js`, so the two must change together. Topics hint at a solution, so `services/topics.js` hides them while a contest with the problem is still to come or running: they come back as an empty list, and filtering by topic leaves those problems out.

**Search.** Every word typed must appear in the field, in any order, and spaces inside a word do not matter, so `a+b` finds "A + B". Results are ranked: the exact title, then titles starting with the text, then titles containing it, then the rest. The chosen sort orders results that are equally close. Ranking needs every match, so a search reads all matching rows and pages them in memory. That suits problem titles and user names. A much larger collection would need the ranking moved into MongoDB.

**Sockets are authenticated.** The JWT is checked during the handshake, and a client can join a submission room only if it owns that submission or is an admin.

**Profile pictures are rebuilt, not stored.** `imageProcessor.js` checks the real file type from its first bytes, rejects oversized or animated images, then decodes the pixels and encodes a fresh 512 by 512 WebP. EXIF and GPS data, colour profiles and anything appended to the file are gone. Only that new copy is written to MinIO, and the bucket has no public access, so every picture is served through the API.

**Request hardening.** Helmet sets security headers. JSON bodies are capped at 10 KB, except submissions (100 KB), problem editing (200 KB) and test cases (10 MB, parsed only after the admin check). Mongo operators are stripped from input and text is filtered for XSS, except passwords, code, statements and test data, which must stay exact.

**Client addresses.** Express skips loopback and private addresses in `X-Forwarded-For`, so rate limits see the visitor behind nginx alone or behind the platform's Traefik and nginx, and a forged header is ignored.

**Logs.** Password reset tokens are redacted from the logged URL and referrer.

**Rate limits.** Every IP gets 1000 API requests an hour. Tighter limits sit on the routes worth abusing: failed logins per IP and email, password checks and submissions per account, signups and reset emails per IP.

**Roles.** Admins manage problems and contests and can delete regular users. Only the super admin, created by the seed script, changes roles: it promotes users to admin, and demotes or deletes admins. Nobody can change or delete a super admin through the API, and the role cannot be handed out.

**Contests can wait.** A contest saved without times is unscheduled: only admins see it until one schedules it or starts it right away. Deleting a contest removes its submissions and standings, and either deletes its problems too or keeps them and publishes them in the problem set. Within a minute of a contest ending, its problems join the problem set, unless another contest that has not ended yet still uses them. This happens once, so an admin can hide a problem again afterwards.

**Shared solutions.** Authors choose whether an accepted submission appears on the problem's solutions page. That page stays closed while any contest with the problem is upcoming or running.

**Deleting an account.** It is marked inactive and logged out everywhere. Logging in within 30 days restores it. After that a daily job removes the account with its photo, submissions and contest standings.

**Search engines.** `/sitemap-problems.xml` lists every public problem. The fixed pages are in the frontend's own sitemap.

**Cross-site requests are blocked.** `sameOrigin.js` compares the `Origin` header of every non-read request with `FRONTEND_URL`. It does not trust proxy headers, so it works the same behind nginx or directly.

## Example data

```sh
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=a-long-password npm run seed
```

Adds nine problems with their tests and topics: three public ones, from easy to a time-limit trap, and six hidden ones (two easy, two medium, two hard) in an unscheduled practice contest. It also makes the super admin as a new account. It never promotes an existing one, because sign-up does not prove who owns an email: if the email is taken by anyone but the super admin, it stops and changes nothing, and you choose another email. An existing super admin keeps their password. Running it again updates the problems instead of making copies, but it also replaces their test cases and resets their visibility: the three are published again and the six hidden again. Run it on a fresh database, not on one people are using.

## Tests

```sh
npm test
npm run lint
```

The tests start an in-memory MongoDB and need no other services.
