export type GradeComponentSource = 'AUTO_QUIZ' | 'AUTO_ATTENDANCE' | 'MANUAL';
export type GradeEntryStatus = 'DRAFT' | 'PUBLISHED';

export interface GradebookComponent {
  id: number;
  name: string;
  nameAr: string | null;
  maxPoints: number;
  source: GradeComponentSource;
  displayOrder: number;
}

export interface GradebookStructure {
  id: number;
  totalPoints: number;
  passMark: number | null;
  components: GradebookComponent[];
}

export interface GradebookCell {
  componentId: number;
  componentName: string;
  maxPoints: number;
  source: GradeComponentSource;
  value: number | null;
  score: number | null;
  isAbsent: boolean;
  status: GradeEntryStatus | null;
  version: number | null;
  notes: string | null;
}

export interface GradebookStudent {
  studentId: number;
  enrollmentId: number;
  firstName: string;
  lastName: string;
  studentIdCode: string;
  groupId: number | null;
  status: string;
  grades: GradebookCell[];
}

export interface GradebookData {
  courseId: number;
  termId: number;
  termName: string;
  structure: GradebookStructure;
  students: GradebookStudent[];
}

export interface SaveGradebookDraftEntry {
  enrollmentId: number;
  componentId: number;
  score: number | null;
  isAbsent: boolean;
  version?: number;
  notes?: string | null;
}

export interface SaveGradebookDraftPayload {
  entries: SaveGradebookDraftEntry[];
}

export interface SaveGradebookDraftResult {
  courseId: number;
  termId: number;
  savedCount: number;
}

export interface CellEditState {
  score: number | null;
  isAbsent: boolean;
  notes?: string | null;
  inputRaw?: string;
  errorKey?: string | null;
}

export interface PublishGradebookResultCompleteItem {
  enrollmentId: number;
  studentId: number;
  finalPointsEarned: number;
  finalPointsMax: number;
  finalGrade: number;
  status: 'COMPLETED' | 'FAILED';
}

export interface PublishGradebookResultIncompleteItem {
  enrollmentId: number;
  studentId: number;
  missingComponents: number[];
}

export interface PublishGradebookResultSkippedItem {
  enrollmentId: number;
  studentId: number;
  status: string;
  reason: string;
}

export interface PublishGradebookResult {
  courseId: number;
  termId: number;
  complete: PublishGradebookResultCompleteItem[];
  incomplete: PublishGradebookResultIncompleteItem[];
  skipped: PublishGradebookResultSkippedItem[];
}

export interface GradeCorrectionEntry {
  enrollmentId: number;
  componentId: number;
  score: number | null;
  isAbsent: boolean;
  version: number;
  reason: string;
}

export interface CorrectGradebookPayload {
  corrections: GradeCorrectionEntry[];
}

export interface CorrectGradebookEntryResult {
  enrollmentId: number;
  componentId: number;
  before: { score: number | null; isAbsent: boolean; version: number };
  after: { score: number | null; isAbsent: boolean; version: number };
  reason: string;
}

export interface CorrectGradebookEnrollmentTotalsResult {
  enrollmentId: number;
  before: {
    finalPointsEarned: number | null;
    finalPointsMax: number | null;
    finalGrade: number | null;
    status: string;
  };
  after: {
    finalPointsEarned: number | null;
    finalPointsMax: number | null;
    finalGrade: number | null;
    status: string;
  };
}

export interface CorrectGradebookResult {
  success: boolean;
  updatedCount: number;
  entries: CorrectGradebookEntryResult[];
  enrollmentTotals: CorrectGradebookEnrollmentTotalsResult[];
}

