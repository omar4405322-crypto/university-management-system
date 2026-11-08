import crypto from 'node:crypto';

export const SIMILARITY_SHINGLE_SIZE = 5;
export const SIMILARITY_MIN_TEXT_LENGTH = 100;
export const SIMILARITY_MIN_WORD_COUNT = 15;
export const SIMILARITY_MINHASH_PERMUTATIONS = 128;
export const SIMILARITY_SIGNATURE_BYTES = SIMILARITY_MINHASH_PERMUTATIONS * 4;
export const SIMILARITY_YIELD_EVERY_SHINGLES = 2000;

/**
 * Normalizes text for similarity comparison according to OD-137 specification.
 * Sequence:
 * 1. NFKC normalization
 * 2. Delete \p{Cf} characters (zero-width characters, BOM, soft hyphen) without adding spaces
 * 3. Delete tatweel (U+0640) and Arabic marks
 * 4. Map alef forms [أإآٱ] to ا, ة to ه, ى to ي (no other hamza folding)
 * 5. Map Arabic-Indic digits (U+0660-0669 and U+06F0-06F9) to 0-9
 * 6. toLowerCase()
 * 7. Replace runs of anything not \p{L}, \p{N}, or \p{M} with ONE space
 * 8. trim()
 */
export function normalizeSimilarityText(text: string): string {
  let res = text.normalize('NFKC');
  res = res.replace(/\p{Cf}/gu, '');
  if (/[\u0600-\u06FF]/u.test(res)) {
    res = res.replace(
      /[\u0640\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/gu,
      ''
    );
    res = res.replace(/[أإآٱ]/gu, 'ا');
    res = res.replace(/ة/gu, 'ه');
    res = res.replace(/ى/gu, 'ي');
    res = res.replace(/[\u0660-\u0669\u06F0-\u06F9]/gu, (d) => {
      const code = d.charCodeAt(0);
      return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
    });
  }
  res = res.toLowerCase();
  res = res.replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ');
  return res.trim();
}

/**
 * Checks eligibility for similarity analysis based on normalized text length and word count.
 */
export function isEligibleForSimilarity(normalized: string): boolean {
  if (normalized.length < SIMILARITY_MIN_TEXT_LENGTH) {
    return false;
  }
  let words = 0;
  let inWord = false;
  const len = normalized.length;
  for (let i = 0; i <= len; i++) {
    const isSpace = i === len || normalized.charCodeAt(i) === 32;
    if (!isSpace) {
      if (!inWord) {
        inWord = true;
      }
    } else if (inWord) {
      inWord = false;
      words++;
    }
  }
  return words >= SIMILARITY_MIN_WORD_COUNT;
}

/**
 * Lazily streams word shingles of the specified size over the normalized text.
 * Uses a ring buffer of token start offsets to avoid token collection allocations.
 */
export function* iterateWordShingles(
  normalized: string,
  size = SIMILARITY_SHINGLE_SIZE
): Generator<string> {
  if (size <= 0 || !normalized) {
    return;
  }
  const len = normalized.length;
  const starts = new Int32Array(size);
  let wordCount = 0;
  let inWord = false;
  let wordStart = 0;

  for (let i = 0; i <= len; i++) {
    const isSpace = i === len || normalized.charCodeAt(i) === 32;
    if (!isSpace) {
      if (!inWord) {
        inWord = true;
        wordStart = i;
      }
    } else if (inWord) {
      inWord = false;
      const wordEnd = i;
      starts[wordCount % size] = wordStart;
      wordCount++;
      if (wordCount >= size) {
        const oldestStart = starts[wordCount % size];
        yield normalized.slice(oldestStart, wordEnd);
      }
    }
  }
}

/**
 * Computes a 512-byte MinHash signature using 128 SHA-256 derived linear permutations.
 */
export function computeMinHashSignature(
  shingles: Iterable<string>,
  permutations = SIMILARITY_MINHASH_PERMUTATIONS
): { signature: Buffer; shingleCount: number } {
  const slots = new Uint32Array(permutations);
  slots.fill(0xffffffff);
  let shingleCount = 0;

  for (const shingle of shingles) {
    shingleCount++;
    const digest = crypto.hash('sha256', shingle, 'buffer');
    const h1 = digest.readUInt32LE(0);
    const h2 = (digest.readUInt32LE(4) | 1) >>> 0;
    for (let i = 0; i < permutations; i++) {
      const val = (h1 + i * h2) >>> 0;
      if (val < slots[i]) {
        slots[i] = val;
      }
    }
  }

  if (shingleCount === 0) {
    throw new RangeError('Cannot compute MinHash signature from empty shingles input');
  }

  const signature = Buffer.alloc(permutations * 4);
  for (let i = 0; i < permutations; i++) {
    signature.writeUInt32LE(slots[i], i * 4);
  }

  return { signature, shingleCount };
}

/**
 * Computes a MinHash signature asynchronously, yielding execution every `yieldEvery` shingles.
 */
export async function computeMinHashSignatureAsync(
  shingles: Iterable<string> | AsyncIterable<string>,
  options?: { yieldEvery?: number; yieldFn?: () => Promise<void> }
): Promise<{ signature: Buffer; shingleCount: number }> {
  const yieldEvery = options?.yieldEvery ?? SIMILARITY_YIELD_EVERY_SHINGLES;
  const yieldFn =
    options?.yieldFn ?? (() => new Promise<void>((resolve) => setImmediate(resolve)));

  const permutations = SIMILARITY_MINHASH_PERMUTATIONS;
  const slots = new Uint32Array(permutations);
  slots.fill(0xffffffff);
  let shingleCount = 0;

  if (Symbol.asyncIterator in shingles) {
    for await (const shingle of shingles) {
      shingleCount++;
      const digest = crypto.hash('sha256', shingle, 'buffer');
      const h1 = digest.readUInt32LE(0);
      const h2 = (digest.readUInt32LE(4) | 1) >>> 0;
      for (let i = 0; i < permutations; i++) {
        const val = (h1 + i * h2) >>> 0;
        if (val < slots[i]) {
          slots[i] = val;
        }
      }
      if (shingleCount % yieldEvery === 0) {
        await yieldFn();
      }
    }
  } else {
    for (const shingle of shingles as Iterable<string>) {
      shingleCount++;
      const digest = crypto.hash('sha256', shingle, 'buffer');
      const h1 = digest.readUInt32LE(0);
      const h2 = (digest.readUInt32LE(4) | 1) >>> 0;
      for (let i = 0; i < permutations; i++) {
        const val = (h1 + i * h2) >>> 0;
        if (val < slots[i]) {
          slots[i] = val;
        }
      }
      if (shingleCount % yieldEvery === 0) {
        await yieldFn();
      }
    }
  }

  if (shingleCount === 0) {
    throw new RangeError('Cannot compute MinHash signature from empty shingles input');
  }

  const signature = Buffer.alloc(permutations * 4);
  for (let i = 0; i < permutations; i++) {
    signature.writeUInt32LE(slots[i], i * 4);
  }

  return { signature, shingleCount };
}

/**
 * Estimates Jaccard similarity between two 512-byte MinHash signatures.
 * Respects byteOffset for Uint8Array and Buffer instances.
 */
export function estimateJaccardSimilarity(sigA: Uint8Array, sigB: Uint8Array): number {
  if (
    sigA.byteLength !== SIMILARITY_SIGNATURE_BYTES ||
    sigB.byteLength !== SIMILARITY_SIGNATURE_BYTES
  ) {
    throw new RangeError(
      `Invalid signature length: expected ${SIMILARITY_SIGNATURE_BYTES} bytes, got ${sigA.byteLength} and ${sigB.byteLength}`
    );
  }

  const viewA = new DataView(sigA.buffer, sigA.byteOffset, sigA.byteLength);
  const viewB = new DataView(sigB.buffer, sigB.byteOffset, sigB.byteLength);

  let matches = 0;
  for (let i = 0; i < SIMILARITY_MINHASH_PERMUTATIONS; i++) {
    if (viewA.getUint32(i * 4, true) === viewB.getUint32(i * 4, true)) {
      matches++;
    }
  }

  return matches / SIMILARITY_MINHASH_PERMUTATIONS;
}
