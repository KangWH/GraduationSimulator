import { CourseSimulation, Requirement } from "./types";

export interface CourseCondition {
  codes?: string[];
  categories?: string[];
  departments?: string[];
  tags?: string[];
  firstDigits?: number[];
}

function testCourses(enrolledCourses: CourseSimulation[], requirement: Requirement, type: string, department?: string, allowDifferentDepartments: boolean = false, departments?: string[]) {
  let currentValue = 0;
  let doubleCountedCredits = 0;
  const courses: CourseSimulation[] = [];
  const tags = new Set<string>();

  enrolledCourses.forEach((c) => {
    if (["W", "F", "U", "NR"].includes(c.grade))
      return;

    const isSameType = [];
    isSameType.push(type === 'basicRequired' && c.classification?.type === 'BASIC_REQUIRED');
    isSameType.push(type === 'basicElective' && c.classification?.type === 'BASIC_ELECTIVE');
    isSameType.push(type === 'mandatoryGeneralCourses' && c.classification?.type === 'MANDATORY_GENERAL_COURSES');
    isSameType.push(type === 'humanitiesSocietyElective' && c.classification?.type === 'HUMANITIES_SOCIETY_ELECTIVE');
    isSameType.push(type === 'major' && c.classification?.type === 'MAJOR');
    isSameType.push(type === 'major' && c.classification?.type === 'MAJOR_AND_DOUBLE_MAJOR');
    isSameType.push(type === 'doubleMajor' && c.classification?.type === 'DOUBLE_MAJOR' && c.classification?.department === department);
    isSameType.push(type === 'doubleMajor' && c.classification?.type === 'MAJOR_AND_DOUBLE_MAJOR' && c.classification?.department === department);
    isSameType.push(type === 'minor' && c.classification?.type === 'MINOR' && c.classification?.department === department);
    isSameType.push(type === 'advancedMajor' && c.classification?.type === 'ADVANCED_MAJOR');
    isSameType.push(type === 'individuallyDesignedMajor' && c.classification?.type === 'INDIVIDUALLY_DESIGNED_MAJOR');
    isSameType.push(type === 'research' && c.classification?.type === 'RESEARCH');
    isSameType.push(type === 'otherElective' && c.classification?.type === 'OTHER_ELECTIVE');
    // 타학과 개설 과목 고려 시 (중복인정)
    if (allowDifferentDepartments) {
      isSameType.push(type === 'major' && c.classification?.type === 'DOUBLE_MAJOR');
      isSameType.push(type === 'doubleMajor' && c.classification?.type === 'MAJOR');
    }
    if (!isSameType.some(c => c) && (type !== 'doubleMajor' && c.classification !== null))
      return;

    if (requirement.targets) {
      if (!checkCourseConditions(requirement.targets, c, allowDifferentDepartments ? undefined : department, type === 'individuallyDesignedMajor' ? departments : undefined))
        return;
    }

    if (requirement.type === 'MIN_TAGS_AMONG') {
      const tagIntersection = (c.course.tags || []).filter(t => requirement.targetTags?.includes(t));
      if (tagIntersection.length > 0)
        tagIntersection.forEach(t => tags.add(t));
      else
        return;
    }

    // 심전: 기준 넘기면 그만 세기
    if (type === 'advancedMajor' && currentValue >= (requirement.value || Number.MAX_SAFE_INTEGER)) {
      return;
    }

    const constraintTests = requirement.constraints?.map(constraint => {
      // 이미 계산한 과목들 중 제약에 일치하는 과목들
      const currentlyTaken = courses.filter(c => checkCourseConditions(constraint.targets, c, allowDifferentDepartments ? undefined : department));
      switch (constraint.type) {
        case 'MAX_CREDITS_AMONG':
          const currentCredit = currentlyTaken.reduce((cv, c) => cv + c.course.credit, 0);
          if (currentCredit > constraint.value)
            return false;
          break;
        case 'MAX_COURSES_AMONG':
          const currentCourses = currentlyTaken.length;
          if (currentCourses > constraint.value)
            return false;
          break;
        case 'MAX_AU_AMONG':
          const currentAU = currentlyTaken.reduce((cv, c) => cv + c.course.au, 0);
          if (currentAU > constraint.value)
            return false;
      }
      return true;
    });

    if (requirement.constraints !== undefined && !constraintTests?.every(c => c))
      return;

    // 과목 분류
    if (c.classification === null) {
      switch (type) {
        case 'basicRequired':
          c.possibleClassifications.push({ type: 'BASIC_REQUIRED' });
          c.classification = { type: 'BASIC_REQUIRED' };
          break;
        case 'basicElective':
          c.possibleClassifications.push({ type: 'BASIC_ELECTIVE' });
          c.classification = { type: 'BASIC_ELECTIVE' };
          break;
        case 'mandatoryGeneralCourses':
          c.possibleClassifications.push({ type: 'MANDATORY_GENERAL_COURSES' });
          c.classification = { type: 'MANDATORY_GENERAL_COURSES' };
          break;
        case 'humanitiesSocietyElective':
          c.possibleClassifications.push({ type: 'HUMANITIES_SOCIETY_ELECTIVE' });
          c.classification = { type: 'HUMANITIES_SOCIETY_ELECTIVE' };
          break;
        case 'major':
          c.possibleClassifications.push({ type: 'MAJOR' });
          c.classification = { type: 'MAJOR' };
          break;
        case 'doubleMajor':
          c.possibleClassifications.push({ type: 'DOUBLE_MAJOR', department: department! });
          c.classification = { type: 'DOUBLE_MAJOR', department: department! };
          break;
        case 'minor':
          c.possibleClassifications.push({ type: 'MINOR', department: department! });
          c.classification = { type: 'MINOR', department: department! };
          break;
        case 'advancedMajor':
          c.possibleClassifications.push({ type: 'ADVANCED_MAJOR' });
          c.classification = { type: 'ADVANCED_MAJOR' };
          break;
        case 'individuallyDesignedMajor':
          c.possibleClassifications.push({ type: 'INDIVIDUALLY_DESIGNED_MAJOR' });
          c.classification = { type: 'INDIVIDUALLY_DESIGNED_MAJOR' };
          break;
        case 'research':
          c.possibleClassifications.push({ type: 'RESEARCH' });
          c.classification = { type: 'RESEARCH' };
          break;
      }
    } else if (type === 'major' && c.classification?.type === 'DOUBLE_MAJOR') {
      c.possibleClassifications.push({ type: 'MAJOR' });
      c.possibleClassifications.push({ type: 'MAJOR_AND_DOUBLE_MAJOR', department: c.classification.department });
      if (doubleCountedCredits + c.course.credit > 6)
        return;
      doubleCountedCredits += c.course.credit;
      c.classification = { type: 'MAJOR_AND_DOUBLE_MAJOR', department: c.classification.department };
    } else if (type === 'doubleMajor' && c.classification?.type === 'MAJOR') {
      c.possibleClassifications.push({ type: 'DOUBLE_MAJOR', department: department! });
      c.possibleClassifications.push({ type: 'MAJOR_AND_DOUBLE_MAJOR', department: department! });
      if (doubleCountedCredits + c.course.credit > 6)
        return;
      doubleCountedCredits += c.course.credit;
      c.classification = { type: 'MAJOR_AND_DOUBLE_MAJOR', department: department! };
    }
    courses.push(c);

    // currentValue 계산 (MIN_TAGS_AMONG 제외)
    switch (requirement.type) {
      case 'MIN_COURSES_AMONG':
        currentValue += 1;
        break;
      case 'MIN_CREDITS_AMONG':
        currentValue += c.course.credit || 0;
        break;
      case 'MIN_AU_AMONG':
        currentValue += c.course.au || 0;
        break;
    }
  });

  // MIN_TAGS_AMONG은 루프 종료 후 tags.size로 설정
  if (requirement.type === 'MIN_TAGS_AMONG') {
    currentValue = tags.size;
  }

  return { currentValue, courses };
}

function checkCourseCondition(condition: CourseCondition, course: CourseSimulation, department?: string, departments?: string[]) {
  if (condition.codes !== undefined) {
    if (!condition.codes.includes(course.course.code))
      return false;
  }
  if (condition.categories !== undefined) {
    if (!condition.categories.includes(course.course.category))
      return false;
  }
  if (condition.departments !== undefined) {
    if (condition.departments[0] !== 'NOT_AFFILIATED') {
      if (!condition.departments.includes(course.course.department))
        return false;
    } else {
      if (departments?.includes(course.course.department))
        return false;
    }
  }
  if (department !== undefined) {
    if (course.course.department !== department)
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

function checkCourseConditions(conditions: CourseCondition[], course: CourseSimulation, department?: string, departments?: string[]) {
  return conditions.some(c => checkCourseCondition(c, course, department, departments));
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

export function classifyCourses(enrolledCourses: CourseSimulation[], requirements: RequirementsProps, majorDepartment: string) {
  // 초기화
  let resultCourses = [...enrolledCourses];
  resultCourses.forEach(c => {
    if (['F', 'W', 'NR', 'U'].includes(c.grade))
      c.classification = { type: 'UNRECOGNIZED' };
    else
      c.classification = null;
    c.possibleClassifications = [];
  });

  // 연구
  if (requirements.research !== undefined) {
    requirements.research.forEach((requirement) => {
      const { currentValue } = testCourses(resultCourses, requirement, 'research');
      requirement.currentValue = currentValue;
    });
  }
  
  // 심전
  if (requirements.advanced !== undefined) {
    requirements.advanced.forEach((requirement) => {
      const { currentValue } = testCourses(resultCourses, requirement, 'advancedMajor');
      requirement.currentValue = currentValue;
    });
  }

  // 주전공 (타학과 과목 제외)
  requirements.major.forEach(requirement => {
    const { currentValue } = testCourses(resultCourses, requirement, 'major', majorDepartment);
    requirement.currentValue = currentValue;
  });

  // 복전 (타학과 과목 제외)
  if (requirements.doubleMajors) {
    Object.entries(requirements.doubleMajors).forEach(([department, rqs]) => {
      rqs.forEach(requirement => {
        const { currentValue } = testCourses(resultCourses, requirement, 'doubleMajor', department);
        requirement.currentValue = currentValue;
      });
    });
  }

  // 부전 (타학과 과목 제외)
  if (requirements.minors) {
    Object.entries(requirements.minors).forEach(([department, rqs]) => {
      rqs.forEach(requirement => {
        const { currentValue } = testCourses(resultCourses, requirement, 'minor', department);
        requirement.currentValue = currentValue;
      });
    });
  }

  // 주전공 (타학과 과목 포함)
  requirements.major.forEach(requirement => {
    const { currentValue } = testCourses(resultCourses, requirement, 'major', undefined, true);
    requirement.currentValue = currentValue;
  });

  // 복전 (타학과 과목 포함)
  if (requirements.doubleMajors) {
    Object.entries(requirements.doubleMajors).forEach(([department, rqs]) => {
      rqs.forEach(requirement => {
        const { currentValue } = testCourses(resultCourses, requirement, 'doubleMajor', department, true);
        requirement.currentValue = currentValue;
      });
    });
  }

  // 부전 (타학과 과목 포함)
  if (requirements.minors) {
    Object.entries(requirements.minors).forEach(([department, rqs]) => {
      rqs.forEach(requirement => {
        const { currentValue } = testCourses(resultCourses, requirement, 'minor', department, true);
        requirement.currentValue = currentValue;
      });
    });
  }

  // 자유융합전공
  if (requirements.individuallyDesignedMajor !== undefined) {
    requirements.individuallyDesignedMajor.forEach((requirement) => {
      const { currentValue } = testCourses(resultCourses, requirement, 'individuallyDesignedMajor', undefined, true, [majorDepartment, ...Object.keys(requirements.doubleMajors || []), ...Object.keys(requirements.minors || [])]);
      requirement.currentValue = currentValue;
    });
  }

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

  console.log('계산 안 함:', resultCourses.filter(c => c.classification?.type === 'UNRECOGNIZED'));

  resultCourses.forEach((c) => {
    if (c.specifiedClassification)
      c.classification = c.specifiedClassification;
  });

  return { enrolledCourses: resultCourses, requirements };
}
