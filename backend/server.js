import 'dotenv/config';
import mongoose from 'mongoose';

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

import app from './app.js';
import * as storage from './utils/storage.js';
import { initSockets } from './sockets/index.js';
import { scheduleAccountCleanup } from './services/accountCleanup.js';
import { scheduleContestPublishing } from './services/contestPublishing.js';

const DB = process.env.DATABASE_LOCAL;
mongoose
	.connect(DB)
	.then((con) => {
		console.log('DB connection successful!');
		scheduleAccountCleanup();
		scheduleContestPublishing();
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

initSockets(server);