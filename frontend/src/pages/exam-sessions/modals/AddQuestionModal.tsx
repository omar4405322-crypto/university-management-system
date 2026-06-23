import React, { useState } from 'react';
import { ListChecks, CheckSquare, AlignLeft, UploadCloud, ArrowRight, ArrowLeft, Info, Check, Loader2 } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import { examSessionService } from '../../../services/examSession.service';
import { useToast } from '../../../context/ToastContext';

interface AddQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sessionId: number;
}

const QUESTION_TYPES = [
  { id: 'MCQ', title: 'Multiple Choice', description: 'Four options, one correct answer', icon: ListChecks },
  { id: 'TRUE_FALSE', title: 'True / False', description: 'Simple binary choice', icon: CheckSquare },
  { id: 'ESSAY', title: 'Essay / Written', description: 'Long form text answer', icon: AlignLeft },
  { id: 'FILE_UPLOAD', title: 'File Upload', description: 'Student uploads a document', icon: UploadCloud },
];

const FILE_TYPES = ['pdf', 'docx', 'xlsx', 'jpg', 'png', 'zip'];

const AddQuestionModal: React.FC<AddQuestionModalProps> = ({ isOpen, onClose, onSuccess, sessionId }) => {
  const { showToast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    type: 'MCQ',
    text: '',
    textAr: '',
    points: 1,
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctAnswer: '',
    maxWords: '',
    allowedFileTypes: ['pdf', 'docx'],
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFormData({
        type: 'MCQ',
        text: '',
        textAr: '',
        points: 1,
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correctAnswer: '',
        maxWords: '',
        allowedFileTypes: ['pdf', 'docx'],
      });
      setFormErrors({});
    }
  }, [isOpen]);

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!formData.text?.trim()) {
      errors.text = 'Question text is required';
    }
    if (formData.type === 'MCQ') {
      if (!formData.optionA?.trim()) errors.optionA = 'Option A is required';
      if (!formData.optionB?.trim()) errors.optionB = 'Option B is required';
      if (!formData.optionC?.trim()) errors.optionC = 'Option C is required';
      if (!formData.optionD?.trim()) errors.optionD = 'Option D is required';
      if (!formData.correctAnswer) errors.correctAnswer = 'Please select the correct answer';
    }
    if (formData.type === 'TRUE_FALSE' && !formData.correctAnswer) {
      errors.correctAnswer = 'Please select True or False';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setLoading(true);
      const payload: any = {
        type: formData.type,
        text: formData.text,
        textAr: formData.textAr,
        points: Number(formData.points) || 1,
      };

      if (formData.type === 'MCQ') {
        payload.optionA = formData.optionA;
        payload.optionB = formData.optionB;
        payload.optionC = formData.optionC;
        payload.optionD = formData.optionD;
        payload.correctAnswer = formData.correctAnswer;
      } else if (formData.type === 'TRUE_FALSE') {
        payload.correctAnswer = formData.correctAnswer;
      } else if (formData.type === 'ESSAY') {
        payload.maxWords = formData.maxWords ? Number(formData.maxWords) : undefined;
      } else if (formData.type === 'FILE_UPLOAD') {
        payload.allowedFileTypes = formData.allowedFileTypes.join(',');
      }

      await examSessionService.addQuestion(sessionId, payload);
      showToast('Question added successfully', 'success');
      onSuccess();
      onClose();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to add question', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleFileType = (type: string) => {
    setFormData(prev => {
      const current = prev.allowedFileTypes;
      if (current.includes(type)) {
        return { ...prev, allowedFileTypes: current.filter(t => t !== type) };
      }
      return { ...prev, allowedFileTypes: [...current, type] };
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Question" size="xl">
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 1 ? 'bg-brand-green-dark text-white' : 'bg-slate-100 text-slate-400'}`}>1</div>
            <div className={`h-1 w-12 rounded-full ${step >= 2 ? 'bg-brand-green-dark' : 'bg-slate-100 dark:bg-slate-700'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 2 ? 'bg-brand-green-dark text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>2</div>
          </div>
          <div className="text-sm font-bold text-slate-500">
            Step {step} of 2
          </div>
        </div>

        <form onSubmit={step === 2 ? handleSubmit : (e) => { e.preventDefault(); setStep(2); }} noValidate>
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-4">
              <h3 className="text-xl font-bold text-brand-text-primary dark:text-white mb-4">Choose Question Type</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {QUESTION_TYPES.map(type => {
                  const isSelected = formData.type === type.id;
                  const Icon = type.icon;
                  return (
                    <div
                      key={type.id}
                      onClick={() => setFormData({ ...formData, type: type.id })}
                      className={`cursor-pointer p-6 rounded-2xl border-2 transition-all ${isSelected ? 'border-brand-green-dark bg-brand-accent-emerald/10 shadow-md shadow-brand-green-dark/10' : 'border-slate-200 hover:border-brand-green-dark/30 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${isSelected ? 'bg-brand-green-dark text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                          <Icon size={24} />
                        </div>
                        <div>
                          <h4 className={`font-bold ${isSelected ? 'text-brand-green-dark' : 'text-brand-text-primary dark:text-white'}`}>{type.title}</h4>
                          <p className="text-sm text-slate-500 mt-1">{type.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-end pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
                <Button type="button" onClick={() => setStep(2)} disabled={!formData.type} className="gap-2 px-8">
                  Next <ArrowRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-brand-text-primary dark:text-white">Question Text (English) *</label>
                    <textarea 
                      className={`w-full p-4 rounded-xl border ${formErrors.text ? 'border-red-500 focus:ring-red-500' : 'border-slate-200 dark:border-slate-700 focus:border-brand-green-dark focus:ring-brand-green-dark/20'} bg-transparent outline-none focus:ring-4 transition-all`}
                      rows={4}
                      placeholder="Enter the question here..."
                      value={formData.text}
                      onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                    />
                    {formErrors.text && <p className="text-red-500 text-xs font-bold">{formErrors.text}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-brand-text-primary dark:text-white">Question Text (Arabic) <span className="text-slate-400 font-normal">- Optional</span></label>
                    <textarea 
                      className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-brand-green-dark focus:ring-brand-green-dark/20 bg-transparent outline-none focus:ring-4 transition-all"
                      rows={3}
                      dir="rtl"
                      placeholder="أدخل نص السؤال هنا..."
                      value={formData.textAr}
                      onChange={(e) => setFormData({ ...formData, textAr: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <label className="text-sm font-bold text-brand-text-primary dark:text-white block mb-2">Points</label>
                    <input
                      type="number"
                      min={1}
                      className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-600 focus:border-brand-green-dark focus:ring-brand-green-dark/20 bg-white dark:bg-slate-900 outline-none focus:ring-4 transition-all font-black text-xl text-center"
                      value={formData.points}
                      onChange={(e) => setFormData({ ...formData, points: Number(e.target.value) })}
                    />
                    
                    {(formData.type === 'ESSAY' || formData.type === 'FILE_UPLOAD') && (
                      <div className="mt-6 flex gap-3 p-4 bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 rounded-xl">
                        <Info size={20} className="shrink-0" />
                        <p className="text-xs font-medium leading-relaxed">This question requires manual grading by the doctor.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                {formData.type === 'MCQ' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-lg text-brand-text-primary dark:text-white">Options</h4>
                      {formErrors.correctAnswer && <span className="text-red-500 text-sm font-bold bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-lg">{formErrors.correctAnswer}</span>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {['A', 'B', 'C', 'D'].map((opt) => {
                        const isCorrect = formData.correctAnswer === opt;
                        const error = formErrors[`option${opt}`];
                        return (
                          <div 
                            key={opt}
                            className={`p-4 rounded-2xl border-2 transition-all flex flex-col gap-3 ${isCorrect ? 'border-brand-green-dark bg-brand-accent-emerald/5' : 'border-slate-200 dark:border-slate-700'}`}
                          >
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setFormData({ ...formData, correctAnswer: opt })}
                                className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${isCorrect ? 'bg-brand-green-dark text-white shadow-md' : 'bg-slate-200 text-slate-500 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700'}`}
                                title="Mark as correct answer"
                              >
                                {isCorrect ? <Check size={16} /> : opt}
                              </button>
                              <div className="flex-1 relative">
                                <input
                                  type="text"
                                  className={`w-full p-3 rounded-xl border ${error ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'} bg-white dark:bg-slate-900 outline-none focus:ring-4 focus:ring-brand-green-dark/20 focus:border-brand-green-dark transition-all`}
                                  placeholder={`Enter option ${opt}...`}
                                  value={(formData as any)[`option${opt}`]}
                                  onChange={(e) => setFormData({ ...formData, [`option${opt}`]: e.target.value })}
                                />
                              </div>
                            </div>
                            {error && <p className="text-red-500 text-[10px] font-bold ms-11">{error}</p>}
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, correctAnswer: opt })}
                              className={`text-xs font-bold text-center py-2 rounded-lg transition-colors ${isCorrect ? 'bg-brand-green-dark/10 text-brand-green-dark' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            >
                              {isCorrect ? 'Correct Answer' : 'Set as Correct'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {formData.type === 'TRUE_FALSE' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-lg text-brand-text-primary dark:text-white">Correct Answer</h4>
                      {formErrors.correctAnswer && <span className="text-red-500 text-sm font-bold bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-lg">{formErrors.correctAnswer}</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div 
                        onClick={() => setFormData({ ...formData, correctAnswer: 'TRUE' })}
                        className={`cursor-pointer flex flex-col items-center justify-center py-10 rounded-3xl border-2 transition-all ${formData.correctAnswer === 'TRUE' ? 'border-brand-green-dark bg-brand-accent-emerald/10 shadow-lg shadow-brand-green-dark/10' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                      >
                        <span className={`text-2xl font-black ${formData.correctAnswer === 'TRUE' ? 'text-brand-green-dark' : 'text-slate-400'}`}>True ✓</span>
                      </div>
                      <div 
                        onClick={() => setFormData({ ...formData, correctAnswer: 'FALSE' })}
                        className={`cursor-pointer flex flex-col items-center justify-center py-10 rounded-3xl border-2 transition-all ${formData.correctAnswer === 'FALSE' ? 'border-red-500 bg-red-50 dark:bg-red-900/10 shadow-lg shadow-red-500/10' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                      >
                        <span className={`text-2xl font-black ${formData.correctAnswer === 'FALSE' ? 'text-red-500' : 'text-slate-400'}`}>False ✗</span>
                      </div>
                    </div>
                  </div>
                )}

                {formData.type === 'ESSAY' && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-lg text-brand-text-primary dark:text-white">Constraints</h4>
                    <div className="max-w-xs">
                      <label className="text-sm font-bold text-slate-600 dark:text-slate-400 block mb-2">Max Words <span className="text-slate-400 font-normal">- Optional</span></label>
                      <input
                        type="number"
                        min={1}
                        placeholder="No limit"
                        className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-brand-green-dark focus:ring-brand-green-dark/20 bg-transparent outline-none focus:ring-4 transition-all font-bold"
                        value={formData.maxWords}
                        onChange={(e) => setFormData({ ...formData, maxWords: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {formData.type === 'FILE_UPLOAD' && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-lg text-brand-text-primary dark:text-white">Allowed File Types</h4>
                    <div className="flex flex-wrap gap-3">
                      {FILE_TYPES.map(type => {
                        const isSelected = formData.allowedFileTypes.includes(type);
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => toggleFileType(type)}
                            className={`px-6 py-3 rounded-xl font-bold text-sm uppercase tracking-wider transition-all border-2 ${isSelected ? 'border-brand-green-dark bg-brand-green-dark text-white shadow-md' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700'}`}
                          >
                            {type}
                          </button>
                        );
                      })}
                    </div>
                    {formData.allowedFileTypes.length === 0 && (
                      <p className="text-xs text-slate-500 mt-2 font-medium">If no types are selected, all file types will be allowed by default.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-6 mt-6 border-t border-slate-100 dark:border-slate-800">
                <Button variant="outline" type="button" onClick={() => setStep(1)} className="gap-2 px-6" disabled={loading}>
                  <ArrowLeft size={16} /> Back
                </Button>
                <div className="flex gap-3">
                  <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading} className="min-w-[160px] gap-2">
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    {loading ? 'Saving...' : 'Add Question'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </Modal>
  );
};

export default AddQuestionModal;
