import mongoose from 'mongoose';
import dotenv from 'dotenv';

process.on('unhandledRejection', (err) => {
	console.log('UNHANDLED REJECTION! Shutting down...');
	console.log(err.name, err.message);
	process.exit(1);
});

process.on('uncaughtException', (err) => {
	console.log('UNCAUGHT EXCEPTION! Shutting down...');
	console.log(err.name, err.message);
	process.exit(1);
});

dotenv.config({ path: './.env' });
import app from './app.js';
import storage from './utils/storage.js';

const DB = process.env.DATABASE_LOCAL;
mongoose
	.connect(DB)
	.then((con) => {
		console.log('DB connection successful!');
	})
	.catch((err) => {
		console.log('DB connection error:', err);
	});

storage
    .checkConnection()
    .then(() => console.log('File storage connection successful!'))
    .catch((err) => console.log('File storage connection error:', err.name, err.message));

const port = process.env.PORT || 5000;
const server = app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});