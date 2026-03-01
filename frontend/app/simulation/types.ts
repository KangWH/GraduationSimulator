import { Course, Grade, Semester } from "../profile/settings/types";
import { CourseCondition } from "./conditionTester";

export type CreditType =
  | { type: 'BASIC_REQUIRED'; }
  | { type: 'BASIC_ELECTIVE'; }
  | { type: 'MANDATORY_GENERAL_COURSES'; }
  | { type: 'HUMANITIES_SOCIETY_ELECTIVE'; }
  | { type: 'MAJOR' }
  | { type: 'DOUBLE_MAJOR'; department: string; }
  | { type: 'MAJOR_AND_DOUBLE_MAJOR'; department: string; }
  | { type: 'MINOR'; department: string; }
  | { type: 'ADVANCED_MAJOR'; }
  | { type: 'INDIVIDUALLY_DESIGNED_MAJOR'; }
  | { type: 'RESEARCH'; }
  | { type: 'OTHER_ELECTIVE'; }
  | { type: 'UNRECOGNIZED'; }
  | null;

export interface CourseSimulation {
  courseId: string;
  course: Course;
  enrolledYear: number;
  enrolledSemester: Semester;
  grade: Grade;
  possibleClassifications: CreditType[];
  specifiedClassification?: CreditType;
  classification?: CreditType;
}

export interface RawCourseSimulation {
  courseId: string;
  enrolledYear: number;
  enrolledSemester: Semester;
  grade: Grade;
  recognizedAs?: CreditType;
}

export interface Requirement {
  title: string;
  description: string;
  type: string;
  value?: number;
  currentValue?: number;
  isKey?: boolean;
  isSecondaryKey?: boolean;
  /** true이면 배정 가능한 과목 비율과 관계없이 해당 카테고리에 우선 배정(주전공/복수전공 시 중복인정 고려) */
  isExhaustive?: boolean;
  targets?: CourseCondition[];
  targetTags?: string[];
  constraints?: any[];
  usedCourses?: CourseSimulation[];
  fulfilled: boolean;
}

export interface Filter {
  requirementYear: number,
  major: string,
  doubleMajors: string[],
  minors: string[],
  advancedMajor: boolean,
  individuallyDesignedMajor: boolean,
  earlyGraduation: boolean,
}