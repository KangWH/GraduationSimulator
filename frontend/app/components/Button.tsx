'use client';

import { ReactNode, ButtonHTMLAttributes } from 'react';

export type ButtonSize = 'exsmall' | 'small' | 'medium' | 'large' | 'exlarge';
export type ButtonStyle = 'simple' | 'standard' | 'prominent' | 'destructive';

const sizeClassNames: Record<ButtonSize, string> = {
  exsmall: 'text-xs px-2 py-1 rounded',
  small: 'text-sm px-2 py-1 rounded-md',
  medium: 'text-base px-3 py-2 rounded-lg',
  large: 'text-lg px-4 py-3 rounded-xl',
  exlarge: 'text-xl px-5 py-3.5 rounded-2xl',
};

const roundedClassNames: Record<ButtonSize, string> = {
  exsmall: 'rounded',
  small: 'rounded-md',
  medium: 'rounded-lg',
  large: 'rounded-xl',
  exlarge: 'rounded-2xl',
};

const minHeightClass: Record<ButtonSize, string> = {
  exsmall: 'min-h-0',
  small: 'min-h-0',
  medium: 'min-h-0',
  large: 'min-h-0',
  exlarge: 'min-h-0',
};

const activeScaleClass = {
  85: 'group-active/btn:scale-[0.85]',
  90: 'group-active/btn:scale-90',
  95: 'group-active/btn:scale-[0.95]',
  96: 'group-active/btn:scale-[0.96]',
} as const;

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled' | 'style'> {
  children: ReactNode;
  size?: ButtonSize;
  /** 시각 스타일: simple, standard, prominent, destructive */
  style?: ButtonStyle;
  isActive?: boolean;
  disabled?: boolean;
  /** active(누르는 중) 시 scale. 기본 90. disabled 시 적용 안 됨. */
  activeScale?: 85 | 90 | 95 | 96;
  className?: string;
  innerClassName?: string;
}

function buttonStyleClasses(
  style: ButtonStyle,
  isActive: boolean,
  disabled: boolean
): string {
  const disabledSuffix = disabled ? ' opacity-50 cursor-not-allowed' : '';
  if (disabled) {
    const base: Record<ButtonStyle, string> = {
      simple: 'bg-transparent text-inherit',
      standard: 'bg-white dark:bg-black shadow-sm text-gray-800 dark:text-gray-200',
      prominent: 'bg-violet-500 text-white shadow-md',
      destructive: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 shadow-sm',
    };
    return base[style] + disabledSuffix;
  }
  switch (style) {
    case 'simple':
      return [
        'bg-transparent text-inherit',
        isActive
          ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400'
          : 'group-hover/btn:bg-gray-100 dark:group-hover/btn:bg-zinc-800',
      ].join(' ') + disabledSuffix;
    case 'standard':
      return [
        'dark:bg-black shadow-sm',
        isActive
          ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 shadow-md'
          : 'bg-white text-gray-800 dark:text-gray-200 group-hover/btn:bg-gray-50 dark:group-hover/btn:bg-zinc-800 group-active/btn:bg-gray-100 dark:group-active/btn:bg-zinc-700',
      ].join(' ') + disabledSuffix;
    case 'prominent':
      return 'bg-violet-500 text-white shadow-md group-hover/btn:bg-violet-600 group-active/btn:bg-violet-700' + disabledSuffix;
    case 'destructive':
      return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 shadow-sm group-hover/btn:bg-red-200 dark:group-hover/btn:bg-red-900/50 group-active/btn:bg-red-300 dark:group-active/btn:bg-red-900/60' + disabledSuffix;
    default:
      return '' + disabledSuffix;
  }
}

export default function Button({
  children,
  size = 'medium',
  style = 'standard',
  isActive = false,
  disabled = false,
  activeScale = 90,
  className = '',
  innerClassName = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  const sizeClass = sizeClassNames[size];
  const roundedClass = roundedClassNames[size];
  const styleClass = buttonStyleClasses(style, isActive, disabled);
  const scaleClass = disabled ? '' : `transition-all duration-150 origin-center ${activeScaleClass[activeScale]}`;

  return (
    <button
      type={type}
      disabled={disabled}
      className={`group/btn m-0 p-0 inline-flex min-w-0 items-stretch justify-center font-medium select-none outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-violet-500/50 dark:focus-visible:ring-offset-zinc-900 leading-tight ${roundedClass} ${className}`}
      {...rest}
    >
      <span
        className={`flex-1 inline-flex min-w-0 items-center whitespace-nowrap justify-center gap-1.5 ${sizeClass} ${roundedClass} ${styleClass} ${scaleClass} ${innerClassName}`}
      >
        {children}
      </span>
    </button>
  );
}
