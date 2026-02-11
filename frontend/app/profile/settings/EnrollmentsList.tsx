'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Select } from '../../components/formFields';
import type { Enrollment, Semester, Grade } from './types';
import { API } from '../../lib/api';
import Accordion, { ACBody, ACTitle } from '@/app/components/Accordion';

const VALID_GRADES: Grade[] = ['A+', 'A0', 'A-', 'B+', 'B0', 'B-', 'C+', 'C0', 'C-', 'D+', 'D0', 'D-', 'F', 'S', 'U', 'P', 'NR', 'W'];
const SEMESTER_LABELS_KO: Record<Semester, string> = {
  SPRING: '봄',
  SUMMER: '여름',
  FALL: '가을',
  WINTER: '겨울',
};
const SEMESTER_LABELS_EN: Record<Semester, string> = {
  SPRING: 'Spring',
  SUMMER: 'Summer',
  FALL: 'Fall',
  WINTER: 'Winter',
};

const SEMESTER_ORDER: Semester[] = ['SPRING', 'SUMMER', 'FALL', 'WINTER'];
const REGULAR_SEMESTERS: Semester[] = ['SPRING', 'FALL'];
const SEASONAL_SEMESTERS: Semester[] = ['SUMMER', 'WINTER'];

/** 메뉴가 뷰포트 안에 들어오도록 anchor 보정. 위쪽 표시 시 bottom으로 붙여 버튼 바로 위에 고정 */
function clampMenuAnchor(rect: DOMRect): {
  top?: number;
  bottom?: number;
  right: number;
  maxHeight?: number;
} {
  const MENU_EST_WIDTH = 220;
  const MENU_EST_HEIGHT = 360;
  const PAD = 8;

  let top: number | undefined = rect.bottom + 4;
  let bottom: number | undefined;
  let maxHeight: number | undefined;

  if (top + MENU_EST_HEIGHT > window.innerHeight - PAD) {
    top = undefined;
    bottom = window.innerHeight - (rect.top - 4);
    maxHeight = rect.top - 4 - PAD;
  }
  if (top != null && top + MENU_EST_HEIGHT > window.innerHeight - PAD) {
    top = window.innerHeight - MENU_EST_HEIGHT - PAD;
  }
  if (top != null && top < PAD) top = PAD;

  let right = window.innerWidth - rect.right;
  const maxRight = window.innerWidth - MENU_EST_WIDTH - PAD;
  if (right > maxRight) right = maxRight;
  if (right < PAD) right = PAD;

  return { top, bottom, right, maxHeight };
}

function getPrevSemester(year: number, semester: Semester): { year: number; semester: Semester } {
  const i = SEMESTER_ORDER.indexOf(semester);
  if (i <= 0) return { year: year - 1, semester: SEMESTER_ORDER[SEMESTER_ORDER.length - 1] };
  return { year, semester: SEMESTER_ORDER[i - 1] };
}
function getNextSemester(year: number, semester: Semester): { year: number; semester: Semester } {
  const i = SEMESTER_ORDER.indexOf(semester);
  if (i < 0 || i >= SEMESTER_ORDER.length - 1) return { year: year + 1, semester: SEMESTER_ORDER[0] };
  return { year, semester: SEMESTER_ORDER[i + 1] };
}
function getPrevSameTypeSemester(year: number, semester: Semester): { year: number; semester: Semester } {
  if (REGULAR_SEMESTERS.includes(semester)) {
    return semester === 'SPRING' ? { year: year - 1, semester: 'FALL' } : { year, semester: 'SPRING' };
  }
  return semester === 'SUMMER' ? { year: year - 1, semester: 'WINTER' } : { year, semester: 'SUMMER' };
}
function getNextSameTypeSemester(year: number, semester: Semester): { year: number; semester: Semester } {
  if (REGULAR_SEMESTERS.includes(semester)) {
    return semester === 'FALL' ? { year: year + 1, semester: 'SPRING' } : { year, semester: 'FALL' };
  }
  return semester === 'WINTER' ? { year: year + 1, semester: 'SUMMER' } : { year, semester: 'WINTER' };
}

export function enrollmentKey(e: Enrollment): string {
  return `${e.courseId}-${e.enrolledYear}-${e.enrolledSemester}`;
}

interface EnrollmentsListProps {
  lang?: 'ko' | 'en';
  enrollments: Enrollment[];
  semesterGroups: Map<string, Enrollment[]>;
  sortedSemesterKeys: string[];
  selectedEnrollmentKeys: Set<string>;
  onSelectionChange: (keys: Set<string>) => void;
  onGradeChange: (enrollment: Enrollment, grade: Grade) => void;
  onMove: (enrollment: Enrollment, newYear: number, newSemester: Semester) => void;
  onRemove: (enrollment: Enrollment) => void;
  onRemoveSelected: () => void;
  onRemoveAll: () => void;
  onDragStart: (e: React.DragEvent, enrollment: Enrollment, semesterKey: string) => void;
  onDrop: (e: React.DragEvent, semesterKey: string) => void;
  onDropOutside: (e: React.DragEvent) => void;
  findNearestPastSemester: () => { year: number; semester: Semester };
}

export default function EnrollmentsList({
  lang = 'ko',
  enrollments,
  semesterGroups,
  sortedSemesterKeys,
  selectedEnrollmentKeys,
  onSelectionChange,
  onGradeChange,
  onMove,
  onRemove,
  onRemoveSelected,
  onRemoveAll,
  onDragStart,
  onDrop,
  onDropOutside,
  findNearestPastSemester,
}: EnrollmentsListProps) {
  const SEMESTER_LABELS = lang === 'en' ? SEMESTER_LABELS_EN : SEMESTER_LABELS_KO;
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; nameEn?: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [collapsedSemesters, setCollapsedSemesters] = useState<Set<string>>(new Set());
  const [openMenu, setOpenMenu] = useState<{
    enrollment: Enrollment;
    anchor: { top?: number; bottom?: number; right: number; maxHeight?: number };
  } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openMenu === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const handleScrollOrResize = () => setOpenMenu(null);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [openMenu]);

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

  const getDepartmentName = (deptId: string | undefined): string => {
    if (!deptId) return '';
    const dept = departments.find((d) => d.id === deptId);
    return dept ? (lang === 'en' && dept.nameEn ? dept.nameEn : dept.name) : deptId;
  };

  const getCategoryName = (catId: string | undefined): string => {
    if (!catId) return '';
    const cat = categories.find((c) => c.id === catId);
    const c = cat as { id: string; name: string; nameEn?: string } | undefined;
    return c ? (lang === 'en' && c.nameEn ? c.nameEn : c.name) : catId;
  };

  const toggleSemester = (semesterKey: string) => {
    setCollapsedSemesters((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(semesterKey)) {
        newSet.delete(semesterKey);
      } else {
        newSet.add(semesterKey);
      }
      return newSet;
    });
  };

  const toggleSelection = (e: Enrollment) => {
    const key = enrollmentKey(e);
    const next = new Set(selectedEnrollmentKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(next);
  };

  const toggleSelectAll = () => {
    if (selectedEnrollmentKeys.size === enrollments.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(enrollments.map(enrollmentKey)));
    }
  };

  if (enrollments.length === 0) {
    return (
      <div
        className="min-h-[200px] rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors dark:border-gray-600"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const target = e.currentTarget as HTMLElement;
          target.classList.add('border-violet-500', 'bg-violet-50', 'dark:bg-violet-900/20');
        }}
        onDragLeave={(e) => {
          const target = e.currentTarget as HTMLElement;
          target.classList.remove('border-violet-500', 'bg-violet-50', 'dark:bg-violet-900/20');
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const target = e.currentTarget as HTMLElement;
          target.classList.remove('border-violet-500', 'bg-violet-50', 'dark:bg-violet-900/20');
          // 빈 목록에 드롭하면 가장 가까운 과거 학기에 추가
          const nearest = findNearestPastSemester();
          const targetSemesterKey = `${nearest.year}-${nearest.semester}`;
          onDrop(e, targetSemesterKey);
        }}
      >
        <p className="text-gray-500 dark:text-gray-400">{lang === 'en' ? 'No enrolled courses yet.' : '등록된 수강 과목이 없습니다.'}</p>
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">{lang === 'en' ? 'Drag courses here to add.' : '과목을 드래그하여 여기에 추가하세요.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 선택 삭제 / 전체 삭제 툴바 */}
      <div className="flex flex-wrap justify-end items-stretch mb-4 text-xs gap-2">
        <button
          type="button"
          onClick={toggleSelectAll}
          className="px-2 py-1 bg-white dark:bg-black shadow-sm rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all active:scale-90 active:rounded-md"
        >
          {selectedEnrollmentKeys.size === enrollments.length ? (lang === 'en' ? 'Deselect all' : '전체 해제') : (lang === 'en' ? 'Select all' : '전체 선택')}
        </button>
        <div className="bg-white dark:bg-black rounded-md shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={onRemoveSelected}
            disabled={selectedEnrollmentKeys.size === 0}
            className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-zinc-800 text-red-600 dark:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-90 active:rounded-md"
          >
            {lang === 'en' ? 'Delete selected' : '선택 삭제'}{selectedEnrollmentKeys.size > 0 && ` (${selectedEnrollmentKeys.size})`}
          </button>
          <button
            type="button"
            onClick={onRemoveAll}
            className="px-2 py-1 hover:bg-gray-100 dark:hover:bg-zinc-800 text-red-600 dark:text-red-400 transition-all active:scale-90 active:rounded-md"
          >
            {lang === 'en' ? 'Delete all' : '전체 삭제'}
          </button>
        </div>
      </div>

      {sortedSemesterKeys.map((semesterKey) => {
        const [year, semester] = semesterKey.split('-');
        const groupEnrollments = semesterGroups.get(semesterKey) || [];
        const sectionTitle =
          year === '0' && semester === 'SPRING'
            ? (lang === 'en' ? 'Prior credit' : '기이수')
            : lang === 'en'
              ? `${year} ${SEMESTER_LABELS[semester as Semester]}`
              : `${year}년 ${SEMESTER_LABELS[semester as Semester]}`;
        const isCollapsed = collapsedSemesters.has(semesterKey);

        return (
          <div
            key={semesterKey}
            className="rounded-lg bg-white dark:bg-black overflow-hidden transition-colors shadow-lg"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const target = e.currentTarget as HTMLElement;
              target.classList.add('border-violet-500', 'bg-violet-50', 'dark:bg-violet-900/20');
            }}
            onDragLeave={(e) => {
              const target = e.currentTarget as HTMLElement;
              target.classList.remove('border-violet-500', 'bg-violet-50', 'dark:bg-violet-900/20');
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const target = e.currentTarget as HTMLElement;
              target.classList.remove('border-violet-500', 'bg-violet-50', 'dark:bg-violet-900/20');
              onDrop(e, semesterKey);
            }}
          >
            <Accordion isCollapsed={isCollapsed} onTitleClick={() => toggleSemester(semesterKey)}>
              <ACTitle>
                <h3 className="font-medium text-base flex-1 text-gray-800 dark:text-gray-200">
                  {sectionTitle}
                </h3>
              </ACTitle>
              <ACBody>
                <div className="space-y-2">
                  {[...groupEnrollments]
                    .sort((a, b) => (a.course.code || '').localeCompare(b.course.code || ''))
                    .map((enrollment, idx) => {
                      const tags = enrollment.course.tags.filter((tag) => ['사회', '인문', '문학예술', '일반', '핵심', '융합'].includes(tag));
                      const menuKey = `${enrollment.courseId}-${enrollment.enrolledYear}-${enrollment.enrolledSemester}-${idx}`;
                      const isMenuOpen =
                        openMenu !== null &&
                        openMenu.enrollment.courseId === enrollment.courseId &&
                        openMenu.enrollment.enrolledYear === enrollment.enrolledYear &&
                        openMenu.enrollment.enrolledSemester === enrollment.enrolledSemester;
                      const y = enrollment.enrolledYear;
                      const s = enrollment.enrolledSemester;
                      const prevSem = getPrevSemester(y, s);
                      const nextSem = getNextSemester(y, s);
                      const prevSameType = getPrevSameTypeSemester(y, s);
                      const nextSameType = getNextSameTypeSemester(y, s);
                      const prevLabel = REGULAR_SEMESTERS.includes(s)
                        ? (lang === 'en' ? 'Move to previous regular semester' : '이전 정규학기로 이동')
                        : (lang === 'en' ? 'Move to previous seasonal semester' : '이전 계절학기로 이동');
                      const nextLabel = REGULAR_SEMESTERS.includes(s)
                        ? (lang === 'en' ? 'Move to next regular semester' : '다음 정규학기로 이동')
                        : (lang === 'en' ? 'Move to next seasonal semester' : '다음 계절학기로 이동');

                      const key = enrollmentKey(enrollment);
                      const isSelected = selectedEnrollmentKeys.has(key);
                      return <div
                        key={menuKey}
                        draggable
                        onDragStart={(e) => {
                          onDragStart(e, enrollment, semesterKey);
                          e.dataTransfer.effectAllowed = 'move';
                          (e.currentTarget as HTMLElement).style.opacity = '0.5';
                        }}
                        onDragEnd={(e) => {
                          (e.currentTarget as HTMLElement).style.opacity = '1';
                        }}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('select, [role="menu"], button')) return;
                          toggleSelection(enrollment);
                        }}
                        className={`flex items-center justify-between gap-4 rounded-md p-2 cursor-move border ${
                          isSelected ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-500/50' : 'bg-gray-50 dark:bg-zinc-900 border-transparent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(enrollment)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="min-w-0 flex-1 flex items-baseline gap-2">
                              <p className="font-medium text-sm text-gray-900 dark:text-white truncate min-w-0">
                                {enrollment.course.title}
                              </p>
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono shrink-0">
                                {enrollment.course.code}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                            {getDepartmentName(enrollment.course.department)}
                            {enrollment.course.category && ` · ${getCategoryName(enrollment.course.category)}`}
                            {tags.length > 0 && ` (${tags.join('·')})`}
                            {enrollment.course.au > 0
                              ? ` · ${enrollment.course.au}AU`
                              : ` · ${enrollment.course.credit}${lang === 'en' ? (enrollment.course.credit === 1 ? ' credit' : ' credits') : '학점'}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Select
                            value={enrollment.grade}
                            onChange={(v) => onGradeChange(enrollment, v as Grade)}
                            size="small"
                            className="w-24"
                          >
                            {VALID_GRADES.map((grade) => (
                              <option key={grade} value={grade}>
                                {grade}
                              </option>
                            ))}
                          </Select>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                if (isMenuOpen) {
                                  setOpenMenu(null);
                                } else {
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  setOpenMenu({
                                    enrollment,
                                    anchor: clampMenuAnchor(rect),
                                  });
                                }
                              }}
                              className="rounded p-1.5 text-gray-500 hover:bg-gray-200 dark:text-zinc-400 dark:hover:bg-zinc-700 active:scale-85 transition-all"
                              title={lang === 'en' ? 'Menu' : '메뉴'}
                              aria-label={lang === 'en' ? 'Menu' : '메뉴'}
                              aria-expanded={isMenuOpen}
                            >
                              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="5" r="1.5" />
                                <circle cx="12" cy="12" r="1.5" />
                                <circle cx="12" cy="19" r="1.5" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    })}
                </div>
              </ACBody>
            </Accordion>
          </div>
        );
      })}
      {openMenu &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            className={`fixed z-[9999] min-w-[160px] max-h-[calc(100vh-16px)] overflow-y-auto p-1 rounded-xl bg-gray-50/50 dark:bg-zinc-900/50 shadow-xl backdrop-blur-sm border border-black/10 dark:border-white/20 text-sm ${
              openMenu.anchor.top != null 
                ? 'animate-slide-down' 
                : 'animate-slide-up'
            }`}
            role="menu"
            style={{
              ...(openMenu.anchor.top != null && { top: openMenu.anchor.top }),
              ...(openMenu.anchor.bottom != null && { bottom: openMenu.anchor.bottom }),
              right: openMenu.anchor.right,
              left: 'auto',
              width: 'max-content',
              maxWidth: 'min(90vw, 280px)',
              ...(openMenu.anchor.maxHeight != null && { maxHeight: openMenu.anchor.maxHeight }),
            }}
          >
            {(() => {
              const e = openMenu.enrollment;
              const y = e.enrolledYear;
              const s = e.enrolledSemester;
              const isPreEnrollment = y === 0 && s === 'SPRING';
              const prevSem = getPrevSemester(y, s);
              const nextSem = getNextSemester(y, s);
              const prevSameType = getPrevSameTypeSemester(y, s);
              const nextSameType = getNextSameTypeSemester(y, s);
              const prevLabel = REGULAR_SEMESTERS.includes(s)
                ? (lang === 'en' ? 'Move to previous regular semester' : '이전 정규학기로 이동')
                : (lang === 'en' ? 'Move to previous seasonal semester' : '이전 계절학기로 이동');
              const nextLabel = REGULAR_SEMESTERS.includes(s)
                ? (lang === 'en' ? 'Move to next regular semester' : '다음 정규학기로 이동')
                : (lang === 'en' ? 'Move to next seasonal semester' : '다음 계절학기로 이동');
              const close = () => setOpenMenu(null);
              
              // 기이수인 경우 삭제만 표시
              if (isPreEnrollment) {
                return (
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-2 py-1 text-gray-700 dark:text-zinc-200 hover:bg-violet-600 hover:text-white transition-all active:scale-90 rounded-lg flex items-center gap-1"
                    onClick={() => {
                      onRemove(e);
                      close();
                    }}
                  >
                    <span className="w-4 flex-shrink-0 flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </span>
                    <span className="flex-1">{lang === 'en' ? 'Delete' : '삭제'}</span>
                  </button>
                );
              }
              
              return (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-2 py-1 text-gray-700 dark:text-zinc-200 hover:bg-violet-600 hover:text-white transition-all active:scale-90 rounded-lg flex items-center gap-1"
                    onClick={() => {
                      onMove(e, y - 1, s);
                      close();
                    }}
                  >
                    <span className="w-4 flex-shrink-0 flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </span>
                    <span className="flex-1">{lang === 'en' ? 'Move to previous year' : '이전 연도로 이동'}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-2 py-1 text-gray-700 dark:text-zinc-200 hover:bg-violet-600 hover:text-white transition-all active:scale-90 rounded-lg flex items-center gap-1"
                    onClick={() => {
                      onMove(e, prevSameType.year, prevSameType.semester);
                      close();
                    }}
                  >
                    <span className="w-4 flex-shrink-0"></span>
                    <span className="flex-1">{prevLabel}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-2 py-1 text-gray-700 dark:text-zinc-200 hover:bg-violet-600 hover:text-white transition-all active:scale-90 rounded-lg flex items-center gap-1"
                    onClick={() => {
                      onMove(e, prevSem.year, prevSem.semester);
                      close();
                    }}
                  >
                    <span className="w-4 flex-shrink-0"></span>
                    <span className="flex-1">{lang === 'en' ? 'Move to previous semester' : '이전 학기로 이동'}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-2 py-1 text-gray-700 dark:text-zinc-200 hover:bg-violet-600 hover:text-white transition-all active:scale-90 rounded-lg flex items-center gap-1"
                    onClick={() => {
                      onMove(e, nextSem.year, nextSem.semester);
                      close();
                    }}
                  >
                    <span className="w-4 flex-shrink-0 flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                    <span className="flex-1">{lang === 'en' ? 'Move to next semester' : '다음 학기로 이동'}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-2 py-1 text-gray-700 dark:text-zinc-200 hover:bg-violet-600 hover:text-white transition-all active:scale-90 rounded-lg flex items-center gap-1"
                    onClick={() => {
                      onMove(e, nextSameType.year, nextSameType.semester);
                      close();
                    }}
                  >
                    <span className="w-4 flex-shrink-0"></span>
                    <span className="flex-1">{nextLabel}</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-2 py-1 text-gray-700 dark:text-zinc-200 hover:bg-violet-600 hover:text-white transition-all active:scale-90 rounded-lg flex items-center gap-1"
                    onClick={() => {
                      onMove(e, y + 1, s);
                      close();
                    }}
                  >
                    <span className="w-4 flex-shrink-0"></span>
                    <span className="flex-1">{lang === 'en' ? 'Move to next year' : '다음 연도로 이동'}</span>
                  </button>
                  <div className="m-1 border-t border-gray-300 dark:border-zinc-600" role="separator" />
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-2 py-1 text-gray-700 dark:text-zinc-200 hover:bg-violet-600 hover:text-white transition-all active:scale-90 rounded-lg flex items-center gap-1"
                    onClick={() => {
                      onRemove(e);
                      close();
                    }}
                  >
                    <span className="w-4 flex-shrink-0 flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </span>
                    <span className="flex-1">{lang === 'en' ? 'Delete' : '삭제'}</span>
                  </button>
                </>
              );
            })()}
          </div>,
          document.body
        )}
    </div>
  );
}
