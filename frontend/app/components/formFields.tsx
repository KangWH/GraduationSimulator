import { ReactNode } from "react";

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

export type FieldSize = 'small' | 'medium' | 'large';
const fieldSizeClassNames: Record<FieldSize, string> = {
  'small': 'text-sm px-2 py-1',
  'medium': 'text-md px-3 py-2',
  'large': 'text-lg px-4 py-3'
};

interface InputProps {
  id?: string;
  name?: string;
  value: any;
  onChange: (newValue: any) => void;
  type?: 'text' | 'email' | 'url' | 'password';
  inputMode?: "text" | "email" | "url" | "search" | "tel" | "none" | "numeric" | "decimal" | undefined;
  required?: boolean;
  placeholder?: string;
  size?: FieldSize;
  className?: string;
}

export function Input({ id, name, value, onChange, type = 'text', inputMode = 'text', required = false, placeholder, size = 'medium', className }: InputProps) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      value={value}
      inputMode={inputMode}
      onChange={(e) => {onChange(e.target.value)}}
      required={required}
      placeholder={placeholder}
      className={
        "w-full bg-white dark:bg-black shadow-sm dark:border-zinc-700 focus:border-violet-500 rounded-md outline-none appearance-none min-h-[44px] sm:min-h-0 "
        + fieldSizeClassNames[size] + (className ? " " + className : "")
      }
    />
  )
}

interface NumberInputProps {
  id?: string;
  name?: string;
  min?: string;
  max?: string;
  step?: string;
  value: any;
  onChange: (newValue: any) => void;
  type?: 'number';
  inputMode?: "text" | "email" | "url" | "search" | "tel" | "none" | "numeric" | "decimal" | undefined;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  size?: FieldSize;
  className?: string;
}

export function NumberInput({ id, name, min = '0', max = '100', step = '1', value, onChange, type = 'number', inputMode = 'numeric', disabled = false, required = false, placeholder, size = 'medium', className }: NumberInputProps) {
  return (
    <div
      className={
        "flex flex-row w-full shadow-sm focus-within:border-violet-500 rounded-md overflow-hidden min-h-[44px] sm:min-h-0 " + (disabled ? 'bg-gray-100 text-gray-500 disabled:bg-zinc-900 ' : 'bg-white dark:bg-black ') + (className ? className : "")
      }
    >
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {onChange(e.target.value)}}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        className={"grow outline-none appearance-none " + fieldSizeClassNames[size] /* + " pr-0" */}
        style={{ WebkitAppearance: 'none' }}
      />
      {/* <div className="ml-1 w-4 flex flex-col items-stretch">
        <button className="grow bg-green-300"></button>
        <button className="grow bg-red-300"></button>
      </div> */}
    </div>
  )
}


interface SelectProps {
  id?: string;
  name?: string;
  value: any;
  onChange: (newValue: any) => void;
  disabled?: boolean;
  required?: boolean;
  size?: FieldSize;
  className?: string;
  children?: ReactNode;
}

export function Select({ id, name, value, onChange, disabled = false, required = false, size = 'medium', className, children }: SelectProps) {
  return (
    <div className="relative flex w-full items-center">
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        className={
          "w-full bg-white dark:bg-black shadow-sm focus:border-violet-500 rounded-md outline-none appearance-none pr-8 disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-zinc-900 min-h-[44px] sm:min-h-0 "
          + fieldSizeClassNames[size]
          + (className ? " " + className : "")
        }
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-2 w-4 h-4 text-gray-500 dark:text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </div>
  )
}

export interface Option {
  value: string;
  label: string;
}

interface MultipleSelectProps {
  id?: string;
  name?: string;
  value: string[];
  onChange: (newValue: string[]) => void;
  options: Option[];
  placeholder?: string;
  size?: FieldSize;
  allowNone?: boolean;
  className: string;
}

export function MultipleSelect({
  id,
  name,
  value,
  onChange,
  options,
  placeholder = '없음',
  size = 'medium',
  allowNone = false,
  className
}: MultipleSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileSheet, setIsMobileSheet] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const closeWithAnimation = () => {
    if (isMobileSheet) {
      setSheetVisible(false);
      window.setTimeout(() => {
        setIsOpen(false);
      }, 200);
      return;
    }
    setIsOpen(false);
  };

  // 팝오버 위치 계산 (트리거 기준) - 모바일 최적화 및 화면 밖 방지
  const updatePopoverPosition = () => {
    if (!triggerRef.current || typeof document === 'undefined') return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const isMobile = viewportWidth < 640; // sm 브레이크포인트
    setIsMobileSheet(isMobile);
    
    const padding = 8; // 화면 가장자리 여유 공간
    const gap = 4; // 트리거와 팝오버 사이 간격
    
    // 모바일: 화면 전체 너비 사용, 데스크톱: 트리거 너비
    const popoverWidth = isMobile 
      ? Math.min(viewportWidth - padding * 2, 400) 
      : Math.min(rect.width, viewportWidth - padding * 2);
    
    let popoverLeft: number;
    let popoverTop: number;
    let maxHeight: number;
    const minHeight = isMobile ? 300 : 200;
    
    if (isMobile) {
      // 모바일: 하단 시트로 표시 (위치는 렌더링에서 bottom 고정)
      popoverLeft = 0;
      popoverTop = padding;
      const maxPopoverHeight = Math.min(viewportHeight - padding * 2, 500);
      maxHeight = maxPopoverHeight;
    } else {
      // 데스크톱: 트리거 기준 배치
      popoverLeft = rect.left;
      
      // 오른쪽으로 나가는 경우 조정
      if (popoverLeft + popoverWidth > viewportWidth - padding) {
        popoverLeft = Math.max(padding, viewportWidth - popoverWidth - padding);
      }
      
      // 왼쪽으로 나가는 경우 조정
      if (popoverLeft < padding) {
        popoverLeft = padding;
      }
      
      // 사용 가능한 공간 계산
      const spaceBelow = viewportHeight - rect.bottom - gap - padding;
      const spaceAbove = rect.top - gap - padding;
      
      // 아래쪽에 배치할 수 있는지 확인
      const canFitBelow = spaceBelow >= minHeight;
      const canFitAbove = spaceAbove >= minHeight;
      
      if (canFitBelow) {
        // 아래쪽에 배치
        popoverTop = rect.bottom + gap;
        maxHeight = Math.min(spaceBelow, viewportHeight - popoverTop - padding);
      } else if (canFitAbove && spaceAbove > spaceBelow) {
        // 위쪽에 배치 (아래 공간이 부족하고 위쪽이 더 넓을 때)
        maxHeight = Math.min(spaceAbove, viewportHeight - padding * 2);
        popoverTop = Math.max(padding, rect.top - maxHeight - gap);
      } else {
        // 공간이 부족한 경우: 가능한 공간에 맞춤
        if (spaceBelow >= spaceAbove) {
          // 아래쪽에 배치하되 화면 안에 맞춤
          popoverTop = rect.bottom + gap;
          maxHeight = Math.min(spaceBelow, viewportHeight - popoverTop - padding);
        } else {
          // 위쪽에 배치하되 화면 안에 맞춤
          maxHeight = Math.min(spaceAbove, viewportHeight - padding * 2);
          popoverTop = Math.max(padding, rect.top - maxHeight - gap);
        }
      }
      
      // 최종 검증: 화면 밖으로 나가지 않도록 보장
      popoverTop = Math.max(padding, Math.min(popoverTop, viewportHeight - maxHeight - padding));
      maxHeight = Math.min(maxHeight, viewportHeight - popoverTop - padding);
    }
    
    setPopoverStyle({
      top: popoverTop,
      left: popoverLeft,
      width: isMobile ? viewportWidth : popoverWidth,
      maxHeight: Math.max(maxHeight, minHeight), // 최소 높이 보장
    });
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updatePopoverPosition();
      const handleResizeScroll = () => updatePopoverPosition();
      window.addEventListener('resize', handleResizeScroll);
      window.addEventListener('scroll', handleResizeScroll, true);
      return () => {
        window.removeEventListener('resize', handleResizeScroll);
        window.removeEventListener('scroll', handleResizeScroll, true);
      };
    } else {
      setPopoverStyle(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && isMobileSheet) {
      // mount 이후 한 프레임 뒤에 올라오는 애니메이션 시작
      setSheetVisible(false);
      const t = window.setTimeout(() => setSheetVisible(true), 10);
      return () => window.clearTimeout(t);
    }
    setSheetVisible(false);
  }, [isOpen, isMobileSheet]);

  // 바깥 클릭 감지 (트리거 + 팝오버 둘 다 제외)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const inTrigger = triggerRef.current?.contains(target);
      const inPopover = popoverRef.current?.contains(target);
      if (!inTrigger && !inPopover) {
        closeWithAnimation();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const handleSelectAll = () => {
    const allValues = options.map((opt) => opt.value);
    onChange(allValues);
  };

  const handleDeselectAll = () => {
    onChange([]);
  };

  const allSelected = value.length === options.length && options.length > 0;
  const someSelected = value.length > 0 && value.length < options.length;

  const handleRemoveTag = (e: React.MouseEvent, optionValue: string) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== optionValue));
  };

  const selectedOptions = value
    .map((val) => options.find((opt) => opt.value === val))
    .filter((opt): opt is Option => opt !== undefined);

  return (
    <div className="relative w-full min-w-20">
      <button
        ref={triggerRef}
        type="button"
        id={id}
        name={name}
        onClick={() => {
          if (isOpen) {
            closeWithAnimation();
          } else {
            setIsOpen(true);
          }
        }}
        className={
          'w-full bg-white dark:bg-black shadow-sm focus:border-violet-500 rounded-md outline-none appearance-none text-left flex items-center gap-2 min-h-[44px] sm:min-h-0 ' +
          fieldSizeClassNames[size]
          + " " + className
          + (isOpen ? ' border-violet-500' : '')
        }
      >
        <div className="flex-1 flex flex-wrap items-center min-w-8 gap-1 sm:gap-2">
          {selectedOptions.length === 0 ? (
            <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
          ) : selectedOptions.length === 1 ? (
            <span>{selectedOptions[0]?.label || value[0] || placeholder}</span>
          ) : (
            <span>
              <span className="hidden sm:inline">{selectedOptions[0]?.label || value[0] || ''} 외 </span>
              <span className="sm:hidden">{selectedOptions.length}개 선택됨</span>
              <span className="hidden sm:inline">{selectedOptions.length}개</span>
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen &&
        popoverStyle &&
        typeof document !== 'undefined' &&
        createPortal(
          isMobileSheet ? (
            <div
              className={`fixed inset-0 z-[9998] bg-black/50 transition-opacity duration-200 ${sheetVisible ? 'opacity-100' : 'opacity-0'}`}
              onClick={closeWithAnimation}
            >
              <div
                ref={popoverRef}
                className={`fixed left-0 right-0 bottom-0 z-[9999] bg-white dark:bg-zinc-900 rounded-md shadow-lg overflow-y-auto overscroll-contain transition-transform duration-200 ${sheetVisible ? 'translate-y-0' : 'translate-y-full'}`}
                style={{
                  maxHeight: `${popoverStyle.maxHeight}px`,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* 전체 선택/전체 취소 버튼 */}
                <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700 px-3 py-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={allSelected ? handleDeselectAll : handleSelectAll}
                    className="text-sm text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium select-none min-h-[44px] sm:min-h-0 px-2 -mx-2 rounded active:bg-violet-50 active:scale-90 dark:active:bg-violet-900/20 transition-all"
                  >
                    {allSelected ? '전체 취소' : '전체 선택'}
                  </button>
                  <div className="flex items-center gap-2">
                    {someSelected && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {value.length} / {options.length}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={closeWithAnimation}
                      className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-90 transition-all"
                      aria-label="닫기"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* 옵션 목록 */}
                <div className="py-1">
                  {allowNone && (
                    <label className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800 active:bg-gray-100 dark:active:bg-zinc-700 select-none min-h-[44px] active:scale-90 active:rounded-md transition-all">
                      <input
                        type="checkbox"
                        checked={value.length === 0}
                        onChange={() => onChange([])}
                        className="h-5 w-5 sm:h-4 sm:w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 focus:ring-2 mr-3"
                      />
                      <span className="text-sm flex-1">{placeholder}</span>
                    </label>
                  )}
                  {options.map((option) => {
                    const isChecked = value.includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800 active:bg-gray-100 dark:active:bg-zinc-700 select-none min-h-[44px] active:scale-90 active:rounded-md transition-all"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggle(option.value)}
                          className="h-5 w-5 sm:h-4 sm:w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 focus:ring-2 mr-3 flex-shrink-0"
                        />
                        <span className="text-sm flex-1 break-words">{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div
              ref={popoverRef}
              className="fixed z-[9999] bg-white dark:bg-zinc-900 rounded-md shadow-lg overflow-y-auto overscroll-contain"
              style={{
                top: popoverStyle.top,
                left: popoverStyle.left,
                width: popoverStyle.width,
                maxHeight: `${popoverStyle.maxHeight}px`,
              }}
            >
            {/* 전체 선택/전체 취소 버튼 */}
            <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700 px-3 py-2 flex items-center justify-between">
              <button
                type="button"
                onClick={allSelected ? handleDeselectAll : handleSelectAll}
                className="text-sm text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium select-none min-h-[44px] sm:min-h-0 px-2 -mx-2 rounded active:bg-violet-50 active:scale-90 dark:active:bg-violet-900/20 transition-all"
              >
                {allSelected ? '전체 취소' : '전체 선택'}
              </button>
              {someSelected && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {value.length} / {options.length}
                </span>
              )}
            </div>

            {/* 옵션 목록 */}
            <div className="py-1">
              {allowNone && (
                <label className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800 active:bg-gray-100 dark:active:bg-zinc-700 select-none min-h-[44px] active:scale-90 active:rounded-md transition-all">
                  <input
                    type="checkbox"
                    checked={value.length === 0}
                    onChange={() => onChange([])}
                    className="h-5 w-5 sm:h-4 sm:w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 focus:ring-2 mr-3"
                  />
                  <span className="text-sm flex-1">{placeholder}</span>
                </label>
              )}
              {options.map((option) => {
                const isChecked = value.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800 active:bg-gray-100 dark:active:bg-zinc-700 select-none min-h-[44px] active:scale-90 active:rounded-md transition-all"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggle(option.value)}
                      className="h-5 w-5 sm:h-4 sm:w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 focus:ring-2 mr-3 flex-shrink-0"
                    />
                    <span className="text-sm flex-1 break-words">{option.label}</span>
                  </label>
                );
              })}
            </div>
            </div>
          ),
          document.body
        )}
    </div>
  );
}
