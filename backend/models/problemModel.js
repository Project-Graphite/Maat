import mongoose from 'mongoose';
import slugify from 'slugify';

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

const Problem = mongoose.model('Problem', problemSchema);

export default Problem;
