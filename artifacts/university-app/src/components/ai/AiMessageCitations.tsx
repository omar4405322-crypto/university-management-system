import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, FileText, Paperclip } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import type { CitationItem, AIAttachmentReference } from '../../services/ai.service';

interface AiMessageCitationsProps {
  citations?: CitationItem[];
  attachmentReferences?: AIAttachmentReference[];
}

function AiMessageCitationsBase({ citations = [], attachmentReferences = [] }: AiMessageCitationsProps) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [expandedAttIndex, setExpandedAttIndex] = useState<number | null>(null);

  const hasCitations = Boolean(citations && citations.length > 0);
  const hasAttachments = Boolean(attachmentReferences && attachmentReferences.length > 0);

  if (!hasCitations && !hasAttachments) return null;

  const toggleExpand = (idx: number) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  return (
    <div data-testid="ai-citations-container" className="mt-3.5 pt-3 border-t border-brand-border/60">
      {hasCitations && (
        <>
          <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-brand-text-sub uppercase tracking-wider">
            <BookOpen size={13} className="text-brand-primary-600 dark:text-brand-primary-400" aria-hidden="true" />
            <span>{isRTL ? 'المصادر واللوائح المعتمدة' : 'Official Sources & Citations'}</span>
            <span className="ms-1 px-1.5 py-0.2 rounded-full bg-brand-primary-500/10 text-brand-primary-700 dark:text-brand-primary-300 text-[10px]">
              {citations.length}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {citations.map((cite, idx) => {
              const isExpanded = expandedIndex === idx;
              const displayTitle = (isRTL && cite.documentTitleAr) ? cite.documentTitleAr : cite.documentTitle;
              const metaParts: string[] = [];
              if (cite.articleNumber) metaParts.push(cite.articleNumber);
              if (cite.pageNumber) metaParts.push(isRTL ? `ص. ${cite.pageNumber}` : `p. ${cite.pageNumber}`);
              if (cite.version) metaParts.push(`v${cite.version}`);

              return (
                <div
                  key={cite.id || `${cite.documentVersionId}-${idx}`}
                  className="rounded-xl border border-brand-border/70 bg-brand-bg-main/60 p-2.5 text-xs transition-colors hover:border-brand-primary-500/40 hover:bg-brand-bg-elevated focus-within:ring-2 focus-within:ring-brand-primary-500/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleExpand(idx)}
                      className="flex-1 flex items-start gap-2 text-start font-medium text-brand-text-main hover:text-brand-primary-600 dark:hover:text-brand-primary-400 focus:outline-none"
                      aria-expanded={isExpanded}
                    >
                      <FileText size={14} className="mt-0.5 text-brand-primary-600 dark:text-brand-primary-400 shrink-0" aria-hidden="true" />
                      <div className="min-w-0">
                        <p data-testid="citation-doc-title" className="font-semibold text-brand-text-main truncate text-[13px]">
                          {displayTitle}
                        </p>
                        {metaParts.length > 0 && (
                          <p className="text-[11px] text-brand-text-sub mt-0.5 truncate">
                            {metaParts.join(' • ')}
                          </p>
                        )}
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleExpand(idx)}
                        className="p-1 text-brand-text-sub hover:text-brand-text-main rounded-md hover:bg-brand-border/40 focus:outline-none"
                        aria-label={isExpanded ? 'Collapse excerpt' : 'Expand excerpt'}
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Collapsible excerpt / quote */}
                  {isExpanded && cite.quote && (
                    <div className="mt-2.5 pt-2 border-t border-brand-border/40 text-[11px] text-brand-text-sub bg-brand-bg-elevated/80 rounded-lg p-2 leading-relaxed">
                      <p className="line-clamp-6 italic select-text">
                        "{cite.quote.replace(/^<untrusted_university_document_excerpt[^>]*>/i, '').replace(/<\/untrusted_university_document_excerpt>$/i, '').trim()}"
                      </p>
                      {cite.sectionTitle && (
                        <p className="mt-1 text-[10px] font-medium text-brand-primary-600 dark:text-brand-primary-400">
                          {isRTL ? 'القسم: ' : 'Section: '} {cite.sectionTitle}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {hasAttachments && (
        <div data-testid="ai-user-attachments-container" className={`${hasCitations ? 'mt-3.5 pt-3 border-t border-brand-border/40' : ''}`}>
          <div className="flex items-center justify-between gap-1.5 mb-2 text-xs font-semibold text-brand-text-sub uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <Paperclip size={13} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <span>{isRTL ? 'المرفقات والملفات الخاصة بك' : 'Your Attachments'}</span>
              <span className="ms-1 px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px]">
                {attachmentReferences.length}
              </span>
            </div>
            <span className="text-[10px] text-brand-text-muted font-normal lowercase tracking-normal">
              {isRTL ? 'ملف شخصي (غير ملزم رسمياً)' : 'User file (not official policy)'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {attachmentReferences.map((att, idx) => {
              const isExpanded = expandedAttIndex === idx;
              return (
                <div
                  key={att.attachmentId || idx}
                  className="rounded-xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 p-2.5 text-xs transition-colors hover:border-amber-500/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedAttIndex(isExpanded ? null : idx)}
                      className="flex-1 flex items-start gap-2 text-start font-medium text-brand-text-main hover:text-amber-600 dark:hover:text-amber-400 focus:outline-none"
                      aria-expanded={isExpanded}
                    >
                      <Paperclip size={14} className="mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                      <div className="min-w-0">
                        <p data-testid="attachment-ref-filename" className="font-semibold text-brand-text-main truncate text-[13px]">
                          {att.filename}
                        </p>
                        {att.pageNumber && (
                          <p className="text-[11px] text-brand-text-sub mt-0.5 truncate">
                            {isRTL ? `الصفحة ${att.pageNumber}` : `Page ${att.pageNumber}`}
                          </p>
                        )}
                      </div>
                    </button>
                    {att.excerptSnippet && (
                      <button
                        type="button"
                        onClick={() => setExpandedAttIndex(isExpanded ? null : idx)}
                        className="p-1 text-brand-text-sub hover:text-brand-text-main rounded-md hover:bg-brand-border/40 focus:outline-none"
                        aria-label={isExpanded ? 'Collapse excerpt' : 'Expand excerpt'}
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                  </div>
                  {isExpanded && att.excerptSnippet && (
                    <div className="mt-2.5 pt-2 border-t border-amber-500/20 text-[11px] text-brand-text-sub bg-brand-bg-elevated/80 rounded-lg p-2 leading-relaxed">
                      <p className="line-clamp-4 italic select-text">
                        "{att.excerptSnippet}"
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export const AiMessageCitations = React.memo(AiMessageCitationsBase);
export default AiMessageCitations;
