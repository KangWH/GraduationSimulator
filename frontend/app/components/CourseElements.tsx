import { MouseEventHandler, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CourseSimulation, CreditType } from "../simulation/types";
import { SubstitutionMap } from "../simulation/conditionTester";

function getCreditTypeLabel(creditType: CreditType, getDeptName?: (id: string) => string): string {
  if (!creditType) return '미분류';
  switch (creditType.type) {
    case 'BASIC_REQUIRED': return '기초필수';
    case 'BASIC_ELECTIVE': return '기초선택';
    case 'MANDATORY_GENERAL_COURSES': return '교양필수';
    case 'HUMANITIES_SOCIETY_ELECTIVE': return '인문사회선택';
    case 'MAJOR': return '주전공';
    case 'DOUBLE_MAJOR': return `복수전공${creditType.department && getDeptName ? `: ${getDeptName(creditType.department)}` : ''}`;
    case 'MAJOR_AND_DOUBLE_MAJOR': return `주전공·복수전공${creditType.department && getDeptName ? `: ${getDeptName(creditType.department)}` : ''}`;
    case 'MINOR': return `부전공${creditType.department && getDeptName ? `: ${getDeptName(creditType.department)}` : ''}`;
    case 'ADVANCED_MAJOR': return '심화전공';
    case 'INDIVIDUALLY_DESIGNED_MAJOR': return '자유융합전공';
    case 'RESEARCH': return '연구';
    case 'OTHER_ELECTIVE': return '자유선택';
    case 'UNRECOGNIZED': return '미인정';
    default: return '미분류';
  }
}

function clampMenuAnchor(rect: DOMRect): {
  top?: number;
  bottom?: number;
  right: number;
  maxHeight?: number;
} {
  const MENU_EST_WIDTH = 220;
  const MENU_EST_HEIGHT = 360;
  const PAD = 8;

  let top: number | undefined = rect.bottom + 4;
  let bottom: number | undefined;
  let maxHeight: number | undefined;

  if (top + MENU_EST_HEIGHT > window.innerHeight - PAD) {
    top = undefined;
    bottom = window.innerHeight - (rect.top - 4);
    maxHeight = rect.top - 4 - PAD;
  }
  if (top != null && top + MENU_EST_HEIGHT > window.innerHeight - PAD) {
    top = window.innerHeight - MENU_EST_HEIGHT - PAD;
  }
  if (top != null && top < PAD) top = PAD;

  let right = window.innerWidth - rect.right;
  const maxRight = window.innerWidth - MENU_EST_WIDTH - PAD;
  if (right > maxRight) right = maxRight;
  if (right < PAD) right = PAD;

  return { top, bottom, right, maxHeight };
}

export function CourseBar({ 
  course, 
  gradeBlindMode,
  onClassificationChange,
  getDeptName,
  substitutionMap,
  majorDepartment,
}: { 
  course: CourseSimulation;
  gradeBlindMode: boolean;
  onClassificationChange?: (course: CourseSimulation, classification: CreditType) => void;
  getDeptName?: (id: string) => string;
  substitutionMap?: SubstitutionMap;
  majorDepartment?: string;
}) {
  const creditString = course.course.au > 0 ? `${course.course.au}AU` : `${course.course.credit}학점`;
  const targetTags = course.course.tags
    .filter((tag: string) => ['사회', '인문', '문학예술', '일반', '핵심', '융합'].includes(tag));
  const [openMenu, setOpenMenu] = useState<{
    course: CourseSimulation;
    anchor: { top?: number; bottom?: number; right: number; maxHeight?: number };
  } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openMenu === null) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    const handleScrollOrResize = () => setOpenMenu(null);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [openMenu]);

  const isMenuOpen = openMenu?.course.courseId === course.courseId;

  // 대체인정 확인 (대체과목인지 확인: reverse 맵에 현재 과목 코드가 있으면 대체과목)
  // 대체인정 태그는 대체과목이 원본 과목의 학과 전공학점으로 인정될 때만 표시
  const originalCodes = substitutionMap?.reverse?.[course.course.code] || [];
  const isSubstitute = originalCodes.length > 0;
  
  // 현재 인정된 학점의 학과 확인
  const currentClassification = course.specifiedClassification || course.classification;
  let currentDepartment: string | undefined;
  if (currentClassification) {
    const classificationType = currentClassification.type;
    if (classificationType === 'MAJOR' || classificationType === 'ADVANCED_MAJOR' || classificationType === 'RESEARCH') {
      currentDepartment = majorDepartment;
    } else if ((classificationType === 'DOUBLE_MAJOR' || classificationType === 'MINOR') && 'department' in currentClassification && currentClassification.department) {
      currentDepartment = currentClassification.department;
    } else if (classificationType === 'MAJOR_AND_DOUBLE_MAJOR' && 'department' in currentClassification && currentClassification.department) {
      currentDepartment = currentClassification.department;
    }
  }
  
  // 원본 과목의 학과 확인 (원본 과목 코드에서 학과 코드 추출)
  let shouldShowSubstituteTag = false;
  if (isSubstitute && currentDepartment) {
    // 원본 과목 코드들에서 학과 코드 추출 (예: "MAS.20041" -> "MAS")
    const originalDepartments = originalCodes.map(code => code.split('.')[0]);
    // 현재 인정된 학과가 원본 과목의 학과 중 하나와 일치하면 대체인정 태그 표시
    shouldShowSubstituteTag = originalDepartments.includes(currentDepartment);
  }
  
  // 대학원 상호인정 확인 (대학원 과목이고 crossRecognition이 true인 경우)
  const isCrossRecognition = course.course.level === 'GR' && course.course.crossRecognition;
  
  // 타학과 개설과목 확인 (전공/연구과목에만 표시, 전공학과 기준으로 판단)
  let isOtherDepartment = false;
  if (currentClassification) {
    const classificationType = currentClassification.type;
    // 전공/연구과목인 경우에만 타학과 태그 표시
    if (classificationType === 'MAJOR' || classificationType === 'ADVANCED_MAJOR' || classificationType === 'RESEARCH' || 
      classificationType === 'DOUBLE_MAJOR' || classificationType === 'MAJOR_AND_DOUBLE_MAJOR' || classificationType === 'MINOR') {
      let targetDepartment: string | undefined;
      if (classificationType === 'MAJOR' || classificationType === 'ADVANCED_MAJOR' || classificationType === 'RESEARCH') {
        // 주전공·심화전공·연구는 주전공 학과 기준
        targetDepartment = majorDepartment;
      } else if ((classificationType === 'DOUBLE_MAJOR' || classificationType === 'MINOR') && 'department' in currentClassification && currentClassification.department) {
        // 복수전공·부전공은 해당 학과 기준
        targetDepartment = currentClassification.department;
      } else if (classificationType === 'MAJOR_AND_DOUBLE_MAJOR' && 'department' in currentClassification && currentClassification.department) {
        // 중복인정은 복수전공 학과 기준
        targetDepartment = currentClassification.department;
      }
      // 타학과인지 확인
      if (targetDepartment && course.course.department !== targetDepartment) {
        isOtherDepartment = true;
      }
    }
  }

  return (
    <>
      <div className="flex items-baseline justify-between p-2 rounded bg-gray-50 dark:bg-zinc-900 leading-tight">
        {/* 좌측: 과목명 */}
        <div className="flex items-baseline gap-1.5 flex-1 min-w-0">
          <p className="font-medium text-sm leading-tight truncate">{course.course.title}</p>
          <p className="text-xs text-gray-500 dark:text-zinc-400 leading-tight truncate">{course.course.code}</p>
          {targetTags.length > 0 && (
            <p className="text-xs text-gray-500 dark:text-zinc-400 leading-tight truncate">{targetTags.join('·')}</p>
          )}
        </div>

        {/* 우측: 학점 및 메뉴 */}
        <div className="flex items-center gap-1.5 shrink-0">
          {!gradeBlindMode && (
            <span className="text-xs font-medium text-gray-500 dark:text-zinc-400">
              {course.grade}
            </span>
          )}
          {(course.specifiedClassification?.type === 'MAJOR_AND_DOUBLE_MAJOR' || course.classification?.type === 'MAJOR_AND_DOUBLE_MAJOR') && (
            <span className="text-xs text-gray-500 dark:text-zinc-400 leading-tight whitespace-nowrap">중복인정</span>
          )}
          {shouldShowSubstituteTag && (
            <span className="text-xs text-gray-500 dark:text-zinc-400 leading-tight whitespace-nowrap">대체인정</span>
          )}
          {isCrossRecognition && (
            <span className="text-xs text-gray-500 dark:text-zinc-400 leading-tight whitespace-nowrap">상호인정</span>
          )}
          {isOtherDepartment && (
            <span className="text-xs text-gray-500 dark:text-zinc-400 leading-tight whitespace-nowrap">타학과</span>
          )}
          <p className="text-xs text-gray-700 dark:text-zinc-300 leading-tight whitespace-nowrap">
            {creditString}
          </p>
          {course.possibleClassifications && course.possibleClassifications.length > 1 && (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (isMenuOpen) {
                    setOpenMenu(null);
                  } else {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setOpenMenu({
                      course,
                      anchor: clampMenuAnchor(rect),
                    });
                  }
                }}
                className="rounded p-1 text-gray-500 hover:bg-gray-200 dark:text-zinc-400 dark:hover:bg-zinc-700 active:scale-85 transition-all"
                title="분류 변경"
                aria-label="분류 변경"
                aria-expanded={isMenuOpen}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="5" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="19" r="1.5" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
      {isMenuOpen &&
        typeof document !== 'undefined' && 
        createPortal(
          <div
            ref={dropdownRef}
            className={`fixed z-[9999] min-w-[160px] max-h-[calc(100vh-16px)] p-1 overflow-y-auto rounded-xl bg-gray-50/50 dark:bg-zinc-900/50 backdrop-blur-sm shadow-xl dark:shadow-white/10 border border-black/10 dark:border-white/20 text-sm ${
              openMenu!.anchor.top != null 
                ? 'animate-slide-down' 
                : 'animate-slide-up'
            }`}
            role="menu"
            style={{
              ...(openMenu!.anchor.top != null && { top: openMenu!.anchor.top }),
              ...(openMenu!.anchor.bottom != null && { bottom: openMenu!.anchor.bottom }),
              right: openMenu!.anchor.right,
              left: 'auto',
              width: 'max-content',
              maxWidth: 'min(90vw, 280px)',
              ...(openMenu!.anchor.maxHeight != null && { maxHeight: openMenu!.anchor.maxHeight }),
            }}
          >
            {/* 자동 옵션 */}
            <button
              type="button"
              role="menuitem"
              className="w-full text-left px-2 py-1 md:min-h-0 min-h-10 transition-all active:scale-90 rounded-lg flex items-center gap-1 text-gray-700 dark:text-zinc-200 hover:bg-violet-600 hover:text-white"
              onClick={() => {
                if (onClassificationChange) {
                  onClassificationChange(course, null);
                }
                setOpenMenu(null);
              }}
            >
              <span className="w-4 flex-shrink-0 flex items-center justify-center">
                {(course.specifiedClassification === null || course.specifiedClassification === undefined) && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className="flex-1">
                자동{(course.specifiedClassification === null || course.specifiedClassification === undefined) && course.classification ? ` (${getCreditTypeLabel(course.classification, getDeptName)})` : ''}
              </span>
            </button>
            <div className="m-1 border-t border-gray-300 dark:border-zinc-600" role="separator" />
            {course.possibleClassifications && course.possibleClassifications.map((classification) => {
              const label = getCreditTypeLabel(classification, getDeptName);
              // const isCurrent = JSON.stringify(course.specifiedClassification || course.classification) === JSON.stringify(classification);
              const isCurrent = JSON.stringify(course.specifiedClassification) === JSON.stringify(classification);
              const classificationKey = JSON.stringify(classification);
              return (
                <button
                  key={classificationKey}
                  type="button"
                  role="menuitem"
                  className="w-full text-left px-2 py-1 md:min-h-0 min-h-10 transition-all active:scale-90 rounded-lg flex items-center gap-1 text-gray-700 dark:text-zinc-200 hover:bg-violet-600 hover:text-white"
                  onClick={() => {
                    if (onClassificationChange) {
                      onClassificationChange(course, classification);
                    }
                    setOpenMenu(null);
                  }}
                >
                  <span className="w-4 flex-shrink-0 flex items-center justify-center">
                    {isCurrent && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1">{label}</span>
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}

interface PseudoRequirement {
  title: string;
  description: string;
  value?: number;
  currentValue?: number;
}

export function RequirementBar({ requirement, onMouseEnter, onMouseLeave }: { requirement: PseudoRequirement,  onMouseEnter: MouseEventHandler<HTMLParagraphElement>, onMouseLeave: () => void }) {
  const currentValue = requirement.currentValue || 0;
  const targetValue = requirement.value || 0;
  const percentage = targetValue > 0 ? Math.min(100, (currentValue / targetValue) * 100) : 0;
  return (
    <div
      className="relative p-2 rounded bg-gray-50 dark:bg-zinc-900 overflow-hidden"
    >
      <div
        className="absolute inset-0 bg-violet-100 dark:bg-violet-900/50 transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
      <div className="relative flex items-center justify-between">
        <p 
          className="flex-1 font-medium text-sm truncate cursor-help leading-tight"
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
        >
          {requirement.title || requirement.description || ''}
        </p>
        {requirement.value != null && (
          <p className="text-xs leading-tight text-gray-500 dark:text-zinc-400 whitespace-nowrap ml-2">
            {currentValue} / {targetValue}
          </p>
        )}
      </div>
    </div>
  );
}
