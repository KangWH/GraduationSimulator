import { CourseSimulation, Requirement } from "./types";

export interface CourseCondition {
  codes?: string[];
  categories?: string[];
  departments?: string[];
  tags?: string[];
  firstDigits?: number[];
}

function testCourses(enrolledCourses: CourseSimulation[], requirement: Requirement, type: string, department?: string) {
  let currentValue = 0;

  let courses: CourseSimulation[] = [];

  enrolledCourses.forEach((c) => {
    if (["W", "F", "U", "NR"].includes(c.grade))
      return;

    if (type !== 'doubleMajor' && c.internalRecognizedAs !== null)
      return;

    if (requirement.targets) {
      if (!checkCourseConditions(requirement.targets, c))
        return;
    }

    // test requirement.constraints here

    // 과목이 조건에 맞음
    switch (type) {
      case 'basicRequired':
        c.internalRecognizedAs = { type: 'BASIC_REQUIRED' };
        break;
      case 'basicElective':
        c.internalRecognizedAs = { type: 'BASIC_ELECTIVE' };
        break;
      case 'mandatoryGeneralCourses':
        c.internalRecognizedAs = { type: 'MANDATORY_GENERAL_COURSES' };
        break;
      case 'humanitiesSocietyElective':
        c.internalRecognizedAs = { type: 'HUMANITIES_SOCIETY_ELECTIVE' };
        break;
      case 'major':
        c.internalRecognizedAs = { type: 'MAJOR' };
        break;
      case 'doubleMajor':
        c.internalRecognizedAs = { type: 'DOUBLE_MAJOR', department: department! };
        break;
      case 'minor':
        c.internalRecognizedAs = { type: 'MINOR', department: department! };
        break;
      case 'advancedMajor':
        c.internalRecognizedAs = { type: 'ADVANCED_MAJOR' };
        break;
      case 'research':
        c.internalRecognizedAs = { type: 'RESEARCH' };
        break;
    }
    courses.push(c);

    switch (requirement.type) {
      case 'MIN_COURSES_AMONG':
        currentValue += 1;
        break;
      case 'MIN_CREDITS_AMONG':
        currentValue += c.course.credit;
        break;
      case 'MIN_AU_AMONG':
        currentValue += c.course.au;
        break;
    }
  });

  return { currentValue, courses };
}

export function getMatches(enrolledCourses: CourseSimulation[], type: string, targets: CourseCondition[] = [], constraints: any[]) {
  let currentValue = 0;

  let courses: any[] = [];

  enrolledCourses.forEach((c) => {
    if (["W", "F", "U", "NR"].includes(c.grade))
      return;

    if (!checkCourseConditions(targets, c))
      return;

    courses.push(c);

    switch (type) {
      case 'MIN_COURSES_AMONG':
        currentValue += 1;
        break;
      case 'MIN_CREDITS_AMONG':
        currentValue += c.course.credit;
        break;
      case 'MIN_AU_AMONG':
        currentValue += c.course.au;
        break;
    }
  });

  return { currentValue, courses };
}

function checkCourseCondition(condition: CourseCondition, course: CourseSimulation) {
  if (condition.codes !== undefined) {
    if (!condition.codes.includes(course.course.code))
      return false;
  }
  if (condition.categories !== undefined) {
    if (!condition.categories.includes(course.course.category))
      return false;
  }
  if (condition.departments !== undefined) {
    if (!condition.departments.includes(course.course.department))
      return false;
  }
  if (condition.tags !== undefined) {
    if (condition.tags.some((t) => !course.course.tags.includes(t)))
      return false;
  }
  if (condition.firstDigits !== undefined) {
    const firstDigit = Number(course.course.code.split('.')[1][0]) || 0;
    if (!condition.firstDigits.includes(firstDigit))
      return false;
  }

  return true;
}

function checkCourseConditions(conditions: CourseCondition[], course: CourseSimulation) {
  return conditions.some(c => checkCourseCondition(c, course));
}


// 과목 목록을 바탕으로 가능한 학과 받기

export interface RequirementsProps {
  basicRequired: Requirement[];
  basicElective: Requirement[];
  mandatoryGeneralCourses: Requirement[];
  humanitiesSocietyElective: Requirement[];
  research?: Requirement[];
  advanced?: Requirement[];
  major: Requirement[];
  doubleMajors?: Record<string, Requirement[]>;
  minors?: Record<string, Requirement[]>;
  individuallyDesignedMajor?: Requirement[];
}

export function classifyCourses(enrolledCourses: CourseSimulation[], requirements: RequirementsProps) {
  // 초기화
  let resultCourses = [...enrolledCourses];
  resultCourses.forEach(c => {
    if (['F', 'W', 'NR', 'U'].includes(c.grade))
      c.internalRecognizedAs = { type: 'UNRECOGNIZED' };
    else
      c.internalRecognizedAs = null;
  });

  // 연구
  if (requirements.research !== undefined) {
    requirements.research.forEach((requirement) => {
      const { courses, currentValue } = testCourses(resultCourses, requirement, 'research');
      requirement.currentValue = currentValue;
    });
  }
  
  // 심전
  if (requirements.advanced !== undefined) {
    requirements.advanced.forEach((requirement) => {
      const { courses, currentValue } = testCourses(resultCourses, requirement, 'advancedMajor');
      requirement.currentValue = currentValue;
    });
  }

  // 주전공
  requirements.major.forEach(requirement => {
    const { courses, currentValue } = testCourses(resultCourses, requirement, 'major');
    requirement.currentValue = currentValue;
  });

  // 복전 (중복인정 고려)
  if (requirements.doubleMajors) {
    Object.entries(requirements.doubleMajors).forEach(([department, rqs]) => {
      rqs.forEach(requirement => {
        const { courses, currentValue } = testCourses(resultCourses, requirement, 'doubleMajor', department);
        requirement.currentValue = currentValue;
      });
    });
  }

  // 부전
  if (requirements.minors) {
    Object.entries(requirements.minors).forEach(([department, rqs]) => {
      rqs.forEach(requirement => {
        const { courses, currentValue } = testCourses(resultCourses, requirement, 'minor', department);
        requirement.currentValue = currentValue;
      });
    });
  }

  // 자유융합전공

  // 기초과목
  requirements.basicRequired.forEach(requirement => {
    const { courses, currentValue } = testCourses(resultCourses, requirement, 'basicRequired');
    requirement.currentValue = currentValue;
  });
  requirements.basicElective.forEach(requirement => {
    const { courses, currentValue } = testCourses(resultCourses, requirement, 'basicElective');
    requirement.currentValue = currentValue;
  });

  // 교양과목
  requirements.mandatoryGeneralCourses.forEach(requirement => {
    const { courses, currentValue } = testCourses(resultCourses, requirement, 'mandatoryGeneralCourses');
    requirement.currentValue = currentValue;
  });
  requirements.humanitiesSocietyElective.forEach(requirement => {
    const { courses, currentValue } = testCourses(resultCourses, requirement, 'humanitiesSocietyElective');
    requirement.currentValue = currentValue;
  });

  // 자선

  console.log('계산 안 함:', resultCourses.filter(c => c.internalRecognizedAs?.type === 'UNRECOGNIZED'))

  return { enrolledCourses: resultCourses, requirements };
}
