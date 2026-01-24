'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DepartmentDropdown, MultipleDepartmentDropdown } from '../components/DepartmentDropdown';
import { NumberInput, Select, Input } from '../components/formFields';
import { CourseCategoryDropdown } from '../components/CourseCategoryDropdown';

const API = 'http://localhost:4000';

type Dept = { id: string; name: string };
type Section = {
  id: string;
  title: string;
  courses: { id: number; name: string; credit: number; grade?: string }[];
  fulfilled: boolean;
  detail: string; // e.g. "12 / 36 학점"
};

export default function SimulationPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [previousSimulations] = useState([
    { id: 1, name: '2024년 1학기 시뮬레이션', date: '2024-01-15' },
    { id: 2, name: '2023년 2학기 시뮬레이션', date: '2023-08-20' },
  ]);
  const [depts, setDepts] = useState<Dept[]>([]);
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const centerScrollRef = useRef<HTMLDivElement>(null);
  const syncingScrollRef = useRef(false);

  const [filters, setFilters] = useState({
    requirementYear: new Date().getFullYear(),
    major: '',
    doubleMajors: [] as string[],
    minors: [] as string[],
    advancedMajor: false,
    individuallyDesignedMajor: false,
  });
  const [simulationCourses, setSimulationCourses] = useState<any[]>([]);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [addToEnrollments, setAddToEnrollments] = useState(false);
  
  // 과목 추가/선택 모드
  const [courseMode, setCourseMode] = useState<'add' | 'view'>('add');
  const [isAddFormExpanded, setIsAddFormExpanded] = useState(false);
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [newCourse, setNewCourse] = useState({
    name: '',
    code: '',
    department: '',
    category: 'ME',
  });
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  useEffect(() => {
    fetch('http://localhost:4000/departments')
      .then((r) => r.json())
      .then((arr: Dept[]) => setDepts(arr))
      .catch(() => {});
    
    // 과목 목록 로드
    fetch(`${API}/courses`)
      .then((r) => r.json())
      .then((arr: any[]) => setAvailableCourses(arr))
      .catch(() => {});
  }, []);

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

    Promise.all([loadProfile(), loadMe()])
      .then(([profileRes, meRes]) => {
        if (profileRes.success && profileRes.profile) {
          const p = profileRes.profile;
          setFilters({
            requirementYear: p.admissionYear || new Date().getFullYear(),
            major: p.major || '',
            doubleMajors: Array.isArray(p.doubleMajors) ? p.doubleMajors : [],
            minors: Array.isArray(p.minors) ? p.minors : [],
            advancedMajor: p.advancedMajor || false,
            individuallyDesignedMajor: p.individuallyDesignedMajor || false,
          });
          setUserName(p.name || '');
        }
        if (meRes.success && meRes.user) {
          setUserName((prev) => prev || meRes.user.email || '');
        }
        setProfileLoaded(true);
      })
      .catch(() => setProfileLoaded(true));
  }, [profileLoaded]);

  const deptName = (id: string) => depts.find((d) => d.id === id)?.name ?? id;

  // 검색어 정규화 (띄어쓰기, 문장부호, 특수문자 제거, 한글/로마자/숫자만)
  const normalizeSearchText = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/\s+/g, '') // 띄어쓰기 제거
      .replace(/[^\w가-힣]/g, '') // 한글, 로마자, 숫자만 남김
      .toLowerCase();
  };

  // 과목 검색 필터링
  const filteredCourses = useMemo(() => {
    if (!courseSearchQuery.trim()) return availableCourses;
    
    const normalizedQuery = normalizeSearchText(courseSearchQuery);
    
    return availableCourses.filter((course) => {
      const normalizedName = normalizeSearchText(course.title || course.name || '');
      const deptNameStr = course.department ? deptName(course.department) : '';
      const normalizedDept = normalizeSearchText(deptNameStr);
      const normalizedCode = normalizeSearchText(course.code || '');
      
      return (
        normalizedName.includes(normalizedQuery) ||
        normalizedDept.includes(normalizedQuery) ||
        normalizedCode.includes(normalizedQuery)
      );
    });
  }, [availableCourses, courseSearchQuery, depts]);

  const sections = useMemo((): Section[] => {
    const out: Section[] = [];
    const majorName = filters.major ? deptName(filters.major) : '';
    if (filters.major) {
      out.push({
        id: 'major',
        title: `${majorName} 주전공 이수 요건`,
        courses: [
          { id: 1, name: '데이터구조', credit: 3, grade: 'A+' },
          { id: 2, name: '알고리즘', credit: 3, grade: 'A' },
        ],
        fulfilled: false,
        detail: '12 / 36 학점',
      });
    }
    if (filters.advancedMajor && filters.major) {
      out.push({
        id: 'advanced',
        title: `${majorName} 심화전공 이수 요건`,
        courses: [],
        fulfilled: false,
        detail: '0 / 12 학점',
      });
    }
    (filters.doubleMajors || []).forEach((id, i) => {
      out.push({
        id: `double-${id}-${i}`,
        title: `${deptName(id)} 복수전공 이수 요건`,
        courses: [],
        fulfilled: false,
        detail: '0 / 36 학점',
      });
    });
    (filters.minors || []).forEach((id, i) => {
      out.push({
        id: `minor-${id}-${i}`,
        title: `${deptName(id)} 부전공 이수 요건`,
        courses: [],
        fulfilled: false,
        detail: '0 / 21 학점',
      });
    });
    if (filters.individuallyDesignedMajor) {
      out.push({
        id: 'individually',
        title: '자유융합전공 이수 요건',
        courses: [],
        fulfilled: false,
        detail: '0 / 36 학점',
      });
    }
    if (filters.major) {
      out.push({
        id: 'research',
        title: `${majorName} 연구 요건`,
        courses: [],
        fulfilled: false,
        detail: '0 / 4 학점',
      });
    }
    out.push({
      id: 'humanities',
      title: '인문사회선택 요건',
      courses: [{ id: 10, name: '인문학개론', credit: 2, grade: 'B+' }],
      fulfilled: false,
      detail: '2 / 6 학점',
    });
    out.push({
      id: 'generalEd',
      title: '교양필수 요건',
      courses: [{ id: 11, name: '영어회화', credit: 2, grade: 'B+' }],
      fulfilled: false,
      detail: '2 / 21 학점',
    });
    return out;
  }, [filters, depts]);

  // 섹션을 그룹화: 주전공/심화전공/연구를 하나의 그룹으로
  const groupedSections = useMemo(() => {
    const majorGroup: Section[] = [];
    const otherSections: Section[] = [];
    
    sections.forEach((s) => {
      if (s.id === 'major' || s.id === 'advanced' || s.id === 'research') {
        majorGroup.push(s);
      } else {
        otherSections.push(s);
      }
    });
    
    return { majorGroup, otherSections };
  }, [sections]);

  const handleLeftScroll = () => {
    if (syncingScrollRef.current || !leftScrollRef.current || !centerScrollRef.current) return;
    syncingScrollRef.current = true;
    centerScrollRef.current.scrollTop = leftScrollRef.current.scrollTop;
    requestAnimationFrame(() => { syncingScrollRef.current = false; });
  };
  const handleCenterScroll = () => {
    if (syncingScrollRef.current || !leftScrollRef.current || !centerScrollRef.current) return;
    syncingScrollRef.current = true;
    leftScrollRef.current.scrollTop = centerScrollRef.current.scrollTop;
    requestAnimationFrame(() => { syncingScrollRef.current = false; });
  };

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
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap min-w-0 truncate">졸업시뮬레이터</h2>
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
              // 새로운 시뮬레이션 시작 로직
              setSimulationCourses([]);
            }}
            className={`w-full flex items-center gap-3 rounded-lg transition-colors ${
              sidebarOpen
                ? 'bg-violet-600 text-white hover:bg-violet-700 px-4 py-3'
                : 'bg-violet-600 text-white hover:bg-violet-700 justify-center p-2'
            }`}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {sidebarOpen && <span className="whitespace-nowrap min-w-0 truncate">새로운 시뮬레이션</span>}
          </button>

          {/* 이전 시뮬레이션 조회 */}
          <div className={sidebarOpen ? 'mt-6' : 'mt-4'}>
            {sidebarOpen && (
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 px-2 whitespace-nowrap min-w-0 truncate">
                이전 시뮬레이션
              </h3>
            )}
            <div className="space-y-1">
              {previousSimulations.map((sim) => (
                <button
                  key={sim.id}
                  onClick={() => {
                    // 시뮬레이션 로드 로직
                  }}
                  className={`w-full flex items-center gap-3 rounded-lg text-left transition-colors ${
                    sidebarOpen
                      ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 px-4 py-2'
                      : 'justify-center p-2'
                  }`}
                  title={sidebarOpen ? undefined : sim.name}
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {sidebarOpen && (
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="text-sm font-medium truncate">{sim.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{sim.date}</p>
                    </div>
                  )}
                </button>
              ))}
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
        {/* 상단 필터 바 (sticky) */}
        <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-gray-700 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex-1 overflow-x-auto">
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
            {/* 저장 버튼 */}
            <div className="flex-shrink-0 pr-6">
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(true)}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
              >
                저장
              </button>
            </div>
          </div>
        </div>

        {/* 3분할 카드 래퍼 */}
        <div className="grow flex flex-col min-h-0 p-4 overflow-hidden">
          <div className="flex-1 flex flex-col min-h-0 rounded-xl shadow-lg overflow-hidden bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-700">
            <div className="flex-1 flex min-h-0">
              {/* 좌측: 섹션별 요건 계산에 사용된 과목 (스크롤 동기화) */}
              <div
                ref={leftScrollRef}
                onScroll={handleLeftScroll}
                className={`${rightPanelOpen ? 'w-1/3' : 'w-1/2'} flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto transition-all duration-300`}
              >
                <div className="p-4">
                  <h2 className="text-xl font-semibold mb-4">요건별 인정 과목</h2>
                  <div>
                    {sections.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                        주전공을 선택하면 섹션이 구성됩니다.
                      </p>
                    ) : (
                      <>
                        {/* 주전공/심화전공/연구 그룹 */}
                        {groupedSections.majorGroup.length > 0 && (
                          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                            {groupedSections.majorGroup.map((s, idx) => (
                              <div key={s.id}>
                                <div className="p-4">
                                  <h3 className="font-medium text-base mb-3">{s.title}</h3>
                                  <div className="space-y-2">
                                    {s.courses.length === 0 ? (
                                      <p className="text-sm text-gray-500 dark:text-gray-400">인정 과목 없음</p>
                                    ) : (
                                      s.courses.map((c) => (
                                        <div
                                          key={c.id}
                                          className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-zinc-800"
                                        >
                                          <p className="font-medium text-sm">{c.name}</p>
                                          <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {c.credit}학점{c.grade != null ? ` · ${c.grade}` : ''}
                                          </p>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                                {idx < groupedSections.majorGroup.length - 1 && (
                                  <div className="border-t border-dashed border-gray-300 dark:border-gray-600"></div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* 나머지 섹션들 */}
                        {groupedSections.otherSections.length > 0 && (
                          <>
                            {groupedSections.majorGroup.length > 0 && (
                              <div className="mt-4"></div>
                            )}
                            {groupedSections.otherSections.map((s) => (
                              <div key={s.id} className={groupedSections.majorGroup.length > 0 ? 'mt-4' : ''}>
                                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                                  <h3 className="font-medium text-base mb-3">{s.title}</h3>
                                  <div className="space-y-2">
                                    {s.courses.length === 0 ? (
                                      <p className="text-sm text-gray-500 dark:text-gray-400">인정 과목 없음</p>
                                    ) : (
                                      s.courses.map((c) => (
                                        <div
                                          key={c.id}
                                          className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-zinc-800"
                                        >
                                          <p className="font-medium text-sm">{c.name}</p>
                                          <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {c.credit}학점{c.grade != null ? ` · ${c.grade}` : ''}
                                          </p>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 가운데: 섹션별 세부 요건 달성 여부 (스크롤 동기화) */}
              <div className={`${rightPanelOpen ? 'w-1/3' : 'w-1/2'} flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col min-h-0 transition-all duration-300 relative`}>
                <div
                  ref={centerScrollRef}
                  onScroll={handleCenterScroll}
                  className="flex-1 min-h-0 overflow-y-auto"
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold">졸업 요건</h2>
                      {!rightPanelOpen && (
                        <button
                          type="button"
                          onClick={() => setRightPanelOpen(true)}
                          className="flex-shrink-0 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors border border-gray-200 dark:border-gray-700"
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
                          {/* 주전공/심화전공/연구 그룹 */}
                          {groupedSections.majorGroup.length > 0 && (
                            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                              {groupedSections.majorGroup.map((s, idx) => (
                                <div key={s.id}>
                                  <div className="p-4">
                                    <h3 className="font-medium text-base mb-2">{s.title}</h3>
                                    <p className="text-lg font-bold">{s.detail}</p>
                                    <p
                                      className={`mt-1 text-sm font-medium ${
                                        s.fulfilled ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
                                      }`}
                                    >
                                      {s.fulfilled ? '달성' : '미달'}
                                    </p>
                                  </div>
                                  {idx < groupedSections.majorGroup.length - 1 && (
                                    <div className="border-t border-dashed border-gray-300 dark:border-gray-600"></div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {/* 나머지 섹션들 */}
                          {groupedSections.otherSections.length > 0 && (
                            <>
                              {groupedSections.majorGroup.length > 0 && (
                                <div className="mt-4"></div>
                              )}
                              {groupedSections.otherSections.map((s) => (
                                <div key={s.id} className={groupedSections.majorGroup.length > 0 ? 'mt-4' : ''}>
                                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                                    <h3 className="font-medium text-base mb-2">{s.title}</h3>
                                    <p className="text-lg font-bold">{s.detail}</p>
                                    <p
                                      className={`mt-1 text-sm font-medium ${
                                        s.fulfilled ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
                                      }`}
                                    >
                                      {s.fulfilled ? '달성' : '미달'}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-gray-700 px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-6 flex-1">
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">총 이수학점</span>
                        <p className="text-lg font-semibold">0 / 130</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">평점</span>
                        <p className="text-lg font-semibold">0.00</p>
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
                      {/* sticky 상단: 모드 전환 + 검색창 */}
                      <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-gray-700 p-4 flex-shrink-0 space-y-4">
                        <div className="flex gap-2 items-center">
                          <button
                            type="button"
                            onClick={() => setCourseMode('add')}
                            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                              courseMode === 'add'
                                ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700'
                                : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 border border-transparent'
                            }`}
                          >
                            과목 추가
                          </button>
                          <button
                            type="button"
                            onClick={() => setCourseMode('view')}
                            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                              courseMode === 'view'
                                ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700'
                                : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 border border-transparent'
                            }`}
                          >
                            선택한 과목
                          </button>
                          <button
                            type="button"
                            onClick={() => setRightPanelOpen(false)}
                            className="flex-shrink-0 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors border border-gray-200 dark:border-gray-700"
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
                        {courseMode === 'add' && !isAddFormExpanded && (
                          <div className="relative">
                            <Input
                              type="text"
                              value={courseSearchQuery}
                              onChange={setCourseSearchQuery}
                              placeholder="과목명, 과목코드, 개설학과로 검색..."
                              size="medium"
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setIsAddFormExpanded(true)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                              title="폼 펼치기"
                            >
                              <svg
                                className="w-5 h-5 transition-transform"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="p-4">
                        {courseMode === 'add' ? (
                          <div className="space-y-4">
                            {/* 통합검색 결과 (폼이 접혀있을 때만 표시) */}
                            {!isAddFormExpanded && (
                              <div className="space-y-2 h-full flex flex-col overflow-y-hidden">
                                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  검색 결과 ({filteredCourses.length})
                                </h3>
                                <div className="space-y-2 overflow-y-auto">
                                  {filteredCourses.length === 0 ? (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
                                      {courseSearchQuery ? '검색 결과가 없습니다.' : '검색어를 입력하거나 과목을 직접 추가하세요.'}
                                    </p>
                                  ) : (
                                    filteredCourses.map((course) => (
                                      <div
                                        key={course.id}
                                        className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium truncate">{course.title || course.name}</p>
                                          <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {course.code && `${course.code} | `}
                                            {course.department && `${deptName(course.department)} | `}
                                            {course.category || '구분 없음'}
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (simulationCourses.find((c) => c.id === course.id)) {
                                              setSimulationCourses(simulationCourses.filter((c) => c.id !== course.id));
                                            } else {
                                              setSimulationCourses([
                                                ...simulationCourses,
                                                {
                                                  id: course.id,
                                                  name: course.title || course.name,
                                                  code: course.code || '',
                                                  department: course.department || '',
                                                  category: course.category || '',
                                                  credit: course.credit || 3,
                                                },
                                              ]);
                                            }
                                          }}
                                          className={`ml-3 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap ${
                                            simulationCourses.find((c) => c.id === course.id)
                                              ? 'bg-red-600 text-white hover:bg-red-700'
                                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700 border border-gray-300 dark:border-gray-600'
                                          }`}
                                        >
                                          {simulationCourses.find((c) => c.id === course.id) ? '제거' : '추가'}
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}

                            {/* 과목 추가 폼 (접을 수 있음) */}
                            {isAddFormExpanded && (
                              <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
                                <div className="relative">
                                  {/* 과목명 */}
                                  <div className="flex flex-col grow gap-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">과목명</label>
                                    <Input
                                      type="text"
                                      value={newCourse.name}
                                      onChange={(value) => setNewCourse({ ...newCourse, name: value })}
                                      placeholder="예: 컴퓨터네트워크"
                                      size="medium"
                                    />
                                  </div>
                                  {/* 폼 접기 버튼 */}
                                  <button
                                    type="button"
                                    onClick={() => setIsAddFormExpanded(false)}
                                    className="absolute top-[-1rem] right-[-1rem] p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                    title="폼 접기"
                                  >
                                    <svg
                                      className="w-5 h-5 transition-transform rotate-180"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                </div>

                                {/* 과목코드, 개설학과, 과목구분 (한 줄 3분할) */}
                                <div className="grid grid-cols-3 gap-3">
                                  <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">과목코드</label>
                                    <Input
                                      type="text"
                                      value={newCourse.code}
                                      onChange={(value) => setNewCourse({ ...newCourse, code: value })}
                                      placeholder="예: CS.30300"
                                      size="small"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">개설학과</label>
                                    <DepartmentDropdown
                                      value={newCourse.department}
                                      onChange={(value) => setNewCourse({ ...newCourse, department: value === 'none' ? '' : value })}
                                      mode="course"
                                      size="small"
                                      allowNone={true}
                                    />
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">과목구분</label>
                                    <CourseCategoryDropdown
                                      value={newCourse.category}
                                      onChange={(newValue) => setNewCourse({ ...newCourse, category: newValue })}
                                      size="small"
                                    />
                                  </div>
                                </div>

                                {/* 추가 버튼 */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!newCourse.name.trim()) {
                                      alert('과목명을 입력해주세요.');
                                      return;
                                    }
                                    const newId = Date.now(); // 임시 ID
                                    const courseToAdd = {
                                      id: newId,
                                      name: newCourse.name,
                                      code: newCourse.code || '',
                                      department: newCourse.department || '',
                                      category: newCourse.category || '',
                                      credit: 3, // 기본값, 나중에 입력받을 수 있음
                                    };
                                    setSimulationCourses([...simulationCourses, courseToAdd]);
                                    setNewCourse({ name: '', code: '', department: '', category: '' });
                                    setIsAddFormExpanded(false);
                                  }}
                                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700 border border-gray-300 dark:border-gray-600 rounded-lg font-medium transition-colors"
                                >
                                  과목 추가
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* 선택한 과목 보기 */
                          <div className="space-y-2">
                            {simulationCourses.length === 0 ? (
                              <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                                추가된 과목이 없습니다.
                              </p>
                            ) : (
                              simulationCourses.map((course) => (
                                <div
                                  key={course.id}
                                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-violet-50 dark:bg-violet-900/20"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{course.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                      {course.code && `${course.code} | `}
                                      {course.department && `${deptName(course.department)} | `}
                                      {course.category || '구분 없음'} | {course.credit || 3}학점
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSimulationCourses(simulationCourses.filter((c) => c.id !== course.id))}
                                    className="ml-3 px-3 py-1.5 text-red-600 hover:text-red-700 text-sm font-medium whitespace-nowrap"
                                  >
                                    삭제
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
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
                            courses: simulationCourses,
                          }),
                        });

                        const data = await response.json();

                        if (data.success) {
                          // 과목 추가 옵션이 체크되어 있으면 프로필의 enrollments에 추가
                          if (addToEnrollments && simulationCourses.length > 0) {
                            const profileResponse = await fetch(`${API}/profile?userId=${encodeURIComponent(userId)}`, {
                              credentials: 'include',
                            });
                            const profileData = await profileResponse.json();

                            if (profileData.success && profileData.profile) {
                              const currentEnrollments = Array.isArray(profileData.profile.enrollments)
                                ? profileData.profile.enrollments
                                : [];

                              const newEnrollments = [
                                ...currentEnrollments,
                                ...simulationCourses.map((course) => ({
                                  courseId: course.id,
                                  courseName: course.name,
                                  credit: course.credit,
                                  grade: course.grade || null,
                                })),
                              ];

                              await fetch(`${API}/profile`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include',
                                body: JSON.stringify({
                                  userId,
                                  enrollments: newEnrollments,
                                }),
                              });
                            }
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
