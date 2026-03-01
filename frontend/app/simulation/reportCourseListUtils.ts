import type { CourseSimulation, CreditType } from './types';
import type { SubstitutionMap } from './conditionTester';
import type { Semester, Grade } from '../profile/settings/types';

/** 성적을 숫자로 변환 (평점 계산용, F/W/U/NR/S/P 제외) */
function gradeToNumber(grade: Grade): number | null {
  switch (grade) {
    case 'A+': return 4.3;
    case 'A0': return 4.0;
    case 'A-': return 3.7;
    case 'B+': return 3.3;
    case 'B0': return 3.0;
    case 'B-': return 2.7;
    case 'C+': return 2.3;
    case 'C0': return 2.0;
    case 'C-': return 1.7;
    case 'D+': return 1.3;
    case 'D0': return 1.0;
    case 'D-': return 0.7;
    case 'F': return 0.0;
    default: return null;
  }
}

/** 섹션 과목 목록의 소계: 학점 총합, AU 총합, 평점 */
export function computeSectionSubtotal(courses: CourseSimulation[]): { creditSum: number; auSum: number; gpa: string } {
  const creditSum = courses.reduce((sum, c) => sum + (c.course.credit || 0), 0);
  const auSum = courses.reduce((sum, c) => sum + (c.course.au || 0), 0);
  let totalGradePoints = 0;
  let totalCreditsForGPA = 0;
  courses.forEach((c) => {
    const credit = c.course.credit || 0;
    if (credit > 0) {
      const n = gradeToNumber(c.grade);
      if (n !== null) {
        totalGradePoints += credit * n;
        totalCreditsForGPA += credit;
      }
    }
  });
  const gpa = totalCreditsForGPA > 0 ? (totalGradePoints / totalCreditsForGPA).toFixed(2) : '-';
  return { creditSum, auSum, gpa };
}

/** 이수연도·학기 표기 (예: 2024-1) */
const SEMESTER_NUM: Record<Semester, string> = {
  SPRING: '봄',
  SUMMER: '여름',
  FALL: '가을',
  WINTER: '겨울',
};

export function formatYearSemester(year: number, semester: Semester): string {
  if (year === 0)
    return '기이수';
  return `${year} ${SEMESTER_NUM[semester]}`;
}

/**
 * 보고서 비고 열: 타학과, 대학원 상호인정, 대체인정, 중복인정, 이수예정
 */
export function getRemarks(
  course: CourseSimulation,
  substitutionMap: SubstitutionMap | undefined,
  majorDepartment: string | undefined
): string[] {
  const remarks: string[] = [];
  const currentClassification: CreditType | undefined =
    course.specifiedClassification || course.classification;

  // 대학원 상호인정
  if (course.course.level === 'GR' && course.course.crossRecognition) {
    remarks.push('대학원 상호인정');
  }

  // 대체인정 (대체과목이 원본 과목 학과 전공으로 인정될 때)
  const originalCodes = substitutionMap?.reverse?.[course.course.code] || [];
  if (originalCodes.length > 0 && currentClassification) {
    const classificationType = currentClassification.type;
    let currentDepartment: string | undefined;
    if (classificationType === 'MAJOR' || classificationType === 'ADVANCED_MAJOR' || classificationType === 'RESEARCH') {
      currentDepartment = majorDepartment;
    } else if ((classificationType === 'DOUBLE_MAJOR' || classificationType === 'MINOR') && 'department' in currentClassification) {
      currentDepartment = currentClassification.department;
    } else if (classificationType === 'MAJOR_AND_DOUBLE_MAJOR' && 'department' in currentClassification) {
      currentDepartment = currentClassification.department;
    }
    if (currentDepartment) {
      const originalDepartments = originalCodes.map((code: string) => code.split('.')[0]);
      if (originalDepartments.includes(currentDepartment)) {
        remarks.push('대체인정');
      }
    }
  }

  // 중복인정
  if (
    currentClassification?.type === 'MAJOR_AND_DOUBLE_MAJOR' ||
    course.classification?.type === 'MAJOR_AND_DOUBLE_MAJOR'
  ) {
    remarks.push('중복인정');
  }

  // 타학과 (전공/복전/부전공 등에서 개설학과와 인정학과가 다를 때)
  if (currentClassification) {
    const classificationType = currentClassification.type;
    if (
      ['MAJOR', 'ADVANCED_MAJOR', 'RESEARCH', 'DOUBLE_MAJOR', 'MAJOR_AND_DOUBLE_MAJOR', 'MINOR'].includes(classificationType)
    ) {
      let targetDepartment: string | undefined;
      if (classificationType === 'MAJOR' || classificationType === 'ADVANCED_MAJOR' || classificationType === 'RESEARCH') {
        targetDepartment = majorDepartment;
      } else if ('department' in currentClassification && currentClassification.department) {
        targetDepartment = currentClassification.department;
      }
      if (targetDepartment && course.course.department !== targetDepartment) {
        remarks.push('타학과');
      }
    }
  }

  // 이수예정 (성적 미입력 등으로 추후 확장 가능)
  if (course.grade === 'NR' || course.grade === 'W') {
    remarks.push('이수예정');
  }

  return remarks;
}
