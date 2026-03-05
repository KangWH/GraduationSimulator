'use client';

import { ReactNode, useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

const DRAG_CLOSE_THRESHOLD = 80;
const ANIMATION_DURATION = 200;

let scrollLockCount = 0;

function applyScrollLock() {
  scrollLockCount++;
  if (scrollLockCount === 1) {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
  }
}

function releaseScrollLock() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
  }
}

export interface BottomSheetProps {
  /** 시트 열림 상태 */
  open: boolean;
  /** 열림 상태 변경 콜백 */
  onOpenChange: (open: boolean) => void;
  /** 시트 본문 콘텐츠 */
  children: ReactNode;
  /** 하단 고정 영역 (예: 저장 폼) */
  footer?: ReactNode;
  /** 제목 (header 미제공 시 기본 헤더에 표시) */
  title?: string;
  /** 커스텀 헤더 (제목/닫기 버튼 대체). 드래그 핸들 포함 가능 */
  header?: ReactNode;
  /** 데스크톱(>=640px)에서 중앙 모달로 표시. false면 항상 하단 시트 */
  desktopCenter?: boolean;
  /** 오버레이 z-index */
  zIndex?: number;
  /** 시트 최대 높이 */
  maxHeight?: string;
  /** 시트 패널 추가 className */
  contentClassName?: string;
  /** 오버레이 추가 className */
  backdropClassName?: string;
  /** 반투명 배경 표시 (false면 클릭 영역만, AddCoursePanel 스타일) */
  dimmed?: boolean;
  /** 닫기 버튼 표시 여부 (title 사용 시 기본 true) */
  showCloseButton?: boolean;
  /** 시트 본문에 padding 적용 (기본 true, header가 전체 영역을 차지할 때 false) */
  padded?: boolean;
}

export default function BottomSheet({
  open,
  onOpenChange,
  children,
  footer,
  title,
  header,
  desktopCenter = false,
  zIndex = 50,
  maxHeight = '80vh',
  contentClassName = '',
  backdropClassName = '',
  dimmed = true,
  showCloseButton = true,
  padded = true,
}: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetDragY, setSheetDragY] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const sheetDragYRef = useRef(0);
  sheetDragYRef.current = sheetDragY;

  useEffect(() => {
    setMounted(true);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetVisible(false);
    setIsClosing(true);
    window.setTimeout(() => {
      onOpenChange(false);
      setIsClosing(false);
    }, ANIMATION_DURATION);
  }, [onOpenChange]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (typeof window !== 'undefined' && window.innerWidth >= 640 && desktopCenter) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) setSheetDragY(dy);
  }, [desktopCenter]);

  const handleTouchEnd = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 640 && desktopCenter) {
      setSheetDragY(0);
      return;
    }
    const currentDrag = sheetDragYRef.current;
    const elapsed = Date.now() - touchStartTime.current;
    const velocity = elapsed > 0 ? currentDrag / elapsed : 0;
    if (currentDrag > DRAG_CLOSE_THRESHOLD || velocity > 0.4) {
      closeSheet();
    }
    setSheetDragY(0);
  }, [closeSheet, desktopCenter]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    touchStartY.current = e.clientY;
    touchStartTime.current = Date.now();
    const onMove = (ev: MouseEvent) => {
      const dy = ev.clientY - touchStartY.current;
      if (dy > 0) setSheetDragY(dy);
    };
    const onUp = () => {
      const currentDrag = sheetDragYRef.current;
      const elapsed = Date.now() - touchStartTime.current;
      const velocity = elapsed > 0 ? currentDrag / elapsed : 0;
      if (currentDrag > DRAG_CLOSE_THRESHOLD || velocity > 0.4) {
        closeSheet();
      }
      setSheetDragY(0);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [closeSheet]);

  useEffect(() => {
    if (open) {
      setIsClosing(false);
      setSheetVisible(false);
      const t = window.setTimeout(() => setSheetVisible(true), 10);
      return () => window.clearTimeout(t);
    } else {
      setSheetVisible(false);
      setIsClosing(true);
      const t = window.setTimeout(() => setIsClosing(false), ANIMATION_DURATION);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  // 바텀시트 열림 시 스크롤 잠금
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const isActive = open || isClosing;
    if (isActive) {
      applyScrollLock();
      return () => releaseScrollLock();
    }
  }, [open, isClosing]);

  if (!mounted || (!open && !isClosing) || typeof document === 'undefined') return null;

  const overlayZ = zIndex;
  const sheetZ = zIndex + 1;

  // 데스크톱 desktopCenter: 닫을 때 translate 대신 opacity 페이드아웃 (sm:translate-y-0가 translate-y-full을 덮어써서 슬라이드가 안 됨)
  const isDesktopClose = desktopCenter && isClosing;
  const sheetPanelClasses = [
    'bg-gray-50 dark:bg-zinc-900 shadow-xl w-full sm:max-w-md sm:mx-4 mx-0 flex flex-col rounded-t-2xl sm:rounded-xl overflow-hidden',
    sheetDragY > 0 ? 'transition-none' : 'transition-all duration-200',
    isDesktopClose ? 'sm:opacity-0' : '', // 데스크톱에서만 페이드, 모바일은 슬라이드 유지
    sheetVisible && sheetDragY === 0 ? 'translate-y-0' : sheetVisible ? '' : 'translate-y-full' + (desktopCenter ? ' sm:translate-y-0' : ''),
    contentClassName,
  ].filter(Boolean).join(' ');

  const sheetContent = (
    <div
      className={sheetPanelClasses}
      style={{
        maxHeight,
        ...(sheetVisible && sheetDragY > 0 && { transform: `translateY(${sheetDragY}px)` }),
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 드래그 핸들 + 헤더 영역 (모바일에서 터치로 드래그) */}
      <div
        className="touch-none cursor-grab active:cursor-grabbing border-b border-gray-200 dark:border-zinc-700 sm:cursor-default sm:touch-auto flex-shrink-0"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        {header !== undefined ? (
          header
        ) : (
          <>
            <div className="flex justify-center pt-2 pb-1 sm:hidden" aria-hidden>
              <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-zinc-600" />
            </div>
            <div className="p-4 flex items-center justify-between">
              {title && (
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {title}
                </h2>
              )}
              {showCloseButton && (
                <button
                  type="button"
                  onClick={closeSheet}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-zinc-800 transition-colors"
                  aria-label="닫기"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${padded ? 'p-4' : ''}`}>
        <div className="flex-1 overflow-y-auto overscroll-contain min-h-0">
          {children}
        </div>
        {footer && (
          <div className="flex-shrink-0 border-t border-gray-200 dark:border-zinc-700">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  const overlay = (
    <div
      className={`fixed inset-0 flex items-end sm:items-center justify-center transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100'} ${dimmed ? 'bg-black/50 dark:bg-black/70' : ''} ${backdropClassName}`}
      style={{ zIndex: overlayZ }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSheet();
      }}
    >
      {sheetContent}
    </div>
  );

  return createPortal(overlay, document.body);
}
