import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  BookOpen, 
  User, 
  Building2, 
  FileText,
  ArrowLeft,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Download,
  Info
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import examsService from '../../services/exams.service';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

const ExamDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchExamDetails();
  }, [id]);

  const fetchExamDetails = async () => {
    try {
      setLoading(true);
      const result = await examsService.getExamById(id);
      if (result.success) {
        setExam(result.data);
      }
    } catch (err) {
      setError('Exam details could not be loaded.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="animate-spin text-brand-green" size={48} />
        <p className="text-brand-text-sub font-bold uppercase tracking-widest text-sm">Loading Exam Details...</p>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="text-center py-20 bg-brand-bg-card rounded-3xl border border-brand-border">
        <div className="h-20 w-20 rounded-full bg-brand-navy/5 flex items-center justify-center mx-auto mb-6">
          <AlertCircle size={40} className="text-brand-text-muted" />
        </div>
        <h2 className="text-2xl font-bold text-brand-text-main">{error || 'Exam not found'}</h2>
        <Button variant="outline" className="mt-6 border-brand-border" onClick={() => navigate('/exams')}>
          <ArrowLeft size={18} className="mr-2" /> Back to Schedule
        </Button>
      </div>
    );
  }

  const isUpcoming = new Date(exam.date) > new Date();

  return (
    <div className="section-gap animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between bg-brand-bg-card p-6 rounded-3xl border border-brand-border shadow-soft">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => navigate('/exams')}
            className="p-3 text-brand-text-sub hover:text-brand-green hover:bg-brand-green/10 rounded-2xl transition-all duration-300 group"
          >
            <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-brand-text-main">{exam.course?.name}</h1>
              <Badge variant={exam.type === 'FINAL' ? 'danger' : 'info'} className="px-3 py-1 font-bold">{exam.type}</Badge>
            </div>
            <p className="text-lg text-brand-text-sub mt-1 font-bold">{exam.course?.courseCode}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="flex items-center gap-2 border-brand-border font-bold">
            <Download size={18} className="text-brand-green" /> Download Ticket
          </Button>
          {isUpcoming && user?.role === 'STUDENT' && (
            <Button 
              onClick={() => navigate(`/exams/${id}/take`)}
              className="flex items-center gap-2 shadow-xl shadow-brand-green/20 font-bold"
            >
              <CheckCircle2 size={18} /> Enter Exam Portal
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 gap-5 xl:gap-6">
        <div className="lg:col-span-1 space-y-6">
        </div>
        <div className="lg:col-span-2 xl:col-span-3">
          <Card title="Exam Instructions & Guidelines" extra={<FileText size={20} className="text-brand-green" />} borderLeft={false}>
            <div className="prose prose-sm max-w-none space-y-6 pt-2">
              <div className="p-6 rounded-3xl bg-brand-bg-page border border-brand-border border-l-4 border-l-brand-green">
                <h4 className="text-lg font-black text-brand-text-main mb-3">General Rules</h4>
                <ul className="space-y-3">
                  <li className="flex gap-3 text-brand-text-sub font-bold leading-relaxed">
                    <div className="h-1.5 w-1.5 rounded-full bg-brand-green mt-2 shrink-0"></div>
                    Students must present a valid University ID card to enter the examination hall.
                  </li>
                  <li className="flex gap-3 text-brand-text-sub font-bold leading-relaxed">
                    <div className="h-1.5 w-1.5 rounded-full bg-brand-green mt-2 shrink-0"></div>
                    All electronic devices, including smartphones and smartwatches, must be powered off and placed in designated areas.
                  </li>
                  <li className="flex gap-3 text-brand-text-sub font-bold leading-relaxed">
                    <div className="h-1.5 w-1.5 rounded-full bg-brand-green mt-2 shrink-0"></div>
                    Late entry is only permitted within the first 30 minutes of the examination.
                  </li>
                </ul>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-3xl bg-brand-bg-page border border-brand-border">
                  <h4 className="font-black text-brand-text-main mb-3 uppercase tracking-wider text-xs">Permitted Items</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="success">Pens & Pencils</Badge>
                    <Badge variant="success">Eraser</Badge>
                    <Badge variant="success">Calculator (Non-Prog)</Badge>
                    <Badge variant="success">Water Bottle (Clear)</Badge>
                  </div>
                </div>
                <div className="p-6 rounded-3xl bg-brand-bg-page border border-brand-border">
                  <h4 className="font-black text-brand-text-main mb-3 uppercase tracking-wider text-xs">Prohibited Items</h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="danger">Smartphones</Badge>
                    <Badge variant="danger">Notes/Books</Badge>
                    <Badge variant="danger">Smart Watches</Badge>
                    <Badge variant="danger">Bags</Badge>
                  </div>
                </div>
              </div>

              <div className="mt-8 p-6 rounded-3xl bg-brand-navy text-white relative overflow-hidden group">
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <h4 className="font-black text-lg">Need help with your schedule?</h4>
                    <p className="text-white/70 font-bold mt-1">Contact the academic registrar for any conflicts.</p>
                  </div>
                  <Button className="bg-brand-green hover:bg-brand-green-light shadow-xl shadow-brand-green/20">
                    Contact Support
                  </Button>
                </div>
                <div className="absolute -right-4 -bottom-4 text-white/5 rotate-12">
                  <BookOpen size={100} />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ExamDetails;
