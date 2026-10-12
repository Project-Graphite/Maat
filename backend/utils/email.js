import nodemailer from 'nodemailer';
import AppError from './appError.js';

export default async ({ to, subject, text, html }) => {
    if (!process.env.EMAIL_HOST) {
        if (process.env.NODE_ENV === 'production') {
            throw new AppError('Email is not configured on the server.', 500);
        }
        console.log(
            `\n--- Email (not sent: EMAIL_HOST is unset) ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n---\n`,
        );
        return;
    }

    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT) || 587,
        auth: process.env.EMAIL_USERNAME && process.env.EMAIL_PASSWORD ?
            {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD,
            }
            : undefined,
    });

    try {
        await transporter.sendMail({
            from:
                process.env.EMAIL_FROM ||
                'Maat <noreply@maat.local>',
            to,
            subject,
            text,
            html,
        });
    } catch (err) {
        console.error('Email send failed:', err.message);
        throw new AppError(
            'There was an error sending the email. Try again later!',
            500,
        );
    }
};
