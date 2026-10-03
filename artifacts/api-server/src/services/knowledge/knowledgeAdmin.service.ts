import fs from 'fs';
import prisma from '../../utils/prismaClient';
import { AppError } from '../../utils/appError';
import type { AuthActor } from '../../types/auth.types';
import { processDocumentVersion } from './knowledgeIngestion.service';
import { getKnowledgeStorage } from './knowledgeStorage.service';
import { auditLog } from '../../utils/audit.utils';
import logger from '../../utils/logger';

export interface CreateKnowledgeDocumentDto {
  title: string;
  titleAr?: string;
  description?: string;
  documentType?: 'BYLAW' | 'REGULATION' | 'HANDBOOK' | 'POLICY' | 'PROCEDURE' | 'ANNOUNCEMENT';
  scope?: 'GLOBAL' | 'COLLEGE' | 'DEPARTMENT';
  collegeId?: number;
  departmentId?: number;
  versionTag?: string;
  effectiveDate?: Date;
}

export async function verifyAdminKnowledgeScope(
  actor: AuthActor,
  scope?: string,
  collegeId?: number,
  departmentId?: number
): Promise<void> {
  const role = actor.role?.toUpperCase();
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return;

  const actorCollege = actor.managedCollegeId || actor.collegeId;
  const actorDept = actor.managedDepartmentId || actor.departmentId;

  if (scope === 'GLOBAL') {
    throw new AppError('Only university administrators can create or modify global regulations', 403);
  }

  if (role === 'COLLEGE_ADMIN') {
    if (!actorCollege) {
      throw new AppError('College administrator must be assigned to a college', 403);
    }
    if (scope === 'COLLEGE') {
      if (actorCollege !== collegeId) {
        throw new AppError('You can only manage documents for your assigned college', 403);
      }
    } else if (scope === 'DEPARTMENT') {
      if (!departmentId) {
        throw new AppError('Department ID is required for department documents', 400);
      }
      const dept = await prisma.department.findUnique({
        where: { id: departmentId },
        select: { collegeId: true },
      });
      if (!dept || dept.collegeId !== actorCollege) {
        throw new AppError('You can only manage department documents within your assigned college', 403);
      }
    } else {
      throw new AppError('Invalid document scope for college administrator', 403);
    }
    return;
  }

  if (role === 'DEPARTMENT_ADMIN') {
    if (!actorDept) {
      throw new AppError('Department administrator must be assigned to a department', 403);
    }
    if (scope !== 'DEPARTMENT' || actorDept !== departmentId) {
      throw new AppError('You can only manage documents for your assigned department', 403);
    }
    return;
  }

  throw new AppError('Insufficient administrative permissions to manage knowledge base documents', 403);
}

export async function createKnowledgeDocument(
  actor: AuthActor,
  dto: CreateKnowledgeDocumentDto,
  file: {
    originalname: string;
    path: string;
    mimetype: string;
    size: number;
    fileHash: string;
    buffer?: Buffer;
  },
  reqAudit?: any
) {
  await verifyAdminKnowledgeScope(actor, dto.scope, dto.collegeId, dto.departmentId);

  // Section 24: Duplicate detection
  const existingDuplicate = await prisma.knowledgeDocumentVersion.findFirst({
    where: { fileHash: file.fileHash },
    include: { document: true },
  });

  if (existingDuplicate) {
    throw new AppError(
      `Duplicate document content detected: This exact file was already uploaded as "${existingDuplicate.document.title}" (Version ${existingDuplicate.version}).`,
      409
    );
  }

  // Load buffer
  const fileBuffer = file.buffer || (file.path && fs.existsSync(file.path) ? await fs.promises.readFile(file.path) : null);
  if (!fileBuffer) {
    throw new AppError('Uploaded document file buffer could not be read', 400);
  }

  // 1. Store file in durable storage abstraction
  const storage = getKnowledgeStorage();
  const stored = await storage.store({
    buffer: fileBuffer,
    originalFilename: file.originalname,
    mimeType: file.mimetype,
    fileHash: file.fileHash,
    subfolder: 'versions',
  });

  let document: any;
  try {
    // 2. Create DB record referencing stored key (never absolute Windows path)
    document = await prisma.knowledgeDocument.create({
      data: {
        title: dto.title,
        titleAr: dto.titleAr,
        description: dto.description,
        documentType: dto.documentType || 'REGULATION',
        scope: dto.scope || 'GLOBAL',
        collegeId: dto.collegeId,
        departmentId: dto.departmentId,
        status: 'ACTIVE',
        createdById: actor.id,
        versions: {
          create: {
            version: 1,
            versionTag: dto.versionTag || 'v1.0',
            originalFilename: file.originalname,
            fileUrl: stored.storageKey,
            mimeType: file.mimetype,
            fileSize: file.size,
            fileHash: file.fileHash,
            uploadedById: actor.id,
            effectiveDate: dto.effectiveDate,
            processingStatus: 'PENDING',
          },
        },
      },
      include: {
        versions: true,
      },
    });
  } catch (dbError) {
    // Compensation: delete stored file so no orphaned file exists on disk/cloud
    await storage.delete(stored.storageKey).catch(() => {});
    throw dbError;
  }

  const version = document.versions[0];

  // Set initial active version
  await prisma.knowledgeDocument.update({
    where: { id: document.id },
    data: { activeVersionId: version.id },
  });

  // Trigger ingestion
  await processDocumentVersion(version.id);

  if (reqAudit) {
    await auditLog('UPLOAD_KNOWLEDGE_DOCUMENT', 'KnowledgeDocument', document.id, reqAudit);
  }

  logger.info('[KnowledgeAdmin] Created knowledge document', {
    documentId: document.id,
    versionId: version.id,
    storageKey: stored.storageKey,
    userId: actor.id,
  });

  return prisma.knowledgeDocument.findUnique({
    where: { id: document.id },
    include: {
      activeVersion: true,
      versions: {
        orderBy: { version: 'desc' },
      },
    },
  });
}

export async function uploadNewDocumentVersion(
  actor: AuthActor,
  documentId: string,
  file: {
    originalname: string;
    path: string;
    mimetype: string;
    size: number;
    fileHash: string;
    buffer?: Buffer;
  },
  options: { versionTag?: string; effectiveDate?: Date },
  reqAudit?: any
) {
  const document = await prisma.knowledgeDocument.findUnique({
    where: { id: documentId },
    include: { versions: { orderBy: { version: 'desc' } } },
  });

  if (!document) {
    throw new AppError('Document not found', 404);
  }

  await verifyAdminKnowledgeScope(actor, document.scope, document.collegeId ?? undefined, document.departmentId ?? undefined);

  // Check duplicate hash
  const duplicate = document.versions.find((v) => v.fileHash === file.fileHash);
  if (duplicate) {
    throw new AppError(
      `Duplicate file content: This document already contains an identical version (Version ${duplicate.version}).`,
      409
    );
  }

  // Load buffer
  const fileBuffer = file.buffer || (file.path && fs.existsSync(file.path) ? await fs.promises.readFile(file.path) : null);
  if (!fileBuffer) {
    throw new AppError('Uploaded document file buffer could not be read', 400);
  }

  const storage = getKnowledgeStorage();
  const stored = await storage.store({
    buffer: fileBuffer,
    originalFilename: file.originalname,
    mimeType: file.mimetype,
    fileHash: file.fileHash,
    subfolder: 'versions',
  });

  const nextVersionNum = (document.versions[0]?.version || 0) + 1;

  let newVersion: any;
  try {
    newVersion = await prisma.knowledgeDocumentVersion.create({
      data: {
        documentId: document.id,
        version: nextVersionNum,
        versionTag: options.versionTag || `v${nextVersionNum}.0`,
        originalFilename: file.originalname,
        fileUrl: stored.storageKey,
        mimeType: file.mimetype,
        fileSize: file.size,
        fileHash: file.fileHash,
        uploadedById: actor.id,
        effectiveDate: options.effectiveDate,
        processingStatus: 'PENDING',
      },
    });
  } catch (dbError) {
    // Compensation: delete stored file so no orphaned file exists
    await storage.delete(stored.storageKey).catch(() => {});
    throw dbError;
  }

  // Trigger ingestion
  await processDocumentVersion(newVersion.id);

  if (reqAudit) {
    await auditLog('UPLOAD_KNOWLEDGE_DOCUMENT_VERSION', 'KnowledgeDocumentVersion', newVersion.id, reqAudit);
  }

  return prisma.knowledgeDocument.findUnique({
    where: { id: document.id },
    include: {
      activeVersion: true,
      versions: { orderBy: { version: 'desc' } },
    },
  });
}

export async function activateDocumentVersion(
  actor: AuthActor,
  documentId: string,
  versionId: string,
  reqAudit?: any
) {
  const document = await prisma.knowledgeDocument.findUnique({
    where: { id: documentId },
    include: { versions: true },
  });

  if (!document) throw new AppError('Document not found', 404);
  await verifyAdminKnowledgeScope(actor, document.scope, document.collegeId ?? undefined, document.departmentId ?? undefined);

  const targetVersion = document.versions.find((v) => v.id === versionId);
  if (!targetVersion) throw new AppError('Target version not found for this document', 404);
  if (targetVersion.processingStatus !== 'READY') {
    throw new AppError(`Cannot activate version with processing status: ${targetVersion.processingStatus}`, 400);
  }

  const previousActiveId = document.activeVersionId;

  await prisma.$transaction(async (tx) => {
    // Supersede previous active version
    if (previousActiveId && previousActiveId !== versionId) {
      await tx.knowledgeDocumentVersion.update({
        where: { id: previousActiveId },
        data: { supersededAt: new Date() },
      });
    }

    // Set new active version
    await tx.knowledgeDocument.update({
      where: { id: documentId },
      data: { activeVersionId: versionId },
    });

    // Clear supersededAt on new active version
    await tx.knowledgeDocumentVersion.update({
      where: { id: versionId },
      data: { supersededAt: null },
    });
  });

  if (reqAudit) {
    await auditLog('ACTIVATE_DOCUMENT_VERSION', 'KnowledgeDocument', documentId, reqAudit);
  }

  return prisma.knowledgeDocument.findUnique({
    where: { id: documentId },
    include: {
      activeVersion: true,
      versions: { orderBy: { version: 'desc' } },
    },
  });
}

export async function archiveKnowledgeDocument(
  actor: AuthActor,
  documentId: string,
  reqAudit?: any
) {
  const document = await prisma.knowledgeDocument.findUnique({
    where: { id: documentId },
  });

  if (!document) throw new AppError('Document not found', 404);
  await verifyAdminKnowledgeScope(actor, document.scope, document.collegeId ?? undefined, document.departmentId ?? undefined);

  const updated = await prisma.knowledgeDocument.update({
    where: { id: documentId },
    data: { status: 'ARCHIVED' },
    include: { activeVersion: true, versions: true },
  });

  if (reqAudit) {
    await auditLog('ARCHIVE_KNOWLEDGE_DOCUMENT', 'KnowledgeDocument', documentId, reqAudit);
  }

  return updated;
}

export async function listKnowledgeDocuments(
  actor: AuthActor,
  filter: {
    scope?: string;
    documentType?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }
) {
  const role = actor.role?.toUpperCase();
  const collegeId = actor.managedCollegeId || actor.collegeId;
  const departmentId = actor.managedDepartmentId || actor.departmentId;

  const where: any = {};

  // Scope constraints
  if (role === 'COLLEGE_ADMIN' && collegeId) {
    where.OR = [
      { scope: 'GLOBAL' },
      { scope: 'COLLEGE', collegeId },
    ];
  } else if (role === 'DEPARTMENT_ADMIN' && departmentId) {
    where.OR = [
      { scope: 'GLOBAL' },
      { scope: 'DEPARTMENT', departmentId },
    ];
  }

  if (filter.scope) where.scope = filter.scope;
  if (filter.documentType) where.documentType = filter.documentType;
  if (filter.status) where.status = filter.status;
  if (filter.search) {
    where.OR = [
      { title: { contains: filter.search, mode: 'insensitive' } },
      { titleAr: { contains: filter.search, mode: 'insensitive' } },
      { description: { contains: filter.search, mode: 'insensitive' } },
    ];
  }

  const [total, documents] = await Promise.all([
    prisma.knowledgeDocument.count({ where }),
    prisma.knowledgeDocument.findMany({
      where,
      include: {
        activeVersion: true,
        createdBy: {
          select: { id: true, email: true, role: true },
        },
        _count: {
          select: { versions: true, chunks: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: filter.limit || 50,
      skip: filter.offset || 0,
    }),
  ]);

  return { total, documents };
}
