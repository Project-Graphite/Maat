import mongoose from 'mongoose';

const contestSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'A contest must have a title'],
        trim: true,
        maxlength: 100,
    },
    startsAt: Date,
    endsAt: {
        type: Date,
        validate: {
            validator: function (el) {
                return !el || !this.startsAt || el > this.startsAt;
            },
            message: 'A contest must end after it starts',
        },
    },
    problems: [
        {
            _id: false,
            problemId: {
                type: mongoose.Schema.ObjectId,
                ref: 'Problem',
                required: true,
            },
            label: {
                type: String,
                required: true,
                trim: true,
                uppercase: true,
            },
        },
    ],
    problemsPublished: { type: Boolean, default: false, select: false },
});

contestSchema.pre('validate', function (next) {
    if (!this.startsAt !== !this.endsAt) {
        this.invalidate('startsAt', 'A contest needs both a start and an end time, or neither.');
    }
    next();
});

contestSchema.index({ startsAt: 1 });

const Contest = mongoose.model('Contest', contestSchema);

export default Contest;
