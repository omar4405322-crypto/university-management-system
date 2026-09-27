import type { AuthActor } from "../types/auth.types";
import { TaskScopeService } from "./task/taskScope.service";
import {
  TaskQueriesService,
  type GetTasksOptions,
  type TaskQueryResult,
  type TaskQueryResultItem,
  type TaskPaginationMeta,
} from "./task/taskQueries.service";
import {
  TaskMutationsService,
  type CreateTaskDTO,
  type UpdateTaskDTO,
  type DeleteTaskResult,
  type TaskCreatedPayload,
  type TaskUpdatedPayload,
} from "./task/taskMutations.service";
import {
  TaskGradingService,
  type SubmitTaskDTO,
  type AuditRequestSource,
  type SubmitTaskResult,
  type ResubmitTaskResult,
} from "./task/taskGrading.service";
import {
  TaskSubmissionsService,
  type GetTaskSubmissionsOptions,
  type TaskSubmissionsResult,
} from "./taskSubmissions.service";

export {
  TaskScopeService,
  TaskQueriesService,
  TaskMutationsService,
  TaskGradingService,
  TaskSubmissionsService,
};

export type {
  CreateTaskDTO,
  UpdateTaskDTO,
  GetTasksOptions,
  DeleteTaskResult,
  TaskQueryResult,
  TaskQueryResultItem,
  TaskPaginationMeta,
  TaskCreatedPayload,
  TaskUpdatedPayload,
  SubmitTaskDTO,
  AuditRequestSource,
  SubmitTaskResult,
  ResubmitTaskResult,
  GetTaskSubmissionsOptions,
  TaskSubmissionsResult,
};

export class TaskService {
  static createTask(user: AuthActor, data: CreateTaskDTO) {
    return TaskMutationsService.createTask(user, data);
  }

  static getTasks(
    user: AuthActor,
    courseId?: number,
    opts?: GetTasksOptions,
  ) {
    return TaskQueriesService.getTasks(user, courseId, opts);
  }

  static updateTask(
    user: AuthActor,
    taskId: number,
    data: UpdateTaskDTO,
  ) {
    return TaskMutationsService.updateTask(user, taskId, data);
  }

  static deleteTask(
    user: AuthActor,
    taskId: number,
    force: boolean = false,
  ) {
    return TaskMutationsService.deleteTask(user, taskId, force);
  }

  static submitTask(
    user: AuthActor,
    taskId: number,
    data: SubmitTaskDTO,
    reqSource?: AuditRequestSource,
  ) {
    return TaskGradingService.submitTask(user, taskId, data, reqSource);
  }

  static gradeSubmission(
    user: AuthActor,
    taskId: number,
    submissionId: number,
    score: number,
    feedback?: string,
    expectedSubmittedAt?: string | Date,
    reqSource?: AuditRequestSource,
  ) {
    return TaskGradingService.gradeSubmission(
      user,
      taskId,
      submissionId,
      score,
      feedback,
      expectedSubmittedAt,
      reqSource,
    );
  }

  static getTaskSubmissions(
    user: AuthActor,
    taskId: number,
    opts?: GetTaskSubmissionsOptions,
  ): Promise<TaskSubmissionsResult> {
    return TaskSubmissionsService.getTaskSubmissions(user, taskId, opts);
  }

  static getMySubmission(user: AuthActor, taskId: number) {
    return TaskGradingService.getMySubmission(user, taskId);
  }
}

export default TaskService;
