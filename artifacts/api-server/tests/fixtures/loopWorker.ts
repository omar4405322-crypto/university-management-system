import { parentPort } from 'node:worker_threads';

// Synchronous infinite loop to simulate unyielding CPU work
const start = Date.now();
while (true) {
  // Busy wait intentionally to verify timeout termination
  if (Date.now() - start > 60000) {
    break;
  }
}

parentPort?.postMessage({ status: 'OK', text: 'loop-finished' });
