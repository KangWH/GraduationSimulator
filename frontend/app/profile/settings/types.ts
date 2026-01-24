export type Tab = 'account' | 'profile' | 'courses';

export interface User {
  id: string;
  email: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  credit: number;
  year: number;
  semester: number;
  section?: string;
  grade?: string | null;
}

export interface Profile {
  id: string;
  userId: string;
  name: string;
  studentId: string;
  admissionYear: number;
  isFallAdmission: boolean;
  major: string;
  doubleMajors: string[];
  minors: string[];
  advancedMajor: boolean;
  individuallyDesignedMajor: boolean;
  enrollments?: { id: string; grade: string | null; course: Course }[];
}
