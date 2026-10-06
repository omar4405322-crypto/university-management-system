import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';
import quizService from '../../services/quiz.service';
import coursesService from '../../services/courses.service';
import { Plus, Trash2, Save, ChevronLeft, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const questionSchema = z.object({
  text: z.string().min(1, 'Question text is required'),
  optionA: z.string().min(1, 'Option A is required'),
  optionB: z.string().min(1, 'Option B is required'),
  optionC: z.string().min(1, 'Option C is required'),
  optionD: z.string().min(1, 'Option D is required'),
  correct: z.string().min(1, 'Correct answer is required'),
  points: z.coerce.number().min(1, 'Points must be at least 1')
});

const schema = z.object({
  title: z.string().min(1, 'Quiz title is required'),
  description: z.string().optional(),
  courseId: z.string().min(1, 'Please select a course'),
  duration: z.coerce.number().min(1, 'Duration must be at least 1 minute'),
  questions: z.array(questionSchema).min(1, 'At least one question is required')
});

type QuizFormData = z.infer<typeof schema>;

const CreateQuiz: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language?.startsWith('ar');
  const navigate = useNavigate();
  const [courses, setCourses] = useState<any[]>([]);

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<QuizFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      courseId: '',
      duration: 30,
      questions: [
        {
          text: '',
          optionA: '',
          optionB: '',
          optionC: '',
          optionD: '',
          correct: 'A',
          points: 1
        }
      ]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "questions"
  });

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const result = await coursesService.getCourses();
        if (result.success) {
          setCourses(result.data);
        }
      } catch (error) {
        console.error('Error fetching courses:', error);
      }
    };
    fetchCourses();
  }, []);

  const [apiError, setApiError] = useState('');

  const onSubmit = async (data: QuizFormData) => {
    setApiError('');
    try {
      const result = await quizService.createQuiz(data);
      if (result.success) {
        toast.success(isRTL ? 'تم إنشاء الاختبار بنجاح' : 'Quiz created successfully');
        navigate('/quizzes');
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || (isRTL ? 'حدث خطأ أثناء إنشاء الاختبار' : 'Error creating quiz');
      setApiError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="section-gap animate-page">
      <div className="flex items-center gap-4 mb-6">
        <button 
          type="button"
          onClick={() => navigate('/quizzes')}
          aria-label={t('common.back', isRTL ? 'الرجوع' : 'Back')}
          className="p-2 hover:bg-brand-bg-page rounded-full transition-colors cursor-pointer"
        >
          <ChevronLeft size={24} className="rtl:rotate-180" />
        </button>
        <h1 className="text-2xl font-bold text-brand-text-primary">
          {t('quizzes.createTitle', isRTL ? 'إنشاء اختبار قصير جديد' : 'Create New Quiz')}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="form-section">
        {apiError && (
          <div role="alert" className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-600 dark:text-rose-400 text-sm font-semibold flex items-center gap-2">
            <AlertCircle size={18} className="shrink-0" />
            <span>{apiError}</span>
          </div>
        )}

        <div className="bg-brand-bg-card p-6 rounded-xl shadow-sm border border-brand-border space-y-4">
          <h2 className="text-lg font-bold text-brand-text-primary border-b border-brand-border pb-2">
            {t('quizzes.basicInfo', isRTL ? 'المعلومات الأساسية' : 'Basic Information')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label htmlFor="quiz-title" className="block text-sm font-medium text-brand-text-primary mb-1">
                {t('quizzes.quizTitle', isRTL ? 'عنوان الاختبار' : 'Quiz Title')} *
              </label>
              <input
                id="quiz-title"
                type="text"
                aria-required="true"
                aria-invalid={!!errors.title}
                aria-describedby={errors.title ? 'quiz-title-err' : undefined}
                className="block w-full px-3 py-2 border border-brand-border rounded-md focus:ring-brand-primary-500/30 focus:border-brand-primary-500 bg-brand-bg-page/40"
                {...register('title')}
                placeholder={t('quizzes.quizTitlePlaceholder', isRTL ? 'مثال: اختبار نصفي - CS101' : 'e.g. Midterm Exam - CS101')}
              />
              {errors.title && <p id="quiz-title-err" className="text-rose-500 text-xs mt-1">{errors.title.message}</p>}
            </div>
            <div className="col-span-2">
              <label htmlFor="quiz-description" className="block text-sm font-medium text-brand-text-primary mb-1">
                {t('quizzes.description', isRTL ? 'الوصف' : 'Description')}
              </label>
              <textarea
                id="quiz-description"
                rows={2}
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? 'quiz-description-err' : undefined}
                className="block w-full px-3 py-2 border border-brand-border rounded-md focus:ring-brand-primary-500/30 focus:border-brand-primary-500 bg-brand-bg-page/40"
                {...register('description')}
              />
              {errors.description && <p id="quiz-description-err" className="text-rose-500 text-xs mt-1">{errors.description.message}</p>}
            </div>
            <div>
              <label htmlFor="quiz-course" className="block text-sm font-medium text-brand-text-primary mb-1">
                {t('quizzes.course', isRTL ? 'المقرر الدراسي' : 'Course')} *
              </label>
              <select
                id="quiz-course"
                aria-required="true"
                aria-invalid={!!errors.courseId}
                aria-describedby={errors.courseId ? 'quiz-course-err' : undefined}
                className="block w-full px-3 py-2 border border-brand-border rounded-md focus:ring-brand-primary-500/30 focus:border-brand-primary-500 bg-brand-bg-page/40 cursor-pointer"
                {...register('courseId')}
              >
                <option value="">{t('quizzes.selectCourse', isRTL ? 'اختر المقرر الدراسي' : 'Select Course')}</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>{course.name} ({course.courseCode})</option>
                ))}
              </select>
              {errors.courseId && <p id="quiz-course-err" className="text-rose-500 text-xs mt-1">{errors.courseId.message}</p>}
            </div>
            <div>
              <label htmlFor="quiz-duration" className="block text-sm font-medium text-brand-text-primary mb-1">
                {t('quizzes.durationMinutes', isRTL ? 'المدة (بالدقائق)' : 'Duration (minutes)')} *
              </label>
              <input
                id="quiz-duration"
                type="number"
                min="1"
                aria-required="true"
                aria-invalid={!!errors.duration}
                aria-describedby={errors.duration ? 'quiz-duration-err' : undefined}
                className="block w-full px-3 py-2 border border-brand-border rounded-md focus:ring-brand-primary-500/30 focus:border-brand-primary-500 bg-brand-bg-page/40"
                {...register('duration')}
              />
              {errors.duration && <p id="quiz-duration-err" className="text-rose-500 text-xs mt-1">{errors.duration.message}</p>}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-brand-text-primary">
              {t('quizzes.questions', isRTL ? 'الأسئلة' : 'Questions')}
            </h2>
            <button
              type="button"
              onClick={() => append({
                text: '', optionA: '', optionB: '', optionC: '', optionD: '', correct: 'A', points: 1
              })}
              className="flex items-center gap-1 text-info hover:text-info font-medium cursor-pointer"
            >
              <Plus size={18} />
              {t('quizzes.addQuestion', isRTL ? 'إضافة سؤال' : 'Add Question')}
            </button>
          </div>

          {fields.map((q, index) => (
            <div key={q.id} className="bg-brand-bg-card p-6 rounded-xl shadow-sm border border-brand-border relative animate-in slide-in-from-top-4 duration-300">
              <button
                type="button"
                onClick={() => fields.length > 1 && remove(index)}
                className="absolute top-4 end-4 text-brand-text-muted hover:text-error transition-colors cursor-pointer"
                title={t('quizzes.removeQuestion', isRTL ? 'حذف السؤال' : 'Remove Question')}
                aria-label={t('quizzes.removeQuestion', isRTL ? 'حذف السؤال' : 'Remove Question')}
              >
                <Trash2 size={20} />
              </button>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="bg-brand-primary-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-grow">
                    <input
                      id={`quiz-q-${index}-text`}
                      type="text"
                      aria-label={t('quizzes.questionPlaceholder', isRTL ? 'اكتب نص السؤال هنا...' : 'Enter your question here...')}
                      aria-required="true"
                      aria-invalid={!!errors.questions?.[index]?.text}
                      aria-describedby={errors.questions?.[index]?.text ? `quiz-q-${index}-text-err` : undefined}
                      placeholder={t('quizzes.questionPlaceholder', isRTL ? 'اكتب نص السؤال هنا...' : 'Enter your question here...')}
                      className="w-full text-lg font-medium border-none focus:ring-0 placeholder-brand-text-muted bg-transparent"
                      {...register(`questions.${index}.text`)}
                    />
                    {errors.questions?.[index]?.text && <p id={`quiz-q-${index}-text-err`} className="text-rose-500 text-xs mt-1">{errors.questions[index].text.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ms-9">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-brand-text-muted w-4">A</span>
                    <div className="flex-grow">
                      <input
                        id={`quiz-q-${index}-opt-A`}
                        type="text"
                        aria-label={t('quizzes.optionA', isRTL ? 'الخيار أ' : 'Option A')}
                        aria-required="true"
                        aria-invalid={!!errors.questions?.[index]?.optionA}
                        aria-describedby={errors.questions?.[index]?.optionA ? `quiz-q-${index}-opt-A-err` : undefined}
                        placeholder={t('quizzes.optionA', isRTL ? 'الخيار أ' : 'Option A')}
                        className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:border-brand-primary-500 focus:ring-1 focus:ring-brand-primary-500/30 bg-brand-bg-page/30"
                        {...register(`questions.${index}.optionA`)}
                      />
                      {errors.questions?.[index]?.optionA && <p id={`quiz-q-${index}-opt-A-err`} className="text-rose-500 text-xs mt-1">{errors.questions[index].optionA.message}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-brand-text-muted w-4">B</span>
                    <div className="flex-grow">
                      <input
                        id={`quiz-q-${index}-opt-B`}
                        type="text"
                        aria-label={t('quizzes.optionB', isRTL ? 'الخيار ب' : 'Option B')}
                        aria-required="true"
                        aria-invalid={!!errors.questions?.[index]?.optionB}
                        aria-describedby={errors.questions?.[index]?.optionB ? `quiz-q-${index}-opt-B-err` : undefined}
                        placeholder={t('quizzes.optionB', isRTL ? 'الخيار ب' : 'Option B')}
                        className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:border-brand-primary-500 focus:ring-1 focus:ring-brand-primary-500/30 bg-brand-bg-page/30"
                        {...register(`questions.${index}.optionB`)}
                      />
                      {errors.questions?.[index]?.optionB && <p id={`quiz-q-${index}-opt-B-err`} className="text-rose-500 text-xs mt-1">{errors.questions[index].optionB.message}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-brand-text-muted w-4">C</span>
                    <div className="flex-grow">
                      <input
                        id={`quiz-q-${index}-opt-C`}
                        type="text"
                        aria-label={t('quizzes.optionC', isRTL ? 'الخيار ج' : 'Option C')}
                        aria-required="true"
                        aria-invalid={!!errors.questions?.[index]?.optionC}
                        aria-describedby={errors.questions?.[index]?.optionC ? `quiz-q-${index}-opt-C-err` : undefined}
                        placeholder={t('quizzes.optionC', isRTL ? 'الخيار ج' : 'Option C')}
                        className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:border-brand-primary-500 focus:ring-1 focus:ring-brand-primary-500/30 bg-brand-bg-page/30"
                        {...register(`questions.${index}.optionC`)}
                      />
                      {errors.questions?.[index]?.optionC && <p id={`quiz-q-${index}-opt-C-err`} className="text-rose-500 text-xs mt-1">{errors.questions[index].optionC.message}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-brand-text-muted w-4">D</span>
                    <div className="flex-grow">
                      <input
                        id={`quiz-q-${index}-opt-D`}
                        type="text"
                        aria-label={t('quizzes.optionD', isRTL ? 'الخيار د' : 'Option D')}
                        aria-required="true"
                        aria-invalid={!!errors.questions?.[index]?.optionD}
                        aria-describedby={errors.questions?.[index]?.optionD ? `quiz-q-${index}-opt-D-err` : undefined}
                        placeholder={t('quizzes.optionD', isRTL ? 'الخيار د' : 'Option D')}
                        className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:border-brand-primary-500 focus:ring-1 focus:ring-brand-primary-500/30 bg-brand-bg-page/30"
                        {...register(`questions.${index}.optionD`)}
                      />
                      {errors.questions?.[index]?.optionD && <p id={`quiz-q-${index}-opt-D-err`} className="text-rose-500 text-xs mt-1">{errors.questions[index].optionD.message}</p>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 ms-9 pt-2">
                  <div className="flex items-center gap-3">
                    <label htmlFor={`quiz-q-${index}-correct`} className="text-sm font-medium text-brand-text-secondary">
                      {t('quizzes.correctAnswer', isRTL ? 'الإجابة الصحيحة:' : 'Correct Answer:')}
                    </label>
                    <div>
                      <select
                        id={`quiz-q-${index}-correct`}
                        className="px-3 py-1.5 border border-brand-border rounded-md text-sm focus:ring-brand-primary-500/30 bg-brand-bg-page/40 cursor-pointer"
                        {...register(`questions.${index}.correct`)}
                      >
                        <option value="A">{t('quizzes.optionA', isRTL ? 'الخيار أ' : 'Option A')}</option>
                        <option value="B">{t('quizzes.optionB', isRTL ? 'الخيار ب' : 'Option B')}</option>
                        <option value="C">{t('quizzes.optionC', isRTL ? 'الخيار ج' : 'Option C')}</option>
                        <option value="D">{t('quizzes.optionD', isRTL ? 'الخيار د' : 'Option D')}</option>
                      </select>
                      {errors.questions?.[index]?.correct && <p id={`quiz-q-${index}-correct-err`} className="text-rose-500 text-xs mt-1">{errors.questions[index].correct.message}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor={`quiz-q-${index}-points`} className="text-sm font-medium text-brand-text-secondary">
                      {t('quizzes.points', isRTL ? 'الدرجات:' : 'Points:')}
                    </label>
                    <div>
                      <input
                        id={`quiz-q-${index}-points`}
                        type="number"
                        min="1"
                        className="w-16 px-2 py-1 border border-brand-border rounded-md text-sm text-center bg-brand-bg-page/40"
                        {...register(`questions.${index}.points`)}
                      />
                      {errors.questions?.[index]?.points && <p id={`quiz-q-${index}-points-err`} className="text-rose-500 text-xs mt-1">{errors.questions[index].points.message}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate('/quizzes')}
            className="px-6 py-2 border border-brand-border rounded-lg text-brand-text-secondary hover:bg-brand-bg-page transition-colors cursor-pointer"
          >
            {t('common.cancel', isRTL ? 'إلغاء' : 'Cancel')}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-2 bg-brand-primary-500 text-white rounded-lg hover:bg-brand-primary-600 transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                {t('quizzes.publishing', isRTL ? 'جاري النشر...' : 'Publishing...')}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save size={18} />
                {t('quizzes.publishQuiz', isRTL ? 'نشر الاختبار' : 'Publish Quiz')}
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateQuiz;
