import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Loader2, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import examsService from '../../services/exams.service';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

const ExamSubmissions = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchSubmissions();
  }, [id]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const res = await examsService.getExamSubmissions(id);
      if (res.success) {
        setSubmissions(res.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="animate-spin text-brand-primary-500" size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700">
        <AlertTriangle size={40} className="text-red-500 mx-auto mb-6" />
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{error}</h2>
        <Button variant="outline" className="mt-6" onClick={() => navigate(`/exams/${id}`)}>
          Back
        </Button>
      </div>
    );
  }

  const filtered = submissions.filter(sub => {
    const name = `${sub.student?.user?.firstName} ${sub.student?.user?.lastName}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className="section-gap animate-in fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/exams/${id}`)}
            className="p-3 text-slate-400 hover:text-brand-primary-500 hover:bg-brand-primary-50 dark:hover:bg-brand-primary-900/20 rounded-2xl transition-all group"
          >
            <ArrowLeft size={24} className="rtl:-scale-x-100 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100">Exam Submissions</h1>
            <p className="text-slate-500 font-bold mt-1 text-sm">{submissions.length} Total Submissions</p>
          </div>
        </div>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search student..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-brand-primary-500 outline-none font-bold text-sm"
          />
        </div>
      </div>

      <Card className="overflow-hidden border-none shadow-sm rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
                <th className="p-4 font-black text-xs uppercase tracking-wider text-slate-500">Student Name</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-slate-500">Submitted At</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-slate-500">Score</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-slate-500">Status</th>
                <th className="p-4 font-black text-xs uppercase tracking-wider text-slate-500">Anti-Cheat Violations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(sub => (
                <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group">
                  <td className="p-4">
                    <div className="font-bold text-slate-800 dark:text-slate-100">
                      {sub.student?.user?.firstName} {sub.student?.user?.lastName}
                    </div>
                    <div className="text-xs text-slate-500">{sub.student?.user?.email}</div>
                  </td>
                  <td className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400">
                    {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'Not submitted'}
                  </td>
                  <td className="p-4">
                    {sub.status === 'GRADED' ? (
                      <span className="font-black text-brand-primary-500">{sub.score} / {sub.maxScore}</span>
                    ) : (
                      <span className="font-bold text-slate-400">N/A</span>
                    )}
                  </td>
                  <td className="p-4">
                    <Badge variant={sub.status === 'GRADED' ? 'success' : 'warning'}>
                      {sub.status}
                    </Badge>
                  </td>
                  <td className="p-4">
                    {sub.violations && sub.violations.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-sm">
                          <AlertTriangle size={16} /> {sub.violations.length} Violations
                        </div>
                        <ul className="text-xs space-y-1 text-slate-500">
                          {sub.violations.map(v => (
                            <li key={v.id} className="flex gap-2">
                              <span className="shrink-0 font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">
                                {v.type}
                              </span>
                              <span className="truncate max-w-[200px]" title={v.details}>{v.details}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold text-sm">
                        <CheckCircle2 size={16} /> Clean
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 font-bold">
                    No submissions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default ExamSubmissions;
