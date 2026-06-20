import React, { useState, useEffect } from 'react';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { useTranslation } from 'react-i18next';
import usersService from '../../services/users.service';
import collegeService from '../../services/college.service';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { logger } from '../../lib/logger';
import { useToast } from '../../context/ToastContext';

const AssignAdminModal = ({ isOpen, onClose, collegeId, collegeName, onSuccess }) => {
  const { t } = useTranslation();
  const [admins, setAdmins] = useState([]);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const { showToast } = useToast();



  useEffect(() => {
	if (isOpen) {
	  fetchAvailableAdmins();
	}
  }, [isOpen]);

  const fetchAvailableAdmins = async () => {
	try {
	  setFetching(true);
	  const result = await usersService.getUsers({ role: 'COLLEGE_ADMIN' });
	  if (result.success) {
		// Filter admins who don't have an assigned college or filter by preference
		const availableAdmins = (result.data || []).filter(
		  admin => !admin.managedCollegeId || admin.managedCollegeId === collegeId
		);
		setAdmins(availableAdmins);
	  }
	} catch (error: any) {
	  logger.error('Error fetching admins:', error);
	  showToast(t('common.errorFetching'), 'error');
	} finally {
	  setFetching(false);
	}
  };

  const handleAssign = async () => {
	if (!selectedAdminId) {
	  showToast(t('colleges.selectAdmin') || 'Please select an admin', 'error');
	  return;
	}

	try {
	  setLoading(true);
	  const result = await collegeService.assignAdmin(collegeId, parseInt(selectedAdminId));
	  if (result.success) {
		showToast(t('colleges.adminAssignedSuccess') || 'Admin assigned successfully', 'success');
		setSelectedAdminId('');
		onClose();
		onSuccess?.();
	  }
	} catch (error: any) {
	  const message = error.response?.data?.message || t('colleges.assignAdminError') || 'Failed to assign admin';
	  showToast(message, 'error');
	} finally {
	  setLoading(false);
	}
  };

  if (!isOpen) return null;

  return (
	<Modal
	  isOpen={isOpen}
	  onClose={onClose}
	  title={`${t('colleges.assignAdmin') || 'Assign Admin'} - ${collegeName}`}
	>
	  

	  {fetching ? (
		<div className="flex justify-center py-8">
		  <Loader2 size={32} className="animate-spin text-brand-primary-500" />
		</div>
	  ) : admins.length === 0 ? (
		<div className="text-center py-8">
		  <AlertCircle size={40} className="mx-auto mb-3 text-brand-text-muted" />
		  <p className="text-brand-text-secondary">{t('colleges.noAvailableAdmins') || 'No available COLLEGE_ADMIN users found'}</p>
		</div>
	  ) : (
		<div className="space-y-4">
		  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('colleges.selectCollegeAdmin') || 'Select College Admin'}</label>
		  <select
			value={selectedAdminId}
			onChange={(e) => setSelectedAdminId(e.target.value)}
			className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white focus:ring-2 focus:ring-blue-500/20 outline-none"
		  >
			<option value="">{t('common.select')} {t('colleges.admin')}</option>
			{admins.map((admin) => (
			  <option key={admin.id} value={admin.id}>
				{admin.email} {admin.managedCollege ? `(${admin.managedCollege.name})` : '(Unassigned)'}
			  </option>
			))}
		  </select>

		  <div className="flex gap-3 pt-4">
			<Button
			  variant="outline"
			  className="flex-1"
			  onClick={onClose}
			  disabled={loading}
			>
			  {t('common.cancel')}
			</Button>
			<Button
			  variant="primary"
			  className="flex-1 flex items-center justify-center gap-2"
			  onClick={handleAssign}
			  disabled={loading}
			>
			  {loading ? (
				<>
				  <Loader2 size={16} className="animate-spin" />
				  {t('common.assigning')}
				</>
			  ) : (
				t('colleges.assignAdmin') || 'Assign Admin'
			  )}
			</Button>
		  </div>
		</div>
	  )}
	</Modal>
  );
};

export default AssignAdminModal;
