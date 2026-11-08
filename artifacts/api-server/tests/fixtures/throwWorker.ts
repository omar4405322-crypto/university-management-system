import { parentPort } from 'node:worker_threads';

// Fixture worker that throws an uncaught exception
throw new Error('Simulated worker crash exception');
