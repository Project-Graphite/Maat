import mongoose from 'mongoose';

const STATUSES = [
    'PENDING',
    'RUNNING',
    'ACCEPTED',
    'WRONG_ANSWER',
    'TLE',
    'MLE',
    'RUNTIME_ERROR',
    'COMPILE_ERROR',
    'SYSTEM_ERROR',
];

const testResultSchema = new mongoose.Schema(
    {
        ordinal: { type: Number, required: true },
        verdict: { type: String, enum: STATUSES.slice(2), required: true },
        timeMs: Number,
    },
    { _id: false },
);

const submissionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: [true, 'A submission must belong to a user'],
    },
    problemId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Problem',
        required: [true, 'A submission must belong to a problem'],
    },
    contestId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Contest',
    },
    language: {
        type: String,
        enum: ['cpp17', 'python3'],
        required: [true, 'A submission must have a language'],
    },
    sourceCode: {
        type: String,
        required: [true, 'A submission must have source code'],
        maxlength: [64 * 1024, 'Source code must be under 64KB'],
    },
    status: {
        type: String,
        enum: STATUSES,
        default: 'PENDING',
    },
    compileOutput: String,
    tests: [testResultSchema],
    submittedAt: {
        type: Date,
        default: Date.now,
    },
    judgedAt: Date,
});

submissionSchema.index({ userId: 1, submittedAt: -1 });
submissionSchema.index({ contestId: 1, problemId: 1, userId: 1 });

const Submission = mongoose.model('Submission', submissionSchema);

export { STATUSES };
export default Submission;
