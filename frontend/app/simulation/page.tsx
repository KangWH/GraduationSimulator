'use client';

import { useState, useEffect, useRef, useMemo, useCallback, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DepartmentDropdown, MultipleDepartmentDropdown } from '../components/DepartmentDropdown';
import { NumberInput, Select, Input } from '../components/formFields';
import { API } from '../lib/api';
import type { Profile, Enrollment, RawEnrollment, Semester, Grade, Course } from '../profile/settings/types';
import type { CourseSimulation, RawCourseSimulation, CreditType, Requirement, Filter } from './types';
import AddCoursePanel from '../profile/settings/AddCoursePanel';
import EnrollmentsList, { enrollmentKey } from '../profile/settings/EnrollmentsList';
import { classifyCourses, RequirementsProps, SubstitutionMap } from './conditionTester';
import {
  type Section,
  type SimulationSectionFilters,
  type GroupedSections,
  buildSectionsWithRequirements,
  buildSectionsFromClassifiedCourses,
  groupSections,
} from './sectionBuilder';
import Logo from '../components/Logo';
import MobileTopBar from '../components/MobileTopBar';
import Accordion, { ACBody, ACTitle } from '../components/Accordion';
import { CourseBar, RequirementBar } from '../components/CourseElements';
import { AnimatedNumber } from '../components/AnimatedNumber';
import { RequirementsTable } from './ReportTable';
import { formatYearSemester, getRemarks, computeSectionSubtotal } from './reportCourseListUtils';
import { PDFDownloadLink } from '@react-pdf/renderer';
import GraduationReportPDF from './ReportPDF';
import DesktopTopBar from '../components/DesktopTopBar';
import Button from '../components/Button';

type Dept = { id: string; name: string };

export default function SimulationPage() {
  const router = useRouter();


  /* UI 관련 상태 변수 */
  
  // UI 표시 언어
  const [lang, setLang] = useState<'ko' | 'en'>('ko');
  // 데스크톱 사이드바 펼침 여부
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // 사이드바 활성 탭
  const [sidebarTab, setSidebarTab] = useState<'addCourse' | 'selectMajors'>('addCourse')
  // 이수 과목 그룹 방식
  const [coursesGrouping, setCoursesGrouping] = useState<'bySemester' | 'byCategory'>('byCategory')
  // 모바일 탭 상태
  const [mobileTab, setMobileTab] = useState<'major' | 'courses' | 'credits' | 'requirements'>('requirements');
  // 모바일에서, 시나리오 선택 모달 표시 여부?
  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState(false);
  // 모바일에서, 시나리오 선택 모달 애니메이션 제어용 변수?
  const [scenarioSheetVisible, setScenarioSheetVisible] = useState(false);
  // 시나리오 시트 드래그로 내린 거리(px)
  const [scenarioSheetDragY, setScenarioSheetDragY] = useState(0);
  const scenarioTouchStartY = useRef(0);
  const scenarioTouchStartTime = useRef(0);
  // 시나리오를 저장할 이름 필드
  const [saveName, setSaveName] = useState('');
  // 보고서 다이얼로그 표시 여부
  const [showReportDialog, setShowReportDialog] = useState(false);
  // 과목 추가/선택 모드
  const [courseMode, setCourseMode] = useState<'add' | 'view'>('view');
  // 시나리오 로드 중인지의 여부
  const [isLoadingSimulation, setIsLoadingSimulation] = useState(false);
  // 성적 숨김 모드
  const [gradeBlindMode, setGradeBlindMode] = useState(true);
  // 수강 내역 등록 안내 툴팁(말풍선 팝업) 위치
  const [sidebarTooltipState, setSidebarTooltipState] = useState<{ text: string; x: number; y: number } | null>(null);
  // 툴팁(말풍선 팝업) 위치
  const [tooltipState, setTooltipState] = useState<{ text: string; x: number; y: number } | null>(null);


  /* 고정된 데이터 변수 */

  // 학과별 이름 정보
  const [depts, setDepts] = useState<Dept[]>([]);
  const getDeptName = (id: string) => depts.find((d) => d.id === id)?.name ?? id;
  // 저장된 시뮬레이션 데이터
  const [previousSimulations, setPreviousSimulations] = useState<Array<{
    id: string;
    name: string;
    date: string;
  }>>([]);
  // 대체 과목 데이터
  const [substitutionMap, setSubstitutionMap] = useState<SubstitutionMap | undefined>(undefined);


  /* 현재 시나리오 관련 상태 변수 */

  // 선택된 학과
  const [filters, setFilters] = useState<Filter>({
    requirementYear: new Date().getFullYear(),
    major: '',
    doubleMajors: [] as string[],
    minors: [] as string[],
    advancedMajor: false,
    individuallyDesignedMajor: false,
    earlyGraduation: false,
  });
  // 시뮬레이션에 사용할 과목
  const [simulationCourses, setSimulationCourses] = useState<CourseSimulation[]>([]);
  // 사용자 프로파일
  const [profile, setProfile] = useState<Profile | null>(null);
  // 프로파일 로드 여부
  const [profileLoaded, setProfileLoaded] = useState(false);
  // 사용자 이름
  const [userName, setUserName] = useState<string>('');
  // 시나리오 식별자 (새로운 시나리오일 때는 null)
  const [currentSimulationId, setCurrentSimulationId] = useState<string | null>(null);
  // 자동저장 시간 지연
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [addToEnrollments, setAddToEnrollments] = useState(false);

  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
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
  const [selectedEnrollmentKeys, setSelectedEnrollmentKeys] = useState<Set<string>>(new Set());

  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const prevSimulationCoursesRef = useRef<CourseSimulation[]>([]);
  const prevFiltersRef = useRef(filters);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [profileEnrollmentsEmpty, setProfileEnrollmentsEmpty] = useState(false);
  const [enrollmentPromptDismissed, setEnrollmentPromptDismissed] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('enrollmentPromptDismissed') === '1') {
      setEnrollmentPromptDismissed(true);
    }
  }, []);

  useEffect(() => {
    const y = new Date().getFullYear();
    setFilters((f) => ({ ...f, requirementYear: y }));
    setAddYear(y);
  }, []);

  const profileLinkDesktopRef = useRef<HTMLAnchorElement>(null);
  const profileLinkMobileRef = useRef<HTMLAnchorElement>(null);
  const scenarioNameButtonRef = useRef<HTMLButtonElement>(null);
  const [desktopScenarioPopoverOpen, setDesktopScenarioPopoverOpen] = useState(false);
  const [scenarioPopoverAnchor, setScenarioPopoverAnchor] = useState<{ left: number; top: number; width: number } | null>(null);
  const [enrollmentPromptAnchor, setEnrollmentPromptAnchor] = useState<{ left: number; top: number; isMobile: boolean } | null>(null);

  useEffect(() => {
    if (!desktopScenarioPopoverOpen || typeof window === 'undefined') {
      setScenarioPopoverAnchor(null);
      return;
    }
    const update = () => {
      const rect = scenarioNameButtonRef.current?.getBoundingClientRect();
      if (rect) setScenarioPopoverAnchor({ left: rect.left, top: rect.bottom, width: rect.width });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [desktopScenarioPopoverOpen]);

  const currentSimulationName = currentSimulationId === null
    ? (lang === 'ko' ? '새로운 시나리오' : 'New scenario')
    : (previousSimulations.find((s) => s.id === currentSimulationId)?.name ?? (lang === 'ko' ? '새로운 시나리오' : 'New scenario'));

  // 과목 추가 추천 팝업 위치 (createPortal로 body에 렌더, clip 방지)
  useEffect(() => {
    if (!profileEnrollmentsEmpty || enrollmentPromptDismissed) {
      setEnrollmentPromptAnchor(null);
      return;
    }
    const POPUP_EST_WIDTH = 200;
    const PAD = 12;
    const updateAnchor = () => {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      if (isMobile) {
        const rect = profileLinkMobileRef.current?.getBoundingClientRect();
        if (rect) {
          const left = Math.max(PAD, Math.min(rect.left, window.innerWidth - POPUP_EST_WIDTH - PAD));
          setEnrollmentPromptAnchor({ left, top: rect.bottom + 8, isMobile: true });
        }
      } else {
        const rect = profileLinkDesktopRef.current?.getBoundingClientRect();
        if (rect) {
          const vw = window.innerWidth;
          const spaceLeft = rect.left - PAD;
          const left = spaceLeft >= POPUP_EST_WIDTH
            ? Math.max(PAD, rect.left - POPUP_EST_WIDTH - 8)
            : Math.max(PAD, vw - POPUP_EST_WIDTH - PAD);
          setEnrollmentPromptAnchor({ left, top: rect.top + rect.height / 2, isMobile: false });
        }
      }
    };
    updateAnchor();
    window.addEventListener('resize', updateAnchor);
    window.addEventListener('scroll', updateAnchor, true);
    return () => {
      window.removeEventListener('resize', updateAnchor);
      window.removeEventListener('scroll', updateAnchor, true);
    };
  }, [profileEnrollmentsEmpty, enrollmentPromptDismissed]);

  const closeScenarioModal = useCallback(() => {
    setScenarioSheetVisible(false);
    window.setTimeout(() => setIsScenarioModalOpen(false), 200);
  }, []);

  const SCENARIO_DRAG_CLOSE_THRESHOLD = 80;
  const handleScenarioSheetTouchStart = useCallback((e: React.TouchEvent) => {
    scenarioTouchStartY.current = e.touches[0].clientY;
    scenarioTouchStartTime.current = Date.now();
  }, []);
  const handleScenarioSheetTouchMove = useCallback((e: React.TouchEvent) => {
    if (typeof window === 'undefined' || window.innerWidth >= 640) return;
    const dy = e.touches[0].clientY - scenarioTouchStartY.current;
    if (dy > 0) setScenarioSheetDragY(dy);
  }, []);
  const handleScenarioSheetTouchEnd = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 640) {
      setScenarioSheetDragY(0);
      return;
    }
    const elapsed = Date.now() - scenarioTouchStartTime.current;
    const velocity = elapsed > 0 ? scenarioSheetDragY / elapsed : 0;
    if (scenarioSheetDragY > SCENARIO_DRAG_CLOSE_THRESHOLD || velocity > 0.4) {
      closeScenarioModal();
    }
    setScenarioSheetDragY(0);
  }, [scenarioSheetDragY, closeScenarioModal]);

  const handleSaveSimulation = useCallback(async (name: string) => {
    if (!name.trim()) {
      alert('시나리오 이름을 입력해주세요.');
      return;
    }

    try {
      // CourseSimulation[]를 RawCourseSimulation[]로 변환
      const rawCourses: RawCourseSimulation[] = simulationCourses.map((cs) => ({
        courseId: cs.courseId,
        enrolledYear: cs.enrolledYear,
        enrolledSemester: cs.enrolledSemester,
        grade: cs.grade,
        recognizedAs: cs.specifiedClassification,
      }));

      // 시나리오 저장 API 호출
      const response = await fetch(`${API}/simulation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: name.trim(),
          referenceYear: filters.requirementYear,
          major: filters.major,
          doubleMajors: filters.doubleMajors,
          minors: filters.minors,
          advancedMajor: filters.advancedMajor,
          individuallyDesignedMajor: filters.individuallyDesignedMajor,
          earlyGraduation: filters.earlyGraduation,
          courses: rawCourses,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // 시나리오 목록 새로고침
        const simulationsRes = await fetch(`${API}/simulation`, {
          credentials: 'include',
        });
        const simulationsData = await simulationsRes.json();
        if (simulationsData.success) {
          const sims = (simulationsData.simulations || []).map((sim: any) => ({
            id: sim.id,
            name: sim.title,
            date: new Date(sim.updatedAt).toLocaleDateString('ko-KR'),
          }));
          setPreviousSimulations(sims);
        }

        alert('시뮬레이션이 저장되었습니다.');
        setSaveName('');
        return true;
      } else {
        alert(data.message || '저장에 실패했습니다.');
        return false;
      }
    } catch (error) {
      console.error('저장 오류:', error);
      alert('저장 중 오류가 발생했습니다.');
      return false;
    }
  }, [simulationCourses, filters]);

  useEffect(() => {
    if (isScenarioModalOpen) {
      setScenarioSheetVisible(false);
      const t = window.setTimeout(() => setScenarioSheetVisible(true), 10);
      return () => window.clearTimeout(t);
    }
    setScenarioSheetVisible(false);
  }, [isScenarioModalOpen]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/departments`).then((r) => r.json()),
      fetch(`${API}/courseCategories`).then((r) => r.json()),
    ]).then(([depts, cats]) => {
      setDepts(Array.isArray(depts) ? depts : []);
      setCategories(Array.isArray(cats) ? cats : []);
    }).catch(() => {});
  }, []);

  // RawEnrollment[]를 Enrollment[]로 변환 (초기 로드용, useEffect보다 위에 선언)
  function convertToEnrollments(rawEnrollments: RawEnrollment[]): Promise<Enrollment[]> {
    return Promise.all(
      rawEnrollments.map((raw) =>
        fetch(`${API}/courses?id=${encodeURIComponent(raw.courseId)}`)
          .then((r) => r.json())
          .then((courses: unknown) => {
            const course = Array.isArray(courses) && courses.length > 0 ? courses[0] : null;
            if (!course) return null;
            return {
              courseId: raw.courseId,
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
            } as Enrollment;
          })
          .catch((error) => {
            console.error(`Failed to fetch course ${raw.courseId}:`, error);
            return null;
          })
      )
    ).then((results) => results.filter((e): e is Enrollment => e != null));
  }

  // Enrollment[]를 CourseSimulation[]로 변환 (recognizedAs 추가)
  function convertEnrollmentsToCourseSimulations(
    enrollments: Enrollment[],
    profileData: Profile
  ): CourseSimulation[] {
    return enrollments.map((e) => ({
      ...e,
      possibleClassifications: [],
      recognizedAs: null,
      internalRecognizedAs: null
    }));
  }

  // 초기 시나리오 데이터 생성
  const initializeSimulationData = useCallback((profileData: Profile): Promise<void> => {
    if (!profileData) return Promise.resolve();
    if (isLoadingSimulation) return Promise.resolve();

    // 기존 자동 저장 취소
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }

    setIsLoadingSimulation(true);
    return fetch(`${API}/profile/enrollments`, { credentials: 'include' })
      .then((r) => r.json())
      .then((enrollmentsData: { success?: boolean; enrollments?: unknown }) => {
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
        return convertToEnrollments(rawEnrollments);
      })
      .then((enrollments) => {
        const courseSimulations = convertEnrollmentsToCourseSimulations(enrollments, profileData);
        prevSimulationCoursesRef.current = [];
        setSimulationCourses(courseSimulations);
        setProfileEnrollmentsEmpty(enrollments.length === 0);
        setIsLoadingSimulation(false);
      })
      .catch((error) => {
        console.error('초기 데이터 생성 오류:', error);
        prevSimulationCoursesRef.current = [];
        setSimulationCourses([]);
        setProfileEnrollmentsEmpty(true);
        setIsLoadingSimulation(false);
      });
  }, [isLoadingSimulation]);

  // 프로필 정보 로드 및 필터 초기화
  useEffect(() => {
    if (profileLoaded) return;

    const loadProfile = () =>
      fetch(`${API}/profile`, { credentials: 'include' })
        .then((r) => r.json());

    const loadMe = () =>
      fetch(`${API}/auth/me`, { credentials: 'include' })
        .then((r) => r.json());

    const loadSimulations = () =>
      fetch(`${API}/simulation`, { credentials: 'include' })
        .then((r) => r.json());

    Promise.all([loadProfile(), loadMe(), loadSimulations()])
      .then(([profileRes, meRes, simulationsRes]) => {
        if (!meRes.success) {
          router.push('/login');
          setProfileLoaded(true);
          return Promise.reject();
        }
        if (!profileRes.success || !profileRes.profile) {
          router.push('/signup');
          setProfileLoaded(true);
          return Promise.reject();
        }
        const p = profileRes.profile as Profile;
        if (!p.studentId || !p.name || !p.admissionYear || !p.major) {
          router.push('/signup');
          setProfileLoaded(true);
          return Promise.reject();
        }
        setProfile(p);
        setFilters({
          requirementYear: p.admissionYear || new Date().getFullYear(),
          major: p.major || '',
          doubleMajors: Array.isArray(p.doubleMajors) ? p.doubleMajors : [],
          minors: Array.isArray(p.minors) ? p.minors : [],
          advancedMajor: p.advancedMajor || false,
          individuallyDesignedMajor: p.individuallyDesignedMajor || false,
          earlyGraduation: false,
        });
        setUserName(p.name || '');
        if (meRes.success && meRes.user) {
          setUserName((prev) => prev || meRes.user.email || '');
        }
        return initializeSimulationData(p).then(() => ({ profileRes, simulationsRes, p }));
      })
      .then((payload) => {
        if (!payload) return;
        const { profileRes, simulationsRes, p } = payload;
        if (!simulationsRes.success || !profileRes.success || !profileRes.profile) {
          if (simulationsRes.success) {
            const sims = (simulationsRes.simulations || []).map((sim: any) => ({
              id: sim.id,
              name: sim.title,
              date: new Date(sim.updatedAt).toLocaleDateString('ko-KR'),
            }));
            setPreviousSimulations(sims);
          }
          setProfileLoaded(true);
          return;
        }
        const sims = (simulationsRes.simulations || []).map((sim: any) => ({
          id: sim.id,
          name: sim.title,
          date: new Date(sim.updatedAt).toLocaleDateString('ko-KR'),
        }));
        setPreviousSimulations(sims);
        setProfileLoaded(true);
      })
      .catch(() => {
        router.push('/login');
        setProfileLoaded(true);
      });
  }, [profileLoaded, router, initializeSimulationData]);

  const deptName = (id: string) => depts.find((d) => d.id === id)?.name ?? id;

  // 과목 분류 변경 핸들러
  const handleClassificationChange = useCallback((course: CourseSimulation, classification: CreditType) => {
    setSimulationCourses((prev) =>
      prev.map((c) =>
        c.courseId === course.courseId &&
        c.enrolledYear === course.enrolledYear &&
        c.enrolledSemester === course.enrolledSemester
          ? { ...c, specifiedClassification: classification }
          : c
      )
    );
  }, []);

  // RawCourseSimulation[]를 CourseSimulation[]로 변환
  function convertRawSimulationsToCourseSimulations(
    rawSimulations: RawCourseSimulation[],
    _profileData: Profile
  ): Promise<CourseSimulation[]> {
    return Promise.all(
      rawSimulations.map((raw) =>
        fetch(`${API}/courses?id=${encodeURIComponent(raw.courseId)}`)
          .then((r) => r.json())
          .then((courses: unknown) => {
            const course = Array.isArray(courses) && courses.length > 0 ? courses[0] : null;
            if (!course) return null;
            return {
              courseId: raw.courseId,
              course: {
                id: course.id || raw.courseId,
                code: course.code || '',
                title: course.title || '',
                department: course.department || '',
                category: course.category || '',
                credit: course.credit || 0,
                au: course.au || 0,
                tags: course.tags || 0,
                level: course.level,
                crossRecognition: course.crossRecognition
              },
              enrolledYear: raw.enrolledYear,
              enrolledSemester: raw.enrolledSemester,
              grade: raw.grade,
              possibleClassifications: [],
              specifiedClassification: raw.recognizedAs,
              classification: undefined
            } as CourseSimulation;
          })
          .catch((error) => {
            console.error(`Failed to fetch course ${raw.courseId}:`, error);
            return null;
          })
      )
    ).then((results) => results.filter((c): c is CourseSimulation => c != null));
  }

  // 저장된 시나리오 로드
  const loadSimulation = useCallback(async (simulationId: string) => {
    if (!profile || isLoadingSimulation) return;

    // 기존 자동 저장 취소
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }

    setIsLoadingSimulation(true);
    try {
      const res = await fetch(`${API}/simulation/${simulationId}`, {
        credentials: 'include',
      });
      const data = await res.json();

      if (!data.success || !data.simulation) {
        alert(data.message || '시나리오를 불러오는데 실패했습니다.');
        setIsLoadingSimulation(false);
        return;
      }

      const sim = data.simulation;

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
      
      // 상태를 원자적으로 업데이트 (자동 저장이 트리거되지 않도록)
      prevSimulationCoursesRef.current = [];
      setSimulationCourses(courseSimulations);
      setFilters({
        requirementYear: sim.referenceYear || new Date().getFullYear(),
        major: sim.major || '',
        doubleMajors: Array.isArray(sim.doubleMajors) ? sim.doubleMajors : [],
        minors: Array.isArray(sim.minors) ? sim.minors : [],
        advancedMajor: sim.advancedMajor || false,
        individuallyDesignedMajor: sim.individuallyDesignedMajor || false,
        earlyGraduation: sim.earlyGraduation ?? false,
      });
      setCurrentSimulationId(simulationId);
      setIsLoadingSimulation(false);
    } catch (error) {
      console.error('시나리오 로드 오류:', error);
      alert('시나리오를 불러오는 중 오류가 발생했습니다.');
      setIsLoadingSimulation(false);
    }
  }, [profile, isLoadingSimulation]);

  // 자동 저장 함수
  const autoSave = useCallback(async () => {
    if (!currentSimulationId || !profile) return;

    // RawCourseSimulation[]로 변환
    const rawCourses: RawCourseSimulation[] = simulationCourses.map((cs) => ({
      courseId: cs.courseId,
      enrolledYear: cs.enrolledYear,
      enrolledSemester: cs.enrolledSemester,
      grade: cs.grade,
      recognizedAs: cs.specifiedClassification,
    }));

    try {
      const res = await fetch(`${API}/simulation/${currentSimulationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          referenceYear: filters.requirementYear,
          major: filters.major,
          doubleMajors: filters.doubleMajors,
          minors: filters.minors,
          advancedMajor: filters.advancedMajor,
          individuallyDesignedMajor: filters.individuallyDesignedMajor,
          earlyGraduation: filters.earlyGraduation,
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
    if (!currentSimulationId || isLoadingSimulation) return;

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
  }, [simulationCourses, filters, currentSimulationId, autoSave, isLoadingSimulation]);

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
      setIsSearching(false);
      if (selectedCourseIdsRef.current.size > 0) {
        updateSelectedCourseIds(new Set());
      }
      return;
    }

    setIsSearching(true);
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
          setIsSearching(false);
          
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
          setIsSearching(false);
          // 에러 발생 시 선택 해제
          if (selectedCourseIdsRef.current.size > 0) {
            updateSelectedCourseIds(new Set());
          }
        });
    }, 500); // 디바운스

    return () => {
      clearTimeout(timeoutId);
      setIsSearching(false);
    };
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
        level: course.level,
        crossRecognition: course.crossRecognition,
      };

      newCourses.push({
        courseId: finalCourseId, // UUID 저장
        course: courseObj,
        enrolledYear: targetSemester.year,
        enrolledSemester: targetSemester.semester,
        grade: addGrade,
        possibleClassifications: [],
        specifiedClassification: null,
        // recognizedAs: determineRecognizedAs(courseObj, profile),
        classification: null,
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

  // 학기 이동
  const handleMove = useCallback(
    (simulation: CourseSimulation, newYear: number, newSemester: Semester) => {
      const newCourses = simulationCourses.map((c) =>
        c.courseId === simulation.courseId &&
        c.enrolledYear === simulation.enrolledYear &&
        c.enrolledSemester === simulation.enrolledSemester
          ? { ...c, enrolledYear: newYear, enrolledSemester: newSemester }
          : c
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
          level: draggedCourse.level,
          crossRecognition: draggedCourse.crossRecognition,
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
          possibleClassifications: [],
          specifiedClassification: null,
          classification: null
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
    const prevFilters = prevFiltersRef.current;
    
    // 배열 길이 변경 체크 (추가/삭제)
    const lengthChanged = prev.length !== simulationCourses.length;
    
    // recognizedAs 속성 변경 체크
    const recognizedAsChanged = prev.some((p, i) => {
      const current = simulationCourses[i];
      if (!current) return true; // 항목이 삭제된 경우
      
      // recognizedAs 비교 (깊은 비교 필요)
      const prevRecognizedAs = JSON.stringify(p.specifiedClassification);
      const currentRecognizedAs = JSON.stringify(current.specifiedClassification);
      return prevRecognizedAs !== currentRecognizedAs;
    }) || simulationCourses.some((current, i) => {
      const prevItem = prev[i];
      if (!prevItem) return true; // 항목이 추가된 경우
      
      const prevRecognizedAs = JSON.stringify(prevItem.specifiedClassification);
      const currentRecognizedAs = JSON.stringify(current.specifiedClassification);
      return prevRecognizedAs !== currentRecognizedAs;
    });
    
    // 필터 변경 체크
    const filtersChanged = JSON.stringify(prevFilters) !== JSON.stringify(filters);
    
    // 변경사항이 있는 경우에만 재계산
    if (lengthChanged || recognizedAsChanged || filtersChanged) {
      // 필터가 변경되면 ref 업데이트
      if (filtersChanged) {
        prevFiltersRef.current = filters;
      }
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
        const majorForBE = filters.major || profile?.major || '';
        if (!majorForBE) return { type: 'basicElective', data: [] as Requirement[] };
        const res = await fetch(`${API}/rules/major?year=${profile?.admissionYear}&department=${majorForBE}&type=${filters.doubleMajors.length > 0 ? 'BE_D' : 'BE'}`);
        const data = await res.json();
        return { type: 'basicElective', data: (data.requirements || []) as Requirement[] };
      })());
      promises.push((async () => {
        if (!filters.major) return { type: 'major', data: [] as Requirement[] };
        const res = await fetch(`${API}/rules/major?year=${filters.requirementYear}&department=${filters.major}&type=Major`);
        const data = await res.json();
        return { type: 'major', data: (data.requirements || []) as Requirement[] };
      })());
      (filters.doubleMajors || []).forEach(d => {
        promises.push((async () => {
          const res = await fetch(`${API}/rules/major?year=${filters.requirementYear}&department=${d}&type=DoubleMajor`);
          const data = await res.json();
          return { type: 'doubleMajor', department: d, data: (data.requirements || []) as Requirement[] };
        })());
      });
      (filters.minors || []).forEach(d => {
        promises.push((async () => {
          const res = await fetch(`${API}/rules/major?year=${filters.requirementYear}&department=${d}&type=Minor`);
          const data = await res.json();
          return { type: 'minor', department: d, data: (data.requirements || []) as Requirement[] };
        })());
      });
      if (filters.advancedMajor && filters.major) {
        promises.push((async () => {
          const res = await fetch(`${API}/rules/major?year=${filters.requirementYear}&department=${filters.major}&type=AdvancedMajor`);
          const data = await res.json();
          return { type: 'advancedMajor', data: (data.requirements || []) as Requirement[] };
        })());
      }
      promises.push((async () => {
        if (!filters.major) return { type: 'research', data: [] as Requirement[] };
        const res = await fetch(`${API}/rules/major?year=${profile?.admissionYear}&department=${filters.major}&type=${filters.doubleMajors.length > 0 ? 'RS_D' : 'RS'}`);
        const data = await res.json();
        return { type: 'research', data: (data.requirements || []) as Requirement[] };
      })());
      if (filters.individuallyDesignedMajor) {
        promises.push((async () => {
          const res = await fetch(`${API}/rules/general?year=${profile?.admissionYear}&type=IDM`);
          const data = await res.json();
          return { type: 'individuallyDesignedMajor', data: (data.requirements || []) as Requirement[] };
        })());
      }
      promises.push((async () => {
        const res = await fetch(`${API}/rules/general?year=${profile?.admissionYear}&type=MGC`);
        const data = await res.json();
        return { type: 'mandatoryGeneralCourses', data: (data.requirements || []) as Requirement[] };
      })());
      promises.push((async () => {
        const res = await fetch(`${API}/rules/general?year=${profile?.admissionYear}&type=${filters.doubleMajors.length > 0 ? 'HSE_D' : 'HSE'}`);
        const data = await res.json();
        return { type: 'humanitiesSocietyElective', data: (data.requirements || []) as Requirement[] };
      })());

      // 대체과목 데이터 로드
      const substitutionPromise = (async () => {
        try {
          const year = filters.requirementYear || profile?.admissionYear || new Date().getFullYear();
          const department = filters.major || profile?.major;
          const url = department 
            ? `${API}/substitutions?year=${year}&department=${department}`
            : `${API}/substitutions?year=${year}`;
          const res = await fetch(url);
          const data = await res.json();
          if (data.success) {
            return {
              map: data.map || {},
              reverse: data.reverse || {},
              groups: data.groups || {},
            } as SubstitutionMap;
          }
          return { map: {}, reverse: {}, groups: {} } as SubstitutionMap;
        } catch (error) {
          console.error('Error loading substitutions:', error);
          return { map: {}, reverse: {}, groups: {} } as SubstitutionMap;
        }
      })();

      Promise.allSettled([...promises, substitutionPromise])
        .then((results) => {
          let requirements: RequirementsProps = { basicRequired: [], basicElective: [], mandatoryGeneralCourses: [], humanitiesSocietyElective: [], major: [], doubleMajors: {}, minors: {} };
          let substitutionMap: SubstitutionMap | undefined;

          results.forEach((result, index) => {
            if (result.status !== 'fulfilled')
              return;

            // 마지막 결과는 대체과목 데이터
            if (index === results.length - 1) {
              const map = result.value as SubstitutionMap;
              setSubstitutionMap(map);
              substitutionMap = map;
              return;
            }

            const value = result.value as { type: string; department?: string; data?: Requirement[] };
            const data = value.data || []; // undefined인 경우 빈 배열로 처리
            switch (value.type) {
              case 'basicRequired':
                requirements.basicRequired = data;
                break;
              case 'basicElective':
                requirements.basicElective = data;
                break;
              case 'mandatoryGeneralCourses':
                requirements.mandatoryGeneralCourses = data;
                break;
              case 'humanitiesSocietyElective':
                requirements.humanitiesSocietyElective = data;
                break;
              case 'major':
                requirements.major = data;
                break;
              case 'doubleMajor':
                if (value.department) {
                  requirements.doubleMajors![value.department] = data;
                }
                break;
              case 'minor':
                if (value.department) {
                  requirements.minors![value.department] = data;
                }
                break;
              case 'advancedMajor':
                requirements.advanced = data;
                break;
              case 'individuallyDesignedMajor':
                requirements.individuallyDesignedMajor = data;
                break;
              case 'research':
                requirements.research = data;
            }
          });

          const { enrolledCourses, requirements: evaluatedRequirements } = classifyCourses(
            simulationCourses, 
            requirements, 
            filters.major,
            undefined,
            substitutionMap
          );
          setSimulationCourses(enrolledCourses);
          prevSimulationCoursesRef.current = enrolledCourses;

          const sectionFilters: SimulationSectionFilters = {
            major: filters.major,
            doubleMajors: filters.doubleMajors || [],
            minors: filters.minors || [],
            advancedMajor: filters.advancedMajor,
            individuallyDesignedMajor: filters.individuallyDesignedMajor,
          };
          const updatedSections = buildSectionsWithRequirements(enrolledCourses, requirements, sectionFilters, {
            getDeptName,
            includeOtherAndUnclassified: true,
          });

          setSections(updatedSections);

          // 과목 추가만 / 학점 인정 분야만 변경된 경우에는 접기 상태 유지. 초기 로드, 과목 삭제, 필터·시나리오 변경 시에는 달성된 섹션 접기
          const onlyAddedCourses = prev.length > 0 && lengthChanged && simulationCourses.length > prev.length && !filtersChanged;
          const onlyClassificationChanged = prev.length > 0 && !lengthChanged && recognizedAsChanged && !filtersChanged;
          if (!onlyAddedCourses && !onlyClassificationChanged) {
            const newCollapsedSections = new Set<string>();
            updatedSections.forEach((s) => {
              const sectionKey = `center-${s.id}`;
              if (s.fulfilled) {
                newCollapsedSections.add(sectionKey);
              }
            });
            setCollapsedSections(newCollapsedSections);
          }
        });
    } else {
      // 변경사항이 없어도 ref는 최신 상태로 유지
      prevSimulationCoursesRef.current = simulationCourses;
      prevFiltersRef.current = filters;
    }
  }, [simulationCourses, filters, profile, depts]);

  // substitutionMap이 변경될 때 sections를 강제로 업데이트하여 CourseBar가 다시 렌더링되도록 함
  useEffect(() => {
    if (!substitutionMap || sections.length === 0) return;
    
    // substitutionMap이 로드된 후 sections를 강제로 업데이트하여 CourseBar가 다시 렌더링되도록 함
    // sections의 참조를 변경하여 React가 변경을 감지하도록 함
    setSections(prevSections => [...prevSections]);
  }, [substitutionMap]);

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
  const toggleSection = useCallback((sectionId: string, force?: boolean) => {
    setCollapsedSections((prev) => {
      const newSet = new Set(prev);
      if (force === false || (force === undefined && newSet.has(sectionId))) {
        newSet.delete(sectionId);
      } else if (force === true || (force === undefined && !newSet.has(sectionId))) {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  // 키보드로 섹션 접기/필치기
  const keyboardToggleSection = (e: KeyboardEvent<HTMLButtonElement>, sectionId: string) => {
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        toggleSection(sectionId, true);
        break;
      case 'ArrowRight':
        e.preventDefault();
        toggleSection(sectionId, false);
        break;
    }
  };

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
    let resultCourses = simulationCourses.map((c) => ({...c})).sort((a, b) => {
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
        // 대체과목 관련 재수강 확인 (단방향: 대체과목을 먼저 수강한 경우에만 원본 과목을 재수강으로 처리)
        const currentCode = c.course.code;
        const substitutes = substitutionMap?.map[currentCode] || []; // 현재 과목의 대체과목 목록
        
        // 현재 과목이 원본 과목이고, 이전에 대체과목을 수강한 경우 재수강 처리
        if (substitutes.length > 0) {
          // 이전에 수강한 대체과목 찾기 (현재 과목보다 먼저 수강한 것)
          const previousSubstituteEnrollments = resultCourses.filter(ec => {
            if (ec.enrolledYear > c.enrolledYear) return false;
            if (ec.enrolledYear === c.enrolledYear) {
              const semesterOrder = ['SPRING', 'SUMMER', 'FALL', 'WINTER'];
              const currentSemesterIndex = semesterOrder.indexOf(c.enrolledSemester);
              const ecSemesterIndex = semesterOrder.indexOf(ec.enrolledSemester);
              if (ecSemesterIndex >= currentSemesterIndex) return false;
            }
            return substitutes.includes(ec.course.code) && 
                   !['F', 'W', 'NR', 'U'].includes(ec.grade);
          });
          
          if (previousSubstituteEnrollments.length > 0) {
            // 대체과목을 먼저 수강했으므로 원본 과목은 재수강으로 처리
            c.classification = { type: 'UNRECOGNIZED' };
          } else {
            // 대체과목을 먼저 수강하지 않았으므로 정상 처리
            c.classification = null;
          }
        } else {
          // 일반 재수강 확인 (같은 과목 코드를 여러 번 수강한 경우)
          const sameCodeEnrollments = resultCourses.filter(ec => 
            ec.course.code === currentCode
          );
          
          if (sameCodeEnrollments.length > 1) {
            // 같은 과목 코드 중 가장 최근 수강 이력 찾기
            const finalEnrollment = sameCodeEnrollments
              .filter(course => {
                return !['F', 'W', 'NR', 'U'].includes(course.grade)
              })
              .sort((a, b) => {
                if (a.enrolledYear !== b.enrolledYear) 
                  return b.enrolledYear - a.enrolledYear;
                const semesterOrder = ['SPRING', 'SUMMER', 'FALL', 'WINTER'];
                return semesterOrder.indexOf(b.enrolledSemester) - 
                       semesterOrder.indexOf(a.enrolledSemester);
              })[0];
            
            const isFinalEnrollment = 
              finalEnrollment.enrolledYear === c.enrolledYear && 
              finalEnrollment.enrolledSemester === c.enrolledSemester &&
              finalEnrollment.course.code === c.course.code;
            
            if (isFinalEnrollment)
              // 최종 수강 이력인 경우
              c.classification = null;
            else
              // 아닌 경우 (성적 무효, 재수강으로 처리)
              c.classification = { type: 'UNRECOGNIZED' };
          } else
            // 재수강한 이력이 없음
            c.classification = null;
        }
      }
    });
    // 계산 대상 과목 --- 재수강, 낙제, 수강취소 제외
    const targetCourses = resultCourses.filter(c => c.classification?.type !== 'UNRECOGNIZED');

    const totalCredit = targetCourses.reduce((sum, c) => sum + (c.course.credit || 0), 0);
    const totalAu = targetCourses.reduce((sum, c) => sum + (c.course.au || 0), 0);
    
    // 평점 계산: F, W, U, NR, S, P는 제외, 학점이 0보다 큰 과목만 포함
    let totalGradePoints = 0;
    let totalCreditsForGPA = 0;
    
    targetCourses.forEach((c) => {
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

  const sectionFilters: SimulationSectionFilters = useMemo(
    () => ({
      major: filters.major,
      doubleMajors: filters.doubleMajors || [],
      minors: filters.minors || [],
      advancedMajor: filters.advancedMajor,
      individuallyDesignedMajor: filters.individuallyDesignedMajor,
    }),
    [filters.major, filters.doubleMajors, filters.minors, filters.advancedMajor, filters.individuallyDesignedMajor]
  );

  const baseSections = useMemo(
    () =>
      buildSectionsFromClassifiedCourses(simulationCourses, sectionFilters, {
        getDeptName: deptName,
        includeOtherAndUnclassified: true,
      }),
    [simulationCourses, sectionFilters, depts]
  );

  const [sections, setSections] = useState<Section[]>(baseSections.map(s => ({ ...s, requirements: [] })));

  // 졸업 가능 여부 계산
  const canGraduate = useMemo(() => {
    // 1. 자유선택이나 미분류 섹션을 제외하고 모든 섹션이 fulfilled === true
    const requiredSections = sections.filter(s => s.id !== 'OTHER_ELECTIVE' && s.id !== 'UNCLASSIFIED');
    const allSectionsFulfilled = requiredSections.length > 0 && requiredSections.every(s => s.fulfilled);

    // 2. 전체 이수학점이 138 이상
    const creditRequirementMet = totalStats.totalCredit >= 138;

    // 3. AU가 4 이상
    const auRequirementMet = totalStats.totalAu >= 4;

    // 4. 평점이 2.0 이상 (조기졸업이면 3.0)
    const gpaRequirementMet = parseFloat(totalStats.gpa) >= (filters.earlyGraduation ? 3.0 : 2.0);

    // 5. 자유융합전공이나 심화전공을 하거나 복전이나 부전을 1개 이상의 학과에서 해야 함
    const hasAdvancedMajor = filters.advancedMajor;
    const hasIndividuallyDesignedMajor = filters.individuallyDesignedMajor;
    const hasDoubleMajor = filters.doubleMajors && filters.doubleMajors.length > 0;
    const hasMinor = filters.minors && filters.minors.length > 0;
    const specializationRequirementMet = hasAdvancedMajor || hasIndividuallyDesignedMajor || hasDoubleMajor || hasMinor;

    return allSectionsFulfilled && creditRequirementMet && auRequirementMet && gpaRequirementMet && specializationRequirementMet;
  }, [sections, totalStats, filters]);

  // baseSections가 변경되면 sections 업데이트 (requirements는 792-945행의 useEffect에서 처리)
  useEffect(() => {
    // requirements는 792-945행의 useEffect에서 처리되므로, 여기서는 courses만 업데이트
    setSections(prevSections => {
      return baseSections.map(baseSection => {
        const existingSection = prevSections.find(s => s.id === baseSection.id);
        return {
          ...baseSection,
          requirements: existingSection?.requirements || [],
          fulfilled: existingSection?.fulfilled ?? false
        };
      });
    });
  }, [baseSections]);

  // 섹션을 그룹화: 주전공/심화전공/연구를 하나의 그룹으로
  const groupedSections = useMemo(() => groupSections(sections), [sections, substitutionMap]);


  return (
    <>
      {/* 데스크톱 UI */}
      <div className={`h-screen hidden md:flex md:flex-col bg-gray-50 dark:bg-zinc-900 select-none transition-all duration-300 overflow-hidden ${sidebarOpen ? 'pl-100' : ''}`}>
        {/* 상단 바 */}
        <DesktopTopBar
          left={<>
            <Button
              size="small"
              style="simple"
              activeScale={85}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? '메뉴 접기' : '메뉴 펼치기'}
              className="flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>
            <div className="text-xl flex items-center gap-2">
              <Logo language={lang} />
              <button
                ref={scenarioNameButtonRef}
                type="button"
                onClick={() => setDesktopScenarioPopoverOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors truncate max-w-[200px]"
                title={currentSimulationName}
              >
                <span className="truncate">{currentSimulationName}</span>
                <svg className={`w-4 h-4 flex-shrink-0 transition-transform ${desktopScenarioPopoverOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </>}
          right={<>
            <Button
              size="small"
              style="simple"
              onClick={() => setShowReportDialog(true)}
            >
              보고서 보기
            </Button>
            <Link
              ref={profileLinkDesktopRef}
              href="/profile/settings"
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors active:scale-90"
              title={userName || '프로필 설정'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="hidden lg:inline truncate max-w-[120px]">{userName || '프로필'}</span>
            </Link>
            <button
              type="button"
              onClick={async () => {
                try {
                  await fetch(`${API}/auth/logout`, {
                    method: 'POST',
                    credentials: 'include',
                  });
                } catch (error) {
                  console.error('로그아웃 오류:', error);
                }
                router.push('/login');
              }}
              className="flex items-center justify-center p-2 rounded-lg hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/30 active:scale-90 transition-all"
              title="로그아웃"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </>}
        />

        {/* 데스크톱 시나리오 말풍선 팝업 */}
        {desktopScenarioPopoverOpen && scenarioPopoverAnchor && typeof document !== 'undefined' && createPortal(
          <>
            <div
              className="fixed inset-0 z-[60]"
              aria-hidden
              onClick={() => setDesktopScenarioPopoverOpen(false)}
            />
            <div
              className="fixed z-[61] w-80 max-h-[min(70vh,400px)] flex flex-col rounded-xl shadow-xl border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 overflow-hidden"
              style={{
                left: scenarioPopoverAnchor.left,
                top: scenarioPopoverAnchor.top + 8,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 말풍선 꼬리 - 버튼 중앙에 맞춤 */}
              <div
                className="absolute w-3 h-3 rotate-45 bg-gray-50 dark:bg-zinc-900 border-l border-t border-gray-200 dark:border-zinc-700"
                style={{
                  left: Math.min(Math.max(scenarioPopoverAnchor.width / 2 - 6, 12), 296),
                  top: -7,
                }}
              />
              <div className="relative flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                <Button
                  style="standard"
                  isActive={currentSimulationId === null}
                  onClick={() => {
                    if (profile) {
                      setCurrentSimulationId(null);
                      setFilters((prev) => ({ ...prev, earlyGraduation: false }));
                      initializeSimulationData(profile);
                    }
                    setDesktopScenarioPopoverOpen(false);
                  }}
                  className="w-full justify-start gap-2"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm font-medium">{lang === 'ko' ? '새로운 시나리오' : 'New scenario'}</span>
                </Button>
                {previousSimulations.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">{lang === 'ko' ? '저장된 시나리오가 없습니다.' : 'No saved scenarios.'}</p>
                ) : (
                  <div className="space-y-1">
                    {previousSimulations.map((sim) => (
                      <div
                        key={sim.id}
                        onClick={() => {
                          if (currentSimulationId !== sim.id) loadSimulation(sim.id);
                          setDesktopScenarioPopoverOpen(false);
                        }}
                        className={`flex items-center gap-2 rounded-lg p-2 cursor-pointer transition-all active:scale-[0.98] ${
                          currentSimulationId === sim.id
                            ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{sim.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{sim.date}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!confirm(lang === 'ko' ? '정말 이 시나리오를 삭제하시겠습니까?' : 'Delete this scenario?')) return;
                            fetch(`${API}/simulation/${sim.id}`, {
                              method: 'DELETE',
                              credentials: 'include',
                            })
                              .then((r) => r.json())
                              .then((data) => {
                                if (data.success) {
                                  setPreviousSimulations((prev) => prev.filter((s) => s.id !== sim.id));
                                  if (currentSimulationId === sim.id) {
                                    setCurrentSimulationId(null);
                                    if (profile) initializeSimulationData(profile);
                                  }
                                } else {
                                  alert(data.message || (lang === 'ko' ? '삭제에 실패했습니다.' : 'Delete failed.'));
                                }
                              })
                              .catch((error) => {
                                console.error('삭제 오류:', error);
                                alert(lang === 'ko' ? '삭제 중 오류가 발생했습니다.' : 'An error occurred.');
                              });
                          }}
                          className="flex-shrink-0 p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          title={lang === 'ko' ? '삭제' : 'Delete'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-gray-200 dark:border-zinc-700">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{lang === 'ko' ? '시나리오 저장' : 'Save scenario'}</h3>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={saveName}
                    onChange={setSaveName}
                    placeholder={lang === 'ko' ? '시나리오 이름' : 'Scenario name'}
                    size="small"
                    className="flex-1 min-w-0"
                  />
                  <Button
                    style="prominent"
                    size="small"
                    onClick={async () => {
                      const success = await handleSaveSimulation(saveName);
                      if (success) setDesktopScenarioPopoverOpen(false);
                    }}
                    innerClassName="whitespace-nowrap"
                  >
                    {lang === 'ko' ? '저장' : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          </>,
          document.body
        )}

        {/* 사이드바 */}
        <aside
          className={`w-100 fixed top-12 bottom-0 left-0 z-30 p-2 transition-all duration-300 overflow-hidden ${sidebarOpen ? '' : '-translate-x-full'}`}
        >
          <div
            className={`flex-1 overflow-y-hidden overflow-x-hidden space-y-2 transition-all p-4 rounded-2xl bg-gray-50/50 dark:bg-zinc-900/50 backdrop-blur-md border border-gray-200/50 dark:border-zinc-700/50 shadow-lg w-full h-full flex flex-col ${
              sidebarOpen ? '' : ''
            }`}
          >
            <div className="flex flex-row gap-2">
              <Button
                style="simple"
                size="small"
                isActive={sidebarTab == 'addCourse'}
                className="flex-1"
                onClick={() => setSidebarTab('addCourse')}
              >과목 추가</Button>
              <Button
                style="simple"
                size="small"
                isActive={sidebarTab == 'selectMajors'}
                className="flex-1"
                onClick={() => setSidebarTab('selectMajors')}
              >시나리오 설정</Button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 pt-0">
              {sidebarTab === 'addCourse' && (
                <AddCoursePanel
                  searchQuery={courseSearchQuery}
                  onSearchQueryChange={setCourseSearchQuery}
                  searchResults={searchResults}
                  isSearching={isSearching}
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
                  enrolledCourseIds={simulationCourses.map((cs) => cs.courseId)}
                />
              )}

              {sidebarTab === 'selectMajors' && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      주전공
                    </label>
                    <DepartmentDropdown
                      lang={lang}
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
                      lang={lang}
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
                      lang={lang}
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

                  <hr className="border-none h-px bg-gray-300 dark:bg-zinc-700" />

                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      전공 이수 기준 연도
                    </label>
                    <div className="flex flex-row text-sm items-baseline gap-1">
                      <NumberInput
                        min="2016"
                        max="2050"
                        value={filters.requirementYear}
                        onChange={(newValue) => setFilters({ ...filters, requirementYear: parseInt(newValue) })}
                        size="small"
                        className="flex-1"
                      />
                      <span>년</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="earlyGraduation" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      조기졸업
                    </label>
                    <Select
                      id="earlyGraduation"
                      value={filters.earlyGraduation ? 'true' : 'false'}
                      onChange={(newValue) => setFilters({ ...filters, earlyGraduation: newValue === 'true' })}
                      size="small"
                      className="min-w-16"
                    >
                      <option value="false">아니오</option>
                      <option value="true">예</option>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="honorStudent" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      Honor Student
                    </label>
                    <Select
                      id="honorStudent"
                      // value={filters.individuallyDesignedMajor ? 'true' : 'false'}
                      // onChange={(newValue) => setFilters({ ...filters, individuallyDesignedMajor: newValue === 'true' })}
                      value={false}
                      onChange={() => {}}
                      size="small"
                      className="min-w-16"
                    >
                      <option value="false">아니오</option>
                      <option value="true">예</option>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* 메인 컨텐츠 */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden items-stretch px-4 gap-4">
          {/* 상단 바 */}
          <div className="hidden flex-shrink-0">
            <div className="py-4 overflow-x-auto">
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
                    lang={lang}
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
                    lang={lang}
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
                    lang={lang}
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
                <div className="flex flex-col gap-1">
                  <label htmlFor="earlyGraduation" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    조기졸업
                  </label>
                  <Select
                    id="earlyGraduation"
                    value={filters.earlyGraduation ? 'true' : 'false'}
                    onChange={(newValue) => setFilters({ ...filters, earlyGraduation: newValue === 'true' })}
                    size="small"
                    className="min-w-16"
                  >
                    <option value="false">아니오</option>
                    <option value="true">예</option>
                  </Select>
                </div>
                <div className="hidden flex flex-col gap-1">
                  <label htmlFor="honorStudent" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    Honor Student
                  </label>
                  <Select
                    id="honorStudent"
                    // value={filters.individuallyDesignedMajor ? 'true' : 'false'}
                    // onChange={(newValue) => setFilters({ ...filters, individuallyDesignedMajor: newValue === 'true' })}
                    value={true}
                    onChange={() => {}}
                    size="small"
                    className="min-w-16"
                  >
                    <option value="false">아니오</option>
                    <option value="true">예</option>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* 2분할 래퍼 */}
          <div className="flex-1 min-h-0 flex flex-row space-between justify-center overflow-hidden gap-4">
            {/* 가운데: 섹션별 요건 계산에 사용된 과목 */}
            <div className="max-w-160 w-160 min-h-0 flex flex-col overflow-hidden transition-all duration-300">
              {/* 제목 영역 */}
              <div className="flex items-center justify-between gap-4 mb-2 px-6">
                <h2 className="text-lg font-bold shrink-0">이수한 과목</h2>
                <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                  <Button
                    size="exsmall"
                    style="standard"
                    onClick={() => setGradeBlindMode(!gradeBlindMode)}
                    title={gradeBlindMode ? '성적 표시' : '성적 숨기기'}
                    className="shrink-0"
                  >
                    {gradeBlindMode ? '성적 표시' : '성적 숨기기'}
                  </Button>
                  <div className="min-w-0 flex-1 max-w-40">
                    <Select
                      size="exsmall"
                      value={coursesGrouping}
                      onChange={(value) => setCoursesGrouping(value as 'bySemester' | 'byCategory')}
                    >
                      <option value="bySemester">학기별</option>
                      <option value="byCategory">카테고리별</option>
                    </Select>
                  </div>
                </div>
              </div>

              {/* 본문 영역 */}
              <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-8 relative">
                <div className="sticky top-0 z-10 h-2 bg-gradient-to-t from-transparent via-gray-50/80 to-gray-50 dark:via-zinc-900/80 dark:to-zinc-900"></div>

                {isLoadingSimulation && (
                  <div className="absolute inset-0 z-20 bg-gray-50/80 dark:bg-zinc-900/80 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 dark:border-violet-400"></div>
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">로드 중...</p>
                    </div>
                  </div>
                )}

                {coursesGrouping === 'bySemester' && (
                  <EnrollmentsList
                    enrollments={enrollmentsForList}
                    semesterGroups={semesterGroups}
                    sortedSemesterKeys={sortedSemesterKeys}
                    selectedEnrollmentKeys={selectedEnrollmentKeys}
                    onSelectionChange={setSelectedEnrollmentKeys}
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
                    onMove={(enrollment, newYear, newSemester) => {
                      const cs = simulationCourses.find(
                        (c) =>
                          c.courseId === enrollment.courseId &&
                          c.enrolledYear === enrollment.enrolledYear &&
                          c.enrolledSemester === enrollment.enrolledSemester
                      );
                      if (cs) {
                        handleMove(cs, newYear, newSemester);
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
                    onRemoveSelected={() => {
                      // simulation에서는 선택 삭제 기능 사용 안 함
                      setSelectedEnrollmentKeys(new Set());
                    }}
                    onRemoveAll={() => {
                      // simulation에서는 전체 삭제 기능 사용 안 함
                      setSelectedEnrollmentKeys(new Set());
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
                )}

                {coursesGrouping === 'byCategory' && (
                  <div>
                    {sections.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-zinc-400 py-4">
                        주전공을 선택하면 섹션이 구성됩니다.
                      </p>
                    ) : (
                      <>
                        {/* 기초과목 그룹 */}
                        {groupedSections.basicGroup.length > 0 && (
                          <div className="bg-white dark:bg-black rounded-lg overflow-hidden shadow-lg">
                            {groupedSections.basicGroup.map((s, i) => {
                              const isCollapsed = collapsedSections.has(s.id);
                              return (
                                <div key={s.id}>
                                  <Accordion isCollapsed={isCollapsed} onTitleClick={() => toggleSection(s.id)} onTitleKeyDown={(e) => keyboardToggleSection(e, s.id)}>
                                    <ACTitle>
                                      <h3 className="font-medium text-base flex-1 leading-tight">{s.title}</h3>
                                      <p className="text-gray-600 dark:text-zinc-400 text-sm leading-tight">{calculateSectionCredits(s.courses)}</p>
                                    </ACTitle>
                                    <ACBody>
                                      <div className="space-y-2">
                                        {s.courses.length === 0 ? (
                                          <p className="text-sm text-gray-500 dark:text-zinc-400 leading-tight">인정 과목 없음</p>
                                        ) : (
                                          s.courses.map((c) => (
                                            <CourseBar 
                                              key={`${c.enrolledYear}-${c.enrolledSemester}-${c.courseId}`} 
                                              course={c} 
                                              gradeBlindMode={gradeBlindMode}
                                              onClassificationChange={handleClassificationChange}
                                              getDeptName={deptName}
                                              substitutionMap={substitutionMap}
                                              majorDepartment={filters.major}
                                            />
                                          ))
                                        )}
                                      </div>
                                    </ACBody>
                                  </Accordion>
                                  {i < groupedSections.basicGroup.length - 1 && (
                                    <div className="border-t border-gray-200 dark:border-zinc-700"></div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )} 

                        {/* 주전공/심화전공/연구 그룹 */}
                        {groupedSections.majorGroup.length > 0 && (
                          <>
                            <div className="mt-6 bg-white dark:bg-black rounded-lg overflow-hidden shadow-lg">
                              {groupedSections.majorGroup.map((s, idx) => {
                                const isCollapsed = collapsedSections.has(s.id);
                                return (
                                  <div key={s.id}>
                                    <Accordion isCollapsed={isCollapsed} onTitleClick={() => toggleSection(s.id)} onTitleKeyDown={(e) => keyboardToggleSection(e, s.id)}>
                                      <ACTitle>
                                        <h3 className="font-medium text-base flex-1 leading-tight">
                                          {s.titleElements.length > 1 ? (
                                            <>
                                              <span className="text-gray-400 dark:text-zinc-500">{s.titleElements[0]}: </span>
                                              <span>{s.titleElements.slice(1).join(' ')}</span>
                                            </>
                                          ) : s.titleElements[0]}
                                        </h3>
                                        <p className="text-gray-600 dark:text-zinc-400 text-sm leading-tight">{calculateSectionCredits(s.courses)}</p>
                                      </ACTitle>
                                      <ACBody>
                                        <div className="space-y-2">
                                          {s.courses.length === 0 ? (
                                            <p className="text-sm text-gray-500 dark:text-zinc-400 leading-tight">인정 과목 없음</p>
                                          ) : (
                                            s.courses.map((c) => (
                                              <CourseBar 
                                                key={`${c.enrolledYear}-${c.enrolledSemester}-${c.courseId}`} 
                                                course={c} 
                                                gradeBlindMode={gradeBlindMode}
                                                onClassificationChange={handleClassificationChange}
                                                getDeptName={deptName}
                                                majorDepartment={filters.major}
                                              />
                                            ))
                                          )}
                                        </div>
                                      </ACBody>
                                    </Accordion>
                                    {idx < groupedSections.majorGroup.length - 1 && (
                                      <div className="border-t border-gray-200 dark:border-zinc-700"></div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                        
                        {/* 복전, 부전, 융전, 교필, 인선 */}
                        {groupedSections.otherSections.map((s) => {
                          const isCollapsed = collapsedSections.has(s.id);
                          return (
                            <div key={s.id} className="mt-6 bg-white dark:bg-black rounded-lg overflow-hidden shadow-lg">
                              <Accordion isCollapsed={isCollapsed} onTitleClick={() => toggleSection(s.id)} onTitleKeyDown={(e) => keyboardToggleSection(e, s.id)}>
                                <ACTitle>
                                  <h3 className="font-medium text-base flex-1 leading-tight">
                                    {s.titleElements.length > 1 ? (
                                      <>
                                        <span className="text-gray-400 dark:text-zinc-500">{s.titleElements[0]}: </span>
                                        <span>{s.titleElements.slice(1).join(' ')}</span>
                                      </>
                                    ) : s.titleElements[0]}
                                  </h3>
                                  <p className="text-gray-600 dark:text-zinc-400 text-sm leading-tight">{calculateSectionCredits(s.courses)}</p>
                                </ACTitle>
                                <ACBody>
                                  <div className="space-y-2">
                                    {s.courses.length === 0 ? (
                                      <p className="text-sm text-gray-500 dark:text-zinc-400 leading-tight">인정 과목 없음</p>
                                    ) : (
                                      s.courses.map((c) => (
                                        <CourseBar
                                          key={`${c.enrolledYear}-${c.enrolledSemester}-${c.courseId}`}
                                          course={c}
                                          gradeBlindMode={gradeBlindMode}
                                          onClassificationChange={handleClassificationChange}
                                          substitutionMap={substitutionMap}
                                          majorDepartment={filters.major}
                                        />
                                      ))
                                    )}
                                  </div>
                                </ACBody>
                              </Accordion>
                            </div>
                          );
                        })}

                        {/* 자선, 미분류 */}
                        {groupedSections.miscSections.map((s) => {
                          const isCollapsed = collapsedSections.has(s.id);
                          return s.courses.length === 0 ? null : (
                            <div key={s.id} className="mt-6 bg-white dark:bg-black rounded-lg overflow-hidden shadow-lg">
                              <Accordion isCollapsed={isCollapsed} onTitleClick={() => toggleSection(s.id)} onTitleKeyDown={(e) => keyboardToggleSection(e, s.id)}>
                                <ACTitle>
                                  <h3 className="font-medium text-base flex-1">{s.title}</h3>
                                  <p className="text-gray-600 dark:text-zinc-400">{calculateSectionCredits(s.courses)}</p>
                                </ACTitle>
                                <ACBody>
                                  <div className="space-y-2">
                                    {s.courses.map((c) => (
                                      <CourseBar
                                        key={`${c.enrolledYear}-${c.enrolledSemester}-${c.courseId}`}
                                        course={c}
                                        gradeBlindMode={gradeBlindMode}
                                        onClassificationChange={handleClassificationChange}
                                        substitutionMap={substitutionMap}
                                        majorDepartment={filters.major}
                                      />
                                    ))}
                                  </div>
                                </ACBody>
                              </Accordion>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 우측: 섹션별 세부 요건 달성 여부 */}
            <div className="max-w-160 w-160 min-h-0 flex flex-col overflow-hidden transition-all duration-300">
              {/* 제목 영역 */}
              <div className="flex items-center justify-between mb-2 px-6">
                <h2 className="text-lg font-bold">졸업 요건</h2>
              </div>

              {/* 본문 영역 */}
              <div className="flex-1 min-h-0 overflow-y-auto px-4 relative">
                <div className="sticky top-0 z-10 h-2 bg-gradient-to-t from-transparent via-gray-50/80 to-gray-50 dark:via-zinc-900/80 dark:to-zinc-900"></div>

                {isLoadingSimulation && (
                  <div className="absolute inset-0 z-20 bg-gray-50/80 dark:bg-zinc-900/80 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 dark:border-violet-400"></div>
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">로드 중...</p>
                    </div>
                  </div>
                )}

                {sections.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-zinc-400 py-4">
                    주전공을 선택하면 섹션이 구성됩니다.
                  </p>
                ) : (
                  <>
                    {/* 기초과목 */}
                    {groupedSections.basicGroup.length > 0 && (
                      <div className="bg-white dark:bg-black rounded-lg overflow-hidden shadow-lg">
                        {groupedSections.basicGroup.map((s, idx) => {
                          const requirements = s.requirements || [];
                          const isCollapsed = collapsedSections.has(`center-${s.id}`);
                          return (
                            <div key={s.id}>
                              <Accordion isCollapsed={isCollapsed} onTitleClick={() => toggleSection(`center-${s.id}`)} onTitleKeyDown={(e) => keyboardToggleSection(e, `center-${s.id}`)}>
                                <ACTitle>
                                  <h3 className="font-medium text-base flex-1 leading-tight">{s.title}</h3>
                                  {s.fulfilled ? (
                                    <p className="text-sm font-medium leading-tight text-green-600 dark:text-green-400">달성</p>
                                  ) : (
                                    <p className="text-sm font-medium leading-tight text-red-600 dark:text-red-400">미달</p>
                                  )}
                                </ACTitle>
                                <ACBody>
                                  {requirements.length > 0 ? (
                                    <div className="space-y-2">
                                      {requirements.map((req, reqIdx) => (
                                        <RequirementBar
                                          key={reqIdx}
                                          requirement={req}
                                          onMouseEnter={(e) => {
                                            if (req.title && req.title !== req.description && req.description !== undefined) {
                                              const rect = e.currentTarget.getBoundingClientRect();
                                              setTooltipState({
                                                text: req.description,
                                                x: rect.left + rect.width / 2,
                                                y: rect.top - 8
                                              });
                                            }
                                          }}
                                          onMouseLeave={() => {setTooltipState(null)}}
                                        />
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500 dark:text-zinc-400 leading-tight">요건 없음</p>
                                  )}
                                </ACBody>
                              </Accordion>
                              {idx < groupedSections.basicGroup.length - 1 && (
                                <div className="border-t border-gray-200 dark:border-zinc-700"></div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 주전공/심화전공/연구 그룹 */}
                    {groupedSections.majorGroup.length > 0 && (
                      <div className="mt-6 bg-white dark:bg-black rounded-lg overflow-hidden shadow-lg">
                        {groupedSections.majorGroup.map((s, idx) => {
                          const requirements = s.requirements || [];
                          const isCollapsed = collapsedSections.has(`center-${s.id}`);
                          return (
                            <div key={s.id}>
                              <Accordion isCollapsed={isCollapsed} onTitleClick={() => toggleSection(`center-${s.id}`)} onTitleKeyDown={(e) => keyboardToggleSection(e, `center-${s.id}`)}>
                                <ACTitle>
                                  <h3 className="font-medium text-base flex-1 leading-tight">
                                    {s.titleElements.length > 1 ? (
                                      <>
                                        <span className="text-gray-400 dark:text-zinc-500">{s.titleElements[0]}: </span>
                                        <span>{s.titleElements.slice(1).join(' ')}</span>
                                      </>
                                    ) : s.titleElements[0]}
                                  </h3>
                                  {s.fulfilled ? (
                                    <p className="text-sm font-medium leading-tight text-green-600 dark:text-green-400">달성</p>
                                  ) : (
                                    <p className="text-sm font-medium leading-tight text-red-600 dark:text-red-400">미달</p>
                                  )}
                                </ACTitle>
                                <ACBody>
                                  {requirements.length > 0 ? (
                                    <div className="space-y-2">
                                      {requirements.map((req, reqIdx) => (
                                        <RequirementBar
                                          key={reqIdx}
                                          requirement={req}
                                          onMouseEnter={(e) => {
                                            if (req.title && req.title !== req.description && req.description !== undefined) {
                                              const rect = e.currentTarget.getBoundingClientRect();
                                              setTooltipState({
                                                text: req.description,
                                                x: rect.left + rect.width / 2,
                                                y: rect.top - 8
                                              });
                                            }
                                          }}
                                          onMouseLeave={() => {setTooltipState(null)}}
                                        />
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500 dark:text-zinc-400 leading-tight">요건 없음</p>
                                  )}
                                </ACBody>
                              </Accordion>
                              {idx < groupedSections.majorGroup.length - 1 && (
                                <div className="border-t border-gray-200 dark:border-zinc-700"></div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* 복전, 부전, 융전, 교필, 인선 */}
                    {groupedSections.otherSections.map((s) => {
                      const requirements = s.requirements || [];
                      const isCollapsed = collapsedSections.has(`center-${s.id}`);
                      return (
                        <div key={s.id} className="mt-6 bg-white dark:bg-black rounded-lg overflow-hidden shadow-lg">
                          <Accordion isCollapsed={isCollapsed} onTitleClick={() => toggleSection(`center-${s.id}`)} onTitleKeyDown={(e) => keyboardToggleSection(e, `center-${s.id}`)}>
                            <ACTitle>
                              <h3 className="font-medium text-base flex-1 leading-tight">
                                {s.titleElements.length > 1 ? (
                                  <>
                                    <span className="text-gray-400 dark:text-zinc-500">{s.titleElements[0]}: </span>
                                    <span>{s.titleElements.slice(1).join(' ')}</span>
                                  </>
                                ) : s.titleElements[0]}
                              </h3>
                              {s.fulfilled ? (
                                <p className="text-sm font-medium leading-tight text-green-600 dark:text-green-400">달성</p>
                              ) : (
                                <p className="text-sm font-medium leading-tight text-red-600 dark:text-red-400">미달</p>
                              )}
                            </ACTitle>
                            <ACBody>
                              {requirements.length > 0 ? (
                                <div className="space-y-2">
                                  {requirements.map((req, reqIdx) => (
                                    <RequirementBar
                                      key={reqIdx}
                                      requirement={req}
                                      onMouseEnter={(e) => {
                                        if (req.title && req.title !== req.description && req.description !== undefined) {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          setTooltipState({
                                            text: req.description,
                                            x: rect.left + rect.width / 2,
                                            y: rect.top - 8
                                          });
                                        }
                                      }}
                                      onMouseLeave={() => {setTooltipState(null)}}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 dark:text-zinc-400 leading-tight">요건 없음</p>
                              )}
                            </ACBody>
                          </Accordion>
                        </div>
                      );
                    })}
                  </>
                )}

                {/* 요약 영역 */}
                <div className="sticky bottom-0 flex-shrink-0 mx-[-1rem]">
                  <div className="h-4 bg-gradient-to-b from-transparent to-gray-50 dark:to-zinc-900"></div>

                  <div className="px-6 pt-2 pb-4 flex items-center justify-between gap-4 whitespace-nowrap bg-gray-50 dark:bg-zinc-900">
                    <div className="flex items-center gap-4 flex-1">
                      <div>
                        <span className="text-xs text-gray-500 dark:text-zinc-400 block mb-1/2">이수 학점</span>
                        <p className="text-lg font-semibold"><AnimatedNumber value={totalStats.totalCredit} duration={380} /> <span className="text-xs text-gray-500 dark:text-zinc-400">/ 138</span></p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 dark:text-zinc-400 block mb-1/2">총 AU</span>
                        <p className="text-lg font-semibold"><AnimatedNumber value={totalStats.totalAu} duration={380} /> <span className="text-xs text-gray-500 dark:text-zinc-400">/ 4</span></p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 dark:text-zinc-400 block mb-1/2">평점</span>
                        <p className="text-lg font-semibold"><AnimatedNumber value={totalStats.gpa} decimals={2} duration={380} /> <span className="text-xs text-gray-500 dark:text-zinc-400">/ {filters.earlyGraduation ? '3.0' : '2.0'}</span></p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-500 dark:text-zinc-400 block mb-1/2">시뮬레이션 결과</span>
                      <p className={`text-xl font-bold ${canGraduate ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        졸업 {canGraduate ? '가능' : '불가'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 시뮬레이션 보고서 */}
        {showReportDialog && (
          <div
            className="fixed inset-0 z-200 flex justify-center items-center bg-black/50 dark:bg-black/70 px-20 py-10"
            onClick={(e) => {
              if (e.target === e.currentTarget)
                setShowReportDialog(false);
            }}
          >
            <div className="bg-gray-50 dark:bg-zinc-900 flex-1 max-w-200 rounded-lg shadow-sm max-h-full overflow-hidden flex flex-col">
              {/* 다이얼로그 헤더 */}
              <div className="flex flex-row justify-between p-4">
                <h2 className="font-medium">
                  시뮬레이션 보고서
                </h2>
                <div className="flex flex-row gap-2">
                  <PDFDownloadLink 
                    document={
                      <GraduationReportPDF
                        totalStats={totalStats}
                        canGraduate={canGraduate}
                        sections={sections}
                        filters={filters}
                        getDeptName={getDeptName}
                        substitutionMap={substitutionMap}
                        getCategoryName={(id) => categories.find(c => c.id === id)?.name ?? id}
                      />
                    }
                    fileName={`졸업사정결과-${profile?.studentId}-${new Date().getFullYear().toString().padStart(4, '0')}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${new Date().getDate().toString().padStart(2, '0')}${new Date().getHours().toString().padStart(2, '0')}${new Date().getMinutes().toString().padStart(2, '0')}${new Date().getSeconds().toString().padStart(2, '0')}.pdf`}
                    className="px-2 py-1 rounded-md shadow-sm bg-white dark:bg-black text-xs transition-all active:scale-85"
                  >
                    {({ blob, url, loading, error }) =>
                      loading ? 'PDF 생성 중...' : 'PDF 다운로드'
                    }
                  </PDFDownloadLink>
                  <Button
                    size="small"
                    style="standard"
                    activeScale={85}
                    onClick={() => setShowReportDialog(false)}
                  >
                    완료
                  </Button>
                </div>
              </div>

              {/* 다이얼로그 본문 */}
              <div className="flex-1 overflow-y-auto px-6 bg-white text-black select-text">
                <div className="sticky top-0 bg-gradient-to-b from-white to-transparent w-full h-4"></div>

                <div className="mt-2 float-right text-lg">
                  <Logo />
                </div>
                <p className="my-2 text-2xl font-semibold">졸업 시뮬레이션 결과 보고서</p>
                <p className="text-sm font-light">시행 일시: {
                  (() => {
                    const currentTime = new Date()
                    return `${currentTime.getFullYear()}년 ${currentTime.getMonth() + 1}월 ${currentTime.getDate()}일 ${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`
                  })()
                }</p>
                <p className="mt-4 mb-8 text-sm font-light text-red-800">주의: 본 문서는 참고용이며, 법적·행정적 효력이 없습니다.</p>

                <h3 className="font-bold text-lg mt-4 mb-2">요약</h3>
                
                <table className="my-2 w-full text-sm border-collapse border border-[#ccc] text-center">
                  <thead>
                    <tr className="border-b border-[#ccc] bg-[#f3f4f6] font-semibold">
                      <th className="w-[15%] py-1.5 px-1 border-r border-[#ccc] last:border-r-0">이수 학점</th>
                      <th className="w-[15%] py-1.5 px-1 border-r border-[#ccc] last:border-r-0">이수 AU</th>
                      <th className="w-[15%] py-1.5 px-1 border-r border-[#ccc] last:border-r-0">평점</th>
                      <th className="w-[15%] py-1.5 px-1 border-r border-[#ccc] last:border-r-0">졸업구분</th>
                      <th className="w-[15%] py-1.5 px-1 border-r border-[#ccc] last:border-r-0">결과</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[#ccc]">
                      <td className="py-1.5 px-1 border-r border-[#ccc] last:border-r-0">{totalStats.totalCredit}</td>
                      <td className="py-1.5 px-1 border-r border-[#ccc] last:border-r-0">{totalStats.totalAu}</td>
                      <td className="py-1.5 px-1 border-r border-[#ccc] last:border-r-0">{totalStats.gpa}</td>
                      <td className="py-1.5 px-1 border-r border-[#ccc] last:border-r-0">{filters.earlyGraduation ? '조기졸업' : '정규졸업'}</td>
                      <td className={`py-1.5 px-1 border-r border-[#ccc] last:border-r-0 ${canGraduate ? 'text-[#059669]' : 'text-[#dc2626]'}`}>{canGraduate ? '졸업 가능' : '졸업 불가'}</td>
                    </tr>
                  </tbody>
                </table>

                <h3 className="font-bold text-lg mt-6 mb-2">이수 과목 목록</h3>
                {(
                  () => {
                    const reportSectionOrder: { id: string; title: string }[] = [
                      { id: 'MANDATORY_GENERAL_COURSES', title: '교양필수' },
                      { id: 'HUMANITIES_SOCIETY_ELECTIVE', title: '인문사회선택' },
                      { id: 'BASIC_REQUIRED', title: '기초필수' },
                      { id: 'BASIC_ELECTIVE', title: '기초선택' },
                      { id: `MAJOR_${filters.major}`, title: `전공: ${getDeptName(filters.major)}` },
                      { id: sections.find(s => s.id.startsWith('RESEARCH'))?.id || '', title: '연구' },
                      ...filters.doubleMajors.map(dept => ({ id: `DOUBLE_MAJOR_${dept}`, title: `복수전공: ${getDeptName(dept)}` })),
                      ...filters.minors.map(dept => ({ id: `MINOR_${dept}`, title: `부전공: ${getDeptName(dept)}` })),
                      ...(filters.advancedMajor ? [{ id: sections.find(s => s.id.startsWith('ADVANCED'))?.id || 'ADVANCED_MAJOR', title: '심화전공' }] : []),
                      ...(filters.individuallyDesignedMajor ? [{ id: 'INDIVIDUALLY_DESIGNED_MAJOR', title: '자유융합전공' }] : []),
                    ].filter(entry => entry.id);
                    return reportSectionOrder.map(({ id, title }) => {
                      const section = sections.find(s => s.id === id);
                      if (!section || section.courses.length === 0) return null;
                      const sortedCourses = [...section.courses].sort((a, b) => {
                        if (a.enrolledYear !== b.enrolledYear) return a.enrolledYear - b.enrolledYear;
                        const order = ['SPRING', 'SUMMER', 'FALL', 'WINTER'];
                        return order.indexOf(a.enrolledSemester) - order.indexOf(b.enrolledSemester);
                      });
                      return (
                        <div key={id} className="mb-4">
                          <h4 className="font-semibold mt-4 mb-1">{title}</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                              <thead>
                                <tr className="bg-[#f3f4f6] font-semibold border-b border-[#888]">
                                  <th className="py-1 px-1 text-center whitespace-nowrap w-24">과목 코드</th>
                                  <th className="py-1 px-1 text-center whitespace-nowrap">제목</th>
                                  <th className="py-1 px-1 text-center whitespace-nowrap w-20">이수 학기</th>
                                  <th className="py-1 px-1 text-center whitespace-nowrap w-24">과목 구분</th>
                                  <th className="py-1 px-1 text-center whitespace-nowrap w-8">학점</th>
                                  <th className="py-1 px-1 text-center whitespace-nowrap w-8">AU</th>
                                  <th className="py-1 px-1 text-center whitespace-nowrap w-10">성적</th>
                                  <th className="py-1 px-1 text-center whitespace-nowrap">비고</th>
                                </tr>
                              </thead>
                              <tbody>
                                {sortedCourses.map((cs) => {
                                  const remarks = getRemarks(cs, substitutionMap, filters.major);
                                  return (
                                    <tr key={`${cs.courseId}-${cs.enrolledYear}-${cs.enrolledSemester}`} className="border-b border-[#eee]">
                                      <td className="py-1 px-1 text-center">{cs.course.code}</td>
                                      <td className="py-1 px-1 text-left">{cs.course.title}</td>
                                      <td className="py-1 px-1 text-center">{formatYearSemester(cs.enrolledYear, cs.enrolledSemester)}</td>
                                      <td className="py-1 px-1 text-center">{categories.find(c => c.id === cs.course.category)?.name ?? cs.course.category}</td>
                                      <td className="py-1 px-1 text-center">{cs.course.credit}</td>
                                      <td className="py-1 px-1 text-center">{cs.course.au || '-'}</td>
                                      <td className="py-1 px-1 text-center">{cs.grade}</td>
                                      <td className="py-1 px-1 text-center text-xs">{remarks.join(', ') || '-'}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                {(() => {
                                  const { creditSum, auSum, gpa } = computeSectionSubtotal(sortedCourses);
                                  return (
                                    <tr className="border-t-2 border-[#eee] bg-[#f9fafb] font-medium">
                                      <td className="py-1 px-1 text-left" colSpan={4}>소계</td>
                                      <td className="py-1 px-1 text-center">{creditSum}</td>
                                      <td className="py-1 px-1 text-center">{auSum}</td>
                                      <td className="py-1 px-1 text-center">{gpa}</td>
                                      <td className="py-1 px-1"></td>
                                    </tr>
                                  );
                                })()}
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      );
                    });
                  }
                )()}

                <h3 className="font-bold text-lg mt-4 mb-2">요건별 달성 여부</h3>

                <h4 className="font-semibold">교양필수</h4>
                <RequirementsTable
                  requirements={sections.find((section) => section.id === 'MANDATORY_GENERAL_COURSES')?.requirements || []}
                />

                <h4 className="font-semibold mt-4">인문사회선택</h4>
                <RequirementsTable
                  requirements={sections.find((section) => section.id === 'HUMANITIES_SOCIETY_ELECTIVE')?.requirements || []}
                />

                <h4 className="font-semibold mt-4">기초필수</h4>
                <RequirementsTable
                  requirements={sections.find((section) => section.id === 'BASIC_REQUIRED')?.requirements || []}
                />

                <h4 className="font-semibold mt-4">기초선택</h4>
                <RequirementsTable
                  requirements={sections.find((section) => section.id === 'BASIC_ELECTIVE')?.requirements || []}
                />

                <h4 className="font-semibold mt-4">전공: {getDeptName(filters.major)}</h4>
                <RequirementsTable
                  requirements={sections.find((section) => section.id.startsWith('MAJOR'))?.requirements || []}
                  isMajor={true}
                />

                <h4 className="font-semibold mt-4">연구</h4>
                <RequirementsTable
                  requirements={sections.find((section) => section.id.startsWith('RESEARCH'))?.requirements || []}
                />

                {filters.doubleMajors.map(department => <div key={`DOUBLE_MAJOR_${department}`}>
                  <h4 className="font-semibold mt-4">복수전공: {getDeptName(department)}</h4>
                  <RequirementsTable
                    requirements={sections.find((section) => section.id === `DOUBLE_MAJOR_${department}`)?.requirements || []}
                    isMajor={true}
                  />
                </div>)}

                {filters.minors.map(department => <div key={`MINOR_${department}`}>
                  <h4 className="font-semibold mt-4">부전공: {getDeptName(department)}</h4>
                  <RequirementsTable
                    requirements={sections.find((section) => section.id === `MINOR_${department}`)?.requirements || []}
                    isMajor={true}
                  />
                </div>)}

                {filters.advancedMajor && (<>
                  <h4 className="font-semibold mt-4">심화전공</h4>
                  <RequirementsTable
                    requirements={sections.find((section) => section.id.startsWith(`ADVANCED`))?.requirements || []}
                  />
                </>)}

                {filters.individuallyDesignedMajor && (<>
                  <h4 className="font-semibold mt-4">자유융합전공</h4>
                  <RequirementsTable
                    requirements={sections.find((section) => section.id === 'INDIVIDUALLY_DESIGNED_MAJOR')?.requirements || []}
                  />
                </>)}

                <div className="sticky bottom-0 bg-gradient-to-t from-white via-white to-transparent w-full h-8"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 모바일 UI */}
      <div className="min-h-screen md:hidden bg-gray-50 dark:bg-zinc-900 pb-24 select-none">
        <MobileTopBar
          left={
              <Button
                style="simple"
                size="small"
                onClick={() => setIsScenarioModalOpen(true)}
                aria-label="메뉴"
                className="px-2 py-1.5 gap-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </Button>
            }
          center={
              <div className="text-2xl">
                <Logo />
              </div>
            }
          right={
              <Link
                ref={profileLinkMobileRef}
                href="/profile/settings"
                className="px-2 py-1.5 text-sm font-medium text-gray-700 dark:text-zinc-300 active:bg-gray-100 dark:active:bg-zinc-800 rounded-lg active:scale-90 transition-all flex items-center gap-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </Link>
            }
          below={
            mobileTab === 'requirements' ? (
              <div className="px-4 py-2 flex flex-row justify-between gap-3">
                <div>
                  <span className="text-xs text-gray-500 dark:text-zinc-400 block mb-1">이수 학점</span>
                  <p className="text-base sm:text-lg font-semibold"><AnimatedNumber value={totalStats.totalCredit} duration={380} /> <span className="text-xs text-gray-400 dark:text-zinc-500">/ 138</span></p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-zinc-400 block mb-1">총 AU</span>
                  <p className="text-base sm:text-lg font-semibold"><AnimatedNumber value={totalStats.totalAu} duration={380} /> <span className="text-xs text-gray-400 dark:text-zinc-500">/ 4</span></p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-zinc-400 block mb-1">평점</span>
                  <p className="text-base sm:text-lg font-semibold"><AnimatedNumber value={totalStats.gpa} decimals={2} duration={380} /> <span className="text-xs text-gray-400 dark:text-zinc-500">/ {filters.earlyGraduation ? '3.0' : '2.0'}</span></p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-zinc-400 block mb-1">시뮬레이션 결과</span>
                  <p className={`text-base sm:text-lg font-bold ${canGraduate ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    졸업 {canGraduate ? '가능' : '불가'}
                  </p>
                </div>
              </div>
            ) : undefined
          }
        />

        {/* 본문 영역 */}
        <div>
          {/* 전공 지정 탭 */}
          {mobileTab === 'major' && (
            <div className="p-4 space-y-6 relative">
              {isLoadingSimulation && (
                <div className="absolute inset-0 z-10 bg-gray-50/80 dark:bg-zinc-900/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 dark:border-violet-400"></div>
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">로드 중...</p>
                  </div>
                </div>
              )}
              <h2 className="text-xl font-bold mb-4">전공 지정</h2>
              <div className="space-y-6 px-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                    전공 이수 기준 연도
                  </label>
                  <NumberInput
                    min="2016"
                    max="2050"
                    value={filters.requirementYear}
                    onChange={(newValue) => setFilters({ ...filters, requirementYear: parseInt(newValue) })}
                    size="medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                    주전공
                  </label>
                  <DepartmentDropdown
                    lang={lang}
                    value={filters.major}
                    onChange={(newValue) => setFilters({ ...filters, major: newValue })}
                    mode="major"
                    size="medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                    복수전공
                  </label>
                  <MultipleDepartmentDropdown
                    lang={lang}
                    value={filters.doubleMajors}
                    onChange={(newValues) => setFilters({ ...filters, doubleMajors: newValues })}
                    mode="doubleMajor"
                    size="medium"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                    부전공
                  </label>
                  <MultipleDepartmentDropdown
                    lang={lang}
                    value={filters.minors}
                    onChange={(newValues) => setFilters({ ...filters, minors: newValues })}
                    mode="minor"
                    size="medium"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                    심화전공
                  </label>
                  <Select
                    value={filters.advancedMajor ? 'true' : 'false'}
                    onChange={(newValue) => setFilters({ ...filters, advancedMajor: newValue === 'true' })}
                    size="medium"
                  >
                    <option value="false">아니오</option>
                    <option value="true">예</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                    자유융합전공
                  </label>
                  <Select
                    value={filters.individuallyDesignedMajor ? 'true' : 'false'}
                    onChange={(newValue) => setFilters({ ...filters, individuallyDesignedMajor: newValue === 'true' })}
                    size="medium"
                  >
                    <option value="false">아니오</option>
                    <option value="true">예</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
                    조기졸업
                  </label>
                  <Select
                    value={filters.earlyGraduation ? 'true' : 'false'}
                    onChange={(newValue) => setFilters({ ...filters, earlyGraduation: newValue === 'true' })}
                    size="medium"
                  >
                    <option value="false">아니오</option>
                    <option value="true">예</option>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* 과목 탭 */}
          {mobileTab === 'courses' && (
            <div>
              {/* 모드 전환 */}
              <div className="sticky top-[48px] backdrop-blur-md z-20 flex items-center gap-2 px-6 py-1">
                <Button
                  type="button"
                  size="medium"
                  style="standard"
                  isActive={courseMode === 'add'}
                  onClick={() => setCourseMode('add')}
                  className="flex-1 truncate py-2"
                >
                  <span className={'px-2 py-1 border-b border-b-2 transition-colors ' + (courseMode === 'add' ? 'border-violet-500' : 'border-transparent')}>
                    과목 추가
                  </span>
                </Button>
                <Button
                  type="button"
                  size="medium"
                  style="standard"
                  isActive={courseMode === 'view'}
                  onClick={() => setCourseMode('view')}
                  className="flex-1 truncate py-2"
                >
                  <span className={'px-2 py-1 border-b border-b-2 transition-colors ' + (courseMode === 'view' ? 'border-violet-500' : 'border-transparent')}>
                    수강한 과목<span className="opacity-40 ml-2">{enrollmentsForList.length}</span>
                  </span>
                </Button>
              </div>

              {/* 본문 */}
              <div className="p-4 relative">
                {isLoadingSimulation && (
                  <div className="absolute inset-0 z-10 bg-gray-50/80 dark:bg-zinc-900/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 dark:border-violet-400"></div>
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">로드 중...</p>
                    </div>
                  </div>
                )}
                {courseMode === 'add' ? (
                  <AddCoursePanel
                    searchQuery={courseSearchQuery}
                    onSearchQueryChange={setCourseSearchQuery}
                    searchResults={searchResults}
                    isSearching={isSearching}
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
                    enrolledCourseIds={simulationCourses.map((cs) => cs.courseId)}
                  />
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-center text-gray-500 dark:text-zinc-400 px-4">
                      시뮬레이션에 사용할 과목들을 지정합니다. 아직 듣지 않았지만 들을 예정인 과목을 추가하여 시뮬레이션을 진행할 수 있습니다.
                    </p>
                    <EnrollmentsList
                      enrollments={enrollmentsForList}
                      semesterGroups={semesterGroups}
                      sortedSemesterKeys={sortedSemesterKeys}
                      selectedEnrollmentKeys={selectedEnrollmentKeys}
                      onSelectionChange={setSelectedEnrollmentKeys}
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
                      onMove={(enrollment, newYear, newSemester) => {
                        const cs = simulationCourses.find(
                          (c) =>
                            c.courseId === enrollment.courseId &&
                            c.enrolledYear === enrollment.enrolledYear &&
                            c.enrolledSemester === enrollment.enrolledSemester
                        );
                        if (cs) {
                          handleMove(cs, newYear, newSemester);
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
                      onRemoveSelected={() => {
                        // simulation에서는 선택 삭제 기능 사용 안 함
                        setSelectedEnrollmentKeys(new Set());
                      }}
                      onRemoveAll={() => {
                        // simulation에서는 전체 삭제 기능 사용 안 함
                        setSelectedEnrollmentKeys(new Set());
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
                    <p className="text-sm text-center text-gray-500 dark:text-zinc-400 px-4">
                      이곳에서 과목을 추가하거나 삭제하더라도 프로필에 저장된 수강 내역은 변경되지 않습니다.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 학점 분야 탭 */}
          {mobileTab === 'credits' && (
            <div className="p-4 space-y-4 pb-24 relative">
              {isLoadingSimulation && (
                <div className="absolute inset-0 z-10 bg-gray-50/80 dark:bg-zinc-900/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 dark:border-violet-400"></div>
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">로드 중...</p>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">수업별 학점 인정 분야</h2>
                <Button
                  size="small"
                  style="standard"
                  onClick={() => setGradeBlindMode(!gradeBlindMode)}
                >
                  {gradeBlindMode ? '성적 표시' : '성적 숨기기'}
                </Button>
              </div>

              {sections.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-zinc-400 py-4 text-center">
                  주전공을 선택하면 섹션이 구성됩니다.
                </p>
              ) : (
                <div className="space-y-6">
                  {/* 기초과목 그룹 */}
                  {groupedSections.basicGroup.length > 0 && (
                    <div className="bg-white dark:bg-black rounded-lg overflow-hidden shadow-lg">
                      {groupedSections.basicGroup.map((s, i) => {
                        const isCollapsed = collapsedSections.has(s.id);
                        return (
                          <div key={s.id}>
                            <Accordion isCollapsed={isCollapsed} onTitleClick={() => toggleSection(s.id)} onTitleKeyDown={(e) => keyboardToggleSection(e, s.id)}>
                              <ACTitle>
                                <h3 className="font-medium text-base flex-1">{s.title}</h3>
                                <p className="text-gray-600 dark:text-zinc-400 text-sm">{calculateSectionCredits(s.courses)}</p>
                              </ACTitle>
                              <ACBody>
                                <div className="space-y-2">
                                  {s.courses.length === 0 ? (
                                    <p className="text-sm text-gray-500 dark:text-zinc-400">인정 과목 없음</p>
                                  ) : (
                                    s.courses.map((c) => (
                                      <CourseBar
                                        key={`${c.enrolledYear}-${c.enrolledSemester}-${c.courseId}`}
                                        course={c}
                                        gradeBlindMode={gradeBlindMode}
                                        onClassificationChange={handleClassificationChange}
                                        substitutionMap={substitutionMap}
                                        majorDepartment={filters.major}
                                      />
                                    ))
                                  )}
                                </div>
                              </ACBody>
                            </Accordion>
                            {i < groupedSections.basicGroup.length - 1 && (
                              <div className="border-t border-gray-200 dark:border-zinc-700"></div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 주전공/심화전공/연구 그룹 */}
                  {groupedSections.majorGroup.length > 0 && (
                    <div className="bg-white dark:bg-black rounded-lg overflow-hidden shadow-lg">
                      {groupedSections.majorGroup.map((s, i) => {
                        const isCollapsed = collapsedSections.has(s.id);
                        return (
                          <div key={s.id}>
                            <Accordion isCollapsed={isCollapsed} onTitleClick={() => toggleSection(s.id)} onTitleKeyDown={(e) => keyboardToggleSection(e, s.id)}>
                              <ACTitle>
                                <h3 className="font-medium text-base flex-1">{s.title}</h3>
                                <p className="text-gray-600 dark:text-zinc-400 text-sm">{calculateSectionCredits(s.courses)}</p>
                              </ACTitle>
                              <ACBody>
                                <div className="space-y-2">
                                  {s.courses.length === 0 ? (
                                    <p className="text-sm text-gray-500 dark:text-zinc-400">인정 과목 없음</p>
                                  ) : (
                                    s.courses.map((c) => (
                                      <CourseBar
                                        key={`${c.enrolledYear}-${c.enrolledSemester}-${c.courseId}`}
                                        course={c}
                                        gradeBlindMode={gradeBlindMode}
                                        onClassificationChange={handleClassificationChange}
                                        substitutionMap={substitutionMap}
                                        majorDepartment={filters.major}
                                      />
                                    ))
                                  )}
                                </div>
                              </ACBody>
                            </Accordion>
                            {i < groupedSections.majorGroup.length - 1 && (
                              <div className="border-t border-gray-200 dark:border-zinc-700"></div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 복전, 부전, 융전, 교필, 인선 */}
                  {groupedSections.otherSections.map((s) => {
                    const isCollapsed = collapsedSections.has(s.id);
                    return (
                      <div key={s.id} className="bg-white dark:bg-black rounded-lg overflow-hidden shadow-lg">
                        <Accordion isCollapsed={isCollapsed} onTitleClick={() => toggleSection(s.id)} onTitleKeyDown={(e) => keyboardToggleSection(e, s.id)}>
                          <ACTitle>
                            <h3 className="font-medium text-base flex-1">{s.title}</h3>
                            <p className="text-gray-600 dark:text-zinc-400 text-sm">{calculateSectionCredits(s.courses)}</p>
                          </ACTitle>
                          <ACBody>
                            <div className="space-y-2">
                              {s.courses.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-zinc-400">인정 과목 없음</p>
                              ) : (
                                s.courses.map((c) => (
                                  <CourseBar
                                    key={`${c.enrolledYear}-${c.enrolledSemester}-${c.courseId}`}
                                    course={c}
                                    gradeBlindMode={gradeBlindMode}
                                    onClassificationChange={handleClassificationChange}
                                    majorDepartment={filters.major}
                                  />
                                ))
                              )}
                            </div>
                          </ACBody>
                        </Accordion>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 졸업 요건 탭 */}
          {mobileTab === 'requirements' && (
            <div className="relative">
              {isLoadingSimulation && (
                <div className="absolute inset-0 z-10 bg-gray-50/80 dark:bg-zinc-900/80 backdrop-blur-sm flex items-center justify-center rounded-lg">
                  <div className="flex flex-col items-center gap-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 dark:border-violet-400"></div>
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">로드 중...</p>
                  </div>
                </div>
              )}

              <div className="p-4 space-y-6 pb-24">
              {sections.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-zinc-400 py-4 text-center">
                  주전공을 선택하면 섹션이 구성됩니다.
                </p>
              ) : (
                <div className="space-y-6">
                    {/* 기초과목 */}
                    {groupedSections.basicGroup.length > 0 && (
                      <div className="bg-white dark:bg-black rounded-lg overflow-hidden shadow-lg">
                        {groupedSections.basicGroup.map((s, i) => {
                          const requirements = s.requirements || [];
                          const isCollapsed = collapsedSections.has(`center-${s.id}`);
                          return (
                            <div key={s.id}>
                              <Accordion isCollapsed={isCollapsed} onTitleClick={() => toggleSection(`center-${s.id}`)} onTitleKeyDown={(e) => keyboardToggleSection(e, `center-${s.id}`)}>
                                <ACTitle>
                                  <h3 className="font-medium text-base flex-1">{s.title}</h3>
                                  <p
                                    className={`text-sm font-medium ${
                                      s.fulfilled ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                    }`}
                                  >
                                    {s.fulfilled ? '달성' : '미달'}
                                  </p>
                                </ACTitle>
                                <ACBody>
                                  {requirements.length > 0 ? (
                                    <div className="space-y-2">
                                      {requirements.map((req, reqIdx) => (
                                        <RequirementBar
                                          key={reqIdx}
                                          requirement={req}
                                          onMouseEnter={(e) => {
                                            if (req.title && req.title !== req.description && req.description !== undefined) {
                                              const rect = e.currentTarget.getBoundingClientRect();
                                              setTooltipState({
                                                text: req.description,
                                                x: rect.left + rect.width / 2,
                                                y: rect.top - 8
                                              });
                                            }
                                          }}
                                          onMouseLeave={() => {setTooltipState(null)}}
                                        />
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500 dark:text-zinc-400 text-center py-2">요건 없음</p>
                                  )}
                                </ACBody>
                              </Accordion>
                              {i < groupedSections.basicGroup.length - 1 && (
                                <div className="border-t border-gray-200 dark:border-zinc-700"></div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 주전공/심화전공/연구 그룹 */}
                    {groupedSections.majorGroup.length > 0 && (
                      <div className="bg-white dark:bg-black rounded-lg overflow-hidden shadow-lg">
                        {groupedSections.majorGroup.map((s, i) => {
                          const requirements = s.requirements || [];
                          const isCollapsed = collapsedSections.has(`center-${s.id}`);
                          return (
                            <div key={s.id}>
                              <Accordion isCollapsed={isCollapsed} onTitleClick={() => toggleSection(`center-${s.id}`)} onTitleKeyDown={(e) => keyboardToggleSection(e, `center-${s.id}`)}>
                                <ACTitle>
                                  <h3 className="font-medium text-base flex-1 leading-tight">
                                    {s.titleElements.length > 1 ? (
                                      <>
                                        <span className="text-gray-400 dark:text-zinc-500">{s.titleElements[0]}: </span>
                                        <span>{s.titleElements.slice(1).join(' ')}</span>
                                      </>
                                    ) : s.titleElements[0]}
                                  </h3>
                                  <p
                                    className={`text-sm font-medium leading-tight ${
                                      s.fulfilled ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                    }`}
                                  >
                                    {s.fulfilled ? '달성' : '미달'}
                                  </p>
                                </ACTitle>
                                <ACBody>
                                  {requirements.length > 0 ? (
                                    <div className="space-y-2">
                                      {requirements.map((req, reqIdx) => (
                                        <RequirementBar
                                          key={reqIdx}
                                          requirement={req}
                                          onMouseEnter={(e) => {
                                            if (req.title && req.title !== req.description && req.description !== undefined) {
                                              const rect = e.currentTarget.getBoundingClientRect();
                                              setTooltipState({
                                                text: req.description,
                                                x: rect.left + rect.width / 2,
                                                y: rect.top - 8
                                              });
                                            }
                                          }}
                                          onMouseLeave={() => {setTooltipState(null)}}
                                        />
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500 dark:text-zinc-400 leading-tight">요건 없음</p>
                                  )}
                                </ACBody>
                              </Accordion>
                              {i < groupedSections.majorGroup.length - 1 && (
                                <div className="border-t border-gray-200 dark:border-zinc-700"></div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* 복전, 부전, 융전, 교필, 인선 */}
                    {groupedSections.otherSections.map((s) => {
                      const requirements = s.requirements || [];
                      const isCollapsed = collapsedSections.has(`center-${s.id}`);
                      return (
                        <div key={s.id} className="bg-white dark:bg-black rounded-lg overflow-hidden shadow-lg">
                          <Accordion isCollapsed={isCollapsed} onTitleClick={() => toggleSection(`center-${s.id}`)} onTitleKeyDown={(e) => keyboardToggleSection(e, `center-${s.id}`)}>
                            <ACTitle>
                              <h3 className="font-medium text-base flex-1 leading-tight">
                                {s.titleElements.length > 1 ? (
                                  <>
                                    <span className="text-gray-400 dark:text-zinc-500">{s.titleElements[0]}: </span>
                                    <span>{s.titleElements.slice(1).join(' ')}</span>
                                  </>
                                ) : s.titleElements[0]}
                              </h3>
                              <p
                                className={`text-sm font-medium leading-tight ${
                                  s.fulfilled ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                                }`}
                              >
                                {s.fulfilled ? '달성' : '미달'}
                              </p>
                            </ACTitle>
                            <ACBody>
                              {requirements.length > 0 ? (
                                <div className="space-y-2">
                                  {requirements.map((req, reqIdx) => (
                                    <RequirementBar
                                      key={reqIdx}
                                      requirement={req}
                                      onMouseEnter={(e) => {
                                        if (req.title && req.title !== req.description && req.description !== undefined) {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          setTooltipState({
                                            text: req.description,
                                            x: rect.left + rect.width / 2,
                                            y: rect.top - 8
                                          });
                                        }
                                      }}
                                      onMouseLeave={() => {setTooltipState(null)}}
                                    />
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">요건 없음</p>
                              )}
                            </ACBody>
                          </Accordion>
                        </div>
                      );
                    })}
                </div>
              )}
              </div>
            </div>
          )}
        </div>

        {/* 하단 내비게이션 */}
        <div className="fixed bottom-0 left-0 right-0 z-30 p-2 flex justify-center pointer-events-none">
          <nav className="p-1 flex flex-row backdrop-blur-sm pointer-events-auto rounded-full bg-gray-50/20 dark:bg-zinc-900/20 shadow-[0_0_40px_4px_rgba(0,0,0,0.1)] border border-black/10 dark:border-white/20">
            <button
              onClick={() => setMobileTab('major')}
              className={`w-20 flex-1 flex flex-col items-center justify-center py-2 px-1 min-h-[60px] transition-all active:scale-85 rounded-full ${
                mobileTab === 'major'
                  ? 'text-violet-600 dark:text-violet-400 bg-violet-100/50 dark:bg-violet-900/20'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs font-medium">전공 지정</span>
            </button>
            <button
              onClick={() => setMobileTab('courses')}
              className={`w-20 flex-1 flex flex-col items-center justify-center py-2 px-1 min-h-[60px] transition-all active:scale-85 rounded-full ${
                mobileTab === 'courses'
                  ? 'text-violet-600 dark:text-violet-400 bg-violet-100/50 dark:bg-violet-900/20'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <span className="text-xs font-medium">과목 담기</span>
            </button>
            <button
              onClick={() => setMobileTab('credits')}
              className={`w-20 flex-1 flex flex-col items-center justify-center py-2 px-1 min-h-[60px] transition-all active:scale-85 rounded-full ${
                mobileTab === 'credits'
                  ? 'text-violet-600 dark:text-violet-400 bg-violet-100/50 dark:bg-violet-900/20'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span className="text-xs font-medium">학점 분야</span>
            </button>
            <button
              onClick={() => setMobileTab('requirements')}
              className={`w-20 flex-1 flex flex-col items-center justify-center py-2 px-1 min-h-[60px] transition-all active:scale-85 rounded-full ${
                mobileTab === 'requirements'
                  ? 'text-violet-600 dark:text-violet-400 bg-violet-100/50 dark:bg-violet-900/20'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-medium">졸업 요건</span>
            </button>
          </nav>
        </div>

        {/* 시나리오 선택 모달 */}
        {isScenarioModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 dark:bg-black/70"
            onClick={(e) => {
              if (e.target === e.currentTarget)
                closeScenarioModal();
            }}
          >
            <div
              className={`bg-gray-50 dark:bg-zinc-900 shadow-xl w-full sm:max-w-md sm:mx-4 mx-0 max-h-[80vh] flex flex-col rounded-t-2xl sm:rounded-xl ${scenarioSheetDragY > 0 ? 'transition-none' : 'transition-transform duration-200'} ${
                scenarioSheetVisible && scenarioSheetDragY === 0 ? 'translate-y-0' : scenarioSheetVisible ? '' : 'translate-y-full sm:translate-y-0'
              }`}
              style={{
                ...(scenarioSheetVisible && scenarioSheetDragY > 0 && { transform: `translateY(${scenarioSheetDragY}px)` }),
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* 드래그 가능한 상단바 영역 전체 (모바일) */}
              <div
                className="touch-none cursor-grab active:cursor-grabbing border-b border-gray-200 dark:border-zinc-700 sm:cursor-default sm:touch-auto"
                onTouchStart={handleScenarioSheetTouchStart}
                onTouchMove={handleScenarioSheetTouchMove}
                onTouchEnd={handleScenarioSheetTouchEnd}
              >
                <div className="flex justify-center pt-2 pb-1 sm:hidden" aria-hidden>
                  <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-zinc-600" />
                </div>
                <div className="p-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">시나리오</h2>
                  <Button
                    size="small"
                    style="simple"
                    activeScale={85}
                    onClick={closeScenarioModal}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <Button
                  style="standard"
                  isActive={currentSimulationId === null}
                  onClick={() => {
                    if (profile) {
                      setCurrentSimulationId(null);
                      setFilters((prev) => ({ ...prev, earlyGraduation: false }));
                      initializeSimulationData(profile);
                    }
                    closeScenarioModal();
                  }}
                  className="w-full mb-2"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm font-medium">새로운 시나리오</span>
                </Button>

                {previousSimulations.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">저장된 시나리오가 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {previousSimulations.map((sim) => (
                      <div
                        key={sim.id}
                        onClick={() => {
                          if (currentSimulationId !== sim.id) {
                            loadSimulation(sim.id);
                          }
                          closeScenarioModal();
                        }}
                        className={`w-full flex items-center gap-3 rounded-lg p-3 transition-all active:scale-95 cursor-pointer shadow-md ${
                          currentSimulationId === sim.id
                            ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300'
                            : 'bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700'
                        }`}
                      >
                        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{sim.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{sim.date}</p>
                        </div>
                        <Button
                          size="small"
                          style="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!confirm('정말 이 시나리오를 삭제하시겠습니까?')) return;
                            fetch(`${API}/simulation/${sim.id}`, {
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
                          className="flex-shrink-0 p-1.5"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 시나리오 저장 섹션 */}
              <div className="p-4 border-t border-gray-200 dark:border-zinc-700">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">시나리오 저장</h3>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={saveName}
                    onChange={setSaveName}
                    placeholder="시나리오 이름"
                    size="medium"
                    className="flex-1"
                  />
                  <Button
                    style="prominent"
                    size="medium"
                    onClick={async () => {
                      const success = await handleSaveSimulation(saveName);
                      if (success) {
                        closeScenarioModal();
                      }
                    }}
                    innerClassName="whitespace-nowrap"
                  >
                    저장
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Tooltip (기존 툴팁 - 아래쪽 화살표) */}
      {tooltipState && (
        <div
          className="fixed z-[9999] pointer-events-none shadow-md"
          style={{
            left: `${tooltipState.x}px`,
            top: `${tooltipState.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="w-64 p-2 bg-black dark:bg-zinc-800 text-white text-xs rounded shadow-lg">
            {tooltipState.text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black dark:border-t-zinc-800"></div>
          </div>
        </div>
      )}

      {/* Sidebar Tooltip (사이드바 팝오버 - 왼쪽 화살표) */}
      {sidebarTooltipState && (
        <div
          className="fixed z-[9999] pointer-events-none shadow-md"
          style={{
            left: `${sidebarTooltipState.x}px`,
            top: `${sidebarTooltipState.y}px`,
            transform: 'translateY(-50%)',
          }}
        >
          <div className="p-2 bg-black dark:bg-zinc-800 text-white text-xs rounded shadow-lg whitespace-nowrap">
            {sidebarTooltipState.text}
            <div className="absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-black dark:border-r-zinc-800"></div>
          </div>
        </div>
      )}

      {/* 과목 추가 추천 팝업 (createPortal로 body에 렌더, clip 방지) */}
      {profileEnrollmentsEmpty && !enrollmentPromptDismissed && enrollmentPromptAnchor && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed z-[9999] shadow-lg"
          style={{
            left: enrollmentPromptAnchor.left,
            top: enrollmentPromptAnchor.top,
            ...(enrollmentPromptAnchor.isMobile ? {} : { transform: 'translateY(-50%)' }),
          }}
        >
          <div className="relative bg-black text-white text-sm px-3 py-2 rounded-xl shadow-lg whitespace-nowrap overflow-visible min-w-[180px] max-w-[min(220px,calc(100vw-24px))]">
            {/* 말풍선 꼬리 - 항상 오른쪽에 배치 */}
            {enrollmentPromptAnchor.isMobile ? (
              <div className="absolute right-4 top-0 w-0 h-0 border-[6px] border-transparent border-b-black" style={{ transform: 'translateY(-100%)' }} />
            ) : (
              <div className="absolute right-0 top-1/2 w-0 h-0 border-[6px] border-transparent border-l-black" style={{ transform: 'translate(100%, -50%)' }} />
            )}
            <span>수강 과목을 등록해주세요</span>
            <Link href="/profile/settings?tab=courses" className="block mt-1 text-gray-300 hover:text-white text-xs font-medium">
              등록하기 →
            </Link>
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem('enrollmentPromptDismissed', '1');
                setEnrollmentPromptDismissed(true);
              }}
              className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-sm"
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
