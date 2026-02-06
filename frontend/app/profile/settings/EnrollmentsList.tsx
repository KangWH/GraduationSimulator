'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Select } from '../../components/formFields';
import type { Enrollment, Semester, Grade } from './types';
import { API } from '../../lib/api';
import Accordion, { ACBody, ACTitle } from '@/app/components/Accordion';

const VALID_GRADES: Grade[] = ['A+', 'A0', 'A-', 'B+', 'B0', 'B-', 'C+', 'C0', 'C-', 'D+', 'D0', 'D-', 'F', 'S', 'U', 'P', 'NR', 'W'];
const SEMESTER_LABELS: Record<Semester, string> = {
  SPRING: '봄',
  SUMMER: '여름',
  FALL: '가을',
  WINTER: '겨울',
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

interface EnrollmentsListProps {
  enrollments: Enrollment[];
  semesterGroups: Map<string, Enrollment[]>;
  sortedSemesterKeys: string[];
  onGradeChange: (enrollment: Enrollment, grade: Grade) => void;
  onMove: (enrollment: Enrollment, newYear: number, newSemester: Semester) => void;
  onRemove: (enrollment: Enrollment) => void;
  onDragStart: (e: React.DragEvent, enrollment: Enrollment, semesterKey: string) => void;
  onDrop: (e: React.DragEvent, semesterKey: string) => void;
  onDropOutside: (e: React.DragEvent) => void;
  findNearestPastSemester: () => { year: number; semester: Semester };
}

export default function EnrollmentsList({
  enrollments,
  semesterGroups,
  sortedSemesterKeys,
  onGradeChange,
  onMove,
  onRemove,
  onDragStart,
  onDrop,
  onDropOutside,
  findNearestPastSemester,
}: EnrollmentsListProps) {
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
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
    return dept ? dept.name : deptId;
  };

  const getCategoryName = (catId: string | undefined): string => {
    if (!catId) return '';
    const cat = categories.find((c) => c.id === catId);
    return cat ? cat.name : catId;
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
        <p className="text-gray-500 dark:text-gray-400">등록된 수강 과목이 없습니다.</p>
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">과목을 드래그하여 여기에 추가하세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedSemesterKeys.map((semesterKey) => {
        const [year, semester] = semesterKey.split('-');
        const groupEnrollments = semesterGroups.get(semesterKey) || [];
        const sectionTitle =
          year === '0' && semester === 'SPRING'
            ? '기이수'
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
                      const prevLabel = REGULAR_SEMESTERS.includes(s) ? '이전 정규학기로 이동' : '이전 계절학기로 이동';
                      const nextLabel = REGULAR_SEMESTERS.includes(s) ? '다음 정규학기로 이동' : '다음 계절학기로 이동';

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
                        className="flex items-center justify-between gap-4 rounded p-2 bg-gray-50 cursor-move dark:bg-zinc-900"
                      >
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
                              : ` · ${enrollment.course.credit}학점`}
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
                              title="메뉴"
                              aria-label="메뉴"
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
            className="fixed z-[9999] min-w-[200px] max-h-[calc(100vh-16px)] overflow-y-auto py-1 rounded-lg bg-white dark:bg-zinc-800 shadow-lg border border-gray-200 dark:border-zinc-700"
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
              const prevSem = getPrevSemester(y, s);
              const nextSem = getNextSemester(y, s);
              const prevSameType = getPrevSameTypeSemester(y, s);
              const nextSameType = getNextSameTypeSemester(y, s);
              const prevLabel = REGULAR_SEMESTERS.includes(s) ? '이전 정규학기로 이동' : '이전 계절학기로 이동';
              const nextLabel = REGULAR_SEMESTERS.includes(s) ? '다음 정규학기로 이동' : '다음 계절학기로 이동';
              const close = () => setOpenMenu(null);
              return (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-all active:scale-90 active:rounded-md"
                    onClick={() => {
                      onMove(e, prevSem.year, prevSem.semester);
                      close();
                    }}
                  >
                    이전 학기로 이동
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-all active:scale-90 active:rounded-md"
                    onClick={() => {
                      onMove(e, prevSameType.year, prevSameType.semester);
                      close();
                    }}
                  >
                    {prevLabel}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-all active:scale-90 active:rounded-md"
                    onClick={() => {
                      onMove(e, y - 1, s);
                      close();
                    }}
                  >
                    이전 연도로 이동
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-all active:scale-90 active:rounded-md"
                    onClick={() => {
                      onMove(e, nextSem.year, nextSem.semester);
                      close();
                    }}
                  >
                    다음 학기로 이동
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-all active:scale-90 active:rounded-md"
                    onClick={() => {
                      onMove(e, nextSameType.year, nextSameType.semester);
                      close();
                    }}
                  >
                    {nextLabel}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-all active:scale-90 active:rounded-md"
                    onClick={() => {
                      onMove(e, y + 1, s);
                      close();
                    }}
                  >
                    다음 연도로 이동
                  </button>
                  <div className="my-1 border-t border-gray-200 dark:border-zinc-600" role="separator" />
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-all active:scale-90 active:rounded-md"
                    onClick={() => {
                      onRemove(e);
                      close();
                    }}
                  >
                    삭제
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
