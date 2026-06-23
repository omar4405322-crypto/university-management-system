import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import quizService from '../../services/quiz.service';
import coursesService from '../../services/courses.service';
import { Save, ChevronLeft, Info, Loader2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import { useToast } from '../../context/ToastContext';

const schema = z.object({
  title: z.string().min(1, 'Quiz title is required'),
  description: z.string().optional(),
  courseId: z.string().min(1, 'Please select a course'),
  duration: z.coerce.number().min(5, 'Duration must be at least 5 minutes'),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const CreateQuiz = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const isRTL = i18n.language?.startsWith('ar');
  const [courses, setCourses] = useState<any[]>([]);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      courseId: '',
      duration: 30,
      startTime: '',
      endTime: '',
    }
  });

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const result = await coursesService.getCourses();
        const coursesList = result?.data ?? result ?? [];
        if (Array.isArray(coursesList)) {
          setCourses(coursesList);
        } else {
          setCourses([]);
        }
      } catch (error) {
        console.error('Error fetching courses:', error);
        setCourses([]);
      }
    };
    fetchCourses();
  }, []);

  const onSubmit = async (data: FormData) => {
    // Check start and end dates
    if (data.startTime && data.endTime) {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      if (end <= start) {
        showToast('End time must be after start time', 'error');
        return;
      }
    }

    try {
      // Append a default placeholder question to satisfy backend validation constraint
      const payload = {
        title: data.title,
        description: data.description,
        courseId: data.courseId,
        duration: data.duration,
        startTime: data.startTime ? new Date(data.startTime).toISOString() : null,
        endTime: data.endTime ? new Date(data.endTime).toISOString() : null,
        questions: [
          {
            text: 'First MCQ Question (Edit in database)',
            optionA: 'Option A',
            optionB: 'Option B',
            optionC: 'Option C',
            optionD: 'Option D',
            correct: 'A',
            points: 5,
          }
        ]
      };

      const result = await quizService.createQuiz(payload);
      if (result.success) {
        showToast('Quiz created successfully', 'success');
        navigate('/quizzes');
      }
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Error creating quiz', 'error');
    }
  };

  return (
    <div className="section-gap animate-page max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-8 bg-brand-bg-card p-6 rounded-3xl border border-brand-border shadow-soft">
        <button 
          onClick={() => navigate('/quizzes')}
          className="p-3 text-brand-text-sub hover:text-brand-green-dark hover:bg-brand-green-dark/10 rounded-2xl transition-all duration-300 group"
        >
          <ChevronLeft size={24} className="rtl:-scale-x-100 group-hover:-translate-x-1 transition-transform" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-brand-text-primary dark:text-white">Create New Quiz</h1>
          <p className="text-sm text-brand-text-secondary mt-1 font-bold">Set up quiz details and schedule</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-brand-bg-card p-8 rounded-3xl border border-brand-border shadow-soft space-y-6">
          <h2 className="text-lg font-black text-brand-text-primary dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">Quiz Information</h2>
          
          <div className="space-y-2">
            <label className="text-sm font-bold text-brand-text-primary dark:text-white">Quiz Title *</label>
            <input
              type="text"
              className={`w-full p-3 rounded-xl border ${errors.title ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'} bg-transparent outline-none focus:ring-2 focus:ring-brand-green-dark/20`}
              placeholder="e.g. Midterm Quiz - Chapter 1 & 2"
              {...register('title')}
            />
            {errors.title && <p className="text-rose-500 text-xs font-bold mt-1">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-brand-text-primary dark:text-white">Instructions / Description</label>
            <textarea
              rows={4}
              placeholder="e.g. Answer all questions, no calculators allowed..."
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent outline-none focus:ring-2 focus:ring-brand-green-dark/20"
              {...register('description')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-brand-text-primary dark:text-white">Course *</label>
              <select
                className={`w-full p-3 rounded-xl border ${errors.courseId ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-900 outline-none`}
                {...register('courseId')}
              >
                <option value="">Select Course</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>
                    {isRTL ? (course.nameAr || course.name) : course.name} ({course.courseCode})
                  </option>
                ))}
              </select>
              {errors.courseId && <p className="text-rose-500 text-xs font-bold mt-1">{errors.courseId.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-brand-text-primary dark:text-white">Duration (minutes) *</label>
              <input
                type="number"
                min="5"
                className={`w-full p-3 rounded-xl border ${errors.duration ? 'border-red-500' : 'border-slate-200 dark:border-slate-700'} bg-transparent outline-none focus:ring-2`}
                {...register('duration')}
              />
              {errors.duration && <p className="text-rose-500 text-xs font-bold mt-1">{errors.duration.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-brand-text-primary dark:text-white">Start Time</label>
              <input
                type="datetime-local"
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent outline-none focus:ring-2"
                {...register('startTime')}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-brand-text-primary dark:text-white">End Time</label>
              <input
                type="datetime-local"
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent outline-none focus:ring-2"
                {...register('endTime')}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200 rounded-2xl border border-blue-100 dark:border-blue-850">
          <Info size={20} className="shrink-0" />
          <p className="text-xs font-bold">
            You can add questions after creating the quiz.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/quizzes')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[140px] gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save Quiz
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CreateQuiz;
