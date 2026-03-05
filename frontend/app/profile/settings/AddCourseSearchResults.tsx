'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { API } from '../../lib/api';

export interface SearchResultCourse {
  id: string;
  code?: string;
  title?: string;
  name?: string;
  department?: string;
  category?: string;
  credit?: number;
  au?: number;
  tags?: string[];
}

interface AddCourseSearchResultsProps {
  lang?: 'ko' | 'en';
  searchQuery: string;
  filterDepartment: string;
  filterCategory: string;
  selectedCourseIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onSearchResultsChange?: (results: SearchResultCourse[]) => void;
  onDragStart: (course: SearchResultCourse) => void;
  enrolledCourseIds?: string[];
  departments: Array<{ id: string; name: string; nameEn?: string }>;
  categories: Array<{ id: string; name: string; nameEn?: string }>;
}

const VALID_TAGS = ['사회', '인문', '문학예술', '일반', '핵심', '융합'];
const SEARCH_DEBOUNCE_MS = 500;

export default function AddCourseSearchResults({
  lang = 'ko',
  searchQuery,
  filterDepartment,
  filterCategory,
  selectedCourseIds,
  onSelectionChange,
  onSearchResultsChange,
  onDragStart,
  enrolledCourseIds = [],
  departments,
  categories,
}: AddCourseSearchResultsProps) {
  const [searchResults, setSearchResults] = useState<SearchResultCourse[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const selectedCourseIdsRef = useRef(selectedCourseIds);
  selectedCourseIdsRef.current = selectedCourseIds;

  const hasQuery = !!searchQuery.trim();
  const hasDept = !!(filterDepartment && filterDepartment !== 'none');
  const hasCat = !!(filterCategory && filterCategory !== 'none');
  const hasSearchCriteria = hasQuery || hasDept || hasCat;

  useEffect(() => {
    if (!hasSearchCriteria) {
      setSearchResults([]);
      setIsSearching(false);
      if (selectedCourseIdsRef.current.size > 0) {
        onSelectionChange(new Set());
      }
      onSearchResultsChange?.([]);
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(() => {
      const params = new URLSearchParams();
      if (hasQuery) params.append('query', searchQuery.trim());
      if (hasDept) params.append('department', filterDepartment);
      if (hasCat) params.append('category', filterCategory);

      fetch(`${API}/courses?${params.toString()}`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
          return r.json();
        })
        .then((courses) => {
          const newResults = Array.isArray(courses) ? (courses as SearchResultCourse[]) : [];
          setSearchResults(newResults);
          setIsSearching(false);
          onSearchResultsChange?.(newResults);

          const currentSelected = selectedCourseIdsRef.current;
          if (currentSelected.size > 0) {
            const availableCourseIds = new Set(
              newResults.map((c) => c.id || c.code || '').filter((id) => id !== '')
            );
            const filteredSelected = new Set(
              Array.from(currentSelected).filter((id) => availableCourseIds.has(id))
            );
            if (filteredSelected.size !== currentSelected.size) {
              onSelectionChange(filteredSelected);
            }
          }
        })
        .catch((error) => {
          console.error('Error fetching courses:', error);
          setSearchResults([]);
          setIsSearching(false);
          onSearchResultsChange?.([]);
          if (selectedCourseIdsRef.current.size > 0) {
            onSelectionChange(new Set());
          }
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeoutId);
      setIsSearching(false);
    };
  }, [searchQuery, filterDepartment, filterCategory, onSelectionChange, onSearchResultsChange]);

  const enrolledSet = new Set(enrolledCourseIds);

  const getDepartmentName = useCallback(
    (deptId: string | undefined): string => {
      if (!deptId) return '';
      const dept = departments.find((d) => d.id === deptId);
      return dept ? (lang === 'en' && dept.nameEn ? dept.nameEn : dept.name) : deptId;
    },
    [departments, lang]
  );

  const getCategoryName = useCallback(
    (catId: string | undefined): string => {
      if (!catId) return '';
      const cat = categories.find((c) => c.id === catId);
      return cat ? (lang === 'en' && cat.nameEn ? cat.nameEn : cat.name) : catId;
    },
    [categories, lang]
  );

  const toggleSelection = (courseId: string) => {
    const newSet = new Set(selectedCourseIds);
    if (newSet.has(courseId)) newSet.delete(courseId);
    else newSet.add(courseId);
    onSelectionChange(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedCourseIds.size === searchResults.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(
        new Set(
          searchResults
            .map((c) => {
              const id = c.id || c.code;
              if (!id) return '';
              return id;
            })
            .filter((id) => id !== '')
        )
      );
    }
  };

  // 검색 중 (결과 없음)
  if (isSearching && searchResults.length === 0) {
    return (
      <div className="py-8 text-center">
        <div className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>{lang === 'en' ? 'Searching...' : '검색 중...'}</span>
        </div>
      </div>
    );
  }

  // 검색어 없음
  if (!hasSearchCriteria) {
    return (
      <p className="py-4 text-center text-sm text-gray-500 dark:text-zinc-400">
        {lang === 'en' ? 'Enter a search term.' : '검색어를 입력하세요.'}
      </p>
    );
  }

  // 결과 없음
  if (!isSearching && searchResults.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-500 dark:text-zinc-400">
        {lang === 'en' ? 'No results found.' : '검색 결과가 없습니다.'}
      </p>
    );
  }

  // 검색 결과 목록
  return (
    <>
      <div className="flex items-center justify-between px-2 mb-2">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          {lang === 'en' ? 'Results' : '검색 결과'}{' '}
          <span className="text-gray-500 dark:text-gray-400 font-normal">{searchResults.length}</span>
          {isSearching && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={toggleSelectAll}
          className="text-xs font-medium text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 transition-colors"
        >
          {selectedCourseIds.size === searchResults.length ? (lang === 'en' ? 'Deselect all' : '전체 해제') : (lang === 'en' ? 'Select all' : '전체 선택')}
        </button>
      </div>

      <div className="flex-1 space-y-2 px-2">
        {searchResults.map((course, index) => {
          const courseId = course.id || course.code || String(course.id || course.code || Math.random());
          const isSelected = selectedCourseIds.has(courseId);
          const isEnrolled = enrolledSet.has(course.id || '') || enrolledSet.has(course.code || '');
          const tagList = (course.tags || []).filter((tag: string) => VALID_TAGS.includes(tag));
          return (
            <div
              key={courseId}
              draggable
              onDragStart={(e) => {
                onDragStart(course);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={() => toggleSelection(courseId)}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer active:scale-[0.96] transition-all animate-slide-up shadow ${
                isSelected
                  ? 'border-violet-500 bg-violet-50 dark:border-violet-400 dark:bg-violet-900/20'
                  : isEnrolled
                    ? 'border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900/50'
                    : 'border-transparent bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-zinc-800'
              }`}
              style={{
                animationDelay: `${index * 0.05}s`,
                opacity: 0,
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelection(courseId)}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSelection(courseId);
                }}
                className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 focus:ring-offset-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <p
                      className={`truncate font-medium text-sm min-w-0 ${
                        isEnrolled ? 'text-gray-500 dark:text-zinc-500' : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {course.title || course.name}
                    </p>
                    {course.code && (
                      <span
                        className={`text-xs font-normal shrink-0 ${
                          isEnrolled ? 'text-gray-400 dark:text-zinc-600' : 'text-gray-500 dark:text-zinc-400'
                        }`}
                      >
                        {course.code}
                      </span>
                    )}
                    {isEnrolled && (
                      <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-zinc-300 shrink-0">
                        {lang === 'en' ? 'Enrolled' : '수강함'}
                      </span>
                    )}
                  </div>
                  {tagList.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap shrink-0">
                      {tagList.map((tag: string) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 text-xs font-medium rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 shrink-0"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <p
                  className={`text-xs mt-0.5 ${
                    isEnrolled ? 'text-gray-400 dark:text-zinc-600' : 'text-gray-500 dark:text-zinc-400'
                  }`}
                >
                  {course.department && getDepartmentName(course.department)}
                  {course.category && ` · ${getCategoryName(course.category)}`}
                  {course.au !== undefined && course.au > 0
                    ? ` · ${course.au}AU`
                    : course.credit
                      ? ` · ${course.credit}${lang === 'en' ? (course.credit === 1 ? ' credit' : ' credits') : '학점'}`
                      : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
