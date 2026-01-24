'use client';

import { DepartmentDropdown } from '@/app/components/DepartmentDropdown';
import { Input, NumberInput, Select } from '../../components/formFields';
import type { Semester, Grade } from './types';
import { CourseCategoryDropdown } from '@/app/components/CourseCategoryDropdown';

const VALID_GRADES: Grade[] = ['A+', 'A0', 'A-', 'B+', 'B0', 'B-', 'C+', 'C0', 'C-', 'D+', 'D0', 'D-', 'F', 'S', 'U', 'P', 'NR', 'W'];

const SEMESTER_OPTIONS: { value: Semester; label: string }[] = [
  { value: 'SPRING', label: '봄' },
  { value: 'SUMMER', label: '여름' },
  { value: 'FALL', label: '가을' },
  { value: 'WINTER', label: '겨울' },
];

interface AddCoursePanelProps {
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  searchResults: { id: string; code?: string; title?: string; name?: string; department?: string; category?: string; credit?: number }[];
  selectedCourseIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  addYear: number;
  onAddYearChange: (year: number) => void;
  addSemester: Semester;
  onAddSemesterChange: (semester: Semester) => void;
  addGrade: Grade;
  onAddGradeChange: (grade: Grade) => void;
  onAddSelected: () => void;
  onDragStart: (course: any) => void;
}

export default function AddCoursePanel({
  searchQuery,
  onSearchQueryChange,
  searchResults,
  selectedCourseIds,
  onSelectionChange,
  addYear,
  onAddYearChange,
  addSemester,
  onAddSemesterChange,
  addGrade,
  onAddGradeChange,
  onAddSelected,
  onDragStart,
}: AddCoursePanelProps) {
  const toggleSelection = (courseId: string) => {
    const newSet = new Set(selectedCourseIds);
    if (newSet.has(courseId)) {
      newSet.delete(courseId);
    } else {
      newSet.add(courseId);
    }
    onSelectionChange(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedCourseIds.size === searchResults.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(
        new Set(
          searchResults.map((c) => {
            const id = c.id || c.code;
            if (!id) {
              console.warn('Course without id or code:', c);
              return '';
            }
            return id;
          }).filter((id) => id !== '')
        )
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* 검색 창 */}
      <div className="sticky top-4 flex flex-col gap-4">
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
        <div class="flex flex-row gap-2">
          <div className="flex-1 flex flex-col gap-1">
            <p className="text-sm">학과</p>
            <DepartmentDropdown
              allowNone
              size="small"
            />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <p className="text-sm">과목 구분</p>
            <CourseCategoryDropdown
              allowNone
              size="small"
            />
          </div>
        </div>
      </div>

      {/* 검색 결과 */}
      {searchResults.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              검색 결과 ({searchResults.length})
            </h3>
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
            >
              {selectedCourseIds.size === searchResults.length ? '전체 해제' : '전체 선택'}
            </button>
          </div>
          <div className="space-y-2 overflow-y-auto">
            {searchResults.map((course) => {
              const courseId = course.id || course.code || String(course.id || course.code || Math.random());
              const isSelected = selectedCourseIds.has(courseId);
              return (
                <div
                  key={courseId}
                  draggable
                  onDragStart={(e) => {
                    onDragStart(course);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => toggleSelection(courseId)}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-violet-500 bg-violet-50 dark:border-violet-400 dark:bg-violet-900/20'
                      : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-zinc-800'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelection(courseId)}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelection(courseId);
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{course.title || course.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {course.code && `${course.code}`}
                      {course.department && ` · ${course.department}`}
                      {course.category && ` · ${course.category}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {searchResults.length === 0 && searchQuery && (
        <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">검색 결과가 없습니다.</p>
      )}

      {searchResults.length === 0 && !searchQuery && (
        <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">검색어를 입력하세요.</p>
      )}

      {/* 추가 옵션 및 버튼 */}
      {selectedCourseIds.size > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-zinc-800/50">
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-2 flex-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">수강 연도</label>
              <NumberInput
                min="2000"
                max="2050"
                value={String(addYear)}
                onChange={(v) => onAddYearChange(parseInt(v) || new Date().getFullYear())}
                size="small"
              />
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">수강 학기</label>
              <Select
                value={addSemester}
                onChange={(v) => onAddSemesterChange(v as Semester)}
                size="small"
              >
                {SEMESTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">성적</label>
              <Select
                value={addGrade}
                onChange={(v) => onAddGradeChange(v as Grade)}
                size="small"
              >
                {VALID_GRADES.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </Select>
            </div>
            <button
              type="button"
              onClick={onAddSelected}
              className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 font-medium text-white transition-colors hover:bg-violet-700"
            >
              {selectedCourseIds.size}과목 추가
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
