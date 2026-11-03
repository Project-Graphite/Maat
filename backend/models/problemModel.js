import mongoose from 'mongoose';
import slugify from 'slugify';

export const TOPICS = [
    'implementation',
    'math',
    'number theory',
    'combinatorics',
    'geometry',
    'strings',
    'sorting',
    'searching',
    'binary search',
    'two pointers',
    'prefix sums',
    'greedy',
    'brute force',
    'recursion',
    'divide and conquer',
    'dynamic programming',
    'data structures',
    'stacks and queues',
    'hashing',
    'trees',
    'graphs',
    'shortest paths',
    'bit manipulation',
    'constructive',
];
export const MAX_TOPICS = 6;

const problemSchema = new mongoose.Schema(
    {
        slug: {
            type: String,
            unique: true,
            lowercase: true,
            trim: true,
        },
        title: {
            type: String,
            required: [true, 'A problem must have a title'],
            trim: true,
            maxlength: 100,
        },
        statementMd: {
            type: String,
            required: [true, 'A problem must have a statement'],
        },
        timeLimitMs: {
            type: Number,
            default: 2000,
            min: [100, 'Time limit must be at least 100ms'],
            max: [10000, 'Time limit must be at most 10000ms'],
        },
        memoryLimitMb: {
            type: Number,
            default: 256,
            min: [16, 'Memory limit must be at least 16MB'],
            max: [1024, 'Memory limit must be at most 1024MB'],
        },
        difficulty: {
            type: String,
            enum: ['easy', 'medium', 'hard'],
            default: 'easy',
        },
        topics: {
            type: [{ type: String, enum: { values: TOPICS, message: '"{VALUE}" is not a known topic' } }],
            validate: [
                {
                    validator: (topics) => topics.length <= MAX_TOPICS,
                    message: `A problem can have at most ${MAX_TOPICS} topics`,
                },
                {
                    validator: (topics) => new Set(topics).size === topics.length,
                    message: 'A topic can only be added once',
                },
            ],
        },
        visible: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true },
);

problemSchema.pre('validate', function (next) {
    if (!this.slug && this.title) {
        this.slug = slugify(this.title, { lower: true, strict: true });
    }
    next();
});

problemSchema.index({ topics: 1 });

const Problem = mongoose.model('Problem', problemSchema);

export default Problem;
