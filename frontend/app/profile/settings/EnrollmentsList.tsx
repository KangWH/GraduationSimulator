'use client';

import { useState, useEffect } from 'react';
import { Select } from '../../components/formFields';
import type { Enrollment, Semester, Grade } from './types';
import { API } from '../../lib/api';

const VALID_GRADES: Grade[] = ['A+', 'A0', 'A-', 'B+', 'B0', 'B-', 'C+', 'C0', 'C-', 'D+', 'D0', 'D-', 'F', 'S', 'U', 'P', 'NR', 'W'];
const SEMESTER_LABELS: Record<Semester, string> = {
  SPRING: '봄',
  SUMMER: '여름',
  FALL: '가을',
  WINTER: '겨울',
};

interface EnrollmentsListProps {
  enrollments: Enrollment[];
  semesterGroups: Map<string, Enrollment[]>;
  sortedSemesterKeys: string[];
  onGradeChange: (enrollment: Enrollment, grade: Grade) => void;
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
  onRemove,
  onDragStart,
  onDrop,
  onDropOutside,
  findNearestPastSemester,
}: EnrollmentsListProps) {
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [collapsedSemesters, setCollapsedSemesters] = useState<Set<string>>(new Set());

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
    <div className="space-y-4">
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
            className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors"
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
            <div className="px-3 py-4">
              <button
                onClick={() => toggleSemester(semesterKey)}
                className="px-1 flex w-full items-center gap-2 text-left hover:opacity-70 hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-96 transition-all rounded"
              >
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <h3 className="font-medium text-base flex-1 text-gray-800 dark:text-gray-200">
                  {sectionTitle}
                </h3>
              </button>
              <div className={`overflow-hidden transition-all duration-200 ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100 mt-3'}`}>
                <div className="space-y-2">
              {[...groupEnrollments]
                .sort((a, b) => (a.course.code || '').localeCompare(b.course.code || ''))
                .map((enrollment, idx) => (
                  <div
                    key={`${enrollment.courseId}-${enrollment.enrolledYear}-${enrollment.enrolledSemester}-${idx}`}
                    draggable
                    onDragStart={(e) => {
                      onDragStart(e, enrollment, semesterKey);
                      e.dataTransfer.effectAllowed = 'move';
                      (e.currentTarget as HTMLElement).style.opacity = '0.5';
                    }}
                    onDragEnd={(e) => {
                      (e.currentTarget as HTMLElement).style.opacity = '1';
                    }}
                    className="flex items-center justify-between gap-4 rounded p-2 bg-gray-50 cursor-move dark:bg-zinc-800"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                          {enrollment.course.title}
                        </p>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono shrink-0">
                          {enrollment.course.code}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {getDepartmentName(enrollment.course.department)}
                        {enrollment.course.category && ` · ${getCategoryName(enrollment.course.category)}`}
                        {enrollment.course.au > 0
                          ? ` · ${enrollment.course.au}AU`
                          : ` · ${enrollment.course.credit}학점`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
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
                      <button
                        type="button"
                        onClick={() => onRemove(enrollment)}
                        className="rounded p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50 transition-colors"
                        title="삭제"
                        aria-label="삭제"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
