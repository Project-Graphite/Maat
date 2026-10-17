import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { promisify } from 'util';
import User from '../models/userModel.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/appError.js';
import sendEmail from '../utils/email.js';

const signToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });
};

const cookieOptions = () => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
});

const verifyToken = (token) =>
    promisify(jwt.verify)(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

const getToken = (req) => {
    if (req.cookies && req.cookies.jwt) return req.cookies.jwt;
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) return header.split(' ')[1];
    return undefined;
};

const resetPasswordEmail = (resetURL) => {
    return {
        subject: 'Your password reset link',
        text: `Forgot your password? Reset it here: ${resetURL}\nIf you didn't request this, please ignore this email.`,
        html: `<p>Forgot your password? <a href="${resetURL}">Reset it here</a>.</p><p>If you didn't request this, please ignore this email.</p>`,
    };
};

const sendJWT =(user, res, statusCode = 200) => {
    user.password = undefined;
    const token = signToken(user._id);

    res.cookie('jwt', token, {
        ...cookieOptions(),
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
    });
    res.status(statusCode).json({ status: 'success', data: { user } });
};

const signup = catchAsync(async (req, res, next) => {
    const newUser = await User.create({
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        passwordConfirm: req.body.passwordConfirm,
    });

    sendJWT(newUser, res, 201);
});

const login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return next(new AppError('Please provide email and password!', 400));
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.correctPassword(password, user.password))) {
        return next(new AppError('Incorrect email or password', 401));
    }

    sendJWT(user, res);
});

const logout = catchAsync(async (req, res) => {
    if (req.user) await User.updateOne({ _id: req.user._id }, { passwordChangedAt: new Date() });
    res.clearCookie('jwt', cookieOptions());
    res.status(200).json({ status: 'success' });
});

const protect = catchAsync(async (req, res, next) => {
    const token = getToken(req);
    if (!token) {
        return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    const decoded = await verifyToken(token);
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
        return next(new AppError('The user belonging to this token does no longer exist.', 401));
    }
    if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next(new AppError('User recently changed password! Please log in again.', 401));
    }

    req.user = currentUser;
    next();
});

const identify = catchAsync(async (req, res, next) => {
    const token = getToken(req);
    if (!token) return next();

    let decoded;
    try {
        decoded = await verifyToken(token);
    } catch {
        return next();
    }

    const currentUser = await User.findById(decoded.id);
    if (currentUser && !currentUser.changedPasswordAfter(decoded.iat)) {
        req.user = currentUser;
    }
    next();
});

const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return next(
                new AppError(
                    'You do not have permission to perform this action',
                    403,
                ),
            );
        }
        next();
    };
};

const forgotPassword = catchAsync(async (req, res, next) => {
    if (typeof req.body.email !== 'string') {
        return next(new AppError('Please provide your email address.', 400));
    }

    const response = () =>
        res.status(200).json({
            status: 'success',
            message: 'If that email is registered, a reset link has been sent.',
        });

    const user = await User.findOne({ email: req.body.email });
    if (!user) return response();

    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetURL = `${frontendUrl}/reset-password/${resetToken}`;

    try {
        await sendEmail({ to: user.email, ...resetPasswordEmail(resetURL) });
    } catch (err) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });

        return next(err);
    }

    response();
});

const resetPassword = catchAsync(async (req, res, next) => {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
        return next(new AppError('Token is invalid or has expired', 400));
    }

    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    sendJWT(user, res);
});

const updatePassword = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.user.id).select('+password');

    if (
        typeof req.body.passwordCurrent !== 'string' ||
        !(await user.correctPassword(req.body.passwordCurrent, user.password))
    ) {
        return next(new AppError('Your current password is wrong.', 401));
    }

    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    await user.save();

    sendJWT(user, res);
});

export {
    signup,
    login,
    logout,
    protect,
    identify,
    restrictTo,
    forgotPassword,
    resetPassword,
    updatePassword,
};