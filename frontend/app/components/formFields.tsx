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
  type: 'text' | 'email' | 'url' | 'password';
  required?: boolean;
  placeholder?: string;
  size?: FieldSize;
  className?: string;
}

export function Input({ id, name, value, onChange, type = 'text', required = false, placeholder, size = 'medium', className }: InputProps) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      value={value}
      onChange={(e) => {onChange(e.target.value)}}
      required={required}
      placeholder={placeholder}
      className={
        "w-full bg-white dark:bg-black shadow-sm border border-gray-300 dark:border-zinc-700 focus:border-violet-500 rounded-md outline-none appearance-none "
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
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  size?: FieldSize;
  className?: string;
}

export function NumberInput({ id, name, min = '0', max = '100', step = '1', value, onChange, type = 'number', disabled = false, required = false, placeholder, size = 'medium', className }: NumberInputProps) {
  return (
    <div
      className={
        "flex flex-row w-full shadow-sm border border-gray-300 dark:border-zinc-700 focus-within:border-violet-500 rounded-md overflow-hidden " + (disabled ? 'bg-gray-100 text-gray-500 disabled:bg-zinc-900 ' : 'bg-white dark:bg-black ') + (className ? className : "")
      }
    >
      <input
        id={id}
        name={name}
        type={type}
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
          "w-full bg-white dark:bg-black shadow-sm border border-gray-300 dark:border-zinc-700 focus:border-violet-500 rounded-md outline-none appearance-none pr-8 disabled:bg-gray-100 disabled:text-gray-500 dark:disabled:bg-zinc-900 "
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
  const [popoverStyle, setPopoverStyle] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 팝오버 위치 계산 (트리거 기준)
  const updatePopoverPosition = () => {
    if (!triggerRef.current || typeof document === 'undefined') return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom - 4;
    const spaceAbove = rect.top - 4;
    const maxHeight = Math.max(spaceBelow, spaceAbove, 200); // 최소 200px
    
    setPopoverStyle({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.min(maxHeight, viewportHeight - 16), // 여유 공간 16px
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

  // 바깥 클릭 감지 (트리거 + 팝오버 둘 다 제외)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const inTrigger = triggerRef.current?.contains(target);
      const inPopover = popoverRef.current?.contains(target);
      if (!inTrigger && !inPopover) {
        setIsOpen(false);
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
        onClick={() => setIsOpen(!isOpen)}
        className={
          'w-full bg-white dark:bg-black shadow-sm border border-gray-300 dark:border-zinc-700 focus:border-violet-500 rounded-md outline-none appearance-none text-left flex items-center gap-2 ' +
          fieldSizeClassNames[size]
          + " " + className
          + (isOpen ? ' border-violet-500' : '')
        }
      >
        <div className="flex-1 flex flex-wrap items-center min-w-8">
          {selectedOptions.length === 0 ? (
            <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
          ) : selectedOptions.length === 1 ? (
            <span>{selectedOptions[0]?.label || value[0] || placeholder}</span>
          ) : (
            <span>{selectedOptions[0]?.label || value[0] || ''} 외 {selectedOptions.length}개</span>
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
          <div
            ref={popoverRef}
            className="fixed z-[9999] bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-md shadow-lg overflow-y-auto"
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
                className="text-sm text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 font-medium"
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
                <label className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={value.length === 0}
                    onChange={() => onChange([])}
                    className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 mr-3"
                  />
                  <span className="text-sm">없음</span>
                </label>
              )}
              {options.map((option) => {
                const isChecked = value.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggle(option.value)}
                      className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 mr-3"
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
