'use client';

import { ReactNode, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface DesktopTopBarProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  className?: string;
}

const barContent = (
  left: ReactNode,
  center: ReactNode,
  right: ReactNode,
  className: string
) => (
  <header className={`fixed top-0 left-0 right-0 z-40 hidden md:flex h-12 shrink-0 select-none items-center justify-between min-h-[3rem] backdrop-blur-md bg-gradient-to-b from-gray-50 to-transparent dark:from-zinc-900 dark:to-transparent ${className}`}>
    {/* 콘텐츠 */}
    <div className="relative z-10 flex items-center justify-between w-full p-3 text-gray-700 dark:text-gray-300">
      <div className="flex items-center gap-4 flex-1 min-w-0 justify-start">{left}</div>
      <div className="flex items-center justify-center flex-1 min-w-0">{center}</div>
      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">{right}</div>
    </div>
  </header>
);

export default function DesktopTopBar({ left, center, right, className = '' }: DesktopTopBarProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const bar = barContent(left, center, right, className);

  return (
    <>
      {mounted && typeof document !== 'undefined' && createPortal(bar, document.body)}
      <div className="pt-12 hidden md:block" aria-hidden />
    </>
  );
}
