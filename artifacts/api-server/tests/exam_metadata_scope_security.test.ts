import assert from "node:assert/strict";
import prisma from "../src/utils/prismaClient";
import { getExamById } from "../src/controllers/exams.controller";
import { getScopeWhere } from "../src/utils/scope.utils";

const originalFindFirst = prisma.exam.findFirst;
const originalEnrollmentFindUnique = prisma.enrollment.findUnique;

async function invoke(user: any, id: string) {
  return new Promise<{ body?: any; error?: any }>((resolve) => {
    (getExamById as any)(
      { params: { id }, user },
      { json: (body: any) => resolve({ body }) },
      (error: unknown) => resolve({ error }),
    );
  });
}

try {
  const roles = [
    { role: "COLLEGE_ADMIN", managedCollegeId: 2 },
    { role: "DEPARTMENT_ADMIN", managedDepartmentId: 3 },
    { role: "DOCTOR", doctor: { id: 4 } },
    {
      role: "TEACHING_ASSISTANT",
      teachingAssistant: { id: 5, departmentId: 6 },
    },
    { role: "STUDENT", student: { id: 7, departmentId: 8, year: 2 } },
  ];

  for (const user of roles) {
    let capturedWhere: any;
    (prisma.exam as any).findFirst = async (args: any) => {
      capturedWhere = args.where;
      return {
        id: 41,
        courseId: 9,
        academicYear: 2026,
        semester: 1,
        course: {},
        questions: [],
      };
    };
    (prisma.enrollment as any).findUnique = async () => ({
      id: 70,
      status: "ENROLLED",
    });
    const response = await invoke(user, "41");
    assert.equal(response.error, undefined);
    assert.deepEqual(capturedWhere, {
      AND: [{ id: 41 }, getScopeWhere(user, "exam")],
    });
    assert.equal(response.body.data.id, 41);
  }

  (prisma.exam as any).findFirst = async () => null;
  const denied = await invoke(roles[2], "99");
  assert.equal(denied.error?.statusCode, 404);
} finally {
  (prisma.exam as any).findFirst = originalFindFirst;
  (prisma.enrollment as any).findUnique = originalEnrollmentFindUnique;
}

console.log("✓ Exam metadata uses the complete role-aware exam scope");
