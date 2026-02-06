import type { CourseSimulation, Requirement } from './types';
import type { RequirementsProps } from './conditionTester';

/** 시뮬레이션 필터 (전공·복전·부전 등) */
export interface SimulationSectionFilters {
  major: string;
  doubleMajors: string[];
  minors: string[];
  advancedMajor: boolean;
  individuallyDesignedMajor: boolean;
}

/** 섹션: 분류별 과목 목록 + 요건/달성 여부 */
export interface Section {
  id: string;
  title: string;
  titleElements: string[];
  courses: CourseSimulation[];
  fulfilled: boolean;
  requirements?: Requirement[];
}

export interface BuildSectionsOptions {
  /** 학과 id → 이름. 있으면 "주전공: OO학과" 형태로 표시 */
  getDeptName?: (id: string) => string;
  /** 자유선택·미분류 섹션 포함 여부 (시나리오 목록 canGraduate 계산 시 false) */
  includeOtherAndUnclassified?: boolean;
}

const sortByCode = (a: CourseSimulation, b: CourseSimulation) =>
  a.course.code.localeCompare(b.course.code);

/**
 * classifyCourses로 분류된 과목 목록으로 섹션 배열을 만듦 (과목만, requirements/fulfilled 없음).
 */
export function buildSectionsFromClassifiedCourses(
  enrolledCourses: CourseSimulation[],
  filters: SimulationSectionFilters,
  options: BuildSectionsOptions = {}
): Section[] {
  const { getDeptName = () => '', includeOtherAndUnclassified = true } = options;
  const out: Section[] = [];
  const majorName = filters.major ? getDeptName(filters.major) : '';

  out.push({
    id: 'BASIC_REQUIRED',
    title: '기초필수',
    titleElements: ['기초필수'],
    courses: enrolledCourses.filter((c) => c.classification?.type === 'BASIC_REQUIRED').sort(sortByCode),
    fulfilled: false,
  });
  out.push({
    id: 'BASIC_ELECTIVE',
    title: '기초선택',
    titleElements: ['기초선택'],
    courses: enrolledCourses.filter((c) => c.classification?.type === 'BASIC_ELECTIVE').sort(sortByCode),
    fulfilled: false,
  });

  if (filters.major) {
    out.push({
      id: `MAJOR_${filters.major}`,
      title: majorName ? `주전공: ${majorName}` : '주전공',
      titleElements: majorName ? ['주전공', majorName] : ['주전공'],
      courses: enrolledCourses
        .filter((c) => c.classification?.type === 'MAJOR' || c.classification?.type === 'MAJOR_AND_DOUBLE_MAJOR')
        .sort(sortByCode),
      fulfilled: false,
    });
    if (filters.advancedMajor) {
      out.push({
        id: 'ADVANCED_MAJOR',
        title: '심화전공',
        titleElements: ['심화전공'],
        courses: enrolledCourses.filter((c) => c.classification?.type === 'ADVANCED_MAJOR').sort(sortByCode),
        fulfilled: false,
      });
    }
    out.push({
      id: `RESEARCH_${filters.major}`,
      title: '연구',
      titleElements: ['연구'],
      courses: enrolledCourses.filter((c) => c.classification?.type === 'RESEARCH').sort(sortByCode),
      fulfilled: false,
    });
  }

  (filters.doubleMajors || []).forEach((id) => {
    out.push({
      id: `DOUBLE_MAJOR_${id}`,
      title: `복수전공: ${getDeptName(id)}`,
      titleElements: ['복수전공', getDeptName(id)],
      courses: enrolledCourses
        .filter(
          (c) =>
            (c.classification?.type === 'DOUBLE_MAJOR' && c.classification?.department === id) ||
            (c.classification?.type === 'MAJOR_AND_DOUBLE_MAJOR' && c.classification?.department === id)
        )
        .sort(sortByCode),
      fulfilled: false,
    });
  });

  (filters.minors || []).forEach((id) => {
    out.push({
      id: `MINOR_${id}`,
      title: `부전공: ${getDeptName(id)}`,
      titleElements: ['부전공', getDeptName(id)],
      courses: enrolledCourses
        .filter((c) => c.classification?.type === 'MINOR' && c.classification?.department === id)
        .sort(sortByCode),
      fulfilled: false,
    });
  });

  if (filters.individuallyDesignedMajor) {
    out.push({
      id: 'INDIVIDUALLY_DESIGNED_MAJOR',
      title: '자유융합전공',
      titleElements: ['자유융합전공'],
      courses: enrolledCourses
        .filter((c) => c.classification?.type === 'INDIVIDUALLY_DESIGNED_MAJOR')
        .sort(sortByCode),
      fulfilled: false,
    });
  }

  out.push({
    id: 'MANDATORY_GENERAL_COURSES',
    title: '교양필수',
    titleElements: ['교양필수'],
    courses: enrolledCourses
      .filter((c) => c.classification?.type === 'MANDATORY_GENERAL_COURSES')
      .sort(sortByCode),
    fulfilled: false,
  });
  out.push({
    id: 'HUMANITIES_SOCIETY_ELECTIVE',
    title: '인문사회선택',
    titleElements: ['인문사회선택'],
    courses: enrolledCourses
      .filter((c) => c.classification?.type === 'HUMANITIES_SOCIETY_ELECTIVE')
      .sort(sortByCode),
    fulfilled: false,
  });

  if (includeOtherAndUnclassified) {
    out.push({
      id: 'OTHER_ELECTIVE',
      title: '자유선택',
      titleElements: ['자유선택'],
      courses: enrolledCourses.filter((c) => c.classification?.type === 'OTHER_ELECTIVE').sort(sortByCode),
      fulfilled: false,
    });
    out.push({
      id: 'UNCLASSIFIED',
      title: '미분류',
      titleElements: ['미분류'],
      courses: enrolledCourses.filter((c) => c.classification === undefined).sort(sortByCode),
      fulfilled: false,
    });
  }

  return out;
}

/**
 * 섹션 배열에 요건을 붙이고 fulfilled를 계산함. (requirements 객체의 fulfilled 필드는 갱신됨)
 */
export function assignRequirementsToSections(
  sections: Section[],
  requirements: RequirementsProps,
  filters: SimulationSectionFilters
): Section[] {
  return sections.map((section) => {
    let sectionRequirements: Requirement[] = [];
    if (section.id === 'BASIC_REQUIRED') {
      sectionRequirements = requirements.basicRequired || [];
    } else if (section.id === 'BASIC_ELECTIVE') {
      sectionRequirements = requirements.basicElective || [];
    } else if (section.id.startsWith('MAJOR_') && filters.major) {
      sectionRequirements = requirements.major || [];
    } else if (section.id === 'ADVANCED_MAJOR' && filters.major && filters.advancedMajor) {
      sectionRequirements = requirements.advanced || [];
    } else if (section.id.startsWith('RESEARCH_') && filters.major) {
      sectionRequirements = requirements.research || [];
    } else if (section.id.startsWith('DOUBLE_MAJOR_')) {
      const department = section.id.replace('DOUBLE_MAJOR_', '');
      sectionRequirements = requirements.doubleMajors?.[department] || [];
    } else if (section.id.startsWith('MINOR_')) {
      const department = section.id.replace('MINOR_', '');
      sectionRequirements = requirements.minors?.[department] || [];
    } else if (section.id === 'INDIVIDUALLY_DESIGNED_MAJOR') {
      sectionRequirements = requirements.individuallyDesignedMajor || [];
    } else if (section.id === 'MANDATORY_GENERAL_COURSES') {
      sectionRequirements = requirements.mandatoryGeneralCourses || [];
    } else if (section.id === 'HUMANITIES_SOCIETY_ELECTIVE') {
      sectionRequirements = requirements.humanitiesSocietyElective || [];
    }

    sectionRequirements.forEach((r) => {
      r.fulfilled = r.value === undefined ? true : (r.currentValue || 0) >= (r.value || 0);
    });
    const fulfilled =
      sectionRequirements.length === 0 || sectionRequirements.every((r) => r.fulfilled);

    return {
      ...section,
      requirements: sectionRequirements,
      fulfilled,
    };
  });
}

/**
 * classifyCourses 후 섹션 생성 + 요건 부착을 한 번에 수행.
 */
export function buildSectionsWithRequirements(
  enrolledCourses: CourseSimulation[],
  requirements: RequirementsProps,
  filters: SimulationSectionFilters,
  options: BuildSectionsOptions = {}
): Section[] {
  const sections = buildSectionsFromClassifiedCourses(enrolledCourses, filters, options);
  return assignRequirementsToSections(sections, requirements, filters);
}

/** 섹션을 UI 그룹(기초 / 주전공·심화·연구 / 복전·부전·교필 등 / 자선·미분류)으로 묶음 */
export interface GroupedSections {
  basicGroup: Section[];
  majorGroup: Section[];
  otherSections: Section[];
  miscSections: Section[];
}

export function groupSections(sections: Section[]): GroupedSections {
  const basicGroup: Section[] = [];
  const majorGroup: Section[] = [];
  const otherSections: Section[] = [];
  const miscSections: Section[] = [];

  sections.forEach((s) => {
    if (s.id.match(/^BASIC_/)) {
      basicGroup.push(s);
    } else if (s.id.match(/^MAJOR_/) || s.id === 'ADVANCED_MAJOR' || s.id.match(/^RESEARCH_/)) {
      majorGroup.push(s);
    } else if (s.id === 'OTHER_ELECTIVE' || s.id === 'UNCLASSIFIED') {
      miscSections.push(s);
    } else {
      otherSections.push(s);
    }
  });

  return { basicGroup, majorGroup, otherSections, miscSections };
}
