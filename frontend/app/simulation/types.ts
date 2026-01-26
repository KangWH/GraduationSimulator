import { Course, Grade, Semester } from "../profile/settings/types";

export type CreditType =
  | { type: 'BASIC_REQUIRED'; }
  | { type: 'BASIC_ELECTIVE'; }
  | { type: 'MANDATORY_GENERAL_COURSES'; }
  | { type: 'HUMANITIES_SOCIAL_ELECTIVE'; }
  | { type: 'MAJOR'; department: string; }
  | { type: 'DOUBLE_MAJOR'; department: string; }
  | { type: 'MINOR'; department: string; }
  | { type: 'ADVANCED_MAJOR'; }
  | { type: 'INDIVIDUALLY_DESIGNED_MAJOR'; }
  | { type: 'RESEARCH'; }
  | { type: 'OTHER_ELECTIVE'; }
  | null;

export interface CourseSimulation {
  courseId: string;
  course: Course;
  enrolledYear: number;
  enrolledSemester: Semester;
  grade: Grade;
  recognizedAs: CreditType;
}

export interface RawCourseSimulation {
  courseId: string;
  enrolledYear: number;
  enrolledSemester: Semester;
  grade: Grade;
  recognizedAs: CreditType;
}
