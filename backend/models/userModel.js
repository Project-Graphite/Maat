import crypto from 'crypto';
import mongoose from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, 'Please enter a name.'],
		trim: true,
		unique: true,
		minlength: [3, 'Your name must be at least 3 characters.'],
		maxlength: [30, 'Your name must be at most 30 characters.'],
	},
	email: {
		type: String,
		required: [true, 'Please enter your email address.'],
		unique: true,
		lowercase: true,
		validate: [validator.isEmail, 'Please enter a valid email address.'],
	},
	photo: String,
	role: {
		type: String,
		enum: ['user', 'admin', 'superadmin'],
		default: 'user',
	},
	password: {
		type: String,
		required: [true, 'Please enter a password.'],
		minlength: [8, 'Your password must be at least 8 characters.'],
		select: false,
	},
	passwordConfirm: {
		type: String,
		required: [true, 'Please repeat your password.'],
		validate: {
			validator: function (el) {
				return el === this.password;
			},
			message: 'The two passwords do not match.',
		},
	},
	passwordChangedAt: Date,
	passwordResetToken: String,
	passwordResetExpires: Date,
	deactivatedAt: Date,
});

userSchema.pre('save', async function (next) {
	if (!this.isModified('password')) return next();

	this.password = await bcrypt.hash(this.password, 12);
	this.passwordConfirm = undefined;
	next();
});

userSchema.pre('save', function (next) {
	if (!this.isModified('password') || this.isNew) return next();
	this.passwordChangedAt = Date.now() - 1000;
	next();
});

userSchema.methods.correctPassword = async function (
	candidatePassword,
	userPassword,
) {
	return bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
	if (this.passwordChangedAt) {
		const changedTimestamp = parseInt(
			this.passwordChangedAt.getTime() / 1000,
			10,
		);
		return JWTTimestamp < changedTimestamp;
	}
	return false;
};

userSchema.methods.createPasswordResetToken = function () {
	const resetToken = crypto.randomBytes(32).toString('hex');

	this.passwordResetToken = crypto
		.createHash('sha256')
		.update(resetToken)
		.digest('hex');
	this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

	return resetToken;
};

const User = mongoose.model('User', userSchema);

export default User;
