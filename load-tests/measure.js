// mongosh script. Reads back how a judging run went: run it with `since` defined, for example
//   mongosh ... --eval "const since = new Date('2026-10-27T20:00:00Z')" --file measure.js
// Prints one JSON line. A submission counts once it has a final verdict.
const users = db.users.find({ email: /^loadtest-\d+@maat\.local$/ }, { _id: 1 }).toArray().map((u) => u._id);
const runs = db.submissions
    .find({ userId: { $in: users }, submittedAt: { $gte: since } }, { status: 1, submittedAt: 1, judgedAt: 1 })
    .toArray();

const judged = runs.filter((s) => s.judgedAt);
const latencies = judged.map((s) => s.judgedAt - s.submittedAt).sort((a, b) => a - b);
const pick = (q) => latencies[Math.min(latencies.length - 1, Math.floor(q * latencies.length))] || 0;
const first = Math.min(...runs.map((s) => s.submittedAt.getTime()));
const last = Math.max(...judged.map((s) => s.judgedAt.getTime()));
const minutes = (last - first) / 60000;

const statuses = {};
for (const s of runs) statuses[s.status] = (statuses[s.status] || 0) + 1;

print(
    JSON.stringify({
        submitted: runs.length,
        judged: judged.length,
        judgedPerMinute: minutes > 0 ? Math.round(judged.length / minutes) : 0,
        avgLatencyMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
        p50LatencyMs: pick(0.5),
        p95LatencyMs: pick(0.95),
        statuses,
    }),
);
