import { MouseEventHandler } from "react";
import { CourseSimulation } from "../simulation/types";

export function CourseBar({ course, gradeBlindMode }: { course: CourseSimulation, gradeBlindMode: boolean }) {
  const creditString = course.course.au > 0 ? `${course.course.au}AU` : `${course.course.credit}학점`;
  const targetTags = course.course.tags
    .filter((tag: string) => ['사회', '인문', '문학예술', '일반', '핵심', '융합'].includes(tag));

  return (
    <div className="flex items-baseline justify-between p-2 rounded bg-gray-50 dark:bg-zinc-900 leading-tight">
      {/* 좌측: 과목명 */}
      <div className="flex items-baseline gap-1.5">
        <p className="font-medium text-sm leading-tight truncate">{course.course.title}</p>
        <p className="text-xs text-gray-500 dark:text-zinc-400 leading-tight truncate">{course.course.code}</p>
        {targetTags.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-zinc-400 leading-tight truncate">{targetTags.join('·')}</p>
        )}
      </div>

      {/* 우측: 학점 */}
      <div className="flex items-center gap-1.5">
        {!gradeBlindMode && (
          <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">
            {course.grade}
          </span>
        )}
        {course.classification?.type === 'MAJOR_AND_DOUBLE_MAJOR' && (
          <span className="text-xs text-gray-500 dark:text-zinc-400 leading-tight whitespace-nowrap">중복인정</span>
        )}
        <p className="text-xs text-gray-700 dark:text-zinc-300 leading-tight whitespace-nowrap">
          {creditString}
        </p>
      </div>
    </div>
  );
}

interface PseudoRequirement {
  title: string;
  description: string;
  value?: number;
  currentValue?: number;
}

export function RequirementBar({ requirement, onMouseEnter, onMouseLeave }: { requirement: PseudoRequirement,  onMouseEnter: MouseEventHandler<HTMLParagraphElement>, onMouseLeave: () => void }) {
  const currentValue = requirement.currentValue || 0;
  const targetValue = requirement.value || 0;
  const percentage = targetValue > 0 ? Math.min(100, (currentValue / targetValue) * 100) : 0;
  return (
    <div
      className="relative p-2 rounded bg-gray-50 dark:bg-zinc-900 overflow-hidden"
    >
      <div
        className="absolute inset-0 bg-violet-100 dark:bg-violet-900/50 transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
      <div className="relative flex items-center justify-between">
        <p 
          className="flex-1 font-medium text-sm truncate cursor-help leading-tight"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {requirement.title || requirement.description || ''}
        </p>
        {requirement.value != null && (
          <p className="text-xs leading-tight text-gray-500 dark:text-zinc-400 whitespace-nowrap ml-2">
            {currentValue} / {targetValue}
          </p>
        )}
      </div>
    </div>
  );
}
