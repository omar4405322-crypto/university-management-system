import { Request, Response } from 'express';
import { auditLog } from '../utils/audit.utils';
import catchAsync from '../utils/catchAsync';
import * as collegeService from '../services/college.service';

export const getAllColleges = catchAsync(async (req: Request, res: Response) => {
  const data = await collegeService.getAllColleges();
  res.json({ success: true, data });
});

export const getCollegeById = catchAsync(async (req: Request, res: Response) => {
  const collegeId = parseInt(req.params.id as string);
  // We explicitly type req as any here to safely extract req.user if present
  const data = await collegeService.getCollegeById(collegeId, (req as any).user);
  res.json({ success: true, data });
});

export const createCollege = catchAsync(async (req: Request, res: Response) => {
  const { name, nameAr, description } = req.body;
  const data = await collegeService.createCollege({ name, nameAr, description });
  res.status(201).json({ success: true, data });
});

export const updateCollege = catchAsync(async (req: Request, res: Response) => {
  const collegeId = parseInt(req.params.id as string);
  const { name, nameAr, description } = req.body;
  const data = await collegeService.updateCollege(collegeId, { name, nameAr, description });
  res.json({ success: true, data });
});

export const deleteCollege = catchAsync(async (req: Request, res: Response) => {
  const collegeId = parseInt(req.params.id as string);
  await collegeService.deleteCollege(collegeId);
  auditLog('DELETE_COLLEGE', 'College', req.params.id as string, req);
  res.json({ success: true, message: 'College and its departments deleted successfully' });
});

export const assignAdmin = catchAsync(async (req: Request, res: Response) => {
  const collegeId = parseInt(req.params.id as string);
  const { adminId } = req.body;
  const data = await collegeService.assignAdmin(collegeId, adminId);
  auditLog('ASSIGN_COLLEGE_ADMIN', 'College', req.params.id as string, req);
  res.json({
    success: true,
    message: 'Admin assigned to college successfully',
    data,
  });
});
