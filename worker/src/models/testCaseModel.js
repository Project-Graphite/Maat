import mongoose from 'mongoose';

const testCaseSchema = new mongoose.Schema({
    problemId: {
        type: mongoose.Schema.ObjectId,
        ref: 'Problem',
        required: [true, 'A test case must belong to a problem'],
    },
    ordinal: {
        type: Number,
        required: [true, 'A test case must have an ordinal'],
        min: 1,
    },
    input: {
        type: String,
        default: '',
        select: false,
    },
    expectedOutput: {
        type: String,
        default: '',
        select: false,
    },
    isSample: {
        type: Boolean,
        default: false,
    },
});

testCaseSchema.index({ problemId: 1, ordinal: 1 }, { unique: true });

const TestCase = mongoose.model('TestCase', testCaseSchema);

export default TestCase;
