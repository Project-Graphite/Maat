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
├── services/      Redis, the judging queue, contest standings, problem status, account cleanup
├── sockets/       Socket.IO: login check, rooms, verdict forwarding
├── utils/         Shared helpers
├── tests/         API tests
├── app.js         Express app and middleware stack
├── seed.js        Example problems and an admin account
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
| `apiFeatures.js` | Filtering, sorting, field selection and pagination for list endpoints |

## Running it

```sh
npm install
npm start
```

`npm start` uses nodemon and reloads on changes. For production use `npm run start:prod`.

MongoDB, Redis and MinIO need to be running first. Copy `.env.example` to `.env` and fill it in.

## Configuration

| Variable | Meaning |
| :--- | :--- |
| `NODE_ENV` | `development` or `production` |
| `PORT` | Port the API listens on |
| `DATABASE_LOCAL`, `MONGO_PASSWORD` | MongoDB connection string and its password |
| `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_COOKIE_EXPIRES_IN` | Token signing secret and lifetimes |
| `FRONTEND_URL` | Public address of the frontend. Used in reset links and as the only origin allowed to make changes. Several can be separated by commas |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USERNAME`, `EMAIL_PASSWORD`, `EMAIL_FROM` | SMTP settings. Leave `EMAIL_HOST` empty in development and emails are printed to the log |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | MinIO connection and the restricted account the API uses |
| `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` | MinIO admin credentials, used only by the setup script in `infra/minio` |
| `API_RATE_LIMIT` | Requests allowed per IP per hour across the API. 1000 by default |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Read by `seed.js` only, to create the first admin |

## API overview

| Area | Routes | Access |
| :--- | :--- | :--- |
| Auth | Register, log in, log out, forgot and reset password | Public |
| Problems | List visible problems, read one with its sample cases | Public |
| Submissions | Create a submission, read one, list your own | Logged in |
| Account | Profile, photo, password, delete account | Logged in |
| Contests | List, read, standings | Public |
| Admin | Problems, test cases, contests, user roles | Admin only |

Submitting returns `202 Accepted` with the submission id straight away. The verdict arrives later over the socket, or by polling `GET /submissions/:id`.

## Design notes

**Submissions go through a queue.** The API only validates and stores a submission, then adds a job. A slow or overloaded judge cannot make the API slow, and a failed job is retried once.

**Hidden tests stay hidden.** Test case data is only ever read by the worker. Public routes return sample cases and nothing else.

**Sockets are authenticated.** The JWT is checked during the handshake, and a client can join a submission room only if it owns that submission.

**Profile pictures are rebuilt, not stored.** `imageProcessor.js` checks the real file type from its first bytes, rejects oversized or animated images, then decodes the pixels and encodes a fresh 512 by 512 WebP. EXIF and GPS data, colour profiles and anything appended to the file are gone. Only that new copy is written to MinIO, and the bucket has no public access, so every picture is served through the API.

**Request hardening.** Helmet sets security headers, request bodies are capped at 10 KB, and Mongo operators and script tags are stripped from input.

**Rate limits.** Every IP gets 1000 API requests an hour. Tighter limits sit on the routes worth abusing: failed logins per IP and email, password checks and submissions per account, signups and reset emails per IP.

**Deleting an account.** It is marked inactive and logged out everywhere. Logging in within 30 days restores it. After that a daily job removes the account with its photo, submissions and contest standings.

**Search engines.** `/sitemap-problems.xml` lists every public problem. The fixed pages are in the frontend's own sitemap.

**Cross-site requests are blocked.** `sameOrigin.js` compares the `Origin` header of every non-read request with `FRONTEND_URL`. It does not trust proxy headers, so it works the same behind nginx or directly.

## Example data

```sh
SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_PASSWORD=a-long-password npm run seed
```

Adds three problems with their tests, from easy to a time-limit trap, and an admin account. Running it again updates them instead of making copies.

## Tests

```sh
npm test
npm run lint
```

The tests start an in-memory MongoDB and need no other services.
