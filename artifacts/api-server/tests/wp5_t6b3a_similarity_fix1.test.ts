import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import crypto from 'node:crypto';
import v8 from 'node:v8';
import vm from 'node:vm';

import {
  normalizeSimilarityText,
  isEligibleForSimilarity,
  iterateWordShingles,
  computeMinHashSignature,
  computeMinHashSignatureAsync,
} from '../src/services/similarity/similarityPure';

/**
 * Reference implementation of the pre-optimization normalization chain.
 * Preserved verbatim as specified in OD-137.
 */
function referenceNormalizeSimilarityText(text: string): string {
  let res = text.normalize('NFKC');
  res = res.replace(/\p{Cf}/gu, '');
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
  res = res.toLowerCase();
  res = res.replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ');
  return res.trim();
}

// Build 900,000 words deterministic counter-based text beforehand (~4.4 MB)
const L1_WORD_COUNT = 900000;
let l1Chunks: string[] = [];
let l1CurrentChunk: string[] = [];
for (let i = 0; i < L1_WORD_COUNT; i++) {
  l1CurrentChunk.push(`w${i % 1000}`);
  if (l1CurrentChunk.length >= 10000) {
    l1Chunks.push(l1CurrentChunk.join(' '));
    l1CurrentChunk = [];
  }
}
if (l1CurrentChunk.length > 0) {
  l1Chunks.push(l1CurrentChunk.join(' '));
  l1CurrentChunk = [];
}
const l1RawText = l1Chunks.join(' ');
l1Chunks = []; // release helper arrays

describe('WP5-T6b3a-FIX1: Pure Similarity Engine Fix 1 Guard Suite', () => {
  it('G1: Golden vector regression guard passes on baseline and optimized module', async () => {
    const rawInput =
      'The quick brown fox jumps over the lazy dog while the cat sleeps near the warm fire in the old stone house';
    const expectedNormalized =
      'the quick brown fox jumps over the lazy dog while the cat sleeps near the warm fire in the old stone house';
    const expectedFirst32Hex =
      '2204292386772a17a1fc9b1bd4e90f002d2be0081d6f6a0f793c8606ede31b15';
    const expectedSha256Hex =
      'f6a865486c93f7388418b218c77f69d9e43048e5ccaa4b4309755eed7c1c0ae6';

    const normalized = normalizeSimilarityText(rawInput);
    assert.equal(normalized, expectedNormalized);

    const shingles = Array.from(iterateWordShingles(normalized));
    assert.equal(shingles.length, 18);

    const syncRes = computeMinHashSignature(shingles);
    assert.equal(syncRes.shingleCount, 18);
    assert.equal(syncRes.signature.length, 512);

    const first32Hex = syncRes.signature.subarray(0, 32).toString('hex');
    assert.equal(first32Hex, expectedFirst32Hex);

    const fullSha256Hex = crypto
      .createHash('sha256')
      .update(syncRes.signature)
      .digest('hex');
    assert.equal(fullSha256Hex, expectedSha256Hex);

    // Verify async variant yields byte-identical signature and shingle count
    const asyncRes = await computeMinHashSignatureAsync(iterateWordShingles(normalized));
    assert.equal(asyncRes.shingleCount, 18);
    assert.deepEqual(asyncRes.signature, syncRes.signature);
  });

  it('N5: Normalization equivalence across 49 varied inputs against reference chain', () => {
    const variedInputs: string[] = [
      'The quick brown fox jumps over the lazy dog',
      'LOREM IPSUM DOLOR SIT AMET CONSECTETUR ADIPISCING ELIT',
      'Simple singleword',
      'Mixed CASE words with UPPER and lower chars',
      'Latin with punctuation: Hello, world! (testing: 1, 2, 3; hyphenated-word).',
      'مُحَمَّدٌ رَسُولُ اللَّهِ وَخَاتَمُ النَّبِيِّينَ',
      'كِتَابٌ أُنْزِلَ إِلَيْكَ فَلَا يَكُنْ فِي صَدْرِكَ حَرَجٌ مِنْهُ',
      'مـــــرحـــبــا بـــكـــم فـــي جــــامــــعــــة الــــقـــاهــــرة',
      'أحمد إبراهيم آمنة ٱمرأة أستاذ إداري',
      'جامعة القاهرة كلية الهندسة قسم علوم الحاسب',
      'مدرسة ثانوية ومكتبة عامة وحياة كريمة',
      'علي يذهب إلى مصطفى في المستشفى لرؤية يحيى ومرتضى',
      'الهاتف المحمول: ٠١٢٣٤٥٦٧٨٩ والرقم الأكاديمي: ٩٨٧٦٥٤٣٢١٠',
      'شماره تماس: ۰۱۲۳۴۵۶۷۸۹ و سال تحصیلی: ۱۴۰۳-۱۴۰۴',
      'Combined digits: ١٢٣456 and ۷۸۹012 in single text',
      'می‌خواهم کتاب‌ها و خانه‌ها را در دانشگاه ببینم',
      'Module CS101: مقدمة في علوم الحاسب (Introduction to Computer Science)',
      'الامتحان النهائي Final Exam المقرر في 15/06/2025 في القاعة Hall B',
      '\uFDF2',
      '\uFEFB',
      'بسم \uFDF2 الرحمن الرحيم وقل \uFEFB إله إلا \uFDF2 وحده',
      'word with zero-width space w\u200Bord and ano\u200Bther',
      'word with zero-width joiner con\u200Dnect and j\u200Doin',
      'Directional marks \u200EEnglish text \u200Fنص عربي مع علامات التوجيه',
      'Multi\u00ADsyllabic words with soft\u00ADhyphen breaks embedded',
      'Non-breaking\u00A0spaces\u00A0between\u00A0multiple\u00A0words\u00A0here',
      'Ｈｅｌｌｏ　Ｆｕｌｌ　Ｗｉｄｔｈ　Ｗｏｒｌｄ',
      'Full-width digits: １２３４５６７８９０ and letters: ＡＢＣ',
      'Full-width symbols: ［Ｔｅｓｔ］：（Ａ＋Ｂ）＝Ｃ！',
      'Graduation ceremony 🎓 👨‍🎓 party 🎉 🥳 with books 📚 and rocket 🚀',
      'Country flags: 🇪🇬 Egypt, 🇸🇦 Saudi Arabia, 🇺🇸 USA, 🇯🇵 Japan',
      'Mathematical alphanumeric: 𝕸𝖆𝖙𝖍 and 𝔄𝔩𝔤𝔢𝔟𝔯𝔞 and 𝔸𝕝𝕘𝕖𝕓𝕣𝕒',
      'Hieroglyphs: 𓀀 𓀁 𓀂 𓀃 𓀄 and cuneiform: 𒀀 𒀁 爌',
      'Lone high surrogate \uD800 embedded safely',
      'Lone low surrogate \uDC00 embedded safely',
      'Reversed surrogates \uDC00\uD800 sequence',
      'İSTANBUL ve İZMİR üniversiteleri',
      'Ilık süt ve ılık çay',
      '',
      '     ',
      '\t\r\n   \t  \r\n',
      'Null \u0000 and control \u0001 \u0007 \u0008 \u001B characters',
      '\uFEFFLeading and trailing BOM marks\uFEFF',
      'Combining accents: e\u0301 cafe\u0301, n\u0303 sen\u0303or, c\u0327 franc\u0327ais',
      'Kurdish text: پێشەکی بۆ زانستی کۆمپیوتەر و تەکنەلۆژیا',
      'Urdu text: اردو زبان میں ایک جملہ اور ے بڑی ئے کا استعمال',
      'Heavy tashkeel: سَـــــلَّامٌ عَـــــلَـــــيْـــــكُـــــمْ وَرَحْـــــمَـــــةُ اللهِ وَبَـــــرَكَـــــاتُـــــهُ',
      'Punctuation only: ??? !!! --- ... @@@ ### $$$ %%% ^^^ &&& ***',
      'Measurements: 100km/h, 37°C, 50m², 100%, $50.00, #tag',
    ];

    assert.ok(variedInputs.length >= 40, `Expected at least 40 inputs, got ${variedInputs.length}`);

    for (let i = 0; i < variedInputs.length; i++) {
      const input = variedInputs[i];
      const actual = normalizeSimilarityText(input);
      const expected = referenceNormalizeSimilarityText(input);
      assert.equal(
        actual,
        expected,
        `Normalization mismatch at index ${i} for input: ${JSON.stringify(input)}`
      );
    }
  });

  it('L1: Memory measurement with 900,000 words: peak RSS delta < 250 MiB, retained heap delta < 40 MiB', async () => {
    let gc: (() => void) | null = null;
    try {
      v8.setFlagsFromString('--expose-gc');
      const cand = vm.runInNewContext('gc');
      if (typeof cand === 'function') {
        gc = cand;
      }
    } catch {
      gc = null;
    }

    if (gc) {
      gc();
    } else {
      console.log('GC status: NOT PROVEN for retention (gc unavailable)');
    }

    const initialMem = process.memoryUsage();
    const rss0 = initialMem.rss;
    const heapUsed0 = initialMem.heapUsed;
    let peakRss = rss0;

    const sampleInterval = setInterval(() => {
      const currentRss = process.memoryUsage().rss;
      if (currentRss > peakRss) {
        peakRss = currentRss;
      }
    }, 50);

    const startTime = Date.now();

    const normalized = normalizeSimilarityText(l1RawText);
    const eligible = isEligibleForSimilarity(normalized);
    assert.equal(eligible, true);

    let yieldCount = 0;
    const asyncRes = await computeMinHashSignatureAsync(iterateWordShingles(normalized), {
      yieldEvery: 2000,
      yieldFn: async () => {
        yieldCount++;
        await new Promise<void>((resolve) => setImmediate(resolve));
      },
    });

    const elapsed = Date.now() - startTime;
    clearInterval(sampleInterval);

    const finalRssSample = process.memoryUsage().rss;
    if (finalRssSample > peakRss) {
      peakRss = finalRssSample;
    }

    if (gc) {
      gc();
      gc();
    }

    const finalMem = process.memoryUsage();
    const heapUsed1 = finalMem.heapUsed;

    const peakRssDeltaMiB = (peakRss - rss0) / (1024 * 1024);
    const retainedHeapDeltaMiB = (heapUsed1 - heapUsed0) / (1024 * 1024);

    console.log(`[L1 RAW] peak RSS delta MiB: ${peakRssDeltaMiB.toFixed(2)}`);
    console.log(`[L1 RAW] retained heapUsed delta MiB: ${retainedHeapDeltaMiB.toFixed(2)}`);
    console.log(`[L1 RAW] yield count: ${yieldCount}`);
    console.log(`[L1 RAW] shingleCount: ${asyncRes.shingleCount}`);
    console.log(`[L1 RAW] elapsed ms: ${elapsed}`);

    assert.ok(yieldCount > 0, `Expected yield count > 0, got ${yieldCount}`);
    assert.equal(
      asyncRes.shingleCount,
      L1_WORD_COUNT - 4,
      `Expected shingleCount === ${L1_WORD_COUNT - 4}, got ${asyncRes.shingleCount}`
    );
    if (gc) {
      assert.ok(
        retainedHeapDeltaMiB < 40,
        `Expected retained heap delta < 40 MiB, got ${retainedHeapDeltaMiB.toFixed(2)}`
      );
    }
    assert.ok(
      peakRssDeltaMiB < 250,
      `Expected peak RSS delta < 250 MiB, got ${peakRssDeltaMiB.toFixed(2)}`
    );
  });
});
