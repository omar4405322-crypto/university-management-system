// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import quizService from '../../services/quiz.service';
import coursesService from '../../services/courses.service';
import { Plus, Trash2, Save, X, ChevronLeft } from 'lucide-react';

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

type FormData = z.infer<typeof schema>;

const CreateQuiz = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm({
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

  const onSubmit = async (data) => {
    try {
      const result = await quizService.createQuiz(data);
      if (result.success) {
        navigate('/quizzes');
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Error creating quiz');
    }
  };

  return (
    <div className="section-gap animate-page">
      <div className="flex items-center mb-6">
        <button 
          onClick={() => navigate('/quizzes')}
          className="mr-4 p-2 hover:bg-brand-bg-page rounded-full transition-colors"
        >
          <ChevronLeft size={24} className="rtl:-scale-x-100" />
        </button>
        <h1 className="text-2xl font-bold text-brand-text-primary">Create New Quiz</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="form-section">
        <div className="bg-brand-bg-card p-6 rounded-xl shadow-sm border border-brand-border space-y-4">
          <h2 className="text-lg font-bold text-brand-text-primary border-b border-brand-border pb-2">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-brand-text-primary">Quiz Title</label>
              <input
                type="text"
                className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md focus:ring-brand-primary-500/30 focus:border-brand-primary-500"
                {...register('title')}
                placeholder="e.g. Midterm Exam - CS101"
              />
              {errors.title && <p className="text-rose-500 text-xs mt-1">{errors.title.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-brand-text-primary">Description</label>
              <textarea
                rows="2"
                className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md focus:ring-brand-primary-500/30 focus:border-brand-primary-500"
                {...register('description')}
              />
              {errors.description && <p className="text-rose-500 text-xs mt-1">{errors.description.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text-primary">Course</label>
              <select
                className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md focus:ring-brand-primary-500/30 focus:border-brand-primary-500"
                {...register('courseId')}
              >
                <option value="">Select Course</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>{course.name} ({course.courseCode})</option>
                ))}
              </select>
              {errors.courseId && <p className="text-rose-500 text-xs mt-1">{errors.courseId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text-primary">Duration (minutes)</label>
              <input
                type="number"
                min="1"
                className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md focus:ring-brand-primary-500/30 focus:border-brand-primary-500"
                {...register('duration')}
              />
              {errors.duration && <p className="text-rose-500 text-xs mt-1">{errors.duration.message}</p>}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-brand-text-primary">Questions</h2>
            <button
              type="button"
              onClick={() => append({
                text: '', optionA: '', optionB: '', optionC: '', optionD: '', correct: 'A', points: 1
              })}
              className="flex items-center text-info hover:text-info font-medium"
            >
              <Plus size={18} className="mr-1" />
              Add Question
            </button>
          </div>

          {fields.map((q, index) => (
            <div key={q.id} className="bg-brand-bg-card p-6 rounded-xl shadow-sm border border-brand-border relative animate-in slide-in-from-top-4 duration-300">
              <button
                type="button"
                onClick={() => fields.length > 1 && remove(index)}
                className="absolute top-4 right-4 text-brand-text-muted hover:text-error transition-colors"
                title="Remove Question"
              >
                <Trash2 size={20} />
              </button>
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <span className="bg-brand-primary-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3">
                    {index + 1}
                  </span>
                  <div className="flex-grow">
                    <input
                      type="text"
                      placeholder="Enter your question here..."
                      className="w-full text-lg font-medium border-none focus:ring-0 placeholder-brand-text-muted"
                      {...register(`questions.${index}.text`)}
                    />
                    {errors.questions?.[index]?.text && <p className="text-rose-500 text-xs mt-1">{errors.questions[index].text.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-9">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-brand-text-muted">A</span>
                    <div className="flex-grow">
                      <input
                        type="text"
                        placeholder="Option A"
                        className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:border-brand-primary-500 focus:ring-1 focus:ring-brand-primary-500/30"
                        {...register(`questions.${index}.optionA`)}
                      />
                      {errors.questions?.[index]?.optionA && <p className="text-rose-500 text-xs mt-1">{errors.questions[index].optionA.message}</p>}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-brand-text-muted">B</span>
                    <div className="flex-grow">
                      <input
                        type="text"
                        placeholder="Option B"
                        className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:border-brand-primary-500 focus:ring-1 focus:ring-brand-primary-500/30"
                        {...register(`questions.${index}.optionB`)}
                      />
                      {errors.questions?.[index]?.optionB && <p className="text-rose-500 text-xs mt-1">{errors.questions[index].optionB.message}</p>}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-brand-text-muted">C</span>
                    <div className="flex-grow">
                      <input
                        type="text"
                        placeholder="Option C"
                        className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:border-brand-primary-500 focus:ring-1 focus:ring-brand-primary-500/30"
                        {...register(`questions.${index}.optionC`)}
                      />
                      {errors.questions?.[index]?.optionC && <p className="text-rose-500 text-xs mt-1">{errors.questions[index].optionC.message}</p>}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-brand-text-muted">D</span>
                    <div className="flex-grow">
                      <input
                        type="text"
                        placeholder="Option D"
                        className="w-full px-3 py-2 border border-brand-border rounded-lg text-sm focus:border-brand-primary-500 focus:ring-1 focus:ring-brand-primary-500/30"
                        {...register(`questions.${index}.optionD`)}
                      />
                      {errors.questions?.[index]?.optionD && <p className="text-rose-500 text-xs mt-1">{errors.questions[index].optionD.message}</p>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between ml-9 pt-2">
                  <div className="flex items-center space-x-4">
                    <label className="text-sm font-medium text-brand-text-secondary">Correct Answer:</label>
                    <div>
                      <select
                        className="px-3 py-1 border border-brand-border rounded-md text-sm focus:ring-brand-primary-500/30"
                        {...register(`questions.${index}.correct`)}
                      >
                        <option value="A">Option A</option>
                        <option value="B">Option B</option>
                        <option value="C">Option C</option>
                        <option value="D">Option D</option>
                      </select>
                      {errors.questions?.[index]?.correct && <p className="text-rose-500 text-xs mt-1">{errors.questions[index].correct.message}</p>}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-brand-text-secondary">Points:</label>
                    <div>
                      <input
                        type="number"
                        min="1"
                        className="w-16 px-2 py-1 border border-brand-border rounded-md text-sm text-center"
                        {...register(`questions.${index}.points`)}
                      />
                      {errors.questions?.[index]?.points && <p className="text-rose-500 text-xs mt-1">{errors.questions[index].points.message}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end space-x-4 pt-4">
          <button
            type="button"
            onClick={() => navigate('/quizzes')}
            className="px-6 py-2 border border-brand-border rounded-lg text-brand-text-secondary hover:bg-brand-bg-page transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-2 bg-brand-primary-500 text-white rounded-lg hover:bg-brand-primary-600 transition-colors flex items-center disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </span>
            ) : (
              <span className="flex items-center">
                <Save size={18} className="mr-2" />
                Save Quiz
              </span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateQuiz;
