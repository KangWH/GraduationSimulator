'use client';

import { useState, useEffect, useRef } from 'react';

interface AnimatedNumberProps {
  value: number | string;
  decimals?: number;
  duration?: number;
  /** 'up' = 새 숫자가 아래에서 위로, 'down' = 위에서 아래로 */
  direction?: 'up' | 'down';
  className?: string;
}

function formatValue(val: number, decimals: number): string {
  return decimals > 0 ? val.toFixed(decimals) : Math.round(val).toString();
}

/** 한 글자(자리) 단위 슬라이드 컬럼 - 절대 위치 + overflow:hidden으로 확실히 클리핑 */
function DigitColumn({
  fromChar,
  toChar,
  duration,
  direction,
  valueIncreased,
  className,
}: {
  fromChar: string;
  toChar: string;
  duration: number;
  direction: 'up' | 'down';
  /** 값이 커졌으면 true, 작아졌으면 false → 방향 반전에 사용 */
  valueIncreased: boolean;
  className?: string;
}) {
  const [phase, setPhase] = useState<'start' | 'end'>('start');
  const isDigit = (c: string) => /^[0-9]$/.test(c);
  const isAnimateable = (c: string) => isDigit(c) || c === ' ';
  const shouldAnimate = fromChar !== toChar && isAnimateable(fromChar) && isAnimateable(toChar);

  useEffect(() => {
    if (!shouldAnimate) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase('end'));
    });
    return () => cancelAnimationFrame(id);
  }, [shouldAnimate]);

  if (!shouldAnimate) {
    return <span className={className}>{toChar}</span>;
  }

  // 값이 커질 때는 direction 그대로, 작아질 때는 반대
  const effectiveDirection = valueIncreased ? direction : direction === 'up' ? 'down' : 'up';
  const isUp = effectiveDirection === 'up';
  const ease = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
  const rowHeight = '1.15em';

  // 이전 숫자: start일 때 0, end일 때 위(-100%) 또는 아래(100%)로 나감
  const fromTop = phase === 'end' ? (isUp ? '-100%' : '100%') : '0';
  // 새 숫자: start일 때 아래(100%) 또는 위(-100%)에 대기, end일 때 0
  const toTop = phase === 'end' ? '0' : (isUp ? '100%' : '-100%');

  return (
    <span
      className={`inline-block align-baseline ${className}`}
      style={{
        position: 'relative',
        width: '1ch',
        height: rowHeight,
        overflow: 'hidden',
        verticalAlign: 'bottom',
      }}
    >
      {/* 이전 숫자 - 컨테이너 밖으로 나가면 overflow로 잘림 */}
      <span
        className="absolute left-0 flex items-center justify-center tabular-nums"
        style={{
          top: fromTop,
          width: '100%',
          height: rowHeight,
          minHeight: rowHeight,
          lineHeight: rowHeight,
          fontVariantNumeric: 'tabular-nums',
          transition: `top ${duration}ms ${ease}`,
        }}
      >
        {fromChar}
      </span>
      {/* 새 숫자 - 아래/위에서 제자리로 슬라이드 */}
      <span
        className="absolute left-0 flex items-center justify-center tabular-nums"
        style={{
          top: toTop,
          width: '100%',
          height: rowHeight,
          minHeight: rowHeight,
          lineHeight: rowHeight,
          fontVariantNumeric: 'tabular-nums',
          transition: `top ${duration}ms ${ease}`,
        }}
      >
        {toChar}
      </span>
    </span>
  );
}

export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 280,
  direction = 'up',
  className = '',
}: AnimatedNumberProps) {
  const num = typeof value === 'string' ? parseFloat(value) || 0 : value;
  const format = (v: number) => formatValue(v, decimals);
  const prevStrRef = useRef(format(num));
  const prevNumRef = useRef(num);
  const [chars, setChars] = useState<{ from: string[]; to: string[]; valueIncreased: boolean } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const newStr = format(num);
    const oldStr = prevStrRef.current;
    if (oldStr === newStr) return;

    const valueIncreased = num > prevNumRef.current;
    prevNumRef.current = num;
    prevStrRef.current = newStr;
    const maxLen = Math.max(oldStr.length, newStr.length);
    const from = oldStr.padStart(maxLen, ' ').split('');
    const to = newStr.padStart(maxLen, ' ').split('');

    setChars({ from, to, valueIncreased });

    const t = setTimeout(() => {
      setChars(null);
    }, duration);

    timeoutRef.current = t;
    return () => clearTimeout(t);
  }, [num, duration, decimals]);

  const displayStr = format(num);

  if (chars) {
    return (
      <span className={`inline-flex align-baseline tabular-nums ${className}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {chars.from.map((fromChar, i) => (
          <DigitColumn
            key={i}
            fromChar={fromChar}
            toChar={chars!.to[i]}
            duration={duration}
            direction={direction}
            valueIncreased={chars.valueIncreased}
          />
        ))}
      </span>
    );
  }

  return (
    <span className={`tabular-nums ${className}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {displayStr}
    </span>
  );
}
