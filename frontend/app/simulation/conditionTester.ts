import { CourseSimulation, Requirement } from "./types";

export interface CourseCondition {
  codes?: string[];
  categories?: string[];
  departments?: string[];
  tags?: string[];
  firstDigits?: number[];
}

function checkCourseCondition(condition: CourseCondition, course: CourseSimulation, department?: string, departments?: string[]) {
  if (condition.codes !== undefined) {
    if (!condition.codes.includes(course.course.code))
      return false;
  }
  if (condition.categories !== undefined) {
    if (!condition.categories.includes(course.course.category)) {
      // 대학원 선택 과목 상호인정 처리
      if (course.course.level === 'GR' && course.course.category === 'GE' && course.course.crossRecognition) { // Honor Student에 대한 처리 필요
        if (!condition.categories.includes('ME'))
          return false;
      } else
        return false;
    }
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



/** 지정된 과목을 주어진 졸업요건 달성 여부 계산에 반영합니다. */
function encrementRequirementCurrentValue(course: CourseSimulation, requirements: Requirement[]) {
  requirements.forEach(requirement => {
    const testResult = checkCourseConditions(requirement.targets || [], course);

    if (testResult) {
      switch (requirement.type) {
        case 'MIN_CREDITS_AMONG':
          requirement.currentValue! += course.course.credit;
          break;
        case 'MIN_AU_AMONG':
          requirement.currentValue! += course.course.au;
          break;
        case 'MIN_COURSES_AMONG':
          requirement.currentValue! += 1;
          break;
      }

      if (!requirement.usedCourses)
        requirement.usedCourses = [];
      requirement.usedCourses.push(course);
    }
  });
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

/** 요건 키(MAJOR:제목, DOUBLE_MAJOR:학과:제목 등)에 대응하는 타입·배열·단일 요건 */
export interface ResolvedRequirementKey {
  type: 'MAJOR' | 'DOUBLE_MAJOR' | 'MINOR' | 'ADVANCED_MAJOR' | 'INDIVIDUALLY_DESIGNED_MAJOR' | 'RESEARCH';
  department?: string;
  requirementArray: Requirement[];
  /** 키에 해당하는 단일 요건(제목 일치). 배정 시 제약·남은 학점 계산에 사용 */
  requirement: Requirement | undefined;
}

function resolveRequirementKey(key: string, requirements: RequirementsProps): ResolvedRequirementKey | null {
  const parts = key.split(':');
  if (parts.length < 2) return null;
  const [kind, second, third] = parts;
  switch (kind) {
    case 'MAJOR': {
      const requirement = requirements.major.find(r => r.title === second);
      return { type: 'MAJOR', requirementArray: requirements.major, requirement };
    }
    case 'DOUBLE_MAJOR':
      if (!second || !requirements.doubleMajors?.[second]) return null;
      return {
        type: 'DOUBLE_MAJOR',
        department: second,
        requirementArray: requirements.doubleMajors[second],
        requirement: requirements.doubleMajors[second].find(r => r.title === third),
      };
    case 'MINOR':
      if (!second || !requirements.minors?.[second]) return null;
      return {
        type: 'MINOR',
        department: second,
        requirementArray: requirements.minors[second],
        requirement: requirements.minors[second].find(r => r.title === third),
      };
    case 'ADVANCED_MAJOR':
      return {
        type: 'ADVANCED_MAJOR',
        requirementArray: requirements.advanced || [],
        requirement: requirements.advanced?.find(r => r.title === second),
      };
    case 'INDIVIDUALLY_DESIGNED_MAJOR':
      return {
        type: 'INDIVIDUALLY_DESIGNED_MAJOR',
        requirementArray: requirements.individuallyDesignedMajor || [],
        requirement: requirements.individuallyDesignedMajor?.find(r => r.title === second),
      };
    case 'RESEARCH':
      return {
        type: 'RESEARCH',
        requirementArray: requirements.research || [],
        requirement: requirements.research?.find(r => r.title === second),
      };
    default:
      return null;
  }
}

/** 제약(타학과 최대 인정 등) 위반 여부: 이 과목을 추가하면 constraint를 넘는가 */
function wouldViolateConstraint(
  requirementArray: Requirement[],
  course: CourseSimulation,
  department: string | undefined,
  departments?: string[], // NOT_AFFILIATED 조건을 위한 제외할 학과 목록
): boolean {
  return requirementArray
    .map(requirement => {
      const used = requirement.usedCourses || [];
      for (const constraint of requirement.constraints || []) {
        const targets = constraint.targets || [];
        const currentlyMatching = used.filter(c => checkCourseConditions(targets, c, undefined, departments));
        const courseMatches = checkCourseConditions(targets, course, undefined, departments);
        const newMatching = courseMatches ? [...currentlyMatching, course] : currentlyMatching;
        switch (constraint.type) {
          case 'MAX_CREDITS_AMONG': {
            const total = newMatching.reduce((s, c) => s + c.course.credit, 0);
            if (total > (constraint.value ?? 0)) return true;
            break;
          }
          case 'MAX_COURSES_AMONG':
            if (newMatching.length > (constraint.value ?? 0)) return true;
            break;
          case 'MAX_AU_AMONG': {
            const total = newMatching.reduce((s, c) => s + c.course.au, 0);
            if (total > (constraint.value ?? 0)) return true;
            break;
          }
        }
      }
      return false;
    })
    .some(b => b);
}

/** 특정 요건 키에 대해 배정 가능한 미배정 과목 목록(제약·중복인정 한도·심전 상한 반영) */
function getAssignableCourses(
  keyInfo: ResolvedRequirementKey,
  currentlyUnspecified: CourseSimulation[],
  majorDepartment: string,
  _overlapCreditsUsed: number,
  _maxMajorDoubleMajorOverlapCredits: number,
  allRequirements: RequirementsProps,
): CourseSimulation[] {
  const { type, department, requirement } = keyInfo;
  const req = requirement;
  const dep = type === 'MAJOR' ? majorDepartment : department;
  const idMajorDepartments = type === 'INDIVIDUALLY_DESIGNED_MAJOR'
    ? [majorDepartment, ...Object.keys(allRequirements.doubleMajors || {}), ...Object.keys(allRequirements.minors || {})]
    : undefined;

  return currentlyUnspecified.filter(course => {
    const canBe = (t: string, d?: string) => {
      if (t === 'MAJOR')
        return course.possibleClassifications.some(cl => cl?.type === 'MAJOR' || cl?.type === 'MAJOR_AND_DOUBLE_MAJOR');
      if (t === 'DOUBLE_MAJOR' && d)
        return course.possibleClassifications.some(cl =>
          (cl?.type === 'DOUBLE_MAJOR' || cl?.type === 'MAJOR_AND_DOUBLE_MAJOR') && cl.department === d);
      if (t === 'MINOR' && d)
        return course.possibleClassifications.some(cl => cl?.type === 'MINOR' && cl.department === d);
      if (t === 'ADVANCED_MAJOR')
        return course.possibleClassifications.some(cl => cl?.type === 'ADVANCED_MAJOR');
      if (t === 'INDIVIDUALLY_DESIGNED_MAJOR')
        return course.possibleClassifications.some(cl => cl?.type === 'INDIVIDUALLY_DESIGNED_MAJOR');
      if (t === 'RESEARCH')
        return course.possibleClassifications.some(cl => cl?.type === 'RESEARCH');
      return false;
    };

    if (!canBe(type, department)) return false;
    if (req && !checkCourseConditions(req.targets || [], course, dep, idMajorDepartments))
      return false;
    // requirementArray의 모든 requirement에 대해 constraint 확인 (배정 시 모두 확인되므로)
    // MAJOR의 경우 majorDepartment를 제외할 학과 목록으로 전달 (타학과 필터링용)
    const excludeDepartments = type === 'MAJOR' ? [majorDepartment] : undefined;
    if (wouldViolateConstraint(keyInfo.requirementArray, course, dep, excludeDepartments))
      return false;

    return true;
  });
}


/** 주전공·복수전공 간 중복 인정 최대 학점(기본 6). 3+3 조합 등을 위해 사용. */
const DEFAULT_MAX_MAJOR_DOUBLE_MAJOR_OVERLAP_CREDITS = 6;

/**
 *  메인 함수:
 *  수강한 과목들을 바탕으로 요건별 달성 여부를 계산합니다.
 */
export function classifyCourses(
  enrolledCourses: CourseSimulation[],
  requirements: RequirementsProps,
  majorDepartment: string,
  maxMajorDoubleMajorOverlapCredits: number = DEFAULT_MAX_MAJOR_DOUBLE_MAJOR_OVERLAP_CREDITS,
) {
  /* 1단계: 수강 내역 정렬, 학점 인정 분야 초기화, 낙제·재수강한 과목 무효 처리 */

  let resultCourses = [...enrolledCourses].sort((a, b) => {
    if (a.enrolledYear === b.enrolledYear) {
      const semesterOrderA = ['SPRING', 'SUMMER', 'FALL', 'WINTER'].indexOf(a.enrolledSemester);
      const semesterOrderB = ['SPRING', 'SUMMER', 'FALL', 'WINTER'].indexOf(b.enrolledSemester);
      return semesterOrderA - semesterOrderB;
    } else
      return a.enrolledYear - b.enrolledYear;
  });
  resultCourses.forEach(c => {
    if (['F', 'W', 'NR', 'U'].includes(c.grade))
      c.classification = { type: 'UNRECOGNIZED' };
    else {
      const enrollmentsOfSameCourse = resultCourses.filter(ec => ec.course.code === c.course.code);
      if (enrollmentsOfSameCourse.length > 1) {
        // 재수강한 이력이 있음
        const finalEnrollment = enrollmentsOfSameCourse[enrollmentsOfSameCourse.length - 1];
        const isFinalEnrollment = finalEnrollment.enrolledYear === c.enrolledYear && finalEnrollment.enrolledSemester === c.enrolledSemester;
        if (isFinalEnrollment)
          // 최종 수강 이력인 경우
          c.classification = null;
        else
          // 아닌 경우 (성적 무효)
          c.classification = { type: 'UNRECOGNIZED' };
      } else
        // 재수강한 이력이 없음
        c.classification = null;
    }
    c.possibleClassifications = [];
  });

  const resetRequirement = (r: Requirement) => {
    r.currentValue = 0;
    r.usedCourses = [];
  };
  requirements.basicRequired.forEach(resetRequirement);
  requirements.basicElective.forEach(resetRequirement);
  requirements.major.forEach(resetRequirement);
  requirements.advanced?.forEach(resetRequirement);
  requirements.research?.forEach(resetRequirement);
  Object.keys(requirements.doubleMajors || {}).forEach(department => {
    (requirements.doubleMajors || {})[department].forEach(resetRequirement);
  });
  Object.keys(requirements.minors || {}).forEach(department => {
    (requirements.minors || {})[department].forEach(resetRequirement);
  });
  requirements.individuallyDesignedMajor?.forEach(resetRequirement);
  requirements.mandatoryGeneralCourses.forEach(requirement => {
    requirement.currentValue = 0;
  });
  requirements.humanitiesSocietyElective.forEach(requirement => {
    requirement.currentValue = 0;
  });


  /* 2단계: 과목별 인정 가능 분야 계산 */

  resultCourses.forEach(c => {
    if (c.classification !== null && c.classification !== undefined)
      return;

    // 기필
    requirements.basicRequired.forEach(requirement => {
      const testResult = checkCourseConditions(requirement.targets || [], c);
      if (testResult) {
        if ([...c.possibleClassifications].every(cl => cl?.type !== 'BASIC_REQUIRED'))
          c.possibleClassifications.push({ type: 'BASIC_REQUIRED' });
      }
    });

    // 기선
    requirements.basicElective.forEach(requirement => {
      const testResult = checkCourseConditions(requirement.targets || [], c);
      if (testResult) {
        if ([...c.possibleClassifications].every(cl => cl?.type !== 'BASIC_ELECTIVE'))
          c.possibleClassifications.push({ type: 'BASIC_ELECTIVE' });
        if ([...c.possibleClassifications].every(cl => cl?.type !== 'OTHER_ELECTIVE'))
          c.possibleClassifications.push({ type: 'OTHER_ELECTIVE' });
      }
    });

    // 주전공
    requirements.major.forEach(requirement => {
      const testResult = checkCourseConditions(requirement.targets || [], c);
      if (testResult) {
        if ([...c.possibleClassifications].every(cl => cl?.type !== 'MAJOR'))
          c.possibleClassifications.push({ type: 'MAJOR' });
        if ([...c.possibleClassifications].every(cl => cl?.type !== 'OTHER_ELECTIVE'))
          c.possibleClassifications.push({ type: 'OTHER_ELECTIVE' });
      }
    });

    // 심화전공
    requirements.advanced?.forEach(requirements => {
      const testResult = checkCourseConditions(requirements.targets || [], c);
      if (testResult) {
        if ([...c.possibleClassifications].every(cl => cl?.type !== 'ADVANCED_MAJOR'))
          c.possibleClassifications.push({ type: 'ADVANCED_MAJOR' });
        if ([...c.possibleClassifications].every(cl => cl?.type !== 'OTHER_ELECTIVE'))
          c.possibleClassifications.push({ type: 'OTHER_ELECTIVE' });
      }
    });

    // 연구
    requirements.research?.forEach(requirements => {
      const testResult = checkCourseConditions(requirements.targets || [], c);
      if (testResult) {
        if ([...c.possibleClassifications].every(cl => cl?.type !== 'RESEARCH'))
          c.possibleClassifications.push({ type: 'RESEARCH' });
        if ([...c.possibleClassifications].every(cl => cl?.type !== 'OTHER_ELECTIVE'))
          c.possibleClassifications.push({ type: 'OTHER_ELECTIVE' });
      }
    });

    // 복수전공
    Object.keys(requirements.doubleMajors || {}).forEach(department => {
      (requirements.doubleMajors || {})[department].forEach(requirements => {
        const testResult = checkCourseConditions(requirements.targets || [], c);
        if (testResult) {
          if ([...c.possibleClassifications].every(cl => cl?.type !== 'DOUBLE_MAJOR' || (cl?.type === 'DOUBLE_MAJOR' && cl.department !== department)))
            c.possibleClassifications.push({ type: 'DOUBLE_MAJOR', department });
          if ([...c.possibleClassifications].every(cl => {
            return cl?.type !== 'MAJOR_AND_DOUBLE_MAJOR' || (cl?.type === 'MAJOR_AND_DOUBLE_MAJOR' && cl.department !== department)
          }) && [...c.possibleClassifications].some(cl => cl?.type === 'MAJOR'))
            c.possibleClassifications.push({ type: 'MAJOR_AND_DOUBLE_MAJOR', department });
          if ([...c.possibleClassifications].every(cl => cl?.type !== 'OTHER_ELECTIVE'))
            c.possibleClassifications.push({ type: 'OTHER_ELECTIVE' });
        }
      });
    });

    // 부전공
    Object.keys(requirements.minors || {}).forEach(department => {
      (requirements.minors || {})[department].forEach(requirements => {
        const testResult = checkCourseConditions(requirements.targets || [], c);
        if (testResult) {
          if ([...c.possibleClassifications].every(cl => cl?.type !== 'MINOR' || (cl?.type === 'MINOR' && cl.department !== department)))
            c.possibleClassifications.push({ type: 'MINOR', department });
          if ([...c.possibleClassifications].every(cl => cl?.type !== 'OTHER_ELECTIVE'))
            c.possibleClassifications.push({ type: 'OTHER_ELECTIVE' });
        }
      });
    });

    // 자유융합전공
    requirements.individuallyDesignedMajor?.forEach(requirement => {
      const departments = [majorDepartment, ...Object.keys(requirements.doubleMajors || []), ...Object.keys(requirements.minors || [])];
      const testResult = checkCourseConditions(requirement.targets || [], c, undefined, departments);
      if (testResult) {
        if ([...c.possibleClassifications].every(cl => cl?.type !== 'INDIVIDUALLY_DESIGNED_MAJOR'))
          c.possibleClassifications.push({ type: 'INDIVIDUALLY_DESIGNED_MAJOR' });
        if ([...c.possibleClassifications].every(cl => cl?.type !== 'OTHER_ELECTIVE'))
          c.possibleClassifications.push({ type: 'OTHER_ELECTIVE' });
      }
    });

    // 교양필수
    requirements.mandatoryGeneralCourses.forEach(requirement => {
      const testResult = checkCourseConditions(requirement.targets || [], c);
      if (testResult)
        if ([...c.possibleClassifications].every(cl => cl?.type !== 'MANDATORY_GENERAL_COURSES'))
          c.possibleClassifications.push({ type: 'MANDATORY_GENERAL_COURSES' });
    });

    // 인문사회선택
    requirements.humanitiesSocietyElective.forEach(requirement => {
      const testResult = checkCourseConditions(requirement.targets || [], c);
      if (testResult) {
        if ([...c.possibleClassifications].every(cl => cl?.type !== 'HUMANITIES_SOCIETY_ELECTIVE'))
          c.possibleClassifications.push({ type: 'HUMANITIES_SOCIETY_ELECTIVE' });
        if ([...c.possibleClassifications].every(cl => cl?.type !== 'OTHER_ELECTIVE'))
          c.possibleClassifications.push({ type: 'OTHER_ELECTIVE' });
      }
    });

    let indexOE = c.possibleClassifications.findIndex(cl => cl?.type === 'OTHER_ELECTIVE');
    if (indexOE > -1) {
      c.possibleClassifications.splice(indexOE, 1);
      c.possibleClassifications.push({ type: 'OTHER_ELECTIVE' });
    }
  });
  
  // 나머지: 자선
  resultCourses.forEach(c => {
    if ((c.classification === null || c.classification === undefined) && c.possibleClassifications.length < 1) {
      c.possibleClassifications.push({ type: 'OTHER_ELECTIVE' });
      c.classification = { type: 'OTHER_ELECTIVE' };
    }
  });


  /* 3단계: 사용자가 직접 지정한 과목들 처리 */

  resultCourses.forEach(course => {
    if (course.specifiedClassification === null || course.specifiedClassification === undefined)
      return;

    switch (course.specifiedClassification?.type) {
      case 'MAJOR':
        encrementRequirementCurrentValue(course, requirements.major);
        break;

      case 'MAJOR_AND_DOUBLE_MAJOR':
        encrementRequirementCurrentValue(course, requirements.major);
        if (requirements.doubleMajors)
          encrementRequirementCurrentValue(course, requirements.doubleMajors[course.specifiedClassification.department]);
        break;
      
      case 'ADVANCED_MAJOR':
        if (requirements.advanced)
          encrementRequirementCurrentValue(course, requirements.advanced);
        break;

      case 'RESEARCH':
        if (requirements.research)
          encrementRequirementCurrentValue(course, requirements.research);
        break;

      case 'DOUBLE_MAJOR':
        if (requirements.doubleMajors)
          encrementRequirementCurrentValue(course, requirements.doubleMajors[course.specifiedClassification.department]);
        break;

      case 'MINOR':
        if (requirements.minors)
          encrementRequirementCurrentValue(course, requirements.minors[course.specifiedClassification.department]);
        break;

      case 'INDIVIDUALLY_DESIGNED_MAJOR':
        if (requirements.individuallyDesignedMajor)
          encrementRequirementCurrentValue(course, requirements.individuallyDesignedMajor);
        break;
    }
  });


  /* 4단계: 필수 요건 배정 (다른 분야에 배정될 일 없는 것) */

  // 기필
  resultCourses
    .filter(course => {
      const isBR = course.possibleClassifications.some(classification => classification?.type === 'BASIC_REQUIRED');
      const isUnspecified = course.classification === null || course.classification === undefined;
      const isUnspecifiedByUser = course.specifiedClassification === null || course.specifiedClassification === undefined;
      return isBR && isUnspecified && isUnspecifiedByUser;
    })
    .forEach(course => {
      course.classification = { type: 'BASIC_REQUIRED' };
      encrementRequirementCurrentValue(course, requirements.basicRequired);
    });
  
  // 기선
  resultCourses
    .filter(course => {
      const isBR = course.possibleClassifications.some(classification => classification?.type === 'BASIC_ELECTIVE');
      const isUnspecified = course.classification === null || course.classification === undefined;
      const isUnspecifiedByUser = course.specifiedClassification === null || course.specifiedClassification === undefined;
      return isBR && isUnspecified && isUnspecifiedByUser;
    })
    .forEach(course => {
      course.classification = { type: 'BASIC_ELECTIVE' };
      encrementRequirementCurrentValue(course, requirements.basicElective);
    });

  // 교필
  resultCourses
    .filter(course => {
      const isMGC = course.possibleClassifications.some(classification => classification?.type === 'MANDATORY_GENERAL_COURSES');
      const isUnspecified = course.classification === null || course.classification === undefined;
      const isUnspecifiedByUser = course.specifiedClassification === null || course.specifiedClassification === undefined;
      return isMGC && isUnspecified && isUnspecifiedByUser;
    })
    .forEach(course => {
      course.classification = { type: 'MANDATORY_GENERAL_COURSES' };
      encrementRequirementCurrentValue(course, requirements.mandatoryGeneralCourses);
    });

  // 인선
  resultCourses
    .filter(course => {
      const isHSE = course.possibleClassifications.some(classification => classification?.type === 'HUMANITIES_SOCIETY_ELECTIVE');
      const isUnspecified = course.classification === null || course.classification === undefined;
      const isUnspecifiedByUser = course.specifiedClassification === null || course.specifiedClassification === undefined;
      return isHSE && isUnspecified && isUnspecifiedByUser;
    })
    .forEach(course => {
      course.classification = { type: 'HUMANITIES_SOCIETY_ELECTIVE' };
      encrementRequirementCurrentValue(course, requirements.humanitiesSocietyElective);
    });

  // 주전공 (인정 분야가 이것뿐인 과목)
  resultCourses
    .filter(course => {
      const isMajor = course.possibleClassifications.some(classification => classification?.type === 'MAJOR');
      const isUnspecified = course.classification === null || course.classification === undefined;
      const isUnspecifiedByUser = course.specifiedClassification === null || course.specifiedClassification === undefined;
      const hasSinglePossibility = course.possibleClassifications.length < 3; // 자유선택 고려
      return isMajor && isUnspecified && isUnspecifiedByUser && hasSinglePossibility;
    })
    .forEach(course => {
      // 배정 직전 constraint 확인 (currentValue가 이미 업데이트된 상태를 반영)
      if (wouldViolateConstraint(requirements.major, course, majorDepartment, [majorDepartment]))
        return;
      course.classification = { type: 'MAJOR' };
      encrementRequirementCurrentValue(course, requirements.major);
    });
  
  // 복수전공 (인정 분야가 이것뿐인 과목)
  Object.entries(requirements.doubleMajors || {}).forEach(([ department, requirementArray ]) => {
    resultCourses
      .filter(course => {
        const isDoubleMajor = course.possibleClassifications.some(classification => classification?.type === 'DOUBLE_MAJOR' && classification.department === department);
        const isUnspecified = course.classification === null || course.classification === undefined;
        const isUnspecifiedByUser = course.specifiedClassification === null || course.specifiedClassification === undefined;
        const hasSinglePossibility = course.possibleClassifications.length < 3; // 자유선택 고려
        return isDoubleMajor && isUnspecified && isUnspecifiedByUser && hasSinglePossibility;
      })
      .forEach(course => {
        // 배정 직전 constraint 확인
        if (wouldViolateConstraint(requirementArray, course, department))
          return;
        course.classification = { type: 'DOUBLE_MAJOR', department };
        encrementRequirementCurrentValue(course, requirementArray);
      });
  });

  // 부전공 (인정 분야가 이것뿐인 과목)
  Object.entries(requirements.minors || {}).forEach(([ department, requirementArray ]) => {
    resultCourses
      .filter(course => {
        const isMinor = course.possibleClassifications.some(classification => classification?.type === 'MINOR' && classification.department === department);
        const isUnspecified = course.classification === null || course.classification === undefined;
        const isUnspecifiedByUser = course.specifiedClassification === null || course.specifiedClassification === undefined;
        const hasSinglePossibility = course.possibleClassifications.length < 3; // 자유선택 고려
        return isMinor && isUnspecified && isUnspecifiedByUser && hasSinglePossibility;
      })
      .forEach(course => {
        // 배정 직전 constraint 확인
        if (wouldViolateConstraint(requirementArray, course, department))
          return;
        course.classification = { type: 'MINOR', department };
        encrementRequirementCurrentValue(course, requirementArray);
      });
  });

  // 연구 (인정 분야가 이것뿐인 과목)
  if (requirements.research) {
    const researchReqArray = requirements.research;
    resultCourses
      .filter(course => {
        const isResearch = course.possibleClassifications.some(classification => classification?.type === 'RESEARCH');
        const isUnspecified = course.classification === null || course.classification === undefined;
        const isUnspecifiedByUser = course.specifiedClassification === null || course.specifiedClassification === undefined;
        const hasSinglePossibility = course.possibleClassifications.length < 3; // 자유선택 고려
        return isResearch && isUnspecified && isUnspecifiedByUser && hasSinglePossibility;
      })
      .forEach(course => {
        // 배정 직전 constraint 확인
        if (wouldViolateConstraint(researchReqArray, course, undefined))
          return;
        course.classification = { type: 'RESEARCH' };
        encrementRequirementCurrentValue(course, researchReqArray);
      });
  }

  // 자유융합전공 (인정 분야가 이것뿐인 과목)
  if (requirements.individuallyDesignedMajor) {
    const idMajorReqArray = requirements.individuallyDesignedMajor;
    const idMajorDepartments = [majorDepartment, ...Object.keys(requirements.doubleMajors || {}), ...Object.keys(requirements.minors || {})];
    resultCourses
      .filter(course => {
        const isIndividuallyDesignedMajor = course.possibleClassifications.some(classification => classification?.type === 'INDIVIDUALLY_DESIGNED_MAJOR');
        const isUnspecified = course.classification === null || course.classification === undefined;
        const isUnspecifiedByUser = course.specifiedClassification === null || course.specifiedClassification === undefined;
        const hasSinglePossibility = course.possibleClassifications.length < 3; // 자유선택 고려
        return isIndividuallyDesignedMajor && isUnspecified && isUnspecifiedByUser && hasSinglePossibility;
      })
      .forEach(course => {
        // 배정 직전 constraint 확인
        if (wouldViolateConstraint(idMajorReqArray, course, undefined, idMajorDepartments))
          return;
        course.classification = { type: 'INDIVIDUALLY_DESIGNED_MAJOR' };
        encrementRequirementCurrentValue(course, idMajorReqArray);
      });
  }


  /* 5단계: 여러 분야에 배정 가능한 과목들 처리 */

  let overlapCreditsUsed = 0; // 주전공·복수전공 중복 인정 사용 학점

  while (true) {
    /* 5.1. 각 요건별 배정 가능한 과목에 따라 점수를 매김 */
    const requirementScores: Record<string, number> = {};

    const currentlyUnspecifiedCourses = resultCourses.filter(course => {
      const isUnspecified = course.classification === null || course.classification === undefined;
      const isUnspecifiedByUser = course.specifiedClassification === null || course.specifiedClassification === undefined;
      return isUnspecified && isUnspecifiedByUser;
    });

    if (currentlyUnspecifiedCourses.length < 1)
      break;

    // 주전
    const majorTargetCourses = currentlyUnspecifiedCourses
      .filter(course => {
        return course.possibleClassifications.some(classification => classification?.type === 'MAJOR');
      });
    requirements.major.forEach(requirement => {
      if (!requirement.value) return;
      const denominator = requirement.value - (requirement.currentValue || 0);
      if (denominator <= 0) return;
      const key = `MAJOR:${requirement.title}`;
      let numerator = 0;
      switch (requirement.type) {
        case 'MIN_CREDITS_AMONG':
          numerator = majorTargetCourses.reduce((pv, c) => pv + c.course.credit, 0);
          break;
        case 'MIN_COURSES_AMONG':
          numerator = majorTargetCourses.length;
          break;
      }
      requirementScores[key] = numerator / denominator;
    });

    // 복전
    Object.entries(requirements.doubleMajors || {}).forEach(([department, requirementArray]) => {
      const doubleMajorTargetCourses = currentlyUnspecifiedCourses.filter(course =>
        course.possibleClassifications.some(classification =>
          (classification?.type === 'DOUBLE_MAJOR' || classification?.type === 'MAJOR_AND_DOUBLE_MAJOR') && classification.department === department
        )
      );
      requirementArray.forEach(requirement => {
        if (!requirement.value) return;
        const denominator = requirement.value - (requirement.currentValue || 0);
        if (denominator <= 0) return;
        const key = `DOUBLE_MAJOR:${department}:${requirement.title}`;
        let numerator = 0;
        switch (requirement.type) {
          case 'MIN_CREDITS_AMONG':
            numerator = doubleMajorTargetCourses.reduce((pv, c) => pv + c.course.credit, 0);
            break;
          case 'MIN_COURSES_AMONG':
            numerator = doubleMajorTargetCourses.length;
            break;
        }
        requirementScores[key] = numerator / denominator;
      });
    });

    // 부전
    Object.entries(requirements.minors || {}).forEach(([department, requirementArray]) => {
      const minorTargetCourses = currentlyUnspecifiedCourses.filter(course =>
        course.possibleClassifications.some(classification => classification?.type === 'MINOR' && classification.department === department)
      );
      requirementArray.forEach(requirement => {
        if (!requirement.value) return;
        const denominator = requirement.value - (requirement.currentValue || 0);
        if (denominator <= 0) return;
        const key = `MINOR:${department}:${requirement.title}`;
        let numerator = 0;
        switch (requirement.type) {
          case 'MIN_CREDITS_AMONG':
            numerator = minorTargetCourses.reduce((pv, c) => pv + c.course.credit, 0);
            break;
          case 'MIN_COURSES_AMONG':
            numerator = minorTargetCourses.length;
            break;
        }
        requirementScores[key] = numerator / denominator;
      });
    });

    // 심전
    const advancedMajorTargetCourses = currentlyUnspecifiedCourses.filter(course =>
      course.possibleClassifications.some(classification => classification?.type === 'ADVANCED_MAJOR')
    );
    requirements.advanced?.forEach(requirement => {
      if (!requirement.value) return;
      const denominator = requirement.value - (requirement.currentValue || 0);
      if (denominator <= 0) return;
      const key = `ADVANCED_MAJOR:${requirement.title}`;
      let numerator = 0;
      switch (requirement.type) {
        case 'MIN_CREDITS_AMONG':
          numerator = advancedMajorTargetCourses.reduce((pv, c) => pv + c.course.credit, 0);
          break;
        case 'MIN_COURSES_AMONG':
          numerator = advancedMajorTargetCourses.length;
          break;
      }
      requirementScores[key] = numerator / denominator;
    });

    // 자유융합전공
    const individuallyDesignedMajorTargetCourses = currentlyUnspecifiedCourses.filter(course =>
      course.possibleClassifications.some(classification => classification?.type === 'INDIVIDUALLY_DESIGNED_MAJOR')
    );
    requirements.individuallyDesignedMajor?.forEach(requirement => {
      if (!requirement.value) return;
      const denominator = requirement.value - (requirement.currentValue || 0);
      if (denominator <= 0) return;
      const key = `INDIVIDUALLY_DESIGNED_MAJOR:${requirement.title}`;
      let numerator = 0;
      switch (requirement.type) {
        case 'MIN_CREDITS_AMONG':
          numerator = individuallyDesignedMajorTargetCourses.reduce((pv, c) => pv + c.course.credit, 0);
          break;
        case 'MIN_COURSES_AMONG':
          numerator = individuallyDesignedMajorTargetCourses.length;
          break;
      }
      requirementScores[key] = numerator / denominator;
    });

    // 연구
    const researchTargetCourses = currentlyUnspecifiedCourses.filter(course =>
      course.possibleClassifications.some(classification => classification?.type === 'RESEARCH')
    );
    requirements.research?.forEach(requirement => {
      if (!requirement.value) return;
      const denominator = requirement.value - (requirement.currentValue || 0);
      if (denominator <= 0) return;
      const key = `RESEARCH:${requirement.title}`;
      let numerator = 0;
      switch (requirement.type) {
        case 'MIN_CREDITS_AMONG':
          numerator = researchTargetCourses.reduce((pv, c) => pv + c.course.credit, 0);
          break;
        case 'MIN_COURSES_AMONG':
          numerator = researchTargetCourses.length;
          break;
      }
      requirementScores[key] = numerator / denominator;
    });

    /* 5.2. 우선 과목을 배정해야 할 요건 결정 */

    // 희소성: 값 오름차순(점수 낮을수록 공급 부족 → 우선). 자유융합전공은 맨 뒤.
    const sortedByScore = Object.entries(requirementScores)
      .sort((a, b) => a[1] - b[1]);
    const requirementKeysByPriority: string[] = [
      ...sortedByScore.filter(([k]) => !k.startsWith('INDIVIDUALLY_DESIGNED_MAJOR:')).map(([k]) => k),
      ...sortedByScore.filter(([k]) => k.startsWith('INDIVIDUALLY_DESIGNED_MAJOR:')).map(([k]) => k),
    ];

    let assigned = false;
    for (const key of requirementKeysByPriority) {
      const keyInfo = resolveRequirementKey(key, requirements);
      if (!keyInfo?.requirement) continue;
      const req = keyInfo.requirement;
      const remaining = (req.value ?? 0) - (req.currentValue ?? 0);
      if (remaining <= 0) continue;

      /* 5.3. 배정할 과목 결정 */

      const assignable = getAssignableCourses(
        keyInfo,
        currentlyUnspecifiedCourses,
        majorDepartment,
        overlapCreditsUsed,
        maxMajorDoubleMajorOverlapCredits,
        requirements,
      );
      if (assignable.length === 0) continue;

      // 희소성: 다른 요건에도 쓸 수 있는 과목 수가 적은 과목 우선(가장 희소한 과목 선택)
      const keyCountPerCourse = new Map<string, number>();
      for (const k of requirementKeysByPriority) {
        const info = resolveRequirementKey(k, requirements);
        if (!info?.requirement) continue;
        const r = (info.requirement.value ?? 0) - (info.requirement.currentValue ?? 0);
        if (r <= 0) continue;
        const assignableForK = getAssignableCourses(info, currentlyUnspecifiedCourses, majorDepartment, overlapCreditsUsed, maxMajorDoubleMajorOverlapCredits, requirements);
        assignableForK.forEach(c => keyCountPerCourse.set(c.courseId, (keyCountPerCourse.get(c.courseId) ?? 0) + 1));
      }
      // 심전만: 지정 학점 이상 채우되 초과 최소화. 그 외는 초과 무관, 중복인정 가능한 한 많이 사용.
      const reqVal = keyInfo.requirement?.value ?? 0;
      const curVal = keyInfo.requirement?.currentValue ?? 0;
      const pick = assignable.slice().sort((a, b) => {
        // 심전이고 학점 조건일 때만: 지정 학점 이상 채우되 초과 최소화
        if (keyInfo.type === 'ADVANCED_MAJOR' && keyInfo.requirement?.type === 'MIN_CREDITS_AMONG' && reqVal > 0) {
          const overflowA = (curVal + a.course.credit) - reqVal;
          const overflowB = (curVal + b.course.credit) - reqVal;
          const meetsA = overflowA >= 0;
          const meetsB = overflowB >= 0;
          if (meetsA && !meetsB) return -1;
          if (!meetsA && meetsB) return 1;
          if (meetsA && meetsB) return overflowA - overflowB; // 초과 적은 쪽 우선
          return overflowB - overflowA; // 아직 미달이면 진행량 큰 쪽 우선
        }
        const na = keyCountPerCourse.get(a.courseId) ?? 0;
        const nb = keyCountPerCourse.get(b.courseId) ?? 0;
        if (na !== nb) return na - nb;
        // 3학점 우선(중복인정 3+3), 그다음 1·2학점
        const priority = (c: number) => (c === 3 ? 0 : c === 1 ? 1 : c === 2 ? 2 : 3);
        return priority(a.course.credit) - priority(b.course.credit) || a.course.credit - b.course.credit;
      })[0];
      const course = pick!;

      const { type, department, requirementArray } = keyInfo;
      const credit = course.course.credit;

      /* 5.4. 지정된 과목 배정 */

      const canAlsoBeDoubleMajor = type === 'MAJOR' && course.possibleClassifications.some(cl =>
        (cl?.type === 'DOUBLE_MAJOR' || cl?.type === 'MAJOR_AND_DOUBLE_MAJOR'));
      const canAlsoBeMajor = type === 'DOUBLE_MAJOR' && course.possibleClassifications.some(cl => cl?.type === 'MAJOR' || cl?.type === 'MAJOR_AND_DOUBLE_MAJOR');
      const otherDept = type === 'MAJOR' && requirements.doubleMajors
        ? Object.keys(requirements.doubleMajors).find(d =>
            (requirements.doubleMajors![d]!.some(r => (r.value ?? 0) - (r.currentValue ?? 0) > 0)) &&
            course.possibleClassifications.some(cl => (cl?.type === 'DOUBLE_MAJOR' || cl?.type === 'MAJOR_AND_DOUBLE_MAJOR') && cl.department === d)
          )
        : undefined;
      const majorHasNeed = requirements.major.some(r => (r.value ?? 0) - (r.currentValue ?? 0) > 0);
      
      // 중복인정 가능 여부 확인 (학점 한도 + constraint 확인)
      let useOverlap = false;
      if (type === 'MAJOR' && canAlsoBeDoubleMajor && otherDept != null) {
        const doubleMajorArray = requirements.doubleMajors![otherDept]!;
        const wouldViolateMajor = wouldViolateConstraint(requirements.major, course, majorDepartment, [majorDepartment]);
        const wouldViolateDoubleMajor = wouldViolateConstraint(doubleMajorArray, course, otherDept);
        useOverlap = !wouldViolateMajor && !wouldViolateDoubleMajor && overlapCreditsUsed + credit <= maxMajorDoubleMajorOverlapCredits;
      } else if (type === 'DOUBLE_MAJOR' && canAlsoBeMajor && majorHasNeed && department) {
        const doubleMajorArray = requirements.doubleMajors![department]!;
        const wouldViolateMajor = wouldViolateConstraint(requirements.major, course, majorDepartment, [majorDepartment]);
        const wouldViolateDoubleMajor = wouldViolateConstraint(doubleMajorArray, course, department);
        useOverlap = !wouldViolateMajor && !wouldViolateDoubleMajor && overlapCreditsUsed + credit <= maxMajorDoubleMajorOverlapCredits;
      }

      if (useOverlap && type === 'MAJOR' && otherDept != null) {
        course.classification = { type: 'MAJOR_AND_DOUBLE_MAJOR', department: otherDept };
        encrementRequirementCurrentValue(course, requirements.major);
        encrementRequirementCurrentValue(course, requirements.doubleMajors![otherDept]!);
        overlapCreditsUsed += credit;
      } else if (useOverlap && type === 'DOUBLE_MAJOR' && department) {
        course.classification = { type: 'MAJOR_AND_DOUBLE_MAJOR', department };
        encrementRequirementCurrentValue(course, requirements.major);
        encrementRequirementCurrentValue(course, requirements.doubleMajors![department]!);
        overlapCreditsUsed += credit;
      } else {
        if (type === 'MAJOR')
          course.classification = { type: 'MAJOR' };
        else if (type === 'DOUBLE_MAJOR' && department)
          course.classification = { type: 'DOUBLE_MAJOR', department };
        else if (type === 'MINOR' && department)
          course.classification = { type: 'MINOR', department };
        else if (type === 'ADVANCED_MAJOR')
          course.classification = { type: 'ADVANCED_MAJOR' };
        else if (type === 'INDIVIDUALLY_DESIGNED_MAJOR')
          course.classification = { type: 'INDIVIDUALLY_DESIGNED_MAJOR' };
        else if (type === 'RESEARCH')
          course.classification = { type: 'RESEARCH' };
        encrementRequirementCurrentValue(course, requirementArray);
      }
      assigned = true;
      break;
    }
    if (!assigned) break;
  }


  /* 6단계: 남은 과목들 자유선택으로 처리 */

  resultCourses
    .filter(course => {
      const isUnspecified = course.classification === null || course.classification === undefined;
      const isUnspecifiedByUser = course.specifiedClassification === null || course.specifiedClassification === undefined;
      const hasOE = course.possibleClassifications.some(classification => classification?.type === 'OTHER_ELECTIVE');
      return isUnspecified && isUnspecifiedByUser && hasOE;
    })
    .forEach(course => {
      course.classification = { type: 'OTHER_ELECTIVE' };
    });

  return { enrolledCourses: resultCourses, requirements };
}
