'use client';

import { ReactNode, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface MobileTopBarProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  /** 상단바 아래 추가 영역 (예: 요약) */
  below?: ReactNode;
  className?: string;
}

const barContent = (
  left: ReactNode,
  center: ReactNode,
  right: ReactNode,
  className: string
) => (
  <div className={`fixed top-0 left-0 right-0 z-40 flex md:hidden shrink-0 select-none items-center justify-between min-h-[3.5rem] ${className}`}>
    {/* 1. 그라데이션 레이어 (가장 뒤): 위쪽 배경색 → 아래쪽 투명 */}
    <div
      className="absolute inset-0 pointer-events-none bg-gradient-to-b from-gray-50 to-transparent dark:from-zinc-900 dark:to-transparent"
      aria-hidden
    />
    {/* 2. 블러 레이어 (그라데이션 위) */}
    <div
      className="absolute inset-0 pointer-events-none backdrop-blur-md"
      aria-hidden
    />
    {/* 3. 콘텐츠 (가장 앞) */}
    <div className="relative z-10 p-2 flex flex-row justify-between items-center w-full">
      <div className="flex items-center shrink-0">{left}</div>
      <div className="flex items-center justify-center flex-1 min-w-0">{center}</div>
      <div className="flex items-center shrink-0">{right}</div>
    </div>
  </div>
);

export default function MobileTopBar({ left, center, right, below, className = '' }: MobileTopBarProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const bar = barContent(left, center, right, className);

  return (
    <>
      {mounted && typeof document !== 'undefined' && createPortal(bar, document.body)}
      {below ? (
        <div className="flex flex-col pt-14">
          {below}
        </div>
      ) : (
        /* below 없을 때는 DesktopTopBar 등 다른 상단바가 pt-14 제공 */
        <div className="pt-14 md:hidden" aria-hidden />
      )}
    </>
  );
}
