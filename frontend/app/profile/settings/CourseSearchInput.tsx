'use client';

import { Input } from '../../components/formFields';

interface CourseSearchInputProps {
  value: string;
  onChange: (v: string) => void;
  onExpand: () => void;
  isExpanded: boolean;
}

export default function CourseSearchInput({
  value,
  onChange,
  onExpand,
  isExpanded,
}: CourseSearchInputProps) {
  return (
    <div className="relative">
      <Input
        type="text"
        value={value}
        onChange={onChange}
        placeholder="과목명, 과목코드, 개설학과로 검색..."
        size="medium"
        className="pr-10"
      />
      <button
        type="button"
        onClick={onExpand}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        title={isExpanded ? '폼 접기' : '폼 펼치기'}
      >
        <svg
          className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}
