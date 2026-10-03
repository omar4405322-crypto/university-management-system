import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Archive,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  FileText,
  Filter,
  History,
  Info,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  UploadCloud,
  X,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import {
  activateDocumentVersion,
  archiveKnowledgeDocument,
  fetchKnowledgeDocumentDetail,
  fetchKnowledgeDocuments,
  uploadKnowledgeDocument,
  uploadKnowledgeVersion,
  type KnowledgeDocumentItem,
  type KnowledgeDocumentVersionItem,
} from '../../services/knowledge.service';

export default function KnowledgeBaseAdminPage() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const [documents, setDocuments] = useState<KnowledgeDocumentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isVersionUploadOpen, setIsVersionUploadOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocumentItem | null>(null);
  const [detailDoc, setDetailDoc] = useState<KnowledgeDocumentItem | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Upload Form State
  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [description, setDescription] = useState('');
  const [documentType, setDocumentType] = useState('REGULATION');
  const [scope, setScope] = useState('GLOBAL');
  const [versionTag, setVersionTag] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchKnowledgeDocuments({
        search: search.trim() || undefined,
        scope: scopeFilter || undefined,
        documentType: typeFilter || undefined,
        status: statusFilter || undefined,
      });
      setDocuments(res.documents);
      setTotal(res.total);
    } catch {
      // Handle gracefully
    } finally {
      setIsLoading(false);
    }
  }, [search, scopeFilter, typeFilter, statusFilter]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const openDocumentDetail = async (doc: KnowledgeDocumentItem) => {
    setSelectedDoc(doc);
    setIsLoadingDetail(true);
    try {
      const full = await fetchKnowledgeDocumentDetail(doc.id);
      setDetailDoc(full);
    } catch {
      setDetailDoc(doc);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleUploadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError(isRTL ? 'يرجى اختيار ملف صالح' : 'Please select a valid document file');
      return;
    }
    if (selectedFile.size > 20 * 1024 * 1024) {
      setUploadError(isRTL ? 'حجم الملف يتجاوز الحد الأقصى (20 ميجابايت)' : 'File size exceeds maximum limit of 20MB');
      return;
    }

    setIsSubmitting(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('title', title);
    if (titleAr) formData.append('titleAr', titleAr);
    if (description) formData.append('description', description);
    formData.append('documentType', documentType);
    formData.append('scope', scope);
    if (versionTag) formData.append('versionTag', versionTag);
    if (effectiveDate) formData.append('effectiveDate', effectiveDate);

    try {
      await uploadKnowledgeDocument(formData);
      setIsUploadOpen(false);
      resetForm();
      setSuccessMessage(isRTL ? 'تم رفع المستند بنجاح وبدء معالجته وفهرسته' : 'Document uploaded successfully and indexed');
      setTimeout(() => setSuccessMessage(null), 5000);
      loadDocuments();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || (isRTL ? 'فشل رفع المستند' : 'Failed to upload document');
      setUploadError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVersionUploadSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDoc || !selectedFile) return;

    setIsSubmitting(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    if (versionTag) formData.append('versionTag', versionTag);
    if (effectiveDate) formData.append('effectiveDate', effectiveDate);

    try {
      await uploadKnowledgeVersion(selectedDoc.id, formData);
      setIsVersionUploadOpen(false);
      setSelectedFile(null);
      setVersionTag('');
      setEffectiveDate('');
      setSuccessMessage(isRTL ? 'تم رفع الإصدار الجديد بنجاح' : 'New version uploaded successfully');
      setTimeout(() => setSuccessMessage(null), 5000);
      openDocumentDetail(selectedDoc);
      loadDocuments();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to upload version';
      setUploadError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivateVersion = async (versionId: string) => {
    if (!selectedDoc) return;
    try {
      await activateDocumentVersion(selectedDoc.id, versionId);
      openDocumentDetail(selectedDoc);
      loadDocuments();
    } catch {
      // Handled
    }
  };

  const handleArchive = async (docId: string) => {
    if (!window.confirm(isRTL ? 'هل أنت متأكد من أرشفة هذا المستند؟ لن يتم استخدامه في إجابات الذكاء الاصطناعي.' : 'Are you sure you want to archive this document? It will no longer be retrieved for AI answers.')) {
      return;
    }
    try {
      await archiveKnowledgeDocument(docId);
      if (selectedDoc?.id === docId) setSelectedDoc(null);
      loadDocuments();
    } catch {
      // Handled
    }
  };

  const resetForm = () => {
    setTitle('');
    setTitleAr('');
    setDescription('');
    setDocumentType('REGULATION');
    setScope('GLOBAL');
    setVersionTag('');
    setEffectiveDate('');
    setSelectedFile(null);
    setUploadError(null);
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={12} aria-hidden="true" />
            {isRTL ? 'جاهز ومفهرس' : 'Ready'}
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
            {isRTL ? 'جارٍ الاستخراج والتقطيع' : 'Processing'}
          </span>
        );
      case 'REQUIRES_OCR':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300" title={isRTL ? 'مستند ممسوح ضوئياً يتطلب OCR' : 'Scanned document requires OCR'}>
            <AlertCircle size={12} aria-hidden="true" />
            {isRTL ? 'يتطلب OCR' : 'Requires OCR'}
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
            <ShieldAlert size={12} aria-hidden="true" />
            {isRTL ? 'فشل التحليل' : 'Failed'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-bg-elevated px-2 py-0.5 text-xs font-semibold text-brand-text-sub">
            <Clock size={12} aria-hidden="true" />
            {status}
          </span>
        );
    }
  };

  return (
    <div data-testid="knowledge-base-admin-page" className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-brand-primary-600 dark:text-brand-primary-400" />
            <h1 className="text-2xl font-bold tracking-tight text-brand-text-main">
              {isRTL ? 'قاعدة المعرفة واللوائح الرسمية' : 'University Knowledge Base & Regulations'}
            </h1>
          </div>
          <p className="text-sm text-brand-text-sub mt-1">
            {isRTL
              ? 'إدارة اللوائح، القواعد، أدلة الطلاب والمستندات الرسمية المعتمدة للإجابة والتوثيق عبر الذكاء الاصطناعي'
              : 'Manage approved institutional regulations, bylaws, and official sources for verifiable AI answers'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => { resetForm(); setIsUploadOpen(true); }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-brand-primary-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary-600"
        >
          <Plus size={16} aria-hidden="true" />
          <span>{isRTL ? 'رفع لائحة / مستند رسمي' : 'Upload Official Document'}</span>
        </button>
      </div>

      {/* Success banner */}
      {successMessage && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} />
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-brand-border bg-brand-bg-elevated p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute inset-y-0 start-3 my-auto h-4 w-4 text-brand-text-sub pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isRTL ? 'بحث في العناوين واللوائح...' : 'Search regulations & titles...'}
              className="w-full rounded-xl border border-brand-border bg-brand-bg-main ps-9 pe-3 py-2 text-sm text-brand-text-main placeholder:text-brand-text-sub focus:border-brand-primary-500 focus:outline-none focus:ring-1 focus:ring-brand-primary-500"
            />
          </div>

          {/* Scope Filter */}
          <select
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            className="rounded-xl border border-brand-border bg-brand-bg-main px-3 py-2 text-sm text-brand-text-main focus:border-brand-primary-500 focus:outline-none focus:ring-1 focus:ring-brand-primary-500"
          >
            <option value="">{isRTL ? 'كافة النطاقات (جامعة / كلية / قسم)' : 'All Scopes (Global / College / Dept)'}</option>
            <option value="GLOBAL">{isRTL ? 'على مستوى الجامعة (عام)' : 'University-wide (Global)'}</option>
            <option value="COLLEGE">{isRTL ? 'خاص بكلية' : 'College-scoped'}</option>
            <option value="DEPARTMENT">{isRTL ? 'خاص بقسم' : 'Department-scoped'}</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-brand-border bg-brand-bg-main px-3 py-2 text-sm text-brand-text-main focus:border-brand-primary-500 focus:outline-none focus:ring-1 focus:ring-brand-primary-500"
          >
            <option value="">{isRTL ? 'كافة أنواع الوثائق' : 'All Document Types'}</option>
            <option value="REGULATION">{isRTL ? 'لائحة أكاديمية / تنظيمية' : 'Regulation'}</option>
            <option value="BYLAW">{isRTL ? 'لائحة داخلية / قانون' : 'Bylaw'}</option>
            <option value="HANDBOOK">{isRTL ? 'دليل الطالب' : 'Handbook'}</option>
            <option value="POLICY">{isRTL ? 'سياسة جامعية' : 'Policy'}</option>
            <option value="PROCEDURE">{isRTL ? 'إجراء رسمي' : 'Procedure'}</option>
            <option value="ANNOUNCEMENT">{isRTL ? 'تعميم رسمي' : 'Announcement'}</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-brand-border bg-brand-bg-main px-3 py-2 text-sm text-brand-text-main focus:border-brand-primary-500 focus:outline-none focus:ring-1 focus:ring-brand-primary-500"
          >
            <option value="ACTIVE">{isRTL ? 'نشط ومعتمد' : 'Active Only'}</option>
            <option value="ARCHIVED">{isRTL ? 'مؤرشف' : 'Archived'}</option>
            <option value="">{isRTL ? 'الكل' : 'All Statuses'}</option>
          </select>
        </div>
      </div>

      {/* Documents Table */}
      <div className="rounded-2xl border border-brand-border bg-brand-bg-elevated overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-brand-text-sub flex flex-col items-center justify-center gap-2">
            <Loader2 className="animate-spin text-brand-primary-600" size={24} />
            <p className="text-sm">{isRTL ? 'جارٍ تحميل المستندات واللوائح...' : 'Loading official documents...'}</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center text-brand-text-sub space-y-2">
            <FileText size={36} className="mx-auto text-brand-text-muted" />
            <p className="text-base font-medium text-brand-text-main">
              {isRTL ? 'لا توجد مستندات مطابقة' : 'No knowledge documents found'}
            </p>
            <p className="text-sm">
              {isRTL ? 'قم برفع أول وثيقة أو لائحة رسمية لتغذية مساعد الذكاء الاصطناعي' : 'Upload official university documents to ground AI answers with verifiable citations'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="border-b border-brand-border bg-brand-bg-main text-xs font-semibold text-brand-text-sub uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 text-start">{isRTL ? 'المستند / اللائحة' : 'Document Title'}</th>
                  <th className="px-4 py-3 text-start">{isRTL ? 'النوع والنطاق' : 'Type & Scope'}</th>
                  <th className="px-4 py-3 text-start">{isRTL ? 'الإصدار النشط' : 'Active Version'}</th>
                  <th className="px-4 py-3 text-start">{isRTL ? 'حالة المعالجة' : 'Processing Status'}</th>
                  <th className="px-4 py-3 text-start">{isRTL ? 'القطع المفهرسة' : 'Indexed Chunks'}</th>
                  <th className="px-5 py-3 text-end">{isRTL ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {documents.map((doc) => {
                  const displayTitle = (isRTL && doc.titleAr) ? doc.titleAr : doc.title;
                  const activeVer = doc.activeVersion;

                  return (
                    <tr key={doc.id} data-testid={`knowledge-doc-card-${doc.id}`} className="hover:bg-brand-bg-main/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <button
                          type="button"
                          onClick={() => openDocumentDetail(doc)}
                          className="text-start font-semibold text-brand-text-main hover:text-brand-primary-600 dark:hover:text-brand-primary-400 focus:outline-none"
                        >
                          <div className="flex items-center gap-2">
                            <FileText size={16} className="text-brand-primary-600 dark:text-brand-primary-400 shrink-0" />
                            <span className="line-clamp-1">{displayTitle}</span>
                          </div>
                        </button>
                        {doc.description && (
                          <p className="text-xs text-brand-text-sub mt-0.5 line-clamp-1 ps-6">{doc.description}</p>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-xs text-brand-text-sub whitespace-nowrap">
                        <span className="font-medium text-brand-text-main">{doc.documentType}</span>
                        <span className="mx-1">•</span>
                        <span>{doc.scope}</span>
                      </td>

                      <td className="px-4 py-3.5 text-xs whitespace-nowrap">
                        {activeVer ? (
                          <div className="flex items-center gap-1 font-medium text-brand-text-main">
                            <span>v{activeVer.version}</span>
                            {activeVer.versionTag && (
                              <span className="text-[11px] text-brand-text-sub">({activeVer.versionTag})</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-brand-text-muted">{isRTL ? 'لا يوجد' : 'None'}</span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {activeVer ? renderStatusBadge(activeVer.processingStatus) : <span className="text-xs text-brand-text-sub">—</span>}
                      </td>

                      <td className="px-4 py-3.5 text-xs text-brand-text-sub whitespace-nowrap">
                        <span className="font-semibold text-brand-text-main">{activeVer?.chunkCount ?? 0}</span> {isRTL ? 'مقطع' : 'chunks'}
                      </td>

                      <td className="px-5 py-3.5 text-end whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openDocumentDetail(doc)}
                            className="rounded-lg p-1.5 text-brand-text-sub hover:bg-brand-bg-main hover:text-brand-text-main"
                            title={isRTL ? 'عرض التفاصيل وسجل الإصدارات' : 'View Details & Version History'}
                          >
                            <History size={16} />
                          </button>
                          {doc.status === 'ACTIVE' && (
                            <button
                              type="button"
                              onClick={() => handleArchive(doc.id)}
                              className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-500/10"
                              title={isRTL ? 'أرشفة اللائحة' : 'Archive document'}
                            >
                              <Archive size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Document Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl border border-brand-border bg-brand-bg-elevated p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <h2 className="text-lg font-bold text-brand-text-main">
                {isRTL ? 'رفع لائحة / مستند رسمي جديد' : 'Upload Official University Document'}
              </h2>
              <button
                type="button"
                onClick={() => setIsUploadOpen(false)}
                className="text-brand-text-sub hover:text-brand-text-main"
              >
                <X size={20} />
              </button>
            </div>

            {uploadError && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-brand-text-main mb-1">
                  {isRTL ? 'عنوان اللائحة بالإنجليزية' : 'Document Title (English)'} *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Academic Examination Regulations 2026"
                  className="w-full rounded-xl border border-brand-border bg-brand-bg-main px-3 py-2 text-sm text-brand-text-main focus:outline-none focus:ring-1 focus:ring-brand-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-text-main mb-1">
                  {isRTL ? 'عنوان اللائحة بالعربية' : 'Document Title (Arabic)'}
                </label>
                <input
                  type="text"
                  value={titleAr}
                  onChange={(e) => setTitleAr(e.target.value)}
                  placeholder="مثال: اللائحة الأكاديمية ونظام الامتحانات 2026"
                  className="w-full rounded-xl border border-brand-border bg-brand-bg-main px-3 py-2 text-sm text-brand-text-main focus:outline-none focus:ring-1 focus:ring-brand-primary-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-brand-text-main mb-1">
                    {isRTL ? 'نوع الوثيقة' : 'Document Type'}
                  </label>
                  <select
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    className="w-full rounded-xl border border-brand-border bg-brand-bg-main px-3 py-2 text-sm text-brand-text-main focus:outline-none focus:ring-1 focus:ring-brand-primary-500"
                  >
                    <option value="REGULATION">Regulation (لائحة أكاديمية)</option>
                    <option value="BYLAW">Bylaw (لائحة داخلية)</option>
                    <option value="HANDBOOK">Handbook (دليل الطالب)</option>
                    <option value="POLICY">Policy (سياسة)</option>
                    <option value="PROCEDURE">Procedure (إجراء رسمي)</option>
                    <option value="ANNOUNCEMENT">Announcement (تعميم رسمي)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-text-main mb-1">
                    {isRTL ? 'نطاق الوثيقة' : 'Scope / Visibility'}
                  </label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    className="w-full rounded-xl border border-brand-border bg-brand-bg-main px-3 py-2 text-sm text-brand-text-main focus:outline-none focus:ring-1 focus:ring-brand-primary-500"
                  >
                    <option value="GLOBAL">Global (كافة الجامعة)</option>
                    <option value="COLLEGE">College (كلية محددة)</option>
                    <option value="DEPARTMENT">Department (قسم محدد)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-brand-text-main mb-1">
                    {isRTL ? 'وسم الإصدار (اختياري)' : 'Version Tag (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={versionTag}
                    onChange={(e) => setVersionTag(e.target.value)}
                    placeholder="e.g. 2026/2027 or v1.0"
                    className="w-full rounded-xl border border-brand-border bg-brand-bg-main px-3 py-2 text-sm text-brand-text-main focus:outline-none focus:ring-1 focus:ring-brand-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-text-main mb-1">
                    {isRTL ? 'تاريخ السريان (اختياري)' : 'Effective Date (Optional)'}
                  </label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full rounded-xl border border-brand-border bg-brand-bg-main px-3 py-2 text-sm text-brand-text-main focus:outline-none focus:ring-1 focus:ring-brand-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-text-main mb-1">
                  {isRTL ? 'ملف اللائحة (PDF, DOCX, TXT, MD - الحد الأقصى 20 ميجابايت)' : 'Document File (.pdf, .docx, .txt, .md — max 20MB)'} *
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf,.docx,.txt,.md"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full rounded-xl border border-brand-border bg-brand-bg-main px-3 py-2 text-xs text-brand-text-main file:me-3 file:rounded-lg file:border-0 file:bg-brand-primary-600 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-brand-primary-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-brand-border">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="rounded-xl border border-brand-border px-4 py-2 text-sm font-semibold text-brand-text-sub hover:bg-brand-bg-main"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-brand-primary-500 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  <span>{isRTL ? 'رفع وفهرسة' : 'Upload & Index'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Detail & Version History Drawer / Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl border border-brand-border bg-brand-bg-elevated p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-brand-border pb-3">
              <div>
                <h2 className="text-lg font-bold text-brand-text-main">
                  {(isRTL && selectedDoc.titleAr) ? selectedDoc.titleAr : selectedDoc.title}
                </h2>
                <p className="text-xs text-brand-text-sub mt-0.5">
                  {selectedDoc.documentType} • {selectedDoc.scope}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                className="text-brand-text-sub hover:text-brand-text-main"
              >
                <X size={20} />
              </button>
            </div>

            {/* Version History List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-brand-text-main flex items-center gap-2">
                  <History size={16} />
                  <span>{isRTL ? 'سجل الإصدارات والتحديثات' : 'Version History'}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsVersionUploadOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-primary-600 hover:text-brand-primary-500"
                >
                  <Plus size={14} />
                  <span>{isRTL ? 'رفع إصدار جديد' : 'Upload New Version'}</span>
                </button>
              </div>

              {isLoadingDetail ? (
                <div className="p-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-brand-primary-600" /></div>
              ) : (
                <div className="space-y-2">
                  {(detailDoc?.versions || selectedDoc.versions || []).map((ver) => {
                    const isActive = selectedDoc.activeVersionId === ver.id;

                    return (
                      <div
                        key={ver.id}
                        className={`rounded-xl border p-3.5 transition-colors ${
                          isActive
                            ? 'border-brand-primary-500 bg-brand-primary-500/5'
                            : 'border-brand-border bg-brand-bg-main'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-brand-text-main">
                                Version {ver.version} {ver.versionTag ? `(${ver.versionTag})` : ''}
                              </span>
                              {isActive && (
                                <span className="rounded-full bg-brand-primary-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                  {isRTL ? 'الإصدار النشط' : 'Active Version'}
                                </span>
                              )}
                              {ver.supersededAt && !isActive && (
                                <span className="rounded-full bg-brand-border px-2 py-0.5 text-[10px] text-brand-text-sub">
                                  {isRTL ? 'مُلغى بإصدار أحدث' : 'Superseded'}
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-brand-text-sub mt-1">
                              {ver.originalFilename} • {(ver.fileSize / 1024).toFixed(1)} KB • {ver.chunkCount} {isRTL ? 'قطع مفهرسة' : 'chunks'}
                            </p>

                            {ver.processingError && (
                              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                                {ver.processingError}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {renderStatusBadge(ver.processingStatus)}
                            {!isActive && ver.processingStatus === 'READY' && (
                              <button
                                type="button"
                                onClick={() => handleActivateVersion(ver.id)}
                                className="rounded-lg border border-brand-border bg-brand-bg-elevated px-2.5 py-1 text-xs font-semibold text-brand-text-main hover:bg-brand-primary-600 hover:text-white transition"
                              >
                                {isRTL ? 'تفعيل' : 'Activate'}
                              </button>
                            )}
                            <a
                              href={`/api/knowledge/documents/${selectedDoc.id}/download/${ver.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-lg p-1 text-brand-text-sub hover:text-brand-text-main hover:bg-brand-bg-elevated"
                              title={isRTL ? 'تحميل الملف' : 'Download file'}
                            >
                              <Download size={14} />
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-brand-border">
              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                className="rounded-xl border border-brand-border px-4 py-2 text-sm font-semibold text-brand-text-sub hover:bg-brand-bg-main"
              >
                {isRTL ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Version Modal */}
      {isVersionUploadOpen && selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-brand-border bg-brand-bg-elevated p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <h2 className="text-base font-bold text-brand-text-main">
                {isRTL ? 'رفع إصدار جديد للمستند' : 'Upload New Document Version'}
              </h2>
              <button type="button" onClick={() => setIsVersionUploadOpen(false)}><X size={18} /></button>
            </div>

            {uploadError && (
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs text-rose-700 dark:text-rose-300">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleVersionUploadSubmit} className="space-y-3 text-sm">
              <div>
                <label className="block text-xs font-semibold text-brand-text-main mb-1">
                  {isRTL ? 'وسم الإصدار (مثل v2.0)' : 'Version Tag'}
                </label>
                <input
                  type="text"
                  value={versionTag}
                  onChange={(e) => setVersionTag(e.target.value)}
                  placeholder="e.g. 2027 or v2.0"
                  className="w-full rounded-xl border border-brand-border bg-brand-bg-main px-3 py-2 text-sm text-brand-text-main focus:outline-none focus:ring-1 focus:ring-brand-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-text-main mb-1">
                  {isRTL ? 'الملف الجديد' : 'New File'}
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf,.docx,.txt,.md"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full rounded-xl border border-brand-border bg-brand-bg-main px-3 py-2 text-xs text-brand-text-main"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsVersionUploadOpen(false)}
                  className="rounded-xl border border-brand-border px-3 py-1.5 text-xs font-semibold text-brand-text-sub"
                >
                  {isRTL ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-brand-primary-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-brand-primary-500 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : (isRTL ? 'رفع' : 'Upload')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
