import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import quizService from '../../services/quiz.service';
import coursesService from '../../services/courses.service';
import { Plus, Trash2, Save, X, ChevronLeft } from 'lucide-react';

const CreateQuiz = () => {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    courseId: '',
    duration: 30,
    startTime: '',
    endTime: '',
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleQuestionChange = (index, e) => {
    const { name, value } = e.target;
    const newQuestions = [...formData.questions];
    newQuestions[index] = { ...newQuestions[index], [name]: value };
    setFormData(prev => ({ ...prev, questions: newQuestions }));
  };

  const addQuestion = () => {
    setFormData(prev => ({
      ...prev,
      questions: [
        ...prev.questions,
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
    }));
  };

  const removeQuestion = (index) => {
    if (formData.questions.length === 1) return;
    const newQuestions = formData.questions.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, questions: newQuestions }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await quizService.createQuiz(formData);
      if (result.success) {
        navigate('/quizzes');
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Error creating quiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="section-gap animate-page">
      <div className="flex items-center mb-6">
        <button 
          onClick={() => navigate('/quizzes')}
          className="mr-4 p-2 hover:bg-brand-bg-page rounded-full transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-2xl font-bold text-brand-text-primary">Create New Quiz</h1>
      </div>

      <form onSubmit={handleSubmit} className="form-section">
        <div className="bg-brand-bg-card p-6 rounded-xl shadow-sm border border-brand-border space-y-4">
          <h2 className="text-lg font-semibold text-brand-text-primary border-b border-brand-border pb-2">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-brand-text-primary">Quiz Title</label>
              <input
                type="text"
                name="title"
                required
                className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md focus:ring-brand-primary-500/30 focus:border-brand-primary-500"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g. Midterm Exam - CS101"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-brand-text-primary">Description</label>
              <textarea
                name="description"
                rows="2"
                className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md focus:ring-brand-primary-500/30 focus:border-brand-primary-500"
                value={formData.description}
                onChange={handleChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text-primary">Course</label>
              <select
                name="courseId"
                required
                className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md focus:ring-brand-primary-500/30 focus:border-brand-primary-500"
                value={formData.courseId}
                onChange={handleChange}
              >
                <option value="">Select Course</option>
                {courses.map(course => (
                  <option key={course.id} value={course.id}>{course.name} ({course.courseCode})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-brand-text-primary">Duration (minutes)</label>
              <input
                type="number"
                name="duration"
                required
                min="1"
                className="mt-1 block w-full px-3 py-2 border border-brand-border rounded-md focus:ring-brand-primary-500/30 focus:border-brand-primary-500"
                value={formData.duration}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-brand-text-primary">Questions</h2>
            <button
              type="button"
              onClick={addQuestion}
              className="flex items-center text-info hover:text-info font-medium"
            >
              <Plus size={18} className="mr-1" />
              Add Question
            </button>
          </div>

          {formData.questions.map((q, index) => (
            <div key={index} className="bg-brand-bg-card p-6 rounded-xl shadow-sm border border-brand-border relative animate-in slide-in-from-top-4 duration-300">
              <button
                type="button"
                onClick={() => removeQuestion(index)}
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
                  <input
                    type="text"
                    name="text"
                    required
                    placeholder="Enter your question here..."
                    className="flex-grow text-lg font-medium border-none focus:ring-0 placeholder-brand-text-muted"
                    value={q.text}
                    onChange={(e) => handleQuestionChange(index, e)}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-9">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-brand-text-muted">A</span>
                    <input
                      type="text"
                      name="optionA"
                      required
                      placeholder="Option A"
                      className="flex-grow px-3 py-2 border border-brand-border rounded-lg text-sm focus:border-brand-primary-500 focus:ring-1 focus:ring-brand-primary-500/30"
                      value={q.optionA}
                      onChange={(e) => handleQuestionChange(index, e)}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-brand-text-muted">B</span>
                    <input
                      type="text"
                      name="optionB"
                      required
                      placeholder="Option B"
                      className="flex-grow px-3 py-2 border border-brand-border rounded-lg text-sm focus:border-brand-primary-500 focus:ring-1 focus:ring-brand-primary-500/30"
                      value={q.optionB}
                      onChange={(e) => handleQuestionChange(index, e)}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-brand-text-muted">C</span>
                    <input
                      type="text"
                      name="optionC"
                      required
                      placeholder="Option C"
                      className="flex-grow px-3 py-2 border border-brand-border rounded-lg text-sm focus:border-brand-primary-500 focus:ring-1 focus:ring-brand-primary-500/30"
                      value={q.optionC}
                      onChange={(e) => handleQuestionChange(index, e)}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-bold text-brand-text-muted">D</span>
                    <input
                      type="text"
                      name="optionD"
                      required
                      placeholder="Option D"
                      className="flex-grow px-3 py-2 border border-brand-border rounded-lg text-sm focus:border-brand-primary-500 focus:ring-1 focus:ring-brand-primary-500/30"
                      value={q.optionD}
                      onChange={(e) => handleQuestionChange(index, e)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between ml-9 pt-2">
                  <div className="flex items-center space-x-4">
                    <label className="text-sm font-medium text-brand-text-secondary">Correct Answer:</label>
                    <select
                      name="correct"
                      className="px-3 py-1 border border-brand-border rounded-md text-sm focus:ring-brand-primary-500/30"
                      value={q.correct}
                      onChange={(e) => handleQuestionChange(index, e)}
                    >
                      <option value="A">Option A</option>
                      <option value="B">Option B</option>
                      <option value="C">Option C</option>
                      <option value="D">Option D</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-brand-text-secondary">Points:</label>
                    <input
                      type="number"
                      name="points"
                      min="1"
                      className="w-16 px-2 py-1 border border-brand-border rounded-md text-sm text-center"
                      value={q.points}
                      onChange={(e) => handleQuestionChange(index, e)}
                    />
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
            disabled={loading}
            className="px-8 py-2 bg-brand-primary-500 text-white rounded-lg hover:bg-brand-primary-600 transition-colors flex items-center disabled:opacity-50"
          >
            {loading ? (
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
