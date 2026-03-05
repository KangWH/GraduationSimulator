'use client';

import { useState, useEffect, useCallback } from 'react';
import { DepartmentDropdown } from '@/app/components/DepartmentDropdown';
import { Input, NumberInput, Select } from '../../components/formFields';
import type { Semester, Grade } from './types';
import { CourseCategoryDropdown } from '@/app/components/CourseCategoryDropdown';
import { API } from '../../lib/api';
import Button from '@/app/components/Button';
import BottomSheet from '@/app/components/BottomSheet';
import AddCourseSearchResults from './AddCourseSearchResults';

const VALID_GRADES: Grade[] = ['A+', 'A0', 'A-', 'B+', 'B0', 'B-', 'C+', 'C0', 'C-', 'D+', 'D0', 'D-', 'F', 'S', 'U', 'P', 'NR', 'W'];

const SEMESTER_OPTIONS_KO: { value: Semester; label: string }[] = [
  { value: 'SPRING', label: '봄' },
  { value: 'SUMMER', label: '여름' },
  { value: 'FALL', label: '가을' },
  { value: 'WINTER', label: '겨울' },
];
const SEMESTER_OPTIONS_EN: { value: Semester; label: string }[] = [
  { value: 'SPRING', label: 'Spring' },
  { value: 'SUMMER', label: 'Summer' },
  { value: 'FALL', label: 'Fall' },
  { value: 'WINTER', label: 'Winter' },
];

interface AddCoursePanelProps {
  lang?: 'ko' | 'en';
  searchQuery: string;
  onSearchQueryChange: (v: string) => void;
  /** 검색 결과가 변경될 때 호출 (handleAddSelected 등에서 course 객체 조회용) */
  onSearchResultsChange?: (results: { id: string; code?: string; title?: string; name?: string; department?: string; category?: string; credit?: number; au?: number; tags?: string[] }[]) => void;
  selectedCourseIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  addYear: number;
  onAddYearChange: (year: number) => void;
  addSemester: Semester;
  onAddSemesterChange: (semester: Semester) => void;
  addGrade: Grade;
  onAddGradeChange: (grade: Grade) => void;
  addAsPriorCredit?: boolean;
  onAddAsPriorCreditChange?: (v: boolean) => void;
  onAddSelected: () => void;
  onDragStart: (course: any) => void;
  filterDepartment: string;
  onFilterDepartmentChange: (dept: string) => void;
  filterCategory: string;
  onFilterCategoryChange: (cat: string) => void;
  stickyTopOffset?: string;
  /** 이미 수강한 과목 ID 목록 (검색 결과에서 수강함 표시용). profile/settings는 프로필 수강 목록, simulation은 시뮬레이션 과목 목록 */
  enrolledCourseIds?: string[];
  /** controlled: 시트 열림 상태 (버튼을 스크롤 영역 바깥에 둘 때 사용) */
  addSheetOpen?: boolean;
  onAddSheetOpenChange?: (open: boolean) => void;
}

/** 스크롤 영역 바깥에 둘 과목 추가 버튼 (controlled 모드용) */
export function AddCoursePanelFooter({
  lang = 'ko',
  selectedCount,
  disabled,
  onOpen,
}: {
  lang?: 'ko' | 'en';
  selectedCount: number;
  disabled: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => !disabled && onOpen()}
        disabled={disabled}
        className="w-full rounded-lg bg-violet-600 px-4 py-3 font-medium text-white active:scale-[0.98] transition-all hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-violet-600 disabled:active:scale-100"
      >
        {lang === 'en' ? 'Add Course' : '과목 추가'}
        {selectedCount > 0 && (
          <span className="ml-2 opacity-90">({selectedCount})</span>
        )}
      </button>
    </div>
  );
}

export default function AddCoursePanel({
  lang = 'ko',
  searchQuery,
  onSearchQueryChange,
  onSearchResultsChange,
  selectedCourseIds,
  onSelectionChange,
  addYear,
  onAddYearChange,
  addSemester,
  onAddSemesterChange,
  addGrade,
  onAddGradeChange,
  addAsPriorCredit = false,
  onAddAsPriorCreditChange,
  onAddSelected,
  onDragStart,
  filterDepartment,
  onFilterDepartmentChange,
  filterCategory,
  onFilterCategoryChange,
  stickyTopOffset = '0',
  enrolledCourseIds = [],
  addSheetOpen: addSheetOpenProp,
  onAddSheetOpenChange,
}: AddCoursePanelProps) {
  const SEMESTER_OPTIONS = lang === 'en' ? SEMESTER_OPTIONS_EN : SEMESTER_OPTIONS_KO;
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; nameEn?: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [addSheetOpenInternal, setAddSheetOpenInternal] = useState(false);

  const isControlled = addSheetOpenProp !== undefined;
  const addSheetOpen = isControlled ? addSheetOpenProp! : addSheetOpenInternal;
  const setAddSheetOpen = useCallback(
    (open: boolean) => {
      if (isControlled) {
        onAddSheetOpenChange?.(open);
      } else {
        setAddSheetOpenInternal(open);
      }
    },
    [isControlled, onAddSheetOpenChange]
  );

  useEffect(() => {
    Promise.all([
      fetch(`${API}/departments`).then((r) => r.json()),
      fetch(`${API}/courseCategories`).then((r) => r.json()),
    ]).then(([depts, cats]) => {
      setDepartments(Array.isArray(depts) ? depts : []);
      setCategories(Array.isArray(cats) ? cats : []);
    }).catch((error) => {
      console.error('Failed to load departments/categories:', error);
    });
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* 검색 창 */}
      <div className={`-mx-2 px-4 pt-2 pb-4 bg-gradient-to-b from-gray-50 via-gray-50/90 to-trasparent dark:from-zinc-900 dark:via-zinc-900/90`} style={{ top: stickyTopOffset }}>
        <div className="space-y-2">
          <div className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                type="text"
                value={searchQuery}
                onChange={onSearchQueryChange}
                placeholder={lang === 'en' ? 'Search by course name or code' : '과목명 또는 과목코드로 검색'}
                size="medium"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-1 top-1 bottom-1 flex items-center justify-center px-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-800 dark:text-gray-400 dark:hover:text-gray-200 active:bg-gray-200 dark:active:bg-zinc-700 active:scale-85 transition-all"
                title={lang === 'en' ? 'Search' : '검색'}
                aria-label={lang === 'en' ? 'Search' : '검색'}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-sm active:scale-85 transition-all ${
                  (filterDepartment !== 'none' && filterDepartment) || (filterCategory && filterCategory !== 'none')
                    ? 'text-violet-600 bg-violet-50 hover:bg-violet-100 dark:text-violet-400 dark:bg-violet-900/20 dark:hover:bg-violet-900/30'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-zinc-800'
                }`}
                title={lang === 'en' ? 'Filter' : '필터'}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </button>
              {(filterDepartment !== 'none' && filterDepartment) || (filterCategory && filterCategory !== 'none') ? (
                <button
                  type="button"
                  onClick={() => {
                    onFilterDepartmentChange('none');
                    onFilterCategoryChange('');
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 active:scale-85 transition-all"
                  title={lang === 'en' ? 'Reset filter' : '필터 초기화'}
                >
                  {lang === 'en' ? 'Reset' : '초기화'}
                </button>
              ) : null}
            </div>
          </div>
          {filtersExpanded && (
            <div className="flex flex-row gap-3 pt-2 animate-in slide-in-from-top-2 duration-200">
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{lang === 'en' ? 'Department' : '학과'}</label>
                <DepartmentDropdown
                  lang={lang}
                  value={filterDepartment}
                  onChange={onFilterDepartmentChange}
                  mode="course"
                  allowNone
                  size="small"
                />
              </div>
              <div className="flex-1 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{lang === 'en' ? 'Category' : '과목 구분'}</label>
                <CourseCategoryDropdown
                  lang={lang}
                  value={filterCategory}
                  onChange={onFilterCategoryChange}
                  allowNone
                  size="small"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 검색 결과 */}
      <AddCourseSearchResults
        lang={lang}
        searchQuery={searchQuery}
        filterDepartment={filterDepartment}
        filterCategory={filterCategory}
        selectedCourseIds={selectedCourseIds}
        onSelectionChange={onSelectionChange}
        onSearchResultsChange={onSearchResultsChange}
        onDragStart={onDragStart}
        enrolledCourseIds={enrolledCourseIds}
        departments={departments}
        categories={categories}
      />

      {/* 하단 고정 과목 추가 버튼 (uncontrolled 모드에서만) */}
      {!isControlled && (
        <>
          <div className="mt-4 px-2 pb-[env(safe-area-inset-bottom)] flex flex-col">
            <Button
              style="prominent"
              disabled={selectedCourseIds.size === 0}
              onClick={() => selectedCourseIds.size > 0 && setAddSheetOpen(true)}
            >
              {lang === 'en' ? (selectedCourseIds.size > 1 ? `Add ${selectedCourseIds.size} courses` : selectedCourseIds.size > 0 ? 'Add 1 course' : 'Add course') : (selectedCourseIds.size > 0 ? `${selectedCourseIds.size}과목 추가` : '과목 추가')}
            </Button>
          </div>
        </>
      )}

      {/* 학기/성적 선택 시트: 모바일=하단 시트, 데스크톱=중앙 모달 */}
      <BottomSheet
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
        title={lang === 'en' ? 'Add courses' : '과목 추가'}
        desktopCenter
        dimmed={false}
        zIndex={102}
        maxHeight="min(400px, 80vh)"
        contentClassName="border border-gray-200 dark:border-zinc-700 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div className="space-y-4">
          {onAddAsPriorCreditChange && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={addAsPriorCredit}
                onChange={(e) => onAddAsPriorCreditChange(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">{lang === 'en' ? 'Prior credit' : '기이수'}</span>
            </label>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-700 dark:text-zinc-300">{lang === 'en' ? 'Year' : '수강 연도'}</label>
              <NumberInput
                min="2000"
                max="2050"
                value={String(addYear)}
                onChange={(v) => onAddYearChange(parseInt(v) || new Date().getFullYear())}
                disabled={addAsPriorCredit}
                size="small"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-700 dark:text-zinc-300">{lang === 'en' ? 'Semester' : '학기'}</label>
              <Select
                value={addSemester}
                onChange={(v) => onAddSemesterChange(v as Semester)}
                disabled={addAsPriorCredit}
                size="small"
              >
                {SEMESTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-700 dark:text-zinc-300">{lang === 'en' ? 'Grade' : '성적'}</label>
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
          </div>
          <Button
            style="prominent"
            onClick={() => {
              onAddSelected();
              setAddSheetOpen(false);
            }}
            className="w-full"
          >
            {lang === 'en' ? `Add ${selectedCourseIds.size} course(s)` : `${selectedCourseIds.size}과목 추가`}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
