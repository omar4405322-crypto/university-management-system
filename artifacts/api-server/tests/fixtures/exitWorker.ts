import { parentPort } from 'node:worker_threads';

// Fixture worker that exits directly at the process level with non-zero exit code
process.exit(1);
