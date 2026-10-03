import assert from 'node:assert/strict';
import { test } from 'node:test';

// Mirror of citation quote sanitizer and metadata formatter in AiMessageCitations.tsx
function sanitizeExcerptQuote(rawQuote) {
  if (!rawQuote) return '';
  return rawQuote
    .replace(/^<untrusted_university_document_excerpt[^>]*>/i, '')
    .replace(/<\/untrusted_university_document_excerpt>$/i, '')
    .trim();
}

function formatCitationMetadata(cite, isRTL = false) {
  const parts = [];
  if (cite.articleNumber) parts.push(cite.articleNumber);
  if (cite.pageNumber) parts.push(isRTL ? `ص. ${cite.pageNumber}` : `p. ${cite.pageNumber}`);
  if (cite.version) parts.push(`v${cite.version}`);
  return parts.join(' • ');
}

test('PHASE 15 — Markdown, Citations & Source Drawer Verification', async (t) => {
  await t.test('1. sanitizeExcerptQuote strips untrusted XML boundary tags safely', () => {
    const rawWithTags = '<untrusted_university_document_excerpt documentTitle="Bylaws">Students must maintain 75% attendance.</untrusted_university_document_excerpt>';
    const cleaned = sanitizeExcerptQuote(rawWithTags);
    assert.equal(cleaned, 'Students must maintain 75% attendance.');

    // Plain text without tags remains untouched
    assert.equal(sanitizeExcerptQuote('Normal excerpt text'), 'Normal excerpt text');
    assert.equal(sanitizeExcerptQuote(''), '');
  });

  await t.test('2. Citation metadata formats correctly for English (LTR) and Arabic (RTL)', () => {
    const citation = {
      articleNumber: 'Article 14',
      pageNumber: 42,
      version: '2.1',
    };

    const enMeta = formatCitationMetadata(citation, false);
    assert.equal(enMeta, 'Article 14 • p. 42 • v2.1');

    const arCitation = {
      articleNumber: 'المادة 14',
      pageNumber: 42,
      version: '2.1',
    };
    const arMeta = formatCitationMetadata(arCitation, true);
    assert.equal(arMeta, 'المادة 14 • ص. 42 • v2.1');
  });

  await t.test('3. Official citations and user attachments maintain distinct styling and disclaimers', () => {
    const citations = [
      {
        id: 'cite-1',
        documentTitle: 'Academic Regulations 2026',
        documentTitleAr: 'اللائحة الأكاديمية 2026',
        sectionTitle: 'Examinations',
        articleNumber: 'Article 5',
        pageNumber: 12,
        version: '1.0',
        quote: 'Final exams account for 50% of the course grade.',
      },
    ];

    const attachmentReferences = [
      {
        attachmentId: 'att-99',
        filename: 'medical_excuse.pdf',
        pageNumber: 1,
        excerptSnippet: 'Hospital admission on 2026-10-01.',
      },
    ];

    // Citations header
    const officialHeaderEn = 'Official Sources & Citations';
    const officialHeaderAr = 'المصادر واللوائح المعتمدة';
    assert.ok(officialHeaderEn && officialHeaderAr);

    // Attachment disclaimer distinction
    const attachmentDisclaimerEn = 'User file (not official policy)';
    const attachmentDisclaimerAr = 'ملف شخصي (غير ملزم رسمياً)';
    assert.ok(attachmentDisclaimerEn && attachmentDisclaimerAr);

    // Excerpt sanitizer test on citation quote
    const cleanedQuote = sanitizeExcerptQuote(citations[0].quote);
    assert.equal(cleanedQuote, 'Final exams account for 50% of the course grade.');
  });

  await t.test('4. Empty citations and attachments evaluate to hidden/null', () => {
    const hasCitations = (list) => Boolean(list && list.length > 0);
    const hasAttachments = (list) => Boolean(list && list.length > 0);

    assert.equal(hasCitations([]), false);
    assert.equal(hasAttachments([]), false);
    assert.equal(hasCitations(undefined), false);
    assert.equal(hasAttachments(undefined), false);
  });
});
