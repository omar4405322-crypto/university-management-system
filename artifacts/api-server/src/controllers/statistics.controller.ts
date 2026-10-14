import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { getStatisticsOverview } from '../services/statistics.service';

export const getOverview = catchAsync(async (req: Request, res: Response) => {
  const data = await getStatisticsOverview(req.user!);
  res.json({
    success: true,
    data,
  });
});
