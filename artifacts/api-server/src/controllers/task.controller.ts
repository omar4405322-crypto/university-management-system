import { Request, Response, NextFunction } from 'express';
import catchAsync from '../utils/catchAsync';
import { TaskService } from '../services/task.service';
import { ConflictError, ValidationError } from '../utils/appError';
import { fromZonedTime } from 'date-fns-tz';
import fs from 'fs';
import { cleanupTaskFile } from '../middleware/taskSubmissionUpload.middleware';
import { auditLog } from '../utils/audit.utils';

export const createTask = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { title, description, courseId, dueDate, maxScore } = req.body;

    const task = await TaskService.createTask(req.user!, {
      title,
      description,
      courseId: parseInt(courseId as string),
      dueDate: fromZonedTime(dueDate as string, 'Africa/Cairo'),
      maxScore: parseInt(maxScore as string) || 100,
    }, undefined, req);

    return res.status(201).json({ success: true, data: task });
  }
);

export const getTasks = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { courseId, status, dueFrom, dueTo, sortBy, search, year, page, limit } = req.query;

    let parsedCourseId: number | undefined;
    if (courseId !== undefined && courseId !== '') {
      const parsed = Number(courseId);
      if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new ValidationError('Invalid courseId parameter');
      }
      parsedCourseId = parsed;
    }

    let parsedYear: number | undefined;
    if (year !== undefined && year !== '') {
      const parsed = Number(year);
      if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new ValidationError('Invalid year parameter');
      }
      parsedYear = parsed;
    }

    const tasksResult = await TaskService.getTasks(
      req.user!,
      parsedCourseId,
      {
        status: status as ('ACTIVE' | 'OVERDUE') | undefined,
        dueFrom: dueFrom ? new Date(dueFrom as string) : undefined,
        dueTo: dueTo ? new Date(dueTo as string) : undefined,
        sortBy: sortBy as (
          | 'DUE_DATE_ASC'
          | 'DUE_DATE_DESC'
          | 'CREATED_AT_ASC'
          | 'CREATED_AT_DESC'
          | 'SUBMISSIONS_COUNT_ASC'
          | 'SUBMISSIONS_COUNT_DESC'
        ) | undefined,
        search: search as string | undefined,
        year: parsedYear,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      }
    );

    return res.json({ success: true, data: tasksResult });
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
        dueDate: dueDate != null ? fromZonedTime(dueDate as string, 'Africa/Cairo') : undefined,
        maxScore: maxScore != null ? parseInt(maxScore as string) : undefined,
      },
      req
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
      forceHardDelete,
      req
    );

    return res.json(result);
  }
);

export const submitTask = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { notes, fileUrl, linkUrl } = req.body || {};

    const fileMetadata = req.file
      ? {
          fileName: req.file.originalname,
          fileSize: req.file.size,
          fileType: (req.file as any).detectedType || req.file.mimetype,
          fileHash: (req.file as any).fileHash,
          storageKey: (req.file as any).storageKey || req.file.filename,
        }
      : undefined;

    try {
      const submission = await TaskService.submitTask(
        req.user!,
        parseInt(id as string),
        { notes, fileUrl, linkUrl, fileMetadata },
        req
      );
      const responseData = ('data' in (submission as any) && (submission as any).data)
        ? (submission as any).data
        : submission;
      return res.status(201).json({ success: true, data: responseData });
    } catch (error: unknown) {
      if (req.file?.path) {
        cleanupTaskFile(req.file.path);
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: unknown }).code === 'P2002' &&
        'meta' in error &&
        Array.isArray((error as { meta?: { target?: unknown } }).meta?.target) &&
        ((error as { meta: { target: string[] } }).meta.target.includes('taskId') &&
         (error as { meta: { target: string[] } }).meta.target.includes('studentId'))
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

export const downloadTaskSubmission = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const taskId = parseInt(req.params.id as string, 10);
    const submissionId = parseInt(req.params.sid as string, 10);

    if (Number.isNaN(taskId) || Number.isNaN(submissionId)) {
      return next(new ValidationError('Invalid task or submission ID'));
    }

    const { submission, filePath } = await TaskService.authorizeSubmissionDownload(
      req.user!,
      taskId,
      submissionId
    );

    await auditLog(
      'DOWNLOAD_TASK_SUBMISSION',
      'TaskSubmission',
      submission.id,
      req,
      {
        taskId,
        studentId: submission.studentId,
        fileName: submission.fileName,
        fileSize: submission.fileSize,
      }
    );

    const safeDownloadName = (submission.fileName || submission.storageKey || 'submission_file')
      .replace(/[^a-zA-Z0-9._-]/g, '_');

    res.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (submission.fileType) {
      res.setHeader('Content-Type', submission.fileType);
    } else {
      res.setHeader('Content-Type', 'application/octet-stream');
    }

    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => next(err));
    stream.pipe(res);
  }
);

export const gradeSubmission = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id, sid } = req.params;
    const { score, feedback, expectedSubmittedAt } = req.body;

    const submission = await TaskService.gradeSubmission(
      req.user!,
      parseInt(id as string),
      parseInt(sid as string),
      parseFloat(score as string),
      feedback,
      expectedSubmittedAt,
      req
    );

    return res.json({ success: true, data: submission });
  }
);

export const getTaskSubmissions = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { page, limit, search, status, studentYear } = req.query;

    const submissions = await TaskService.getTaskSubmissions(
      req.user!,
      parseInt(id as string),
      {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        search: search as string | undefined,
        status: status as (
          | 'ALL'
          | 'SUBMITTED'
          | 'GRADED'
          | 'UNGRADED'
          | 'LATE'
          | 'NOT_SUBMITTED'
        ) | undefined,
        studentYear: studentYear ? parseInt(studentYear as string) : undefined,
      }
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
