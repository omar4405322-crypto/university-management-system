import { parentPort, workerData } from 'node:worker_threads';
import fs from 'node:fs';

// If TEST_RECORDING_WORKER_PATH is provided, record that the worker was started
const marker = process.env.TEST_RECORDING_WORKER_PATH;
if (marker) {
  try {
    fs.writeFileSync(marker, 'started', 'utf8');
  } catch {
    // Ignore marker errors
  }
}

parentPort?.postMessage({ status: 'OK', text: 'recording-worker-started' });
