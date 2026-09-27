import prisma from "../../utils/prismaClient";
import { AuthorizationError } from "../../utils/appError";
import { getScopeWhere } from "../../utils/scope.utils";
import type { AuthActor } from "../../types/auth.types";

export interface CourseScopeValidationTarget {
  departmentId?: number | null;
  department?: { collegeId?: number | null } | null;
}

export interface TaskOwnershipValidationTarget {
  doctorId: number;
  courseId: number;
  course?: CourseScopeValidationTarget | null;
}

export class TaskScopeService {
  static async getDoctorOrThrow(userId: number) {
    const doctor = await prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) {
      throw new AuthorizationError("Only doctors can perform this action");
    }
    return doctor;
  }

  static async getStudentOrThrow(userId: number) {
    const student = await prisma.student.findUnique({ where: { userId } });
    if (!student) {
      throw new AuthorizationError("Only students can perform this action");
    }
    return student;
  }

  static async validateCourseScope(
    user: AuthActor,
    course: CourseScopeValidationTarget,
  ): Promise<void> {
    const courseScope = getScopeWhere(user, "course") as {
      id?: number;
      department?: { collegeId?: number | null } | null;
      departmentId?: number | null;
    } | undefined;
    if (courseScope && Object.keys(courseScope).length) {
      if (courseScope.id === -1) {
        throw new AuthorizationError("Access denied");
      }
      if (
        courseScope.department &&
        course.department?.collegeId !== courseScope.department.collegeId
      ) {
        throw new AuthorizationError("Access denied");
      }
      if (
        courseScope.departmentId &&
        course.departmentId !== courseScope.departmentId
      ) {
        throw new AuthorizationError("Access denied");
      }
    }
  }

  static async ensureDoctorAssignedToCourse(
    doctorId: number,
    courseId: number,
  ): Promise<void> {
    const isAssigned = await prisma.scheduleSlot.findFirst({
      where: { courseId, doctorId },
    });
    if (!isAssigned) {
      throw new AuthorizationError(
        "Access denied: You are not assigned to teach this course",
      );
    }
  }

  static async ensureCourseOwnershipOrScope(
    user: AuthActor,
    task: TaskOwnershipValidationTarget,
  ): Promise<void> {
    if (user.role === "DOCTOR") {
      const doctor = await TaskScopeService.getDoctorOrThrow(user.id);
      if (task.doctorId !== doctor.id) {
        throw new AuthorizationError(
          "Access denied: You did not create this task",
        );
      }
      return;
    }
    if (task.course) {
      await TaskScopeService.validateCourseScope(user, task.course);
    }
  }
}
