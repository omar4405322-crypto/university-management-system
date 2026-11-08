import { parentPort } from 'node:worker_threads';

// Memory hog: allocate heap strings until hitting maxOldGenerationSizeMb
const chunks: string[] = [];
while (true) {
  chunks.push('M'.repeat(1024 * 1024));
}
