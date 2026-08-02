import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import { TaskService } from '../services/task.service';
import { ConflictError } from '../utils/appError';

export const createTask = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { title, description, courseId, dueDate, maxScore } = req.body;

    const task = await TaskService.createTask(req.user!, {
      title,
      description,
      courseId: parseInt(courseId as string),
      dueDate: new Date(dueDate as string),
      maxScore: parseInt(maxScore as string) || 100,
    });

    return res.status(201).json({ success: true, data: task });
  }
);

export const getTasks = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { courseId } = req.query;

    const tasks = await TaskService.getTasks(
      req.user!,
      courseId ? parseInt(courseId as string) : undefined
    );

    return res.json({ success: true, data: tasks });
  }
);

export const updateTask = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { title, description, dueDate, maxScore } = req.body;

    const updated = await TaskService.updateTask(
      req.user!,
      parseInt(id as string),
      {
        title,
        description,
        dueDate: dueDate != null ? new Date(dueDate as string) : undefined,
        maxScore: maxScore != null ? parseInt(maxScore as string) : undefined,
      }
    );

    return res.json({ success: true, data: updated });
  }
);

export const deleteTask = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { force } = req.query;
    const forceHardDelete = String(force).toLowerCase() === 'true';

    const result = await TaskService.deleteTask(
      req.user!,
      parseInt(id as string),
      forceHardDelete
    );

    return res.json(result);
  }
);

export const submitTask = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { notes, fileUrl } = req.body;

    try {
      const submission = await TaskService.submitTask(
        req.user!,
        parseInt(id as string),
        { notes, fileUrl }
      );
      return res.status(201).json({ success: true, data: submission });
    } catch (error: any) {
      if (
        error?.code === 'P2002' &&
        Array.isArray(error?.meta?.target) &&
        error.meta.target.includes('taskId') &&
        error.meta.target.includes('studentId')
      ) {
        return next(
          new ConflictError(
            'You have already submitted this task. Only one submission per task is allowed.'
          )
        );
      }
      throw error;
    }
  }
);

export const gradeSubmission = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { sid } = req.params;
    const { score, feedback } = req.body;

    const submission = await TaskService.gradeSubmission(
      req.user!,
      parseInt(sid as string),
      parseFloat(score as string),
      feedback,
      req
    );

    return res.json({ success: true, data: submission });
  }
);

export const getTaskSubmissions = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const submissions = await TaskService.getTaskSubmissions(
      req.user!,
      parseInt(id as string)
    );

    return res.json({ success: true, data: submissions });
  }
);

export const getMySubmission = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const submission = await TaskService.getMySubmission(
      req.user!,
      parseInt(id as string)
    );

    return res.json({ success: true, data: submission });
  }
);
