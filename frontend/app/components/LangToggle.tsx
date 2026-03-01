'use client';

import Button from './Button';

export interface LangToggleProps {
  lang: 'ko' | 'en';
  onToggle: () => void;
  className?: string;
}

const LangIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
  </svg>
);

export default function LangToggle({ lang, onToggle, className = '' }: LangToggleProps) {
  return (
    <Button
      type="button"
      style="simple"
      size="small"
      activeScale={85}
      onClick={onToggle}
      className={`w-10 h-10 md:w-auto md:h-auto gap-1.5 md:hover:bg-gray-100 md:dark:hover:bg-zinc-700 ${className}`}
      aria-label={lang === 'ko' ? '한국어' : 'English'}
    >
      <LangIcon />
      <span className="hidden md:inline">{lang === 'ko' ? '한국어' : 'English'}</span>
    </Button>
  );
}
