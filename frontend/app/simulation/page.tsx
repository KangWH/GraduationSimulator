'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DepartmentDropdown, MultipleDepartmentDropdown } from '../components/DepartmentDropdown';
import { NumberInput, Select, Input } from '../components/formFields';
import { CourseCategoryDropdown } from '../components/CourseCategoryDropdown';
import { API } from '../lib/api';
import type { Profile, Enrollment, RawEnrollment, Semester, Grade, Course } from '../profile/settings/types';
import type { CourseSimulation, RawCourseSimulation, CreditType, Requirement } from './types';
import AddCoursePanel from '../profile/settings/AddCoursePanel';
import EnrollmentsList from '../profile/settings/EnrollmentsList';
import { group } from 'console';
import { classifyCourses, getMatches, RequirementsProps } from './conditionTester';
import Logo from '../components/Logo';

type Dept = { id: string; name: string };
type Section = {
  id: string;
  title: string;
  titleElements: string[];
  courses: CourseSimulation[];
  fulfilled: boolean;
  requirements?: Array<{ title: string; description: string; value?: number; currentValue?: number; }>;
};

export default function SimulationPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [previousSimulations, setPreviousSimulations] = useState<Array<{
    id: string;
    name: string;
    date: string;
    canGraduate?: boolean;
  }>>([]);
  const [depts, setDepts] = useState<Dept[]>([]);

  const [filters, setFilters] = useState({
    requirementYear: new Date().getFullYear(),
    major: '',
    doubleMajors: [] as string[],
    minors: [] as string[],
    advancedMajor: false,
    individuallyDesignedMajor: false,
  });
  const [simulationCourses, setSimulationCourses] = useState<CourseSimulation[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [addToEnrollments, setAddToEnrollments] = useState(false);
  const [currentSimulationId, setCurrentSimulationId] = useState<string | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 과목 추가/선택 모드
  const [courseMode, setCourseMode] = useState<'add' | 'view'>('add');
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const selectedCourseIdsRef = useRef<Set<string>>(new Set());
  
  // selectedCourseIds와 ref를 동시에 업데이트하는 함수
  const updateSelectedCourseIds = useCallback((newIds: Set<string>) => {
    selectedCourseIdsRef.current = newIds;
    setSelectedCourseIds(newIds);
  }, []);
  const [addYear, setAddYear] = useState(new Date().getFullYear());
  const [addSemester, setAddSemester] = useState<Semester>('SPRING');
  const [addGrade, setAddGrade] = useState<Grade>('A+');
  const [addAsPriorCredit, setAddAsPriorCredit] = useState(false);
  const [filterDepartment, setFilterDepartment] = useState<string>('none');
  const [filterCategory, setFilterCategory] = useState<string>('none');
  const [draggedEnrollment, setDraggedEnrollment] = useState<CourseSimulation | null>(null);
  const [draggedFromSemester, setDraggedFromSemester] = useState<string | null>(null);
  const [draggedCourse, setDraggedCourse] = useState<any | null>(null);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const prevSimulationCoursesRef = useRef<CourseSimulation[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      fetch(`${API}/departments`).then((r) => r.json()),
      fetch(`${API}/courseCategories`).then((r) => r.json()),
    ]).then(([depts, cats]) => {
      setDepts(Array.isArray(depts) ? depts : []);
      setCategories(Array.isArray(cats) ? cats : []);
    }).catch(() => {});
  }, []);

  const getDepartmentName = (deptId: string | undefined): string => {
    if (!deptId) return '';
    const dept = depts.find((d) => d.id === deptId);
    return dept ? dept.name : deptId;
  };

  const getCategoryName = (catId: string | undefined): string => {
    if (!catId) return '';
    const cat = categories.find((c) => c.id === catId);
    return cat ? cat.name : catId;
  };

  // 프로필 정보 로드 및 필터 초기화
  useEffect(() => {
    if (profileLoaded) return;
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
    if (!userId) return;

    const loadProfile = () =>
      fetch(`${API}/profile?userId=${encodeURIComponent(userId!)}`, { credentials: 'include' })
        .then((r) => r.json());

    const loadMe = () =>
      fetch(`${API}/auth/me?userId=${encodeURIComponent(userId!)}`, { credentials: 'include' })
        .then((r) => r.json());

    const loadSimulations = () =>
      fetch(`${API}/simulation?userId=${encodeURIComponent(userId!)}`, { credentials: 'include' })
        .then((r) => r.json());

    Promise.all([loadProfile(), loadMe(), loadSimulations()])
      .then(([profileRes, meRes, simulationsRes]) => {
        if (profileRes.success && profileRes.profile) {
          const p = profileRes.profile as Profile;
          setProfile(p);
          setFilters({
            requirementYear: p.admissionYear || new Date().getFullYear(),
            major: p.major || '',
            doubleMajors: Array.isArray(p.doubleMajors) ? p.doubleMajors : [],
            minors: Array.isArray(p.minors) ? p.minors : [],
            advancedMajor: p.advancedMajor || false,
            individuallyDesignedMajor: p.individuallyDesignedMajor || false,
          });
          setUserName(p.name || '');

          // 초기 데이터 생성
          initializeSimulationData(p);
        }
        if (meRes.success && meRes.user) {
          setUserName((prev) => prev || meRes.user.email || '');
        }
        if (simulationsRes.success) {
          const sims = (simulationsRes.simulations || []).map((sim: any) => ({
            id: sim.id,
            name: sim.title,
            date: new Date(sim.updatedAt).toLocaleDateString('ko-KR'),
            canGraduate: false, // TODO: 졸업가능 여부 계산 로직 추가 필요
          }));
          setPreviousSimulations(sims);
        }
        setProfileLoaded(true);
      })
      .catch(() => setProfileLoaded(true));
  }, [profileLoaded]);

  // 초기 시뮬레이션 데이터 생성
  const initializeSimulationData = useCallback(async (profileData: Profile) => {
    if (!profileData) return;

    // 프로필의 수강 내역 가져오기
    try {
      const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
      if (!userId) return;

      const enrollmentsRes = await fetch(`${API}/profile/enrollments?userId=${encodeURIComponent(userId)}`, {
        credentials: 'include',
      });
      const enrollmentsData = await enrollmentsRes.json();

      let rawEnrollments: RawEnrollment[] = [];
      if (enrollmentsData.success && enrollmentsData.enrollments) {
        const raw = enrollmentsData.enrollments;
        if (Array.isArray(raw)) {
          rawEnrollments = raw as RawEnrollment[];
        } else if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            rawEnrollments = Array.isArray(parsed) ? (parsed as RawEnrollment[]) : [];
          } catch {
            rawEnrollments = [];
          }
        }
      }

      // Enrollment[]로 변환
      const enrollments = await convertToEnrollments(rawEnrollments);

      // CourseSimulation[]로 변환 (recognizedAs 추가)
      const courseSimulations = convertEnrollmentsToCourseSimulations(enrollments, profileData);

      setSimulationCourses(courseSimulations);
    } catch (error) {
      console.error('초기 데이터 생성 오류:', error);
      setSimulationCourses([]);
    }
  }, []);

  const deptName = (id: string) => depts.find((d) => d.id === id)?.name ?? id;

  // RawEnrollment[]를 Enrollment[]로 변환
  async function convertToEnrollments(rawEnrollments: RawEnrollment[]): Promise<Enrollment[]> {
    const enrollments: Enrollment[] = [];
    for (const raw of rawEnrollments) {
      try {
        // courseId는 이제 UUID (고유 ID)
        const courseRes = await fetch(`${API}/courses?id=${encodeURIComponent(raw.courseId)}`);
        const courses = await courseRes.json();
        const course = Array.isArray(courses) && courses.length > 0 ? courses[0] : null;
        if (course) {
          enrollments.push({
            courseId: raw.courseId, // UUID 저장
            course: {
              id: course.id || raw.courseId,
              code: course.code || '',
              title: course.title || '',
              department: course.department || '',
              category: course.category || '',
              credit: course.credit || 0,
              au: course.au || 0,
              tags: course.tags || [],
            },
            enrolledYear: raw.enrolledYear,
            enrolledSemester: raw.enrolledSemester,
            grade: raw.grade,
          });
        }
      } catch (error) {
        console.error(`Failed to fetch course ${raw.courseId}:`, error);
      }
    }
    return enrollments;
  }

  // 과목의 category와 프로필 정보를 기반으로 recognizedAs 결정
  function determineRecognizedAs(
    course: Course,
    profileData: Profile
  ): CreditType {
    const category = course.category;
    const department = course.department;

    // BR -> BASIC_REQUIRED
    if (category === 'BR') {
      return { type: 'BASIC_REQUIRED' };
    }

    // BE -> BASIC_ELECTIVE
    if (category === 'BE') {
      return { type: 'BASIC_ELECTIVE' };
    }

    // MR, ME, GE
    if (category === 'MR' || category === 'ME' || category === 'GE') {
      // 개설학과가 주전공 학과인 경우
      if (department === profileData.major) {
        return { type: 'MAJOR' };
      }
      // 개설학과가 복수전공 학과인 경우
      if (profileData.doubleMajors && profileData.doubleMajors.includes(department)) {
        return { type: 'DOUBLE_MAJOR', department };
      }
      // 개설학과가 부전공 학과인 경우
      if (profileData.minors && profileData.minors.includes(department)) {
        return { type: 'MINOR', department };
      }
      // 어디에도 속하지 않으면서 individuallyDesignedMajor가 true인 경우
      if (profileData.individuallyDesignedMajor) {
        return { type: 'INDIVIDUALLY_DESIGNED_MAJOR' };
      }
      // 그 외
      return { type: 'OTHER_ELECTIVE' };
    }

    // MGC -> MANDATORY_GENERAL_COURSES
    if (category === 'MGC') {
      return { type: 'MANDATORY_GENERAL_COURSES' };
    }

    // HSE -> HUMANITIES_SOCIETY_ELECTIVE
    if (category === 'HSE' || category === 'HS') {
      return { type: 'HUMANITIES_SOCIETY_ELECTIVE' };
    }

    // RS -> RESEARCH
    if (category === 'RS') {
      return { type: 'RESEARCH' };
    }

    // OE, 기타 -> OTHER_ELECTIVE
    return { type: 'OTHER_ELECTIVE' };
  }

  // Enrollment[]를 CourseSimulation[]로 변환 (recognizedAs 추가)
  function convertEnrollmentsToCourseSimulations(
    enrollments: Enrollment[],
    profileData: Profile
  ): CourseSimulation[] {
    return enrollments.map((e) => ({
      ...e,
      // recognizedAs: determineRecognizedAs(e.course, profileData),
      recognizedAs: null,
      internalRecognizedAs: null
    }));
  }

  // RawCourseSimulation[]를 CourseSimulation[]로 변환
  async function convertRawSimulationsToCourseSimulations(
    rawSimulations: RawCourseSimulation[],
    profileData: Profile
  ): Promise<CourseSimulation[]> {
    const courseSimulations: CourseSimulation[] = [];
    for (const raw of rawSimulations) {
      try {
        // courseId는 이제 UUID (고유 ID)
        const courseRes = await fetch(`${API}/courses?id=${encodeURIComponent(raw.courseId)}`);
        const courses = await courseRes.json();
        const course = Array.isArray(courses) && courses.length > 0 ? courses[0] : null;
        if (course) {
          courseSimulations.push({
            courseId: raw.courseId, // UUID 저장
            course: {
              id: course.id || raw.courseId,
              code: course.code || '',
              title: course.title || '',
              department: course.department || '',
              category: course.category || '',
              credit: course.credit || 0,
              au: course.au || 0,
              tags: course.tags || 0,
            },
            enrolledYear: raw.enrolledYear,
            enrolledSemester: raw.enrolledSemester,
            grade: raw.grade,
            recognizedAs: raw.recognizedAs,
            internalRecognizedAs: raw.recognizedAs
          });
        }
      } catch (error) {
        console.error(`Failed to fetch course ${raw.courseId}:`, error);
      }
    }
    return courseSimulations;
  }

  // 저장된 시뮬레이션 로드
  const loadSimulation = useCallback(async (simulationId: string) => {
    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
    if (!userId || !profile) return;

    try {
      const res = await fetch(`${API}/simulation/${simulationId}?userId=${encodeURIComponent(userId)}`, {
        credentials: 'include',
      });
      const data = await res.json();

      if (!data.success || !data.simulation) {
        alert(data.message || '시뮬레이션을 불러오는데 실패했습니다.');
        return;
      }

      const sim = data.simulation;

      // 필터 업데이트
      setFilters({
        requirementYear: sim.referenceYear || new Date().getFullYear(),
        major: sim.major || '',
        doubleMajors: Array.isArray(sim.doubleMajors) ? sim.doubleMajors : [],
        minors: Array.isArray(sim.minors) ? sim.minors : [],
        advancedMajor: sim.advancedMajor || false,
        individuallyDesignedMajor: sim.individuallyDesignedMajor || false,
      });

      // courses 파싱 및 변환
      let rawCourses: RawCourseSimulation[] = [];
      if (sim.courses) {
        if (Array.isArray(sim.courses)) {
          rawCourses = sim.courses as RawCourseSimulation[];
        } else if (typeof sim.courses === 'string') {
          try {
            const parsed = JSON.parse(sim.courses);
            rawCourses = Array.isArray(parsed) ? (parsed as RawCourseSimulation[]) : [];
          } catch {
            rawCourses = [];
          }
        }
      }

      // CourseSimulation[]로 변환
      const courseSimulations = await convertRawSimulationsToCourseSimulations(rawCourses, profile);
      setSimulationCourses(courseSimulations);
      setCurrentSimulationId(simulationId);
    } catch (error) {
      console.error('시뮬레이션 로드 오류:', error);
      alert('시뮬레이션을 불러오는 중 오류가 발생했습니다.');
    }
  }, [profile]);

  // 자동 저장 함수
  const autoSave = useCallback(async () => {
    if (!currentSimulationId || !profile) return;

    const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
    if (!userId) return;

    // RawCourseSimulation[]로 변환
    const rawCourses: RawCourseSimulation[] = simulationCourses.map((cs) => ({
      courseId: cs.courseId,
      enrolledYear: cs.enrolledYear,
      enrolledSemester: cs.enrolledSemester,
      grade: cs.grade,
      recognizedAs: cs.recognizedAs,
    }));

    try {
      const res = await fetch(`${API}/simulation/${currentSimulationId}?userId=${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId,
          referenceYear: filters.requirementYear,
          major: filters.major,
          doubleMajors: filters.doubleMajors,
          minors: filters.minors,
          advancedMajor: filters.advancedMajor,
          individuallyDesignedMajor: filters.individuallyDesignedMajor,
          courses: rawCourses,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        console.error('자동 저장 실패:', data.message);
      }
    } catch (error) {
      console.error('자동 저장 오류:', error);
    }
  }, [currentSimulationId, profile, simulationCourses, filters]);

  // simulationCourses나 filters 변경 시 자동 저장 (debounce)
  useEffect(() => {
    if (!currentSimulationId) return;

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSave();
    }, 1000); // 1초 후 자동 저장

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [simulationCourses, filters, currentSimulationId, autoSave]);

  // 학기별로 그룹화
  function groupBySemester(simulations: CourseSimulation[]): Map<string, CourseSimulation[]> {
    const map = new Map<string, CourseSimulation[]>();
    simulations.forEach((s) => {
      const key = `${s.enrolledYear}-${s.enrolledSemester}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(s);
    });
    return map;
  }

  // 오늘보다 이른 학기 중 가장 가까운 학기 찾기
  function findNearestPastSemester(): { year: number; semester: Semester } {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11

    // 학기 판단: 봄(3-5), 여름(6-7), 가을(9-11), 겨울(12-2)
    let currentSemester: Semester = 'SPRING';
    if (currentMonth >= 2 && currentMonth <= 4) currentSemester = 'SPRING';
    else if (currentMonth >= 5 && currentMonth <= 6) currentSemester = 'SUMMER';
    else if (currentMonth >= 8 && currentMonth <= 10) currentSemester = 'FALL';
    else currentSemester = 'WINTER';

    // 현재 학기보다 이전 학기 찾기
    const semesterOrder: Semester[] = ['SPRING', 'SUMMER', 'FALL', 'WINTER'];
    let year = currentYear;
    let semesterIndex = semesterOrder.indexOf(currentSemester) - 1;

    if (semesterIndex < 0) {
      year--;
      semesterIndex = semesterOrder.length - 1;
    }

    return { year, semester: semesterOrder[semesterIndex] };
  }

  // 서버 검색
  useEffect(() => {
    const hasQuery = !!courseSearchQuery.trim();
    const hasDept = !!(filterDepartment && filterDepartment !== 'none');
    const hasCat = !!(filterCategory && filterCategory !== 'none');

    if (!hasQuery && !hasDept && !hasCat) {
      setSearchResults([]);
      if (selectedCourseIdsRef.current.size > 0) {
        updateSelectedCourseIds(new Set());
      }
      return;
    }

    const timeoutId = setTimeout(() => {
      const params = new URLSearchParams();
      if (hasQuery) {
        params.append('query', courseSearchQuery.trim());
      }
      if (hasDept) {
        params.append('department', filterDepartment);
      }
      if (hasCat) {
        params.append('category', filterCategory);
      }

      fetch(`${API}/courses?${params.toString()}`)
        .then((r) => {
          if (!r.ok) {
            throw new Error(`HTTP error! status: ${r.status}`);
          }
          return r.json();
        })
        .then((courses) => {
          const newResults = Array.isArray(courses) ? courses : [];
          setSearchResults(newResults);
          
          // 검색 결과가 변경되면, 화면에서 사라진 항목은 선택 해제
          const currentSelected = selectedCourseIdsRef.current;
          if (currentSelected.size > 0) {
            const availableCourseIds = new Set(
              newResults.map((c) => c.id || c.code || '').filter((id) => id !== '')
            );
            const filteredSelected = new Set(
              Array.from(currentSelected).filter((id) => availableCourseIds.has(id))
            );
            if (filteredSelected.size !== currentSelected.size) {
              updateSelectedCourseIds(filteredSelected);
            }
          }
        })
        .catch((error) => {
          console.error('Error fetching courses:', error);
          setSearchResults([]);
          // 에러 발생 시 선택 해제
          if (selectedCourseIdsRef.current.size > 0) {
            updateSelectedCourseIds(new Set());
          }
        });
    }, 500); // 디바운스

    return () => clearTimeout(timeoutId);
  }, [courseSearchQuery, filterDepartment, filterCategory, updateSelectedCourseIds]);

  // 선택된 과목 추가
  const handleAddSelected = useCallback(() => {
    if (!profile) return;
    if (selectedCourseIds.size === 0) {
      alert('추가할 과목을 선택해주세요.');
      return;
    }

    const newCourses = [...simulationCourses];
    const targetSemester = addAsPriorCredit
      ? { year: 0, semester: 'SPRING' as Semester }
      : { year: addYear, semester: addSemester };

    let addedCount = 0;
    selectedCourseIds.forEach((courseId) => {
      if (!courseId) return;

      // selectedCourseIds에는 course.id 또는 course.code가 들어갈 수 있음 (AddCoursePanel에서 설정)
      const course = searchResults.find((c) => {
        return c.id === courseId || c.code === courseId;
      });

      if (!course) {
        console.warn(`Course not found for courseId: ${courseId}`);
        return;
      }

      // 저장 시에는 고유 ID 사용
      const finalCourseId = course.id || courseId;
      if (!finalCourseId) {
        console.warn(`Course has no id:`, course);
        return;
      }

      // 중복 체크
      const isDuplicate = newCourses.some(
        (c) =>
          c.courseId === finalCourseId &&
          c.enrolledYear === targetSemester.year &&
          c.enrolledSemester === targetSemester.semester
      );

      if (isDuplicate) {
        console.warn(`Duplicate course: ${finalCourseId}`);
        return;
      }

      const courseObj: Course = {
        id: course.id || finalCourseId,
        code: course.code || '',
        title: course.title || '',
        department: course.department || '',
        category: course.category || '',
        credit: course.credit || 0,
        au: course.au || 0,
        tags: course.tags || [],
      };

      newCourses.push({
        courseId: finalCourseId, // UUID 저장
        course: courseObj,
        enrolledYear: targetSemester.year,
        enrolledSemester: targetSemester.semester,
        grade: addGrade,
        recognizedAs: null,
        // recognizedAs: determineRecognizedAs(courseObj, profile),
        internalRecognizedAs: null,
      });
      addedCount++;
    });

    if (addedCount === 0) {
      alert('추가할 수 있는 과목이 없습니다.');
      return;
    }

    setSimulationCourses(newCourses);
    updateSelectedCourseIds(new Set());
  }, [selectedCourseIds, searchResults, simulationCourses, profile, addYear, addSemester, addGrade, addAsPriorCredit, updateSelectedCourseIds]);

  // 성적 변경
  const handleGradeChange = useCallback(
    (simulation: CourseSimulation, newGrade: Grade) => {
      const newCourses = simulationCourses.map((c) =>
        c.courseId === simulation.courseId &&
        c.enrolledYear === simulation.enrolledYear &&
        c.enrolledSemester === simulation.enrolledSemester
          ? { ...c, grade: newGrade }
          : c
      );
      setSimulationCourses(newCourses);
    },
    [simulationCourses]
  );

  // 삭제
  const handleRemove = useCallback(
    (simulation: CourseSimulation) => {
      const newCourses = simulationCourses.filter(
        (c) =>
          !(
            c.courseId === simulation.courseId &&
            c.enrolledYear === simulation.enrolledYear &&
            c.enrolledSemester === simulation.enrolledSemester
          )
      );
      setSimulationCourses(newCourses);
    },
    [simulationCourses]
  );

  // 드래그 시작
  const handleDragStart = (e: React.DragEvent, simulation: CourseSimulation, semesterKey: string) => {
    setDraggedEnrollment(simulation);
    setDraggedFromSemester(semesterKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  // 드롭
  const handleDrop = useCallback(
    (e: React.DragEvent, targetSemesterKey: string) => {
      e.preventDefault();
      const [targetYear, targetSemester] = targetSemesterKey.split('-');

      if (draggedEnrollment) {
        const newCourses = simulationCourses
          .filter(
            (c) =>
              !(
                c.courseId === draggedEnrollment.courseId &&
                c.enrolledYear === draggedEnrollment.enrolledYear &&
                c.enrolledSemester === draggedEnrollment.enrolledSemester
              )
          )
          .map((c) => c);

        newCourses.push({
          ...draggedEnrollment,
          enrolledYear: parseInt(targetYear),
          enrolledSemester: targetSemester as Semester,
        });

        setSimulationCourses(newCourses);
        setDraggedEnrollment(null);
        setDraggedFromSemester(null);
      } else if (draggedCourse) {
        const targetSemesterObj =
          simulationCourses.length === 0
            ? findNearestPastSemester()
            : { year: parseInt(targetYear), semester: targetSemester as Semester };
        const courseId = draggedCourse.id;
        if (!courseId) {
          console.warn('Dragged course has no id:', draggedCourse);
          setDraggedCourse(null);
          return;
        }
        const courseObj: Course = {
          id: draggedCourse.id,
          code: draggedCourse.code || '',
          title: draggedCourse.title || '',
          department: draggedCourse.department || '',
          category: draggedCourse.category || '',
          credit: draggedCourse.credit || 0,
          au: draggedCourse.au || 0,
          tags: draggedCourse.tags || [],
        };

        const isDuplicate = simulationCourses.some(
          (c) =>
            c.courseId === courseId &&
            c.enrolledYear === targetSemesterObj.year &&
            c.enrolledSemester === targetSemesterObj.semester
        );

        if (isDuplicate) {
          alert('이미 해당 학기에 추가된 과목입니다.');
          setDraggedCourse(null);
          return;
        }

        const defaultGrade = (draggedCourse.au || 0) > 0 ? 'S' : 'A+';
        const newCourse: CourseSimulation = {
          courseId: courseId, // UUID 저장
          course: courseObj,
          enrolledYear: targetSemesterObj.year,
          enrolledSemester: targetSemesterObj.semester,
          grade: defaultGrade,
          recognizedAs: profile ? determineRecognizedAs(courseObj, profile) : { type: 'OTHER_ELECTIVE' },
          internalRecognizedAs: null
        };

        const newCourses = [...simulationCourses, newCourse];
        setSimulationCourses(newCourses);
        setDraggedCourse(null);
      }
    },
    [draggedEnrollment, draggedCourse, simulationCourses, profile]
  );

  // 목록 밖으로 드롭 (삭제)
  const handleDropOutside = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (draggedEnrollment) {
        handleRemove(draggedEnrollment);
        setDraggedEnrollment(null);
        setDraggedFromSemester(null);
      }
      if (draggedCourse) {
        setDraggedCourse(null);
      }
    },
    [draggedEnrollment, draggedCourse, handleRemove]
  );

  const semesterGroups = useMemo(() => groupBySemester(simulationCourses), [simulationCourses]);
  const sortedSemesterKeys = useMemo(() => {
    const keys = Array.from(semesterGroups.keys());
    return keys.sort((a, b) => {
      const [yearA, semA] = a.split('-');
      const [yearB, semB] = b.split('-');
      if (yearA !== yearB) return parseInt(yearA) - parseInt(yearB);
      const order: Semester[] = ['SPRING', 'SUMMER', 'FALL', 'WINTER'];
      return order.indexOf(semA as Semester) - order.indexOf(semB as Semester);
    });
  }, [semesterGroups]);

  // simulationCourses 변경 시 internalRecognizedAs 재계산
  useEffect(() => {
    const prev = prevSimulationCoursesRef.current;
    
    // 배열 길이 변경 체크 (추가/삭제)
    const lengthChanged = prev.length !== simulationCourses.length;
    
    // recognizedAs 속성 변경 체크
    const recognizedAsChanged = prev.some((p, i) => {
      const current = simulationCourses[i];
      if (!current) return true; // 항목이 삭제된 경우
      
      // recognizedAs 비교 (깊은 비교 필요)
      const prevRecognizedAs = JSON.stringify(p.recognizedAs);
      const currentRecognizedAs = JSON.stringify(current.recognizedAs);
      return prevRecognizedAs !== currentRecognizedAs;
    }) || simulationCourses.some((current, i) => {
      const prevItem = prev[i];
      if (!prevItem) return true; // 항목이 추가된 경우
      
      const prevRecognizedAs = JSON.stringify(prevItem.recognizedAs);
      const currentRecognizedAs = JSON.stringify(current.recognizedAs);
      return prevRecognizedAs !== currentRecognizedAs;
    });
    
    // 변경사항이 있는 경우에만 재계산
    if (lengthChanged || recognizedAsChanged) {
      if (!profile) {
        prevSimulationCoursesRef.current = simulationCourses;
        return;
      }

      let promises: Promise<{ type: string; department?: string; data: Requirement[] }>[] = [];
      promises.push((async () => {
        const res = await fetch(`${API}/rules/general?year=${profile?.admissionYear}&type=BR`);
        const data = await res.json();
        return { type: 'basicRequired', data: (data.requirements || []) as Requirement[] };
      })());
      promises.push((async () => {
        const res = await fetch(`${API}/rules/major?year=${profile?.admissionYear}&department=${profile?.major}&type=${profile?.doubleMajors.length > 1 ? 'BE_D' : 'BE'}`);
        const data = await res.json();
        return { type: 'basicElective', data: (data.requirements || []) as Requirement[] };
      })());
      promises.push((async () => {
        const res = await fetch(`${API}/rules/major?year=${filters.requirementYear}&department=${profile?.major}&type=Major`);
        const data = await res.json();
        return { type: 'major', data: (data.requirements || []) as Requirement[] };
      })());
      profile?.doubleMajors.forEach(d => {
        promises.push((async () => {
          const res = await fetch(`${API}/rules/major?year=${profile?.admissionYear}&department=${d}&type=DoubleMajor`);
          const data = await res.json();
          return { type: 'doubleMajor', department: d, data: (data.requirements || []) as Requirement[] };
        })());
      });
      profile?.minors.forEach(d => {
        promises.push((async () => {
          const res = await fetch(`${API}/rules/major?year=${profile?.admissionYear}&department=${d}&type=Minor`);
          const data = await res.json();
          return { type: 'minor', department: d, data: (data.requirements || []) as Requirement[] };
        })());
      });
      promises.push((async () => {
        const res = await fetch(`${API}/rules/major?year=${profile?.admissionYear}&department=${profile?.major}&type=AdvancedMajor`);
        const data = await res.json();
        return { type: 'advancedMajor', data: (data.requirements || []) as Requirement[] };
      })());
      promises.push((async () => {
        const res = await fetch(`${API}/rules/major?year=${profile?.admissionYear}&department=${profile?.major}&type=${profile?.doubleMajors.length > 1 ? 'RS_D' : 'RS'}`);
        const data = await res.json();
        return { type: 'research', data: (data.requirements || []) as Requirement[] };
      })());
      promises.push((async () => {
        const res = await fetch(`${API}/rules/general?year=${profile?.admissionYear}&type=IDM`);
        const data = await res.json();
        return { type: 'individuallyDesignedMajor', data: (data.requirements || []) as Requirement[] };
      })());
      promises.push((async () => {
        const res = await fetch(`${API}/rules/general?year=${profile?.admissionYear}&type=MGC`);
        const data = await res.json();
        return { type: 'mandatoryGeneralCourses', data: (data.requirements || []) as Requirement[] };
      })());
      promises.push((async () => {
        const res = await fetch(`${API}/rules/general?year=${profile?.admissionYear}&type=HSE`);
        const data = await res.json();
        return { type: 'humanitiesSocietyElective', data: (data.requirements || []) as Requirement[] };
      })());

      Promise.allSettled(promises)
        .then((results) => {
          let requirements: RequirementsProps = { basicRequired: [], basicElective: [], mandatoryGeneralCourses: [], humanitiesSocietyElective: [], major: [], doubleMajors: {}, minors: {} };

          results.forEach((result) => {
            if (result.status !== 'fulfilled')
              return;

            switch (result.value.type) {
              case 'basicRequired':
                requirements.basicRequired = result.value.data;
                break;
              case 'basicElective':
                requirements.basicElective = result.value.data;
                break;
              case 'mandatoryGeneralCourses':
                requirements.mandatoryGeneralCourses = result.value.data;
                break;
              case 'humanitiesSocietyElective':
                requirements.humanitiesSocietyElective = result.value.data;
                break;
              case 'major':
                requirements.major = result.value.data;
                break;
              case 'doubleMajor':
                requirements.doubleMajors![result.value.department!] = result.value.data
                break;
              case 'minor':
                requirements.minors![result.value.department!] = result.value.data;
                break;
              case 'advancedMajor':
                requirements.advanced = result.value.data;
                break;
              case 'individuallyDesignedMajor':
                requirements.individuallyDesignedMajor = result.value.data;
                break;
              case 'research':
                requirements.research = result.value.data;
            }
          });

          const { enrolledCourses, requirements: evaluatedRequirements } = classifyCourses(simulationCourses, requirements);
          setSimulationCourses(enrolledCourses);
          prevSimulationCoursesRef.current = enrolledCourses;

          sections.forEach(s => {
            switch (s.id) {
              case 'BASIC_REQUIRED':
                s.courses = simulationCourses.filter(c => c.internalRecognizedAs?.type === 'BASIC_REQUIRED');
                s.requirements = requirements.basicRequired;
                break;
              case 'BASIC_ELECTIVE':
                s.courses = simulationCourses.filter(c => c.internalRecognizedAs?.type === 'BASIC_ELECTIVE');
                s.requirements = requirements.basicElective;
                break;
              // TODO
            }
            s.fulfilled = s.requirements?.every(r => r.value === undefined || r.value <= (r.currentValue || 0)) || true
          });
          setSections([...sections]);
        });
    } else {
      // 변경사항이 없어도 ref는 최신 상태로 유지
      prevSimulationCoursesRef.current = simulationCourses;
    }
  }, [simulationCourses, filters]);

  // CourseSimulation[]를 Enrollment[]로 변환 (EnrollmentsList 컴포넌트 사용을 위해)
  const enrollmentsForList: Enrollment[] = simulationCourses.map((cs) => ({
    courseId: cs.courseId,
    course: cs.course,
    enrolledYear: cs.enrolledYear,
    enrolledSemester: cs.enrolledSemester,
    grade: cs.grade,
  }));

  // 섹션의 학점과 AU 총합을 계산하는 함수
  const calculateSectionCredits = useCallback((courses: CourseSimulation[]): string => {
    const totalCredit = courses.reduce((sum, c) => sum + (c.course.credit || 0), 0);
    const totalAu = courses.reduce((sum, c) => sum + (c.course.au || 0), 0);
    
    if (totalAu > 0) {
      return `${totalCredit}학점 · ${totalAu}AU`;
    }
    return `${totalCredit}학점`;
  }, []);

  // 섹션 접기/펼치기 토글
  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  // 성적을 숫자로 변환하는 함수
  const gradeToNumber = useCallback((grade: Grade): number | null => {
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
      default:
        return null;
    }
  }, []);

  // 총 이수학점, AU, 평점 계산
  const totalStats = useMemo(() => {
    const totalCredit = simulationCourses.filter(c => c.grade !== 'F' && c.grade !== 'U' && c.grade !== 'NR' && c.grade !== 'W').reduce((sum, c) => sum + (c.course.credit || 0), 0);
    const totalAu = simulationCourses.filter(c => c.grade !== 'F' && c.grade !== 'U' && c.grade !== 'NR' && c.grade !== 'W').reduce((sum, c) => sum + (c.course.au || 0), 0);
    
    // 평점 계산: F, W, U, NR, S, P는 제외, 학점이 0보다 큰 과목만 포함
    let totalGradePoints = 0;
    let totalCreditsForGPA = 0;
    
    simulationCourses.forEach((c) => {
      const credit = c.course.credit || 0;
      if (credit > 0) {
        const gradeNum = gradeToNumber(c.grade);
        if (gradeNum !== null) {
          totalGradePoints += credit * gradeNum;
          totalCreditsForGPA += credit;
        }
      }
    });
    
    const gpa = totalCreditsForGPA > 0 ? totalGradePoints / totalCreditsForGPA : 0;
    
    return {
      totalCredit,
      totalAu,
      gpa: gpa.toFixed(2),
    };
  }, [simulationCourses, gradeToNumber]);

  const baseSections = useMemo((): Section[] => {
    const out: Section[] = [];
    const majorName = filters.major ? deptName(filters.major) : '';

    const unWithdrawnCourses = simulationCourses.filter(c => c.grade !== 'W' && c.grade !== 'F' && c.grade !== 'U' && c.grade !== 'NR');

    out.push({
      id: 'BASIC_REQUIRED',
      title: '기초필수',
      titleElements: ['기초필수'],
      // courses: simulationCourses.filter(c => c.internalRecognizedAs?.type === 'BASIC_REQUIRED'),
      courses: [],
      fulfilled: false
    });
    out.push({
      id: 'BASIC_ELECTIVE',
      title: '기초선택',
      titleElements: ['기초선택'],
      courses: simulationCourses.filter(c => c.internalRecognizedAs?.type === 'BASIC_ELECTIVE'),
      fulfilled: false
    });

    if (filters.major) {
      out.push({
        id: `MAJOR_${filters.major}`,
        title: `주전공: ${majorName}`,
        titleElements: ['주전공', majorName],
        courses: simulationCourses.filter(c => c.internalRecognizedAs?.type === 'MAJOR'),
        fulfilled: false
      });
      if (filters.advancedMajor) {
        out.push({
          id: `ADVANCED_MAJOR_${filters.major}`,
          title: '심화전공',
          titleElements: ['심화전공'],
          courses: simulationCourses.filter(c => c.internalRecognizedAs?.type === 'ADVANCED_MAJOR'),
          fulfilled: false
        });
      }
    }
    if (filters.major) {
      out.push({
        id: `RESEARCH_${filters.major}`,
        title: '연구',
        titleElements: ['연구'],
        courses: simulationCourses.filter(c => c.internalRecognizedAs?.type === 'RESEARCH'),
        fulfilled: false
      });
    }

    (filters.doubleMajors || []).forEach(id => {
      out.push({
        id: `DOUBLE_MAJOR_${id}`,
        title: `복수전공: ${deptName(id)}`,
        titleElements: ['복수전공', deptName(id)],
        courses: simulationCourses.filter(c => (c.internalRecognizedAs?.type === 'DOUBLE_MAJOR' && c.internalRecognizedAs?.department === id)),
        fulfilled: false
      });
    });

    (filters.minors || []).forEach(id => {
      out.push({
        id: `MINOR_${id}`,
        title: `부전공: ${deptName(id)}`,
        titleElements: ['부전공', deptName(id)],
        courses: simulationCourses.filter(c => (c.internalRecognizedAs?.type === 'MINOR' && c.internalRecognizedAs?.department === id)),
        fulfilled: false,
      });
    });

    if (filters.individuallyDesignedMajor) {
      out.push({
        id: 'INDIVIDUALLY_DESIGNED_MAJOR',
        title: '자유융합전공',
        titleElements: ['자유융합전공'],
        courses: simulationCourses.filter(c => c.internalRecognizedAs?.type === 'INDIVIDUALLY_DESIGNED_MAJOR'),
        fulfilled: false
      });
    }

    out.push({
      id: 'MANDATORY_GENERAL_COURSES',
      title: '교양필수',
      titleElements: ['교양필수'],
      courses: simulationCourses.filter(c => c.internalRecognizedAs?.type === 'MANDATORY_GENERAL_COURSES'),
      fulfilled: false
    });
    out.push({
      id: 'HUMANITIES_SOCIETY_ELECTIVE',
      title: '인문사회선택',
      titleElements: ['인문사회선택'],
      courses: simulationCourses.filter(c => c.internalRecognizedAs?.type === 'HUMANITIES_SOCIETY_ELECTIVE'),
      fulfilled: false
    });

    out.push({
      id: 'OTHER_ELECTIVE',
      title: '자유선택',
      titleElements: ['자유선택'],
      courses: simulationCourses.filter(c => c.internalRecognizedAs?.type === 'OTHER_ELECTIVE'),
      fulfilled: false
    });
    out.push({
      id: 'UNCLASSIFIED',
      title: '미분류',
      titleElements: ['미분류'],
      courses: simulationCourses.filter(c => c.internalRecognizedAs === undefined),
      fulfilled: false
    });

    return out;
  }, [filters, simulationCourses, depts]);

  const [sections, setSections] = useState<Section[]>(baseSections.map(s => ({ ...s, requirements: [] })));

  // baseSections가 변경되면 sections 업데이트
  useEffect(() => {
    setSections(baseSections.map(s => ({ ...s, requirements: s.requirements || [] })));
  }, [baseSections]);

  // 섹션별 요건 불러오기
  useEffect(() => {
    const loadRequirements = async () => {
      const year = filters.requirementYear;
      if (!year) {
        // 요건 연도가 없으면 빈 배열로 설정
        setSections(baseSections.map(s => ({ ...s, requirements: [] })));
        return;
      }

      const updatedSections = await Promise.all(
        baseSections.map(async (section) => {
          try {
            let requirements: Array<Requirement> = [];
            
            if (section.id === 'BASIC_REQUIRED') {
              // 기초필수: 공통 요건
              // const res = await fetch(`${API}/rules/general?year=${profile?.admissionYear}&type=BR`);
              // const data = await res.json();
              // if (data.success && Array.isArray(data.requirements)) {
              //   requirements = data.requirements;
              //   requirements.forEach(r => {
              //     const evaluation = getMatches(simulationCourses, r.type, r.targets, r.constraints || []);
              //     r.currentValue = evaluation.currentValue;
              //     switch (r.type) {
              //       case 'MIN_COURSES_AMONG':
              //       case 'MIN_CREDITS_AMONG':
              //       case 'MIN_AU_AMONG':
              //         r.fulfilled = r.value === undefined ? true : r.value < r.currentValue || r.value === r.currentValue;
              //         break;
              //     }
              //   });
              // }
            } else if (section.id === 'BASIC_ELECTIVE') {
              // 기초선택: 학과별 요건
              if (filters.major) {
                const res = await fetch(`${API}/rules/major?year=${year}&department=${encodeURIComponent(filters.major)}&type=${filters.doubleMajors.length < 1 ? 'BE' : 'BE_D'}`);
                const data = await res.json();
                if (data.success && Array.isArray(data.requirements)) {
                  requirements = data.requirements;
                  requirements.forEach(r => {
                    const evaluation = getMatches(simulationCourses, r.type, r.targets, r.constraints || []);
                    r.currentValue = evaluation.currentValue;
                    switch (r.type) {
                      case 'MIN_COURSES_AMONG':
                      case 'MIN_CREDITS_AMONG':
                      case 'MIN_AU_AMONG':
                        r.fulfilled = r.value === undefined ? true : r.value < r.currentValue || r.value === r.currentValue;
                        break;
                    }
                  });
                }
              }
            } else if (section.id.startsWith('MAJOR_') && filters.major) {
              // 주전공: 학과별 요건
              const res = await fetch(`${API}/rules/major?year=${year}&department=${encodeURIComponent(filters.major)}&type=Major`);
              const data = await res.json();
              if (data.success && Array.isArray(data.requirements)) {
                requirements = data.requirements;
                requirements.forEach(r => {
                  const evaluation = getMatches(simulationCourses, r.type, r.targets, r.constraints || []);
                  r.currentValue = evaluation.currentValue;
                  switch (r.type) {
                    case 'MIN_COURSES_AMONG':
                    case 'MIN_CREDITS_AMONG':
                    case 'MIN_AU_AMONG':
                      r.fulfilled = r.value === undefined ? true : r.value < r.currentValue || r.value === r.currentValue;
                      break;
                  }
                });
              }
            } else if (section.id.startsWith('ADVANCED_MAJOR_') && filters.major) {
              // 심화전공: 학과별 요건
              const res = await fetch(`${API}/rules/major?year=${year}&department=${encodeURIComponent(filters.major)}&type=AdvancedMajor`);
              const data = await res.json();
              if (data.success && Array.isArray(data.requirements)) {
                requirements = data.requirements;
              }
            } else if (section.id.startsWith('RESEARCH_') && filters.major) {
              // 연구: 학과별 요건
              const res = await fetch(`${API}/rules/major?year=${year}&department=${encodeURIComponent(filters.major)}&type=${filters.doubleMajors.length < 1 ? 'RS' : 'RS_D'}`);
              const data = await res.json();
              if (data.success && Array.isArray(data.requirements)) {
                requirements = data.requirements;
              }
            } else if (section.id.startsWith('DOUBLE_MAJOR_')) {
              // 복수전공: 학과별 요건
              const department = section.id.replace('DOUBLE_MAJOR_', '');
              const res = await fetch(`${API}/rules/major?year=${year}&department=${encodeURIComponent(department)}&type=DoubleMajor`);
              const data = await res.json();
              if (data.success && Array.isArray(data.requirements)) {
                requirements = data.requirements;
              }
            } else if (section.id.startsWith('MINOR_')) {
              // 부전공: 학과별 요건
              const department = section.id.replace('MINOR_', '');
              const res = await fetch(`${API}/rules/major?year=${year}&department=${encodeURIComponent(department)}&type=Minor`);
              const data = await res.json();
              if (data.success && Array.isArray(data.requirements)) {
                requirements = data.requirements;
              }
            } else if (section.id === 'INDIVIDUALLY_DESIGNED_MAJOR') {
              // 자유융합전공: 공통 요건
              const res = await fetch(`${API}/rules/general?year=${year}&type=IDM`);
              const data = await res.json();
              if (data.success && Array.isArray(data.requirements)) {
                requirements = data.requirements;
              }
            } else if (section.id === 'MANDATORY_GENERAL_COURSES') {
              // 교양필수: 공통 요건
              const res = await fetch(`${API}/rules/general?year=${profile?.admissionYear}&type=MGC`);
              const data = await res.json();
              if (data.success && Array.isArray(data.requirements)) {
                requirements = data.requirements;
                requirements.forEach(r => {
                  const evaluation = getMatches(simulationCourses, r.type, r.targets, r.constraints || []);
                  r.currentValue = evaluation.currentValue;
                  switch (r.type) {
                    case 'MIN_COURSES_AMONG':
                    case 'MIN_CREDITS_AMONG':
                    case 'MIN_AU_AMONG':
                      r.fulfilled = r.value === undefined ? true : r.value < r.currentValue || r.value === r.currentValue;
                      break;
                  }
                });
              }
            } else if (section.id === 'HUMANITIES_SOCIETY_ELECTIVE') {
              // 인문사회선택: 공통 요건
              const hasDoubleMajor = filters.doubleMajors && filters.doubleMajors.length > 0;
              const type = hasDoubleMajor ? 'HSE_D' : 'HSE';
              const res = await fetch(`${API}/rules/general?year=${profile?.admissionYear}&type=${type}`);
              const data = await res.json();
              if (data.success && Array.isArray(data.requirements)) {
                requirements = data.requirements;
              }
            }

            if (section.id !== 'BASIC_REQUIRED') {
            const fulfilled = requirements.every(r => r.fulfilled);

            return { ...section, requirements, fulfilled: fulfilled };
            } else {
              return section;
            }
          } catch (error) {
            console.error(`Error loading requirements for ${section.id}:`, error);
            return { ...section, requirements: [] };
          }
        })
      );

      setSections(updatedSections);
      
      // 달성된 섹션을 기본으로 접기
      const fulfilledSectionIds = new Set<string>();
      updatedSections.forEach((s) => {
        if (s.fulfilled) {
          fulfilledSectionIds.add(`center-${s.id}`);
        }
      });
      setCollapsedSections((prev) => {
        const newSet = new Set(prev);
        // 기존에 수동으로 접은 섹션은 유지하고, 달성된 섹션만 추가
        fulfilledSectionIds.forEach((id) => {
          if (!prev.has(id)) {
            newSet.add(id);
          }
        });
        return newSet;
      });
    };

    if (baseSections.length > 0) {
      loadRequirements();
    }
  }, [baseSections, filters.requirementYear, filters.major, filters.doubleMajors]);

  // 섹션을 그룹화: 주전공/심화전공/연구를 하나의 그룹으로
  const groupedSections = useMemo(() => {
    const basicGroup: Section[] = [];
    const majorGroup: Section[] = [];
    const otherSections: Section[] = [];
    const miscSections: Section[] = [];
    
    sections.forEach((s) => {
      if (s.id.match(/^BASIC_/)) {
        basicGroup.push(s);
      } else if (s.id.match(/^MAJOR_/) || s.id.match(/^ADVANCED_MAJOR_/) || s.id.match(/^RESEARCH_/)) {
        majorGroup.push(s);
      } else if (s.id === 'OTHER_ELECTIVE' || s.id === 'UNCLASSIFIED') {
        miscSections.push(s);
      } else {
        otherSections.push(s);
      }
    });
    
    return { basicGroup, majorGroup, otherSections, miscSections };
  }, [sections]);


  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-black">
      {/* 사이드바 */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-14'
        } transition-all duration-300 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden flex-shrink-0`}
      >
        {/* 사이드바 토글 버튼 - 좌상단 햄버거 */}
        <div
          className={`flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 overflow-hidden transition-all ${
            sidebarOpen ? 'p-4' : 'px-2 py-3'
          }`}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400 flex-shrink-0"
            aria-label={sidebarOpen ? '메뉴 접기' : '메뉴 펼치기'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {sidebarOpen && (
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap min-w-0 truncate"><Logo /></h2>
          )}
        </div>

        {/* 메인 메뉴 */}
        <div
          className={`flex-1 overflow-y-auto overflow-x-hidden space-y-2 ${
            sidebarOpen ? 'p-4' : 'px-2 py-3'
          }`}
        >
          {/* 새로운 시뮬레이션 */}
          <button
            onClick={() => {
              if (profile) {
                setCurrentSimulationId(null);
                initializeSimulationData(profile);
              }
            }}
            className={`w-full flex items-center gap-2 rounded-lg transition-colors ${
              currentSimulationId === null
                ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                : sidebarOpen
                ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                : ''
            } ${sidebarOpen ? 'px-3 py-2' : 'justify-center p-2'}`}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {sidebarOpen && <span className="text-sm whitespace-nowrap min-w-0 truncate">새로운 시뮬레이션</span>}
          </button>

          {/* 이전 시뮬레이션 조회 */}
          <div className={sidebarOpen ? 'mt-6' : 'mt-4'}>
            {sidebarOpen && (
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 px-2 whitespace-nowrap min-w-0 truncate">
                저장된 시뮬레이션
              </h3>
            )}
            <div className="space-y-1">
              {previousSimulations.length === 0 ? (
                sidebarOpen && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 px-2 py-2 truncate">저장된 시뮬레이션이 없습니다.</p>
                )
              ) : (
                previousSimulations.map((sim) => (
                  <div
                    key={sim.id}
                    onClick={() => loadSimulation(sim.id)}
                    className={`w-full flex items-center gap-3 rounded-lg text-left transition-all cursor-pointer ${
                      currentSimulationId === sim.id
                        ? ('bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 transition-all' + (sidebarOpen ? '' : ' p-2 justify-center'))
                        : sidebarOpen
                        ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 px-4 py-2'
                        : 'justify-center p-2'
                    } ${sidebarOpen ? 'px-4 py-2' : ''}`}
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {sidebarOpen && (
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="text-sm font-medium truncate">{sim.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{sim.date}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {sim.canGraduate ? '졸업 가능' : '졸업 불가능'}
                        </p>
                      </div>
                    )}
                    {sidebarOpen && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
                          if (!userId) return;
                          if (!confirm('정말 이 시뮬레이션을 삭제하시겠습니까?')) return;
                          fetch(`${API}/simulation/${sim.id}?userId=${encodeURIComponent(userId)}`, {
                            method: 'DELETE',
                            credentials: 'include',
                          })
                            .then((r) => r.json())
                            .then((data) => {
                              if (data.success) {
                                setPreviousSimulations((prev) => prev.filter((s) => s.id !== sim.id));
                                if (currentSimulationId === sim.id) {
                                  setCurrentSimulationId(null);
                                  if (profile) {
                                    initializeSimulationData(profile);
                                  }
                                }
                              } else {
                                alert(data.message || '삭제에 실패했습니다.');
                              }
                            })
                            .catch((error) => {
                              console.error('삭제 오류:', error);
                              alert('삭제 중 오류가 발생했습니다.');
                            });
                        }}
                        className="flex-shrink-0 p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                        title="삭제"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 하단 메뉴: 계정 이름 + 로그아웃 */}
        <div
          className={`border-t border-gray-200 dark:border-gray-700 overflow-hidden ${
            sidebarOpen ? 'p-4 space-y-2' : 'px-2 py-3 space-y-2'
          }`}
        >
          <div
            className={`flex items-center gap-3 rounded-lg transition-colors ${
              sidebarOpen ? 'w-full' : 'justify-center'
            }`}
          >
            <Link
              href="/profile/settings"
              className={`flex items-center gap-3 rounded-lg transition-colors flex-1 min-w-0 ${
                sidebarOpen
                  ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 px-4 py-2'
                  : 'justify-center p-2'
              }`}
              title={sidebarOpen ? undefined : userName || '프로필 설정'}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {sidebarOpen && (
                <span className="whitespace-nowrap min-w-0 truncate">
                  {userName || '프로필 설정'}
                </span>
              )}
            </Link>
            {sidebarOpen && (
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('userId');
                  router.push('/login');
                }}
                className="flex-shrink-0 p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 dark:text-gray-400 dark:hover:text-red-400 dark:hover:bg-red-950/30 transition-colors"
                title="로그아웃"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        {/* 상단 바 (sticky) */}
        <div className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex-1 py-4 overflow-x-auto">
              <div className="px-6 flex items-center gap-4 min-w-max">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    전공 이수 기준
                  </label>
                  <NumberInput
                    min="2016"
                    max="2050"
                    value={filters.requirementYear}
                    onChange={(newValue) => setFilters({ ...filters, requirementYear: parseInt(newValue) })}
                    size="small"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    주전공
                  </label>
                  <DepartmentDropdown
                    value={filters.major}
                    onChange={(newValue) => setFilters({ ...filters, major: newValue })}
                    mode="major"
                    size="small"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    복수전공
                  </label>
                  <MultipleDepartmentDropdown
                    value={filters.doubleMajors}
                    onChange={(newValues) => setFilters({ ...filters, doubleMajors: newValues })}
                    mode="doubleMajor"
                    size="small"
                    className="min-w-40"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    부전공
                  </label>
                  <MultipleDepartmentDropdown
                    value={filters.minors}
                    onChange={(newValues) => setFilters({ ...filters, minors: newValues })}
                    mode="minor"
                    size="small"
                    className="min-w-40"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="advancedMajor" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    심화전공
                  </label>
                  <Select
                    id="advancedMajor"
                    value={filters.advancedMajor ? 'true' : 'false'}
                    onChange={(newValue) => setFilters({ ...filters, advancedMajor: newValue === 'true' })}
                    size="small"
                    className="min-w-16"
                  >
                    <option value="false">아니오</option>
                    <option value="true">예</option>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="individuallyDesignedMajor" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    자유융합전공
                  </label>
                  <Select
                    id="individuallyDesignedMajor"
                    value={filters.individuallyDesignedMajor ? 'true' : 'false'}
                    onChange={(newValue) => setFilters({ ...filters, individuallyDesignedMajor: newValue === 'true' })}
                    size="small"
                    className="min-w-16"
                  >
                    <option value="false">아니오</option>
                    <option value="true">예</option>
                  </Select>
                </div>
              </div>
            </div>
            {/* 다른 이름으로 저장 버튼 */}
            <div className="flex-shrink-0 pr-6">
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(true)}
                className="px-3 py-2 border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-sm font-medium text-gray-700 dark:text-gray-300 rounded-lg transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800 whitespace-nowrap"
              >
                다른 이름으로 저장
              </button>
            </div>
          </div>
        </div>

        {/* 3분할 카드 래퍼 */}
        <div className="grow flex flex-col min-h-0 p-4 overflow-hidden">
          <div className="flex-1 flex flex-col min-h-0 rounded-xl shadow-lg overflow-hidden bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-700">
            <div className="flex-1 flex min-h-0">
              {/* 좌측: 섹션별 요건 계산에 사용된 과목 */}
              <div
                className={`${rightPanelOpen ? 'w-1/3' : 'w-1/2'} flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto transition-all duration-300`}
              >
                <div className="p-4">
                  <h2 className="text-xl font-semibold mb-4">수업별 학점 인정 분야</h2>
                  <div>
                    {sections.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                        주전공을 선택하면 섹션이 구성됩니다.
                      </p>
                    ) : (
                      <>
                        {/* 기초과목 그룹 */}
                        {groupedSections.basicGroup.length > 0 && (
                          <>
                            {groupedSections.basicGroup.map((s, i) => {
                              const isCollapsed = collapsedSections.has(s.id);
                              return (
                                <div key={s.id} className={i > 0 ? 'mt-4' : ''}>
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                  <div className="flex justify-between text-sm items-baseline mb-3">
                                    <button
                                      onClick={() => toggleSection(s.id)}
                                      className="flex items-center gap-2 flex-1 text-left hover:opacity-70 transition-opacity"
                                    >
                                      <svg
                                        className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                      <h3 className="font-medium text-base">{s.title}</h3>
                                    </button>
                                    <p className="text-gray-600 dark:text-gray-400">{calculateSectionCredits(s.courses)}</p>
                                  </div>
                                  {!isCollapsed && (
                                  <div className="space-y-2">
                                    {s.courses.length === 0 ? (
                                      <p className="text-sm text-gray-500 dark:text-gray-400">인정 과목 없음</p>
                                    ) : (
                                      s.courses.map((c) => (
                                        <div
                                          key={c.courseId}
                                          className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-zinc-800"
                                        >
                                          <p className="font-medium text-sm">{c.course.title}</p>
                                          <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {c.course.au > 0 ? `${c.course.au}AU` : `${c.course.credit}학점`}
                                          </p>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                  )}
                                </div>
                              </div>
                            );
                            })}
                          </>
                        )} 

                        {/* 주전공/심화전공/연구 그룹 */}
                        {groupedSections.majorGroup.length > 0 && (
                          <>
                            {groupedSections.basicGroup.length > 0 && (
                              <div className="mt-4"></div>
                            )}
                            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                              {groupedSections.majorGroup.map((s, idx) => {
                                const isCollapsed = collapsedSections.has(s.id);
                                return (
                                  <div key={s.id}>
                                  <div className="p-4">
                                    <div className="flex justify-between text-sm items-baseline mb-3">
                                      <button
                                        onClick={() => toggleSection(s.id)}
                                        className="flex items-center gap-2 flex-1 text-left hover:opacity-70 transition-opacity"
                                      >
                                        <svg
                                          className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                        <h3 className="font-medium text-base">{s.title}</h3>
                                      </button>
                                      <p className="text-gray-600 dark:text-gray-400">{calculateSectionCredits(s.courses)}</p>
                                    </div>
                                    {!isCollapsed && (
                                    <div className="space-y-2">
                                      {s.courses.length === 0 ? (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">인정 과목 없음</p>
                                      ) : (
                                        s.courses.map((c) => (
                                          <div
                                            key={c.courseId}
                                            className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-zinc-800"
                                          >
                                            <p className="font-medium text-sm">{c.course.title}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                              {c.course.au > 0 ? `${c.course.au}AU` : `${c.course.credit}학점`}
                                            </p>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                    )}
                                  </div>
                                  {idx < groupedSections.majorGroup.length - 1 && (
                                    <div className="border-t border-dashed border-gray-300 dark:border-gray-600"></div>
                                  )}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                        
                        {/* 복전, 부전, 융전, 교필, 인선 */}
                        {groupedSections.otherSections.length > 0 && (
                          <>
                            {groupedSections.majorGroup.length > 0 && (
                              <div className="mt-4"></div>
                            )}
                            {groupedSections.otherSections.map((s) => {
                              const isCollapsed = collapsedSections.has(s.id);
                              return (
                                <div key={s.id} className={groupedSections.majorGroup.length > 0 ? 'mt-4' : ''}>
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                  <div className="flex justify-between text-sm items-baseline mb-3">
                                    <button
                                      onClick={() => toggleSection(s.id)}
                                      className="flex items-center gap-2 flex-1 text-left hover:opacity-70 transition-opacity"
                                    >
                                      <svg
                                        className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                      <h3 className="font-medium text-base">{s.title}</h3>
                                    </button>
                                    <p className="text-gray-600 dark:text-gray-400">{calculateSectionCredits(s.courses)}</p>
                                  </div>
                                  {!isCollapsed && (
                                  <div className="space-y-2">
                                    {s.courses.length === 0 ? (
                                      <p className="text-sm text-gray-500 dark:text-gray-400">인정 과목 없음</p>
                                    ) : (
                                      s.courses.map((c) => (
                                        <div
                                          key={c.courseId}
                                          className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-zinc-800"
                                        >
                                          <p className="font-medium text-sm">{c.course.title}</p>
                                          <p className="text-xs text-gray-500 dark:text-gray-400">
                                          {c.course.au > 0 ? `${c.course.au}AU` : `${c.course.credit}학점`}
                                          </p>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                  )}
                                </div>
                              </div>
                              );
                            })}
                          </>
                        )}

                        {groupedSections.miscSections.map((s) => {
                          const isCollapsed = collapsedSections.has(s.id);
                          return s.courses.length === 0 ? null : (
                          <div key={s.id} className="mt-4">
                            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                              <div className="flex justify-between text-sm items-baseline mb-3">
                                <button
                                  onClick={() => toggleSection(s.id)}
                                  className="flex items-center gap-2 flex-1 text-left hover:opacity-70 transition-opacity"
                                >
                                  <svg
                                    className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                  <h3 className="font-medium text-base">{s.title}</h3>
                                </button>
                                <p className="text-gray-600 dark:text-gray-400">{calculateSectionCredits(s.courses)}</p>
                              </div>
                              {!isCollapsed && (
                              <div className="space-y-2">
                                {s.courses.map((c) => (
                                  <div
                                    key={c.courseId}
                                    className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-zinc-800"
                                  >
                                    <p className="font-medium text-sm">{c.course.title}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {c.course.au > 0 ? `${c.course.au}AU` : `${c.course.credit}학점`}
                                    </p>
                                  </div>
                                ))}
                              </div>
                              )}
                            </div>
                          </div>
                        );
                        })}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 가운데: 섹션별 세부 요건 달성 여부 */}
              <div className={`${rightPanelOpen ? 'w-1/3' : 'w-1/2'} flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col min-h-0 transition-all duration-300 relative`}>
                <div
                  className="flex-1 h-full overflow-y-auto"
                >
                  <div className="p-4 pb-24">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold">졸업 요건</h2>
                      {!rightPanelOpen && (
                        <button
                          type="button"
                          onClick={() => setRightPanelOpen(true)}
                          className="flex-shrink-0 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors border border-gray-200 dark:border-gray-700"
                          title="패널 펼치기"
                        >
                          <svg
                            className="w-5 h-5 text-gray-600 dark:text-gray-400 rotate-180"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div>
                      {sections.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                          주전공을 선택하면 섹션이 구성됩니다.
                        </p>
                      ) : (
                        <>
                          {/* 기초과목 */}
                          {groupedSections.basicGroup.length > 0 && (
                            <>
                              {groupedSections.basicGroup.map((s, idx) => {
                                const requirements = s.requirements || [];
                                const isCollapsed = collapsedSections.has(`center-${s.id}`);
                                return (
                                  <div key={s.id} className={idx > 0 ? 'mt-4' : ''}>
                                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                                      <div className="flex items-center justify-between mb-2">
                                        <button
                                          onClick={() => toggleSection(`center-${s.id}`)}
                                          className="flex items-center gap-2 flex-1 text-left hover:opacity-70 transition-opacity"
                                        >
                                          <svg
                                            className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                          <h3 className="font-medium text-base">{s.title}</h3>
                                        </button>
                                        <p
                                          className={`text-sm font-medium ${
                                            s.fulfilled ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
                                          }`}
                                        >
                                          {s.fulfilled ? '달성' : '미달'}
                                        </p>
                                      </div>
                                      {!isCollapsed && requirements.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                          {requirements.map((req, reqIdx) => (
                                            <div
                                              key={reqIdx}
                                              className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-zinc-800"
                                            >
                                              <p className="font-medium text-sm truncate">{req.title || req.description}</p>
                                              {req.value != null && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                  {req.currentValue || 0} / {req.value}
                                                </p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          )}

                          {/* 주전공/심화전공/연구 그룹 */}
                          {groupedSections.majorGroup.length > 0 && (
                            <div className={'rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden' + (groupedSections.basicGroup.length > 0 ? ' mt-4' : '')}>
                              {groupedSections.majorGroup.map((s, idx) => {
                                const requirements = s.requirements || [];
                                const isCollapsed = collapsedSections.has(`center-${s.id}`);
                                return (
                                  <div key={s.id}>
                                    <div className="p-4">
                                      <div className="flex items-center justify-between mb-2">
                                        <button
                                          onClick={() => toggleSection(`center-${s.id}`)}
                                          className="flex items-center gap-2 flex-1 text-left hover:opacity-70 transition-opacity"
                                        >
                                          <svg
                                            className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                          <h3 className="font-medium text-base">
                                            {s.titleElements.length > 1 ? (
                                              <>
                                                <span className="text-gray-400 dark:text-zinc-600">{s.titleElements[0]}: </span>
                                                <span>{s.titleElements.slice(1).join(' ')}</span>
                                              </>
                                            ) : s.titleElements[0]}
                                          </h3>
                                        </button>
                                        <p
                                          className={`text-sm font-medium ${
                                            s.fulfilled ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
                                          }`}
                                        >
                                          {s.fulfilled ? '달성' : '미달'}
                                        </p>
                                      </div>
                                      {!isCollapsed && requirements.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                          {requirements.map((req, reqIdx) => (
                                            <div
                                              key={reqIdx}
                                              className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-zinc-800"
                                            >
                                              <p className="font-medium text-sm truncate">{req.title || req.description}</p>
                                              {req.value != null && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                  {req.currentValue || 0} / {req.value}
                                                </p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    {idx < groupedSections.majorGroup.length - 1 && (
                                      <div className="border-t border-dashed border-gray-300 dark:border-gray-600"></div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          
                          {/* 복전, 부전, 융전, 교필, 인선 */}
                          {groupedSections.otherSections.length > 0 && (
                            <>
                              {groupedSections.otherSections.map((s) => {
                                const requirements = s.requirements || [];
                                const isCollapsed = collapsedSections.has(`center-${s.id}`);
                                return (
                                  <div key={s.id} className={groupedSections.majorGroup.length > 0 ? 'mt-4' : ''}>
                                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                                      <div className="flex items-center justify-between mb-2">
                                        <button
                                          onClick={() => toggleSection(`center-${s.id}`)}
                                          className="flex items-center gap-2 flex-1 text-left hover:opacity-70 transition-opacity"
                                        >
                                          <svg
                                            className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                          </svg>
                                          <h3 className="font-medium text-base">
                                            {s.titleElements.length > 1 ? (
                                              <>
                                                <span className="text-gray-400 dark:text-zinc-600">{s.titleElements[0]}: </span>
                                                <span>{s.titleElements.slice(1).join(' ')}</span>
                                              </>
                                            ) : s.titleElements[0]}
                                          </h3>
                                        </button>
                                        <p
                                          className={`text-sm font-medium ${
                                            s.fulfilled ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
                                          }`}
                                        >
                                          {s.fulfilled ? '달성' : '미달'}
                                        </p>
                                      </div>
                                      {!isCollapsed && requirements.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                          {requirements.map((req, reqIdx) => (
                                            <div
                                              key={reqIdx}
                                              className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-zinc-800"
                                            >
                                              <p className="font-medium text-sm truncate">{req.title || req.description}</p>
                                              {req.value != null && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                  {req.currentValue || 0} / {req.value}
                                                </p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="absolute bottom-0 w-full flex-shrink-0 bg-gradient-to-t from-white via-white/95 to-transparent backdrop-blur-sm px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-6 flex-1">
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">총 이수학점</span>
                        <p className="text-lg font-semibold">{totalStats.totalCredit} / 138</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">총 AU</span>
                        <p className="text-lg font-semibold">{totalStats.totalAu} / 4</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">평점</span>
                        <p className="text-lg font-semibold">{totalStats.gpa} / 2.0</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">졸업 가능 여부</span>
                      <p className="text-2xl font-bold text-red-600">불가능</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 우측: 시뮬레이션에서 추가·삭제할 과목 선택 */}
              <div className={`${rightPanelOpen ? 'w-1/3' : 'w-0'} flex-shrink-0 overflow-hidden transition-all duration-300 flex flex-col min-h-0`}>
                {rightPanelOpen && (
                  <>
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      {/* sticky 상단: 모드 전환 */}
                      <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-gray-700 p-4 flex-shrink-0">
                        <div className="flex gap-2 items-center">
                          <button
                            type="button"
                            onClick={() => setCourseMode('add')}
                            className={`flex-1 px-2 py-1 rounded-lg text-sm font-medium transition-colors truncate ${
                              courseMode === 'add'
                                ? 'border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                                : 'border border-transparent bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700'
                            }`}
                          >
                            과목 추가
                          </button>
                          <button
                            type="button"
                            onClick={() => setCourseMode('view')}
                            className={`flex-1 px-2 py-1 rounded-lg text-sm font-medium transition-colors truncate ${
                              courseMode === 'view'
                                ? 'border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                                : 'border border-transparent bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700'
                            }`}
                          >
                            수강한 과목<span className="opacity-40 ml-2">{enrollmentsForList.length}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRightPanelOpen(false)}
                            className="flex-shrink-0 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors border border-gray-200 dark:border-gray-700"
                            title="패널 접기"
                          >
                            <svg
                              className="w-5 h-5 text-gray-600 dark:text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      <div className="p-6 pt-0">
                        {courseMode === 'add' ? (
                          <AddCoursePanel
                            searchQuery={courseSearchQuery}
                            onSearchQueryChange={setCourseSearchQuery}
                            searchResults={searchResults}
                            selectedCourseIds={selectedCourseIds}
                            onSelectionChange={updateSelectedCourseIds}
                            addYear={addYear}
                            onAddYearChange={setAddYear}
                            addSemester={addSemester}
                            onAddSemesterChange={setAddSemester}
                            addGrade={addGrade}
                            onAddGradeChange={setAddGrade}
                            addAsPriorCredit={addAsPriorCredit}
                            onAddAsPriorCreditChange={setAddAsPriorCredit}
                            onAddSelected={handleAddSelected}
                            onDragStart={(course) => setDraggedCourse(course)}
                            filterDepartment={filterDepartment}
                            onFilterDepartmentChange={setFilterDepartment}
                            filterCategory={filterCategory}
                            onFilterCategoryChange={setFilterCategory}
                          />
                        ) : (
                          <>
                            <p className="text-sm text-center my-4 px-4 text-gray-500">
                              시뮬레이션에 사용할 과목들을 지정합니다. 아직 듣지 않았지만 들을 예정인 과목을 추가하거나, 재수강 예정인 과목의 성적을 변경하여 시뮬레이션을 진행할 수 있습니다.
                            </p>
                            <EnrollmentsList
                              enrollments={enrollmentsForList}
                              semesterGroups={semesterGroups}
                              sortedSemesterKeys={sortedSemesterKeys}
                              onGradeChange={(enrollment, grade) => {
                                const cs = simulationCourses.find(
                                  (c) =>
                                    c.courseId === enrollment.courseId &&
                                    c.enrolledYear === enrollment.enrolledYear &&
                                    c.enrolledSemester === enrollment.enrolledSemester
                                );
                                if (cs) {
                                  handleGradeChange(cs, grade);
                                }
                              }}
                              onRemove={(enrollment) => {
                                const cs = simulationCourses.find(
                                  (c) =>
                                    c.courseId === enrollment.courseId &&
                                    c.enrolledYear === enrollment.enrolledYear &&
                                    c.enrolledSemester === enrollment.enrolledSemester
                                );
                                if (cs) {
                                  handleRemove(cs);
                                }
                              }}
                              onDragStart={(e, enrollment, semesterKey) => {
                                const cs = simulationCourses.find(
                                  (c) =>
                                    c.courseId === enrollment.courseId &&
                                    c.enrolledYear === enrollment.enrolledYear &&
                                    c.enrolledSemester === enrollment.enrolledSemester
                                );
                                if (cs) {
                                  handleDragStart(e, cs, semesterKey);
                                }
                              }}
                              onDrop={handleDrop}
                              onDropOutside={handleDropOutside}
                              findNearestPastSemester={findNearestPastSemester}
                            />
                            <p className="text-sm text-center my-4 px-4 text-gray-500">
                              이곳에서 과목을 추가하거나 삭제하더라도 프로필에 저장된 수강 내역은 변경되지 않습니다.
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 저장 모달 */}
      {isSaveModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSaveModalOpen(false);
          }}
        >
          <div
            className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">시뮬레이션 저장</h2>
              
              <div className="space-y-4">
                {/* 이름 입력 */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    시뮬레이션 이름
                  </label>
                  <Input
                    type="text"
                    value={saveName}
                    onChange={setSaveName}
                    placeholder="예: 2024년 1학기 시뮬레이션"
                    size="medium"
                  />
                </div>

                {/* 과목 추가 체크박스 */}
                {simulationCourses.length > 0 && (
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="addToEnrollments"
                      checked={addToEnrollments}
                      onChange={(e) => setAddToEnrollments(e.target.checked)}
                      className="mt-1 w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500 dark:bg-zinc-800 dark:border-zinc-600"
                    />
                    <label
                      htmlFor="addToEnrollments"
                      className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                    >
                      시뮬레이션에 사용한 과목들을 프로필의 수강한 과목에 추가하기
                      <span className="text-gray-500 dark:text-gray-400 ml-1">
                        ({simulationCourses.length}개 과목)
                      </span>
                    </label>
                  </div>
                )}

                {/* 버튼 */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSaveModalOpen(false);
                      setSaveName('');
                      setAddToEnrollments(false);
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!saveName.trim()) {
                        alert('시뮬레이션 이름을 입력해주세요.');
                        return;
                      }

                      const userId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
                      if (!userId) {
                        alert('로그인이 필요합니다.');
                        router.push('/login');
                        return;
                      }

                      try {
                        // CourseSimulation[]를 RawCourseSimulation[]로 변환
                        const rawCourses: RawCourseSimulation[] = simulationCourses.map((cs) => ({
                          courseId: cs.courseId,
                          enrolledYear: cs.enrolledYear,
                          enrolledSemester: cs.enrolledSemester,
                          grade: cs.grade,
                          recognizedAs: cs.recognizedAs,
                        }));

                        // 시뮬레이션 저장 API 호출
                        const response = await fetch(`${API}/simulation`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({
                            userId,
                            title: saveName.trim(),
                            referenceYear: filters.requirementYear,
                            major: filters.major,
                            doubleMajors: filters.doubleMajors,
                            minors: filters.minors,
                            advancedMajor: filters.advancedMajor,
                            individuallyDesignedMajor: filters.individuallyDesignedMajor,
                            courses: rawCourses,
                          }),
                        });

                        const data = await response.json();

                        if (data.success) {
                          // 시뮬레이션 목록 새로고침
                          const simulationsRes = await fetch(`${API}/simulation?userId=${encodeURIComponent(userId)}`, {
                            credentials: 'include',
                          });
                          const simulationsData = await simulationsRes.json();
                          if (simulationsData.success) {
                            const sims = (simulationsData.simulations || []).map((sim: any) => ({
                              id: sim.id,
                              name: sim.title,
                              date: new Date(sim.updatedAt).toLocaleDateString('ko-KR'),
                              canGraduate: false, // TODO: 졸업가능 여부 계산 로직 추가 필요
                            }));
                            setPreviousSimulations(sims);
                          }

                          alert('시뮬레이션이 저장되었습니다.');
                          setIsSaveModalOpen(false);
                          setSaveName('');
                          setAddToEnrollments(false);
                        } else {
                          alert(data.message || '저장에 실패했습니다.');
                        }
                      } catch (error) {
                        console.error('저장 오류:', error);
                        alert('저장 중 오류가 발생했습니다.');
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
                  >
                    저장
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
