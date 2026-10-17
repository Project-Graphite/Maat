# Load tests

Scripts and results for measuring how much Ma'at can judge.

## Two numbers, not one

A load test against the API alone is misleading. The API accepts a submission in a few milliseconds and answers `202`, but that only means the job was queued. Nobody has a verdict yet. So two things are measured:

- **Acceptance rate.** How fast the API takes in submissions. This comes from k6.
- **Judged throughput.** How many submissions per minute actually reach a final verdict, and how long each one waited. This is what users feel, and it is read back from MongoDB after the run.

## How a run works

1. Create a test user and a token, and make sure a small problem exists with a known-good C++ solution
2. Start the stack with the number of workers you want to test
3. Run the k6 script, which posts that solution at a constant arrival rate

```sh
k6 run -e BASE_URL=http://localhost:5000 -e TOKEN=<jwt> -e PROBLEM_ID=<id> submit.js
```

4. Wait for the queue to drain, then compute the real figures from the database:

```js
db.submissions.aggregate([
  { $match: { submittedAt: { $gte: runStart } } },
  { $group: {
      _id: null,
      n: { $sum: 1 },
      avgMs: { $avg: { $subtract: ['$judgedAt', '$submittedAt'] } }
  } }
])
```

`n` divided by the run length gives judged submissions per minute, and `avgMs` is the average time from submitting to a verdict.

## What gets recorded

Every configuration runs with 1, 2, 4 and 8 workers on the same machine, and the results go in [results.md](results.md) next to the hardware they were measured on.

| Workers | Judged per minute | Average verdict latency |
| :--- | :--- | :--- |
| 1 | | |
| 2 | | |
| 4 | | |
| 8 | | |

## What to expect

Judging is CPU-bound. Each submission compiles and runs real programs, so every extra worker helps only while there are spare cores. Throughput rises close to linearly at first, then flattens near the machine's core count. Past that point more workers just compete for the same CPUs, and latency gets worse instead of better.

The plateau is a property of the hardware, not a bug, and it is why the worker caps its concurrent sandboxes. To judge more, add machines, not workers on the same one.

## Files

| File | Purpose |
| :--- | :--- |
| `submit.js` | The k6 script: a constant-arrival-rate load of valid submissions |
| `results.md` | The measured tables for each run |
