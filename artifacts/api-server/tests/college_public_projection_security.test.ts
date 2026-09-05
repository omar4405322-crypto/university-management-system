import assert from 'node:assert/strict';
import prisma from '../src/utils/prismaClient';
import {
  getAllColleges,
  getCollegeById,
  getPublicCollegeById,
  getPublicColleges,
} from '../src/services/college.service';
import { getScopeWhere } from '../src/utils/scope.utils';

const originalFindMany = prisma.college.findMany;
const originalFindUnique = prisma.college.findUnique;
const originalFindFirst = prisma.college.findFirst;

try {
  let captured: any;
  (prisma.college as any).findMany = async (args: any) => {
    captured = args;
    return [];
  };
  await getPublicColleges();
  assert.deepEqual(captured, {
    select: { id: true, name: true, nameAr: true },
    orderBy: { name: 'asc' },
  });

  (prisma.college as any).findUnique = async (args: any) => {
    captured = args;
    return { id: 1, name: 'Engineering', nameAr: null };
  };
  assert.deepEqual(await getPublicCollegeById(1), {
    id: 1,
    name: 'Engineering',
    nameAr: null,
  });
  assert.deepEqual(captured.select, { id: true, name: true, nameAr: true });
  assert.equal(captured.include, undefined);

  (prisma.college as any).findMany = async (args: any) => {
    captured = args;
    return [];
  };
  await getAllColleges({ role: 'COLLEGE_ADMIN', managedCollegeId: 7 });
  assert.deepEqual(captured.where, { id: 7 });
  await getAllColleges({ role: 'DEPARTMENT_ADMIN', managedDepartmentId: 9 });
  assert.deepEqual(captured.where, { departments: { some: { id: 9 } } });
  await getAllColleges({ role: 'DOCTOR', doctor: { id: 4 } });
  assert.deepEqual(captured.where, { id: -1 });

  (prisma.college as any).findFirst = async (args: any) => {
    captured = args;
    return null;
  };
  await assert.rejects(
    getCollegeById(8, { role: 'COLLEGE_ADMIN', managedCollegeId: 7 }),
    /College not found/
  );
  assert.deepEqual(captured.where, { AND: [{ id: 8 }, { id: 7 }] });

  assert.deepEqual(getScopeWhere(undefined, 'college'), { id: -1 });
} finally {
  (prisma.college as any).findMany = originalFindMany;
  (prisma.college as any).findUnique = originalFindUnique;
  (prisma.college as any).findFirst = originalFindFirst;
}

console.log('✓ Public college projection and managed scope checks passed');
