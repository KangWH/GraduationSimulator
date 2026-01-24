'use client';

import { Input, NumberInput, Select } from '../../components/formFields';
import { DepartmentDropdown } from '../../components/DepartmentDropdown';
import type { Profile } from './types';
import { CourseCategoryDropdown } from '@/app/components/CourseCategoryDropdown';

interface NewCourse {
  name: string;
  code: string;
  department: string;
  category: string;
  credit: number;
  year: number;
  semester: string;
  grade: string;
}

interface AddCoursePanelProps {
  isExpanded: boolean;
  setIsExpanded: (b: boolean) => void;
  newCourse: NewCourse;
  setNewCourse: React.Dispatch<React.SetStateAction<NewCourse>>;
  filteredCourses: { id: string; code?: string; title?: string; name?: string; department?: string; category?: string; credit?: number }[];
  profile: Profile | null;
  deptName: (id: string) => string;
  validGrades: string[];
  semesters: string[];
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  onAdd: () => void;
}

export default function AddCoursePanel({
  isExpanded,
  setIsExpanded,
  newCourse,
  setNewCourse,
  filteredCourses,
  profile,
  deptName,
  validGrades,
  semesters,
  searchQuery,
  onSearchQueryChange,
  onAdd,
}: AddCoursePanelProps) {
  if (isExpanded) {
    return (
      <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-zinc-800/50">
        <div className="relative">
          <div className="flex flex-col gap-2 grow">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">과목명</label>
            <Input
              type="text"
              value={newCourse.name}
              onChange={(value) => setNewCourse((c) => ({ ...c, name: value }))}
              placeholder="예: 운영체제및실험"
              size="medium"
            />
          </div>
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="absolute -right-4 -top-4 rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:text-gray-400 dark:hover:text-gray-200"
            title="폼 접기"
          >
            <svg className="h-5 w-5 rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">과목코드</label>
            <Input
              type="text"
              value={newCourse.code}
              onChange={(value) => setNewCourse((c) => ({ ...c, code: value }))}
              placeholder="예: CS.30300"
              size="small"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">개설학과</label>
            <DepartmentDropdown
              value={newCourse.department}
              onChange={(value) => setNewCourse((c) => ({ ...c, department: value === 'none' ? '' : value }))}
              mode="course"
              size="small"
              allowNone={true}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">과목구분</label>
            <CourseCategoryDropdown
              value={newCourse.category}
              onChange={(newValue) => setNewCourse((c) => ({ ...c, category: newValue }))}
              size="small"
            />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">학점</label>
            <NumberInput
              min="1"
              max="10"
              value={String(newCourse.credit)}
              onChange={(value) => setNewCourse((c) => ({ ...c, credit: parseInt(value) || 3 }))}
              size="small"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">연도</label>
            <NumberInput
              min="2000"
              max="2050"
              value={String(newCourse.year)}
              onChange={(value) => setNewCourse((c) => ({ ...c, year: parseInt(value) || new Date().getFullYear() }))}
              size="small"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">학기</label>
            <Select value={newCourse.semester} onChange={(value) => setNewCourse((c) => ({ ...c, semester: value }))} size="small">
              {semesters.map((sem) => (
                <option key={sem} value={sem}>{sem}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">성적</label>
            <Select value={newCourse.grade} onChange={(value) => setNewCourse((c) => ({ ...c, grade: value }))} size="small">
              <option value="">선택</option>
              {validGrades.map((grade) => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </Select>
          </div>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="w-full rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:border-gray-600 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700"
        >
          과목 추가
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 검색 창 */}
      <div className="flex gap-2">
        <div className="relative grow">
          <Input
            type="text"
            value={searchQuery}
            onChange={onSearchQueryChange}
            placeholder="과목명 또는 과목코드로 검색"
            size="medium"
            className="pr-10"
          />
          <button
            type="button"
            className="absolute right-1 top-1 bottom-1 flex items-center justify-center px-1.5 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-900 dark:text-gray-400 dark:hover:text-gray-200 active:bg-gray-200 dark:active:bg-zinc-800 transition-colors"
            title="검색"
            aria-label="검색"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="shrink-0 rounded p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-zinc-800 dark:hover:text-gray-200"
          title="상세 검색"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">검색 결과 ({filteredCourses.length})</h3>
      <div className="space-y-2 overflow-y-auto">
        {filteredCourses.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            {searchQuery ? '검색 결과가 없습니다.' : '검색어를 입력하거나 과목을 직접 추가하세요.'}
          </p>
        ) : (
          filteredCourses.map((course) => {
            const isAlreadyAdded = profile?.enrollments?.some(
              (e: any) =>
                (e.course?.code || e.code) === course.code ||
                (e.course?.title || e.course?.name || e.courseName) === (course.title || course.name)
            );
            return (
              <div
                key={course.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-zinc-800"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{course.title || course.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {course.code && `${course.code} | `}
                    {course.department && `${deptName(course.department)} | `}
                    {course.category || '구분 없음'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (isAlreadyAdded) {
                      alert('이미 추가된 과목입니다.');
                      return;
                    }
                    setNewCourse({
                      name: course.title || course.name || '',
                      code: course.code || '',
                      department: course.department || '',
                      category: course.category || '',
                      credit: course.credit || 3,
                      year: new Date().getFullYear(),
                      semester: '봄',
                      grade: '',
                    });
                    setIsExpanded(true);
                  }}
                  disabled={isAlreadyAdded}
                  className={`ml-3 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ${
                    isAlreadyAdded
                      ? 'cursor-not-allowed bg-gray-300 text-gray-500 dark:bg-zinc-700 dark:text-gray-400'
                      : 'border border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200 dark:border-gray-600 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700'
                  }`}
                >
                  {isAlreadyAdded ? '추가됨' : '추가'}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
