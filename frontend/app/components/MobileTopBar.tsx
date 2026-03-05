'use client';

import { ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface MobileTopBarProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  /** 상단바 아래 추가 영역 (예: 요약) - 화면 상단에 고정됨 */
  below?: ReactNode;
  className?: string;
}

const SCROLL_THRESHOLD = 10;
const SCROLL_DELTA_THRESHOLD = 5;
const TITLE_BAR_HEIGHT = 64; // 4rem - SegmentedControl 그림자 여유 포함

export default function MobileTopBar({ left, center, right, below, className = '' }: MobileTopBarProps) {
  const [mounted, setMounted] = useState(false);
  const [titleVisible, setTitleVisible] = useState(true);
  const [belowHeight, setBelowHeight] = useState(0);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const belowRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (typeof window === 'undefined') return;
    const scrollY = window.scrollY ?? document.documentElement.scrollTop;

    if (!ticking.current) {
      window.requestAnimationFrame(() => {
        const delta = scrollY - lastScrollY.current;

        if (scrollY < SCROLL_THRESHOLD) {
          setTitleVisible(true);
        } else if (delta > SCROLL_DELTA_THRESHOLD) {
          setTitleVisible(false);
        } else if (delta < -SCROLL_DELTA_THRESHOLD) {
          setTitleVisible(true);
        }

        lastScrollY.current = scrollY;
        ticking.current = false;
      });
      ticking.current = true;
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [mounted, handleScroll]);

  useEffect(() => {
    if (!below || !belowRef.current) {
      setBelowHeight(0);
      return;
    }
    const el = belowRef.current;
    const ro = new ResizeObserver(() => {
      setBelowHeight(el.offsetHeight);
    });
    ro.observe(el);
    setBelowHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, [below]);

  const fixedContent = (
    <div className={`fixed top-0 left-0 right-0 z-40 flex flex-col md:hidden select-none backdrop-blur-md bg-gradient-to-b from-gray-50 to-transparent dark:from-zinc-900 dark:to-transparent ${className}`}>
      {/* 타이틀 바 (left, center, right) - 스크롤 시 숨김 */}
      <div
        className={`shrink-0 transition-all duration-300 ease-out ${
          titleVisible ? 'max-h-[4rem] opacity-100 overflow-visible' : 'max-h-0 opacity-0 pointer-events-none overflow-hidden'
        }`}
      >
        <div className="relative min-h-[4rem] flex items-center py-3">
          {/* 콘텐츠 - py-3로 그림자 여유 확보 */}
          <div className="relative z-10 px-2 flex flex-row justify-between items-center w-full">
            <div className="flex items-center shrink-0">{left}</div>
            <div className="flex items-center justify-center flex-1 min-w-0">{center}</div>
            <div className="flex items-center shrink-0">{right}</div>
          </div>
        </div>
      </div>

      {/* below 영역 - 상단에 고정 */}
      {below && (
        <div
          ref={belowRef}
          className="shrink-0"
        >
          {below}
        </div>
      )}
    </div>
  );

  const spacerTop = TITLE_BAR_HEIGHT + belowHeight;

  return (
    <>
      {mounted && typeof document !== 'undefined' && createPortal(fixedContent, document.body)}
      <div
        className="md:hidden"
        aria-hidden
        style={{ paddingTop: `${spacerTop}px` }}
      />
    </>
  );
}
