import React, { useState, useEffect } from 'react';
import studentsService from '../../services/students.service';
import paymentsService from '../../services/payments.service';
import { Search, X, AlertCircle, Loader2 } from 'lucide-react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

const AddPaymentModal = ({ isOpen, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    studentId: '',
    type: 'TUITION',
    amount: '',
    description: '',
    dueDate: '',
  });
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchStudents();
    }
  }, [isOpen]);

  const fetchStudents = async () => {
    try {
      const result = await studentsService.getStudents();
      if (result.success) {
        setStudents(result.data);
      } else {
        // Fallback for demo
        setStudents([
          { id: '1', firstName: 'Alice', lastName: 'Johnson', studentId: 'STU-001' },
          { id: '2', firstName: 'Bob', lastName: 'Smith', studentId: 'STU-002' },
          { id: '3', firstName: 'Charlie', lastName: 'Davis', studentId: 'STU-003' },
        ]);
      }
    } catch (err) {
      console.error(err);
      setStudents([
        { id: '1', firstName: 'Alice', lastName: 'Johnson', studentId: 'STU-001' },
        { id: '2', firstName: 'Bob', lastName: 'Smith', studentId: 'STU-002' },
        { id: '3', firstName: 'Charlie', lastName: 'Davis', studentId: 'STU-003' },
      ]);
    }
  };

  const filteredStudents = students.filter(s => 
    `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.studentId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.studentId) {
      setError('Please select a student');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await paymentsService.createPayment(formData);
      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setError(result.message || 'Error creating payment');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating payment');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Add New Payment</h2>
            <p className="text-xs text-slate-500 mt-0.5">Record a student payment transaction</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl text-sm font-medium flex items-center gap-2 border border-rose-100 animate-in shake duration-300">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Student Assignment *</label>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={16} />
              <Input
                placeholder="Search student by name or ID..."
                className="pl-10 h-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              required
              className="w-full h-11 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer"
              value={formData.studentId}
              onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
            >
              <option value="">Select Student</option>
              {filteredStudents.map(s => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName} ({s.studentId})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Type *</label>
              <select
                required
                className="w-full h-11 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1rem' }}
              >
                <option value="TUITION">Tuition</option>
                <option value="REGISTRATION">Registration</option>
                <option value="LIBRARY">Library</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Amount ($) *</label>
              <Input
                type="number"
                required
                step="0.01"
                min="0"
                placeholder="0.00"
                className="h-11 font-bold text-slate-900"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Due Date</label>
            <Input
              type="date"
              className="h-11"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Description</label>
            <textarea
              rows="2"
              placeholder="Optional notes about this payment..."
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none placeholder:text-slate-400"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            ></textarea>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose} 
              className="flex-1 h-11"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading} 
              className="flex-1 h-11 shadow-lg shadow-blue-500/20"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 animate-spin" size={18} />
                  Processing...
                </>
              ) : 'Record Payment'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPaymentModal;
