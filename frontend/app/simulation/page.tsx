'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SimulationPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'basic' | 'courses' | 'result'>('basic');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [previousSimulations] = useState([
    { id: 1, name: '2024년 1학기 시뮬레이션', date: '2024-01-15' },
    { id: 2, name: '2023년 2학기 시뮬레이션', date: '2023-08-20' },
  ]);

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-black">
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
              setActiveTab('result');
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
                    setActiveTab('result');
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
          <h1 className="mb-8 text-4xl font-bold text-center">졸업시뮬레이터</h1>
        
        {/* 탭 네비게이션 */}
        <div className="mb-8 flex justify-center border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('basic')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'basic'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            기본 정보
          </button>
          <button
            onClick={() => setActiveTab('courses')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'courses'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            들은 과목
          </button>
          <button
            onClick={() => setActiveTab('result')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'result'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            결과 조회
          </button>
        </div>

        {/* 기본 정보 입력 섹션 */}
        {activeTab === 'basic' && (
          <div className="mx-auto max-w-2xl rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
            <h2 className="mb-6 text-2xl font-semibold">기본 정보 입력</h2>
            <form className="space-y-6">
              <div>
                <label htmlFor="major" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  학과
                </label>
                <input
                  id="major"
                  name="major"
                  type="text"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                  placeholder="학과를 입력하세요"
                />
              </div>

              <div>
                <label htmlFor="admissionYear" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  입학연도
                </label>
                <input
                  id="admissionYear"
                  name="admissionYear"
                  type="number"
                  min="2000"
                  max="2030"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                  placeholder="입학연도를 입력하세요"
                />
              </div>

              <div>
                <label htmlFor="doubleMajor" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  복전 여부
                </label>
                <select
                  id="doubleMajor"
                  name="doubleMajor"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="">선택하세요</option>
                  <option value="none">없음</option>
                  <option value="double">복수전공</option>
                  <option value="minor">부전공</option>
                </select>
              </div>

              {false && (
                <div>
                  <label htmlFor="doubleMajorName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    복전 학과명
                  </label>
                  <input
                    id="doubleMajorName"
                    name="doubleMajorName"
                    type="text"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                    placeholder="복전 학과명을 입력하세요"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                저장
              </button>
            </form>
          </div>
        )}

        {/* 들은 과목 입력 섹션 */}
        {activeTab === 'courses' && (
          <div className="mx-auto max-w-4xl rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
            <h2 className="mb-6 text-2xl font-semibold">들은 과목 입력</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="과목명"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="학점"
                  className="w-24 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="성적"
                  className="w-24 rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                />
                <button
                  type="button"
                  className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  추가
                </button>
              </div>
              
              <div className="mt-6">
                <h3 className="mb-4 text-lg font-medium">등록된 과목 목록</h3>
                <div className="space-y-2">
                  <p className="text-gray-500 dark:text-gray-400">등록된 과목이 없습니다.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 결과 조회 창 + 시뮬레이션 섹션 */}
        {activeTab === 'result' && (
          <div className="mx-auto max-w-6xl">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* 결과 조회 창 */}
              <div className="rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
                <h2 className="mb-6 text-2xl font-semibold">졸업 요건 조회</h2>
                <div className="space-y-4">
                  <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                    <h3 className="font-medium">총 이수학점</h3>
                    <p className="text-2xl font-bold">0 / 130</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                    <h3 className="font-medium">전공 이수학점</h3>
                    <p className="text-2xl font-bold">0 / 60</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                    <h3 className="font-medium">교양 이수학점</h3>
                    <p className="text-2xl font-bold">0 / 30</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                    <h3 className="font-medium">졸업 가능 여부</h3>
                    <p className="text-2xl font-bold text-red-600">불가능</p>
                  </div>
                </div>
              </div>

              {/* 시뮬레이션 섹션 */}
              <div className="rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
                <h2 className="mb-6 text-2xl font-semibold">시뮬레이션</h2>
                <p className="mb-4 text-gray-600 dark:text-gray-400">
                  아직 듣지 않은 과목을 선택하면 결과 창에 즉시 반영됩니다.
                </p>
                <div className="space-y-4">
                  <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">과목명 예시</h3>
                        <p className="text-sm text-gray-500">3학점 | 전공</p>
                      </div>
                      <button
                        type="button"
                        className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                      >
                        추가
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    시뮬레이션할 과목 목록이 여기에 표시됩니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
