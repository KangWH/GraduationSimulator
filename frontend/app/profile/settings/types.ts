export type Tab = 'account' | 'profile' | 'courses';

export interface User {
  id: string;
  email: string;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  department: string;
  category: string;
  credit: number;
  au: number;
  level: string;
  crossRecognition: boolean;
  tags: string[];
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
  enrollments?: Enrollment[];
}

export type Semester = 'SPRING' | 'SUMMER' | 'FALL' | 'WINTER';
export type Grade = 'A+' | 'A0' | 'A-' | 'B+' | 'B0' | 'B-' | 'C+' | 'C0' | 'C-' | 'D+' | 'D0' | 'D-' | 'F' | 'S' | 'U' | 'P' | 'NR' | 'W';

export interface Enrollment {
  courseId: string;
  course: Course;
  enrolledYear: number;
  enrolledSemester: Semester;
  grade: Grade;
}

export interface RawEnrollment {
  courseId: string;
  enrolledYear: number;
  enrolledSemester: Semester;
  grade: Grade;
}
