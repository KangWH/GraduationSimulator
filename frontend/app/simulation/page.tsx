'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DepartmentDropdown from '../components/DepartmentDropeown';
import { NumberInput } from '../components/formFields';

export default function SimulationPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [previousSimulations] = useState([
    { id: 1, name: '2024년 1학기 시뮬레이션', date: '2024-01-15' },
    { id: 2, name: '2023년 2학기 시뮬레이션', date: '2023-08-20' },
  ]);

  // 필터 상태
  const [filters, setFilters] = useState({
    requirementYear: new Date().getFullYear(),
    major: '',
    doubleMajor: '',
    minor: '',
    advancedMajor: false,
    individuallyDesignedMajor: false,
  });

  // 시뮬레이션에 추가된 과목들
  const [simulationCourses, setSimulationCourses] = useState<any[]>([]);
  
  // 카테고리별 인정된 과목들 (예시 데이터)
  const [categoryCourses] = useState({
    전공: [
      { id: 1, name: '데이터구조', credit: 3, grade: 'A+' },
      { id: 2, name: '알고리즘', credit: 3, grade: 'A' },
    ],
    교양: [
      { id: 3, name: '영어회화', credit: 2, grade: 'B+' },
    ],
  });

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-black">
      {/* 사이드바 */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-16'
        } transition-all duration-300 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-gray-700 flex flex-col`}
      >
        {/* 사이드바 토글 버튼 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          {sidebarOpen && (
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">메뉴</h2>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400"
          >
            {sidebarOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* 메인 메뉴 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {/* 새로운 시뮬레이션 */}
          <button
            onClick={() => {
              // 새로운 시뮬레이션 시작 로직
              setSimulationCourses([]);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              sidebarOpen
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-blue-600 text-white hover:bg-blue-700 justify-center'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {sidebarOpen && <span>새로운 시뮬레이션</span>}
          </button>

          {/* 이전 시뮬레이션 조회 */}
          <div className="mt-6">
            {sidebarOpen && (
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 px-2">
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
                  className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-left transition-colors ${
                    sidebarOpen
                      ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                      : 'justify-center'
                  }`}
                  title={sidebarOpen ? undefined : sim.name}
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {sidebarOpen && (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{sim.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{sim.date}</p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 하단 메뉴 */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-2">
          <Link
            href="/simulation?tab=courses"
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
              sidebarOpen
                ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                : 'justify-center'
            }`}
            title={sidebarOpen ? undefined : '들은 과목 설정'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            {sidebarOpen && <span>들은 과목 설정</span>}
          </Link>
          <Link
            href="/profile/setup"
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
              sidebarOpen
                ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                : 'justify-center'
            }`}
            title={sidebarOpen ? undefined : '프로필 설정'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {sidebarOpen && <span>프로필 설정</span>}
          </Link>
        </div>
      </aside>

      {/* 메인 컨텐츠 */}
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold text-center">졸업시뮬레이터</h1>
        </div>

        {/* 상단 필터 바 */}
        <div className="py-4 flex-shrink-0 overflow-x-auto">
          <div className="px-4 flex flex-wrap gap-6 min-w-max justify-center">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                전공 이수 기준 연도
              </label>
              {/* <input
                type="number"
                min="2000"
                max="2030"
                value={filters.requirementYear}
                onChange={(e) => setFilters({ ...filters, requirementYear: parseInt(e.target.value) })}
                className="w-28 rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
              /> */}
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
                주전공 학과
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
                복수전공 학과
              </label>
              <input
                type="text"
                value={filters.doubleMajor}
                onChange={(e) => setFilters({ ...filters, doubleMajor: e.target.value })}
                placeholder="복수전공 학과"
                className="w-36 rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                부전공 학과
              </label>
              <input
                type="text"
                value={filters.minor}
                onChange={(e) => setFilters({ ...filters, minor: e.target.value })}
                placeholder="부전공 학과"
                className="w-36 rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="advancedMajor" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                심화전공 여부
              </label>
              <select
                id="advancedMajor"
                value={filters.advancedMajor ? 'true' : 'false'}
                onChange={(e) => setFilters({ ...filters, advancedMajor: e.target.value === 'true' })}
                className="w-28 rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
              >
                <option value="false">아니오</option>
                <option value="true">예</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="individuallyDesignedMajor" className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                자유융합전공 여부
              </label>
              <select
                id="individuallyDesignedMajor"
                value={filters.individuallyDesignedMajor ? 'true' : 'false'}
                onChange={(e) => setFilters({ ...filters, individuallyDesignedMajor: e.target.value === 'true' })}
                className="w-28 rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
              >
                <option value="false">아니오</option>
                <option value="true">예</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3분할 카드 래퍼 */}
        <div className="flex-1 flex flex-col min-h-0 p-4">
          <div className="flex-1 flex flex-col min-h-0 rounded-xl shadow-lg overflow-hidden bg-white dark:bg-zinc-900 border border-gray-200 dark:border-gray-700">
            {/* 3분할 메인 영역 - 빈 공간 없이 꽉 채움 */}
            <div className="flex-1 flex min-h-0">
              {/* 좌측: 요건 카테고리별 인정된 과목 */}
              <div className="w-1/3 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
                <div className="p-4">
                  <h2 className="text-xl font-semibold mb-4">요건 카테고리별 인정된 과목</h2>
                  <div className="space-y-4">
                    {Object.entries(categoryCourses).map(([category, courses]) => (
                      <div key={category} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <h3 className="font-medium text-lg mb-3">{category}</h3>
                        <div className="space-y-2">
                          {courses.map((course) => (
                            <div
                              key={course.id}
                              className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-zinc-800"
                            >
                              <div>
                                <p className="font-medium text-sm">{course.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {course.credit}학점 | {course.grade}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 가운데: 졸업 요건 조회 */}
              <div className="w-1/3 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-y-auto relative">
                <div className="p-4 pb-20">
                  <h2 className="text-xl font-semibold mb-4">졸업 요건 조회</h2>
                  <div className="space-y-4">
                    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                      <h3 className="font-medium mb-2">총 이수학점</h3>
                      <p className="text-3xl font-bold">0 / 130</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                      <h3 className="font-medium mb-2">전공 이수학점</h3>
                      <p className="text-3xl font-bold">0 / 60</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                      <h3 className="font-medium mb-2">교양 이수학점</h3>
                      <p className="text-3xl font-bold">0 / 30</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                      <h3 className="font-medium mb-2">졸업 가능 여부</h3>
                      <p className="text-3xl font-bold text-red-600">불가능</p>
                    </div>
                  </div>
                </div>
                
                {/* Sticky 하단 박스 */}
                <div className="sticky bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-gray-700 px-4 py-3 shadow-lg">
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
                            className="flex items-center justify-between p-2 rounded bg-blue-50 dark:bg-blue-900/20"
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
