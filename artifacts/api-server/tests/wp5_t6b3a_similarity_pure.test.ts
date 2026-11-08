import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SIMILARITY_SHINGLE_SIZE,
  SIMILARITY_MIN_TEXT_LENGTH,
  SIMILARITY_MIN_WORD_COUNT,
  SIMILARITY_MINHASH_PERMUTATIONS,
  SIMILARITY_SIGNATURE_BYTES,
  SIMILARITY_YIELD_EVERY_SHINGLES,
  normalizeSimilarityText,
  isEligibleForSimilarity,
  iterateWordShingles,
  computeMinHashSignature,
  computeMinHashSignatureAsync,
  estimateJaccardSimilarity,
} from '../src/services/similarity/similarityPure';

describe('WP5-T6b3a: Pure Text Similarity Engine', () => {
  it('OD-137: Exports expected constants with exact values', () => {
    assert.equal(SIMILARITY_SHINGLE_SIZE, 5);
    assert.equal(SIMILARITY_MIN_TEXT_LENGTH, 100);
    assert.equal(SIMILARITY_MIN_WORD_COUNT, 15);
    assert.equal(SIMILARITY_MINHASH_PERMUTATIONS, 128);
    assert.equal(SIMILARITY_SIGNATURE_BYTES, 512);
    assert.equal(SIMILARITY_YIELD_EVERY_SHINGLES, 2000);
  });

  it('N1: Arabic/English variants normalise identically', () => {
    // 1. Diacritics
    assert.equal(normalizeSimilarityText('مُحَمَّدٌ'), normalizeSimilarityText('محمد'));

    // 2. Alef forms ([أإآٱ] -> ا)
    assert.equal(
      normalizeSimilarityText('أحمد إسلام آية ٱسم'),
      normalizeSimilarityText('احمد اسلام اية اسم')
    );

    // 3. Ta marbuta (ة -> ه)
    assert.equal(normalizeSimilarityText('مدرسة وجامعة'), normalizeSimilarityText('مدرسه وجامعه'));

    // 4. Ya / Alef maksura (ى -> ي, no other hamza folding)
    assert.equal(normalizeSimilarityText('علي ومصطفى'), normalizeSimilarityText('علي ومصطفي'));

    // 5. Tatweel (U+0640)
    assert.equal(normalizeSimilarityText('مـــــرحـــبــا'), normalizeSimilarityText('مرحبا'));

    // 6. Case folding
    assert.equal(normalizeSimilarityText('Hello World'), normalizeSimilarityText('hello world'));

    // 7. Punctuation removal
    assert.equal(
      normalizeSimilarityText('Hello, World! (Testing: 1, 2, 3).'),
      normalizeSimilarityText('hello world testing 1 2 3')
    );

    // 8. Arabic-Indic digits (U+0660-0669 and U+06F0-06F9 -> 0-9)
    assert.equal(normalizeSimilarityText('عام ١٤٤٥'), normalizeSimilarityText('عام 1445'));
    assert.equal(normalizeSimilarityText('سال ۱۲۳۴'), normalizeSimilarityText('سال 1234'));

    // 9. NFKC full-width forms
    assert.equal(
      normalizeSimilarityText('Ｈｅｌｌｏ　１２３'),
      normalizeSimilarityText('hello 123')
    );
  });

  it('N2: Zero-width characters inside words do NOT change the result and do not split words', () => {
    assert.equal(normalizeSimilarityText('w\u200Bord'), 'word'); // ZWSP
    assert.equal(normalizeSimilarityText('k\u200Cey'), 'key'); // ZWNJ
    assert.equal(normalizeSimilarityText('j\u200Doin'), 'join'); // ZWJ
    assert.equal(normalizeSimilarityText('t\u200Ee\u200Fxt'), 'text'); // LRM, RLM
    assert.equal(normalizeSimilarityText('hyp\u00ADhen'), 'hyphen'); // soft hyphen
    assert.equal(normalizeSimilarityText('b\uFEFFom'), 'bom'); // BOM

    // Verifying zero-width characters do not split words into multiple tokens
    const withZwsp = 'wo\u200Brd1 wo\u200Brd2 wo\u200Brd3 wo\u200Brd4 wo\u200Brd5';
    const withoutZwsp = 'word1 word2 word3 word4 word5';
    assert.equal(normalizeSimilarityText(withZwsp), withoutZwsp);
  });

  it('N3: Whitespace variants (tabs, newlines, NBSP) collapse into single space and trim', () => {
    const raw = '  \t\n  hello \r\n\t  beautiful\u00A0\u00A0world  \n\t  ';
    assert.equal(normalizeSimilarityText(raw), 'hello beautiful world');
  });

  it('N4: Eligibility boundaries: 99 vs 100 characters and 14 vs 15 words, each condition alone', () => {
    // Condition 1: 99 characters, 15 words -> false (fails length, satisfies word count)
    // Construct exactly 15 words whose joined length is 99 characters:
    // 14 spaces + words length = 99 - 14 = 85 chars total for 15 words.
    // 14 words of length 6 (84 chars) + 1 word of length 1 (1 char) = 85 chars + 14 spaces = 99 chars.
    const words15_len99 = 'aaaaaa '.repeat(14) + 'b';
    assert.equal(words15_len99.length, 99);
    assert.equal(words15_len99.split(' ').length, 15);
    assert.equal(isEligibleForSimilarity(words15_len99), false);

    // Condition 2: 100 characters, 15 words -> true (satisfies both length and word count)
    // 14 words of length 6 (84 chars) + 1 word of length 2 (2 chars) = 86 chars + 14 spaces = 100 chars.
    const words15_len100 = 'aaaaaa '.repeat(14) + 'bb';
    assert.equal(words15_len100.length, 100);
    assert.equal(words15_len100.split(' ').length, 15);
    assert.equal(isEligibleForSimilarity(words15_len100), true);

    // Condition 3: 105 characters, 14 words -> false (satisfies length, fails word count)
    // 13 words of length 7 (91 chars) + 1 word of length 1 (1 char) = 92 chars + 13 spaces = 105 chars.
    const words14_len105 = 'aaaaaaa '.repeat(13) + 'b';
    assert.equal(words14_len105.length, 105);
    assert.equal(words14_len105.split(' ').length, 14);
    assert.equal(isEligibleForSimilarity(words14_len105), false);

    // Condition 4: 105 characters, 15 words -> true (satisfies both)
    // 14 words of length 6 (84 chars) + 1 word of length 7 (7 chars) = 91 chars + 14 spaces = 105 chars.
    const words15_len105 = 'aaaaaa '.repeat(14) + 'bbbbbbb';
    assert.equal(words15_len105.length, 105);
    assert.equal(words15_len105.split(' ').length, 15);
    assert.equal(isEligibleForSimilarity(words15_len105), true);

    // Condition 5: 99 characters, 14 words -> false (fails both)
    const words14_len99 = 'aaaaaa '.repeat(13) + 'bbbbbbbb';
    assert.equal(words14_len99.length, 99);
    assert.equal(words14_len99.split(' ').length, 14);
    assert.equal(isEligibleForSimilarity(words14_len99), false);
  });

  it('S1: Shingles for a tiny input with explicit size 3 equal expected list, count = words - size + 1, fewer words yields none, works lazily', () => {
    const tiny = 'one two three four five';
    const shingles = Array.from(iterateWordShingles(tiny, 3));
    assert.deepEqual(shingles, [
      'one two three',
      'two three four',
      'three four five',
    ]);
    assert.equal(shingles.length, 5 - 3 + 1);

    // Fewer words than size yields nothing
    const shortText = 'one two';
    const emptyShingles = Array.from(iterateWordShingles(shortText, 3));
    assert.deepEqual(emptyShingles, []);

    // Streaming / lazy check: generator produces first shingle without exhausting a large input
    let generatorEvaluated = false;
    function* infiniteWords(): Generator<string> {
      let i = 0;
      while (true) {
        if (i === 10) {
          generatorEvaluated = true;
        }
        yield `word${i++}`;
      }
    }
    // Test laziness on iterateWordShingles: taking first element from a 100,000 word text
    const largeNormalized = Array.from({ length: 100000 }, (_, i) => `token${i}`).join(' ');
    const gen = iterateWordShingles(largeNormalized, 3);
    const firstShingle = gen.next().value;
    assert.equal(firstShingle, 'token0 token1 token2');
  });

  it('M1: Signature is exactly 512 bytes, deterministic across two calls, equal to async variant; async calls yieldFn floor(n / yieldEvery) times', async () => {
    const text = Array.from({ length: 5500 }, (_, i) => `term${i}`).join(' ');
    const shinglesA = Array.from(iterateWordShingles(text, 5));
    const shinglesB = Array.from(iterateWordShingles(text, 5));

    const syncA = computeMinHashSignature(shinglesA);
    const syncB = computeMinHashSignature(shinglesB);

    assert.equal(syncA.signature.length, 512);
    assert.ok(Buffer.isBuffer(syncA.signature));
    assert.equal(syncA.shingleCount, shinglesA.length);
    assert.deepEqual(syncA.signature, syncB.signature);

    let yieldCalls = 0;
    const yieldEvery = 1000;
    const asyncRes = await computeMinHashSignatureAsync(iterateWordShingles(text, 5), {
      yieldEvery,
      yieldFn: async () => {
        yieldCalls++;
      },
    });

    assert.equal(asyncRes.signature.length, 512);
    assert.equal(asyncRes.shingleCount, shinglesA.length);
    assert.deepEqual(asyncRes.signature, syncA.signature);

    // Expected yieldCalls = Math.floor(n / yieldEvery)
    const expectedYields = Math.floor(shinglesA.length / yieldEvery);
    assert.equal(yieldCalls, expectedYields);
  });

  it('M2: ACCURACY: deterministic generated shingle sets with known Jaccard 0.0, 0.25, 0.5, 0.75, 1.0 within +/- 0.13', () => {
    // MinHash estimation error derivation:
    // For k = 128 hash permutations, the estimate is the mean of 128 Bernoulli trials.
    // Standard error SE = sqrt(J * (1 - J) / k).
    // At maximum variance J = 0.5: SE = sqrt(0.25 / 128) ≈ 0.044194.
    // 3 standard errors = 3 * SE ≈ 3 * 0.044194 ≈ 0.13258 ≈ 0.13.
    // Thus +/- 0.13 covers ~99.7% of the sampling distribution under 128 permutations.

    function makeShingleSet(prefix: string, start: number, count: number): string[] {
      const result: string[] = [];
      for (let i = start; i < start + count; i++) {
        result.push(`${prefix}_shingle_${i}_token_extra`);
      }
      return result;
    }

    // 1. Known Jaccard 1.0 (identical sets, 2400 shingles)
    const set1A = makeShingleSet('univ', 0, 2400);
    const set1B = makeShingleSet('univ', 0, 2400);
    const sig1A = computeMinHashSignature(set1A).signature;
    const sig1B = computeMinHashSignature(set1B).signature;
    const est1 = estimateJaccardSimilarity(sig1A, sig1B);
    assert.equal(est1, 1.0, `Expected exact 1.0 for identical sets, got ${est1}`);

    // 2. Known Jaccard 0.0 (disjoint sets, 2400 shingles each)
    const set0A = makeShingleSet('alpha', 0, 2400);
    const set0B = makeShingleSet('beta', 0, 2400);
    const sig0A = computeMinHashSignature(set0A).signature;
    const sig0B = computeMinHashSignature(set0B).signature;
    const est0 = estimateJaccardSimilarity(sig0A, sig0B);
    assert.ok(est0 <= 1 / 128, `Expected <= 1/128 for disjoint sets, got ${est0}`);

    // 3. Known Jaccard 0.25 (C = 1000, N = 2500, union = 4000; J = 1000/4000 = 0.25)
    const set025A = makeShingleSet('univ', 0, 2500);
    const set025B = makeShingleSet('univ', 1500, 2500);
    const sig025A = computeMinHashSignature(set025A).signature;
    const sig025B = computeMinHashSignature(set025B).signature;
    const est025 = estimateJaccardSimilarity(sig025A, sig025B);
    assert.ok(
      Math.abs(est025 - 0.25) <= 0.13,
      `Jaccard 0.25 estimate out of bounds: got ${est025}`
    );

    // 4. Known Jaccard 0.50 (C = 2000, N = 3000, union = 4000; J = 2000/4000 = 0.50)
    const set05A = makeShingleSet('univ', 0, 3000);
    const set05B = makeShingleSet('univ', 1000, 3000);
    const sig05A = computeMinHashSignature(set05A).signature;
    const sig05B = computeMinHashSignature(set05B).signature;
    const est05 = estimateJaccardSimilarity(sig05A, sig05B);
    assert.ok(
      Math.abs(est05 - 0.50) <= 0.13,
      `Jaccard 0.50 estimate out of bounds: got ${est05}`
    );

    // 5. Known Jaccard 0.75 (C = 3000, N = 3500, union = 4000; J = 3000/4000 = 0.75)
    const set075A = makeShingleSet('univ', 0, 3500);
    const set075B = makeShingleSet('univ', 500, 3500);
    const sig075A = computeMinHashSignature(set075A).signature;
    const sig075B = computeMinHashSignature(set075B).signature;
    const est075 = estimateJaccardSimilarity(sig075A, sig075B);
    assert.ok(
      Math.abs(est075 - 0.75) <= 0.13,
      `Jaccard 0.75 estimate out of bounds: got ${est075}`
    );
  });

  it('M3: Evasion tests: formatting/zero-width changes score 1.0, reordered paragraphs score >= 0.75', () => {
    const paragraphs: string[] = [];
    for (let p = 0; p < 20; p++) {
      const words: string[] = [];
      for (let w = 0; w < 100; w++) {
        words.push(`p${p}term${w}`);
      }
      paragraphs.push(words.join(' '));
    }

    const originalText = paragraphs.join('\n\n');

    // Evasion text: casing, punctuation, extra whitespace, zero-width characters
    const evasionText = paragraphs
      .map((p, i) => {
        return p
          .split(' ')
          .map((w, j) => {
            let mod = w.toUpperCase();
            if (j % 2 === 0) mod = mod.slice(0, 2) + '\u200B' + mod.slice(2);
            if (j % 4 === 0) mod += '!?.,';
            return mod;
          })
          .join('   \t\n  ');
      })
      .join('\n\n\n');

    const normOrig = normalizeSimilarityText(originalText);
    const normEvasion = normalizeSimilarityText(evasionText);

    assert.equal(normOrig, normEvasion);

    const sigOrig = computeMinHashSignature(iterateWordShingles(normOrig)).signature;
    const sigEvasion = computeMinHashSignature(iterateWordShingles(normEvasion)).signature;
    const evasionScore = estimateJaccardSimilarity(sigOrig, sigEvasion);
    assert.equal(evasionScore, 1.0);

    // Reordered paragraphs: expected true Jaccard ~0.93, estimate >= 0.75
    const reorderedText = [...paragraphs].reverse().join('\n\n');
    const normReordered = normalizeSimilarityText(reorderedText);
    const sigReordered = computeMinHashSignature(iterateWordShingles(normReordered)).signature;
    const reorderedScore = estimateJaccardSimilarity(sigOrig, sigReordered);
    assert.ok(
      reorderedScore >= 0.75,
      `Reordered paragraphs score should be >= 0.75, got ${reorderedScore}`
    );
  });

  it('M4: Uint8Array and Buffer inputs give same estimate; wrong lengths throw RangeError; empty input throws RangeError', () => {
    const text = Array.from({ length: 50 }, (_, i) => `item${i}`).join(' ');
    const shingles = Array.from(iterateWordShingles(text, 5));
    const sigBufA = computeMinHashSignature(shingles).signature;
    const sigBufB = computeMinHashSignature(shingles).signature;

    // Direct buffer comparison
    const estBuf = estimateJaccardSimilarity(sigBufA, sigBufB);
    assert.equal(estBuf, 1.0);

    // Uint8Array views (including slice and offset views)
    const uint8A = new Uint8Array(sigBufA.buffer, sigBufA.byteOffset, sigBufA.byteLength);
    const uint8B = new Uint8Array(sigBufB.buffer, sigBufB.byteOffset, sigBufB.byteLength);
    const estUint8 = estimateJaccardSimilarity(uint8A, uint8B);
    assert.equal(estUint8, estBuf);

    // Subarray with non-zero byteOffset
    const largeBuffer = new Uint8Array(1024);
    largeBuffer.set(uint8A, 16);
    const offsetViewA = largeBuffer.subarray(16, 16 + 512);
    const estOffset = estimateJaccardSimilarity(offsetViewA, uint8B);
    assert.equal(estOffset, 1.0);

    // Wrong signature length checks
    assert.throws(() => {
      estimateJaccardSimilarity(new Uint8Array(511), sigBufB);
    }, RangeError);

    assert.throws(() => {
      estimateJaccardSimilarity(sigBufA, new Uint8Array(513));
    }, RangeError);

    // Empty input to computeMinHashSignature throws RangeError
    assert.throws(() => {
      computeMinHashSignature([]);
    }, RangeError);

    // Empty input to computeMinHashSignatureAsync throws RangeError
    assert.rejects(async () => {
      await computeMinHashSignatureAsync([]);
    }, RangeError);
  });

  it('M5: Signature length is 512 for minimum-size input and for 100,000-word input (async, shingleCount = words - 4)', async () => {
    // Minimum-size input: 5 words -> exactly 1 shingle
    const minText = 'one two three four five';
    const minRes = computeMinHashSignature(iterateWordShingles(minText, 5));
    assert.equal(minRes.signature.length, 512);
    assert.equal(minRes.shingleCount, 1);

    // 100,000 words input: async variant without crashing or excessive memory
    function* generate100kWords(): Generator<string> {
      for (let i = 0; i < 100000; i++) {
        yield `word${i}`;
      }
    }
    const chunks: string[] = [];
    for (let i = 0; i < 1000; i++) {
      chunks.push(Array.from({ length: 100 }, (_, j) => `w${i * 100 + j}`).join(' '));
    }
    const hugeText = chunks.join(' ');
    const hugeRes = await computeMinHashSignatureAsync(iterateWordShingles(hugeText, 5));
    assert.equal(hugeRes.signature.length, 512);
    assert.equal(hugeRes.shingleCount, 100000 - 4);
  });

  it('U1: Emoji, astral characters and lone surrogates do not throw', () => {
    assert.doesNotThrow(() => {
      const emojiText = 'Graduation ceremony 🎓 📚 🏫 congratulations to all students!';
      const norm1 = normalizeSimilarityText(emojiText);
      Array.from(iterateWordShingles(norm1, 5));
    });

    assert.doesNotThrow(() => {
      const astralText = 'Mathematical bold 𝕸𝖆𝖙𝖍 and hieroglyphs 𓀀 𓀁 text sample';
      const norm2 = normalizeSimilarityText(astralText);
      Array.from(iterateWordShingles(norm2, 5));
    });

    assert.doesNotThrow(() => {
      const surrogateText = 'Lone surrogates \uD800 and \uDFFF inside sample text strings';
      const norm3 = normalizeSimilarityText(surrogateText);
      Array.from(iterateWordShingles(norm3, 5));
    });
  });

  it('Z1: source-text test: module imports only node:crypto and contains no console., eval or new Function', () => {
    // Structural test: structural check of source text, not a formal proof.
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const modulePath = path.resolve(__dirname, '../src/services/similarity/similarityPure.ts');
    const source = readFileSync(modulePath, 'utf8');

    // 1. Module imports only node:crypto
    const importLines = source
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('import '));

    assert.ok(importLines.length > 0, 'Module should have at least one import statement');
    for (const line of importLines) {
      assert.match(
        line,
        /^import\s+.*from\s+['"]node:crypto['"];?$/,
        `Module must only import from 'node:crypto', found: ${line}`
      );
    }

    // 2. Contains no console.
    assert.equal(
      source.includes('console.'),
      false,
      'Module must not contain any console.* calls'
    );

    // 3. Contains no eval
    assert.equal(
      /\beval\s*\(/.test(source),
      false,
      'Module must not contain eval'
    );

    // 4. Contains no new Function
    assert.equal(
      source.includes('new Function'),
      false,
      'Module must not contain new Function'
    );
  });
});
