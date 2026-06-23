import React from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Modal from '../Modal';
import Button from '../Button';
import Input from '../Input';
import enrollmentService from '../../../services/enrollment.service';
import { Loader2 } from 'lucide-react';

const schema = z.object({
  finalGrade: z.coerce.number().min(0).max(100, 'Grade cannot exceed 100'),
});

type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

interface UpdateGradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  enrollment: any;
}

const UpdateGradeModal: React.FC<UpdateGradeModalProps> = ({ isOpen, onClose, onSuccess, enrollment }) => {
  const { t } = useTranslation();
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm<FormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      finalGrade: enrollment?.finalGrade ?? 0,
    }
  });

  const onSubmit = async (data: FormInput) => {
    try {
      const validData = schema.parse(data);
      await enrollmentService.updateGrade(enrollment.id, validData.finalGrade);
      onSuccess();
    } catch (error: any) {
      setError('root', { message: error.response?.data?.message || 'Failed to update grade' });
    }
  };

  if (!enrollment) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('enrollment.updateGradeTitle', 'Update Final Grade')}
      subtitle={t('enrollment.updateGradeDesc', 'Set the final grade for the student')}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {errors.root && (
          <div className="p-4 bg-error/10 text-error rounded-xl text-sm font-bold">
            {errors.root.message}
          </div>
        )}
        
        <div className="space-y-1.5">
          <label className="text-sm font-bold text-brand-text-main ml-1">
            {t('enrollment.finalGrade', 'Final Grade')} (0-100)
          </label>
          <Input
            type="number"
            {...register('finalGrade')}
            className="bg-brand-bg-page/30 border-brand-border focus:bg-brand-bg-card transition-all"
            min="0"
            max="100"
          />
          {errors.finalGrade && <p className="text-rose-500 text-xs mt-1">{errors.finalGrade.message}</p>}
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-brand-border">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : t('common.save', 'Save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default UpdateGradeModal;
