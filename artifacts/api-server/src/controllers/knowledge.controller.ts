import type { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { AppError } from '../utils/appError';
import prisma from '../utils/prismaClient';
import {
  createKnowledgeDocument,
  uploadNewDocumentVersion,
  activateDocumentVersion,
  archiveKnowledgeDocument,
  listKnowledgeDocuments,
  verifyAdminKnowledgeScope,
} from '../services/knowledge/knowledgeAdmin.service';
import { retrieveKnowledgeChunks } from '../services/knowledge/knowledgeRetrieval.service';
import { getKnowledgeStorage } from '../services/knowledge/knowledgeStorage.service';
import { setKnowledgeDownloadHeaders } from '../middleware/knowledgeUpload.middleware';

function extractParamString(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

export const listDocumentsHandler = catchAsync(async (req: Request, res: Response) => {
  const actor = req.user!;
  const { scope, documentType, status, search, limit, offset } = req.query;

  const result = await listKnowledgeDocuments(actor, {
    scope: scope as string,
    documentType: documentType as string,
    status: status as string,
    search: search as string,
    limit: limit ? parseInt(limit as string, 10) : 50,
    offset: offset ? parseInt(offset as string, 10) : 0,
  });

  res.json({
    success: true,
    data: result.documents,
    meta: { total: result.total },
  });
});

export const getDocumentByIdHandler = catchAsync(async (req: Request, res: Response) => {
  const actor = req.user!;
  const id = extractParamString(req.params.id);

  const document = await prisma.knowledgeDocument.findUnique({
    where: { id },
    include: {
      activeVersion: {
        include: {
          chunks: {
            orderBy: { chunkIndex: 'asc' },
            take: 100,
          },
        },
      },
      versions: {
        orderBy: { version: 'desc' },
      },
      createdBy: {
        select: { id: true, email: true, role: true },
      },
    },
  });

  if (!document) {
    throw new AppError('Knowledge document not found', 404);
  }

  // Admin scope check to prevent cross-jurisdiction document inspection
  await verifyAdminKnowledgeScope(actor, document.scope, document.collegeId ?? undefined, document.departmentId ?? undefined);

  res.json({
    success: true,
    data: document,
  });
});

export const createDocumentHandler = catchAsync(async (req: Request, res: Response) => {
  const actor = req.user!;
  if (!req.file) {
    throw new AppError('Official document file is required (.pdf, .docx, .txt, .md)', 400);
  }

  const { title, titleAr, description, documentType, scope, collegeId, departmentId, versionTag, effectiveDate } = req.body;

  if (!title || !title.trim()) {
    throw new AppError('Document title is required', 400);
  }

  const document = await createKnowledgeDocument(
    actor,
    {
      title: title.trim(),
      titleAr: titleAr?.trim(),
      description: description?.trim(),
      documentType,
      scope,
      collegeId: collegeId ? parseInt(collegeId, 10) : undefined,
      departmentId: departmentId ? parseInt(departmentId, 10) : undefined,
      versionTag: versionTag?.trim(),
      effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
    },
    {
      originalname: req.file.originalname,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size,
      fileHash: req.file.fileHash || '',
      buffer: req.file.buffer,
    },
    req
  );

  res.status(201).json({
    success: true,
    message: 'Official university document uploaded and queued for processing',
    data: document,
  });
});

export const uploadVersionHandler = catchAsync(async (req: Request, res: Response) => {
  const actor = req.user!;
  const id = extractParamString(req.params.id);
  if (!req.file) {
    throw new AppError('Document version file is required', 400);
  }

  const { versionTag, effectiveDate } = req.body;

  const document = await uploadNewDocumentVersion(
    actor,
    id,
    {
      originalname: req.file.originalname,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size,
      fileHash: req.file.fileHash || '',
      buffer: req.file.buffer,
    },
    {
      versionTag: versionTag?.trim(),
      effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
    },
    req
  );

  res.status(201).json({
    success: true,
    message: 'New document version uploaded and processed',
    data: document,
  });
});

export const activateVersionHandler = catchAsync(async (req: Request, res: Response) => {
  const actor = req.user!;
  const id = extractParamString(req.params.id);
  const versionId = extractParamString(req.params.versionId);

  const document = await activateDocumentVersion(actor, id, versionId, req);

  res.json({
    success: true,
    message: 'Document version activated successfully',
    data: document,
  });
});

export const archiveDocumentHandler = catchAsync(async (req: Request, res: Response) => {
  const actor = req.user!;
  const id = extractParamString(req.params.id);

  const document = await archiveKnowledgeDocument(actor, id, req);

  res.json({
    success: true,
    message: 'Document archived successfully',
    data: document,
  });
});

export const downloadDocumentHandler = catchAsync(async (req: Request, res: Response) => {
  const actor = req.user;
  if (!actor) {
    throw new AppError('Authentication required to access official documents', 401);
  }

  const id = extractParamString(req.params.id);
  const versionId = extractParamString(req.params.versionId);

  const document = await prisma.knowledgeDocument.findUnique({
    where: { id },
    include: { versions: true, activeVersion: true },
  });

  if (!document) throw new AppError('Document not found', 404);

  // Authorization check for document download:
  // Must respect document scope and active status for non-admin viewers
  const role = actor.role?.toUpperCase();
  const collegeId = actor.managedCollegeId || actor.collegeId;
  const deptId = actor.managedDepartmentId || actor.departmentId;

  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN') {
    // Non-super-admins cannot download archived documents unless they are the scope manager
    if (document.status === 'ARCHIVED') {
      const isManager = (role === 'COLLEGE_ADMIN' && document.scope === 'COLLEGE' && collegeId === document.collegeId) ||
                        (role === 'DEPARTMENT_ADMIN' && document.scope === 'DEPARTMENT' && deptId === document.departmentId);
      if (!isManager) {
        throw new AppError('Cannot access archived documents', 403);
      }
    }

    if (document.scope === 'COLLEGE') {
      if (role === 'COLLEGE_ADMIN' && collegeId !== document.collegeId) {
        throw new AppError('Not authorized to access documents from another college', 403);
      }
      if (role === 'DEPARTMENT_ADMIN' || role === 'STUDENT' || role === 'DOCTOR' || role === 'TEACHING_ASSISTANT') {
        const userDeptId = actor.student?.departmentId || actor.doctor?.departmentId || deptId;
        if (userDeptId) {
          const userDept = await prisma.department.findUnique({
            where: { id: userDeptId },
            select: { collegeId: true },
          });
          if (!userDept || userDept.collegeId !== document.collegeId) {
            throw new AppError('Not authorized to access documents from another college', 403);
          }
        } else if (collegeId && collegeId !== document.collegeId) {
          throw new AppError('Not authorized to access documents from another college', 403);
        }
      }
    } else if (document.scope === 'DEPARTMENT') {
      const userDeptId = actor.student?.departmentId || actor.doctor?.departmentId || deptId;
      if (role === 'DEPARTMENT_ADMIN' && deptId !== document.departmentId) {
        throw new AppError('Not authorized to access documents from another department', 403);
      }
      if ((role === 'STUDENT' || role === 'DOCTOR' || role === 'TEACHING_ASSISTANT') && userDeptId !== document.departmentId) {
        throw new AppError('Not authorized to access documents from another department', 403);
      }
      if (role === 'COLLEGE_ADMIN') {
        const docDept = await prisma.department.findUnique({
          where: { id: document.departmentId! },
          select: { collegeId: true },
        });
        if (!docDept || docDept.collegeId !== collegeId) {
          throw new AppError('Not authorized to access documents outside your college', 403);
        }
      }
    }
  }

  const targetVersion = versionId
    ? document.versions.find((v) => v.id === versionId)
    : document.activeVersion;

  if (!targetVersion || !targetVersion.fileUrl) {
    throw new AppError('Document version file not found', 404);
  }

  const storage = getKnowledgeStorage();
  const fileBuffer = await storage.read(targetVersion.fileUrl);

  setKnowledgeDownloadHeaders(res, targetVersion.originalFilename);
  res.setHeader('Content-Type', targetVersion.mimeType || 'application/octet-stream');
  res.setHeader('Content-Length', fileBuffer.length);
  res.send(fileBuffer);
});

export const queryKnowledgeHandler = catchAsync(async (req: Request, res: Response) => {
  const actor = req.user;
  const { query, documentType, topK, includeSuperseded } = req.body;

  if (!query || typeof query !== 'string') {
    throw new AppError('Query string is required', 400);
  }

  const result = await retrieveKnowledgeChunks({
    actor,
    query,
    documentType,
    topK: topK ? parseInt(topK, 10) : 4,
    includeSuperseded: Boolean(includeSuperseded),
  });

  res.json({
    success: true,
    data: result,
  });
});
