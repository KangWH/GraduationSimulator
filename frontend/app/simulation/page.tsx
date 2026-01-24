'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { DepartmentDropdown, MultipleDepartmentDropdown } from '../components/DepartmentDropeown';
import { NumberInput, Select } from '../components/formFields';

type Dept = { id: string; name: string };
type Section = {
  id: string;
  title: string;
  courses: { id: number; name: string; credit: number; grade?: string }[];
  fulfilled: boolean;
  detail: string; // e.g. "12 / 36 학점"
};

export default function SimulationPage() {
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

  useEffect(() => {
    fetch('http://localhost:4000/departments')
      .then((r) => r.json())
      .then((arr: Dept[]) => setDepts(arr))
      .catch(() => {});
  }, []);

  const deptName = (id: string) => depts.find((d) => d.id === id)?.name ?? id;

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
          className={`flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 overflow-hidden ${
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

        {/* 하단 메뉴 */}
        <div
          className={`border-t border-gray-200 dark:border-gray-700 space-y-2 overflow-hidden ${
            sidebarOpen ? 'p-4' : 'px-2 py-3'
          }`}
        >
          <Link
            href="/profile/settings"
            className={`w-full flex items-center gap-3 rounded-lg transition-colors ${
              sidebarOpen
                ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 px-4 py-2'
                : 'justify-center p-2'
            }`}
            title={sidebarOpen ? undefined : '프로필 설정'}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {sidebarOpen && <span className="whitespace-nowrap min-w-0 truncate">프로필 설정</span>}
          </Link>
        </div>
      </aside>

      {/* 메인 컨텐츠 */}
      <div className="flex-1 overflow-y-auto">
        {/* 상단 필터 바 */}
        <div className="py-4 flex-shrink-0 overflow-x-auto">
          <div className="px-8 flex items-center gap-4 min-w-max">
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

        {/* 3분할 카드 래퍼 */}
        <div className="flex-1 flex flex-col min-h-0 p-4">
          <div className="flex-1 flex flex-col min-h-0 rounded-xl shadow-lg overflow-hidden bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-700">
            <div className="flex-1 flex min-h-0">
              {/* 좌측: 섹션별 요건 계산에 사용된 과목 (스크롤 동기화) */}
              <div
                ref={leftScrollRef}
                onScroll={handleLeftScroll}
                className="w-1/3 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto"
              >
                <div className="p-4">
                  <h2 className="text-xl font-semibold mb-4">요건별 인정 과목</h2>
                  <div className="space-y-4">
                    {sections.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                        주전공을 선택하면 섹션이 구성됩니다.
                      </p>
                    ) : (
                      sections.map((s) => (
                        <div
                          key={s.id}
                          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                        >
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
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* 가운데: 섹션별 세부 요건 달성 여부 (스크롤 동기화) */}
              <div className="w-1/3 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col min-h-0">
                <div
                  ref={centerScrollRef}
                  onScroll={handleCenterScroll}
                  className="flex-1 min-h-0 overflow-y-auto"
                >
                  <div className="p-4">
                    <h2 className="text-xl font-semibold mb-4">졸업 요건 조회</h2>
                    <div className="space-y-4">
                      {sections.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                          주전공을 선택하면 섹션이 구성됩니다.
                        </p>
                      ) : (
                        sections.map((s) => (
                          <div
                            key={s.id}
                            className="rounded-lg border border-gray-200 dark:border-gray-700 p-4"
                          >
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
                        ))
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
              <div className="w-1/3 flex-shrink-0 overflow-y-auto">
                <div className="p-4">
                  <h2 className="text-xl font-semibold mb-4">시뮬레이션 과목 선택</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    아직 듣지 않은 과목을 선택하면 결과 창에 즉시 반영됩니다.
                  </p>
                  <div className="space-y-3">
                    {/* 예시 과목 목록 */}
                    {[
                      { id: 1, name: '컴퓨터네트워크', credit: 3, category: '전공' },
                      { id: 2, name: '운영체제', credit: 3, category: '전공' },
                      { id: 3, name: '인문학개론', credit: 2, category: '교양' },
                    ].map((course) => (
                      <div
                        key={course.id}
                        className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700"
                      >
                        <div>
                          <p className="font-medium">{course.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {course.credit}학점 | {course.category}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            if (simulationCourses.find((c) => c.id === course.id)) {
                              setSimulationCourses(simulationCourses.filter((c) => c.id !== course.id));
                            } else {
                              setSimulationCourses([...simulationCourses, course]);
                            }
                          }}
                          className={`px-4 py-2 rounded-md text-sm font-medium ${
                            simulationCourses.find((c) => c.id === course.id)
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'bg-green-600 text-white hover:bg-green-700'
                          }`}
                        >
                          {simulationCourses.find((c) => c.id === course.id) ? '제거' : '추가'}
                        </button>
                      </div>
                    ))}
                  </div>
                  {simulationCourses.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <h3 className="font-medium mb-3">추가된 과목 ({simulationCourses.length})</h3>
                      <div className="space-y-2">
                        {simulationCourses.map((course) => (
                          <div
                            key={course.id}
                            className="flex items-center justify-between p-2 rounded bg-violet-50 dark:bg-violet-900/20"
                          >
                            <span className="text-sm">{course.name}</span>
                            <button
                              onClick={() => setSimulationCourses(simulationCourses.filter((c) => c.id !== course.id))}
                              className="text-red-600 hover:text-red-700 text-sm"
                            >
                              삭제
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
