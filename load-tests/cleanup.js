// mongosh script. Removes the load test users and everything they submitted.
const users = db.users.find({ email: /^loadtest-\d+@maat\.local$/ }, { _id: 1 }).toArray().map((u) => u._id);
const submissions = db.submissions.deleteMany({ userId: { $in: users } }).deletedCount;
const accounts = db.users.deleteMany({ _id: { $in: users } }).deletedCount;
print(`Removed ${accounts} load test users and ${submissions} submissions`);
