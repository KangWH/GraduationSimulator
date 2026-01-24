'use client';

import { Enrollment } from "./types";

interface EnrollmentsListProps {
  enrollments: Enrollment[];
  onRemove: (id: number) => void;
  ulClassName?: string;
}

export default function EnrollmentsList({
  enrollments,
  onRemove,
  ulClassName = 'space-y-2',
}: EnrollmentsListProps) {
  if (enrollments.length === 0) {
    return (
      <p className="rounded-lg bg-gray-50 py-8 text-center text-gray-500 dark:bg-zinc-800 dark:text-gray-400">
        등록된 수강 과목이 없습니다.
      </p>
    );
  }
  return (
    <ul className={ulClassName}>
      {enrollments.map((e, i) => (
        <li
          key={i}
          className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700"
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">
              {e.course.title} ({e.course.code})
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {e.course.credit}학점
              {e.course?.year != null && e.course?.semester != null && ` · ${e.course.year}년 ${e.course.semester}`}
              {e.grade != null && ` · ${e.grade}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="ml-3 whitespace-nowrap rounded-md border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
          >
            삭제
          </button>
        </li>
      ))}
    </ul>
  );
}
