'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { API } from '../../lib/api';
import type { Profile, Enrollment, RawEnrollment, Semester, Grade } from './types';
import AddCoursePanel from './AddCoursePanel';
import EnrollmentsList, { enrollmentKey } from './EnrollmentsList';

const VALID_GRADES: Grade[] = ['A+', 'A0', 'A-', 'B+', 'B0', 'B-', 'C+', 'C0', 'C-', 'D+', 'D0', 'D-', 'F', 'S', 'U', 'P', 'NR', 'W'];
const SEMESTER_OPTIONS: { value: Semester; label: string }[] = [
  { value: 'SPRING', label: '봄' },
  { value: 'SUMMER', label: '여름' },
  { value: 'FALL', label: '가을' },
  { value: 'WINTER', label: '겨울' },
];

interface CoursesTabProps {
  lang?: 'ko' | 'en';
  profile: Profile | null;
  userId: string | null;
  onProfileUpdate: (p: Profile) => void;
  onRegisterXlsxHeader?: (action: { open: () => void; isApplying: boolean }) => void;
}

// RawEnrollment[]를 Enrollment[]로 변환
async function convertToEnrollments(rawEnrollments: RawEnrollment[]): Promise<Enrollment[]> {
  const enrollments: Enrollment[] = [];
  for (const raw of rawEnrollments) {
    try {
      // courseId는 이제 UUID (고유 ID)
      const courseRes = await fetch(`${API}/courses?id=${encodeURIComponent(raw.courseId)}`);
      const courses = await courseRes.json();
      const course = Array.isArray(courses) && courses.length > 0 ? courses[0] : null;
      if (course) {
        enrollments.push({
          courseId: raw.courseId, // UUID 저장
          course: {
            id: course.id || raw.courseId,
            code: course.code || '',
            title: course.title || '',
            department: course.department || '',
            category: course.category || '',
            credit: course.credit || 0,
            au: course.au || 0,
            tags: course.tags || [],
            level: course.level || 'UG',
            crossRecognition: course.crossRecognition || false
          },
          enrolledYear: raw.enrolledYear,
          enrolledSemester: raw.enrolledSemester,
          grade: raw.grade,
        });
      }
    } catch (error) {
      console.error(`Failed to fetch course ${raw.courseId}:`, error);
    }
  }
  return enrollments;
}

// Enrollment[]를 RawEnrollment[]로 변환
function convertToRawEnrollments(enrollments: Enrollment[]): RawEnrollment[] {
  return enrollments.map((e) => ({
    courseId: e.courseId,
    enrolledYear: e.enrolledYear,
    enrolledSemester: e.enrolledSemester,
    grade: e.grade,
  }));
}

// 학기별로 그룹화
function groupBySemester(enrollments: Enrollment[]): Map<string, Enrollment[]> {
  const map = new Map<string, Enrollment[]>();
  enrollments.forEach((e) => {
    const key = `${e.enrolledYear}-${e.enrolledSemester}`;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(e);
  });
  return map;
}

function parseXlsxCategoryLabel(input: string): { baseLabel: string; requiredTags: string[] } {
  const raw = String(input ?? '').trim();
  if (!raw) return { baseLabel: '', requiredTags: [] };

  const m = raw.match(/^(.+?)\((.+?)\)$/);
  const baseLabel = (m ? m[1] : raw).trim();
  const inside = (m ? m[2] : '').trim();
  if (!inside) return { baseLabel, requiredTags: [] };

  // 예: 인선(사일), 인선(인융), 인선(문핵)
  // 사- →사회, 인- →인문, 문- →문학예술
  // -일 → 일반, -융 → 융합, -핵 → 핵심
  const groupMap: Record<string, string> = { 사: '사회', 인: '인문', 문: '문학예술' };
  const typeMap: Record<string, string> = { 일: '일반', 융: '융합', 핵: '핵심' };

  const chars = Array.from(inside);
  const groupChar = chars.find((c) => c in groupMap) ?? '';
  const typeChar = chars.find((c) => c in typeMap) ?? '';

  const requiredTags = [groupChar ? groupMap[groupChar] : '', typeChar ? typeMap[typeChar] : ''].filter(Boolean);
  return { baseLabel, requiredTags };
}

// 성적 목록 xlsx 행 → { year, semester, courseCode, categoryBaseLabel, requiredTags, grade } 파싱 (20260210_성적 목록.xlsx 형식)
// courseCode: 교과목 열 사용. categoryBaseLabel: 구분 열(예: 기필/기선/교필/자선/인선...). requiredTags: 구분의 괄호 약어(예: 사일/인융/문핵)를 tags로 매칭.
// grade: P/NR 표기 후인 '성적' 열 사용.
function parseXlsxRow(row: Record<string, unknown>): { year: number; semester: Semester; courseCode: string; categoryBaseLabel: string; requiredTags: string[]; grade: Grade } | null {
  const termStr = String(row['학년도-학기'] ?? '').trim();
  const codeRaw = row['교과목'];
  const categoryLabelRaw = String(row['구분'] ?? '').trim();
  const gradeStr = String(row['성적'] ?? '').trim(); // P/NR 표기 후
  if (!termStr || codeRaw == null || codeRaw === '') return null;

  let year: number;
  let semester: Semester;
  if (termStr === '기이수 인정 학점') {
    year = 0;
    semester = 'SPRING';
  } else {
    const m = termStr.match(/(\d{4})년\s*(봄|여름|가을|겨울)학기/);
    if (!m) return null;
    year = parseInt(m[1], 10);
    const semMap: Record<string, Semester> = { 봄: 'SPRING', 여름: 'SUMMER', 가을: 'FALL', 겨울: 'WINTER' };
    semester = semMap[m[2]] ?? 'SPRING';
  }

  const courseCode = String(codeRaw).trim();
  const grade = (VALID_GRADES.includes(gradeStr as Grade) ? gradeStr : 'NR') as Grade;
  const { baseLabel: categoryBaseLabel, requiredTags } = parseXlsxCategoryLabel(categoryLabelRaw);
  return { year, semester, courseCode, categoryBaseLabel, requiredTags, grade };
}

// 오늘보다 이른 학기 중 가장 가까운 학기 찾기
function findNearestPastSemester(): { year: number; semester: Semester } {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11

  // 학기 판단: 봄(3-5), 여름(6-7), 가을(9-11), 겨울(12-2)
  let currentSemester: Semester = 'SPRING';
  if (currentMonth >= 2 && currentMonth <= 4) currentSemester = 'SPRING';
  else if (currentMonth >= 5 && currentMonth <= 6) currentSemester = 'SUMMER';
  else if (currentMonth >= 8 && currentMonth <= 10) currentSemester = 'FALL';
  else currentSemester = 'WINTER';

  // 현재 학기보다 이전 학기 찾기
  const semesterOrder: Semester[] = ['SPRING', 'SUMMER', 'FALL', 'WINTER'];
  let year = currentYear;
  let semesterIndex = semesterOrder.indexOf(currentSemester) - 1;

  if (semesterIndex < 0) {
    year--;
    semesterIndex = semesterOrder.length - 1;
  }

  return { year, semester: semesterOrder[semesterIndex] };
}

export default function CoursesTab({ lang = 'ko', profile, userId, onProfileUpdate, onRegisterXlsxHeader }: CoursesTabProps) {
  const [courseMode, setCourseMode] = useState<'add' | 'view'>('add');
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const selectedCourseIdsRef = useRef<Set<string>>(new Set());
  
  // selectedCourseIds와 ref를 동시에 업데이트하는 함수
  const updateSelectedCourseIds = useCallback((newIds: Set<string>) => {
    selectedCourseIdsRef.current = newIds;
    setSelectedCourseIds(newIds);
  }, []);
  const [addYear, setAddYear] = useState(new Date().getFullYear());
  const [addSemester, setAddSemester] = useState<Semester>('SPRING');
  const [addGrade, setAddGrade] = useState<Grade>('A+');
  const [addAsPriorCredit, setAddAsPriorCredit] = useState(false);
  const [filterDepartment, setFilterDepartment] = useState<string>('none');
  const [filterCategory, setFilterCategory] = useState<string>('none');
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [draggedEnrollment, setDraggedEnrollment] = useState<Enrollment | null>(null);
  const [draggedFromSemester, setDraggedFromSemester] = useState<string | null>(null);
  const [draggedCourse, setDraggedCourse] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [selectedEnrollmentKeys, setSelectedEnrollmentKeys] = useState<Set<string>>(new Set());
  const [xlsxParsedRows, setXlsxParsedRows] = useState<Record<string, unknown>[] | null>(null);
  const [xlsxFileName, setXlsxFileName] = useState<string | null>(null);
  const [xlsxLoading, setXlsxLoading] = useState(false);
  const [xlsxDialogOpen, setXlsxDialogOpen] = useState(false);
  const [xlsxApplying, setXlsxApplying] = useState(false);
  const [xlsxShouldApply, setXlsxShouldApply] = useState(false);
  const xlsxInputRef = useRef<HTMLInputElement>(null);

  // 수강 내역 로드 및 변환
  useEffect(() => {
    if (initialLoadDone) return;

    let cancelled = false;

    const loadEnrollments = async () => {
      try {
        const res = await fetch(`${API}/profile/enrollments`, {
          credentials: 'include',
        });

        if (cancelled) return;
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        if (!data.success) {
          setEnrollments([]);
          setInitialLoadDone(true);
          return;
        }

        let rawEnrollments: RawEnrollment[] = [];
        const raw = data.enrollments;
        if (Array.isArray(raw)) {
          rawEnrollments = raw as RawEnrollment[];
        } else if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            rawEnrollments = Array.isArray(parsed) ? (parsed as RawEnrollment[]) : [];
          } catch {
            rawEnrollments = [];
          }
        }

        if (cancelled) return;
        const converted = await convertToEnrollments(rawEnrollments);
        if (cancelled) return;
        setEnrollments(converted);
        setInitialLoadDone(true);
      } catch (e) {
        if (!cancelled) {
          setEnrollments([]);
          setInitialLoadDone(true);
        }
      }
    };

    loadEnrollments();
    return () => {
      cancelled = true;
    };
  }, [initialLoadDone]);

  // 서버 검색
  useEffect(() => {
    const hasQuery = !!courseSearchQuery.trim();
    const hasDept = !!(filterDepartment && filterDepartment !== 'none');
    const hasCat = !!(filterCategory && filterCategory !== 'none');

    if (!hasQuery && !hasDept && !hasCat) {
      setSearchResults([]);
      setIsSearching(false);
      if (selectedCourseIdsRef.current.size > 0) {
        updateSelectedCourseIds(new Set());
      }
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(() => {
      const params = new URLSearchParams();
      if (hasQuery) {
        params.append('query', courseSearchQuery.trim());
      }
      if (hasDept) {
        params.append('department', filterDepartment);
      }
      if (hasCat) {
        params.append('category', filterCategory);
      }

      fetch(`${API}/courses?${params.toString()}`)
        .then((r) => {
          if (!r.ok) {
            throw new Error(`HTTP error! status: ${r.status}`);
          }
          return r.json();
        })
        .then((courses) => {
          const newResults = Array.isArray(courses) ? courses : [];
          setSearchResults(newResults);
          setIsSearching(false);
          
          // 검색 결과가 변경되면, 화면에서 사라진 항목은 선택 해제
          const currentSelected = selectedCourseIdsRef.current;
          if (currentSelected.size > 0) {
            const availableCourseIds = new Set(
              newResults.map((c) => c.id || c.code || '').filter((id) => id !== '')
            );
            const filteredSelected = new Set(
              Array.from(currentSelected).filter((id) => availableCourseIds.has(id))
            );
            if (filteredSelected.size !== currentSelected.size) {
              updateSelectedCourseIds(filteredSelected);
            }
          }
        })
        .catch((error) => {
          console.error('Error fetching courses:', error);
          setSearchResults([]);
          setIsSearching(false);
          // 에러 발생 시 선택 해제
          if (selectedCourseIdsRef.current.size > 0) {
            updateSelectedCourseIds(new Set());
          }
        });
    }, 500); // 디바운스

    return () => {
      clearTimeout(timeoutId);
      setIsSearching(false);
    };
  }, [courseSearchQuery, filterDepartment, filterCategory]);

  // 서버에 저장
  const saveEnrollments = useCallback(
    async (newEnrollments: Enrollment[]) => {
      setIsSaving(true);
      try {
        const rawEnrollments = convertToRawEnrollments(newEnrollments);
        const res = await fetch(`${API}/profile/enrollments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ enrollments: rawEnrollments }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();
        if (!data.success) {
          alert(data.message || '저장에 실패했습니다.');
        }
      } catch (error) {
        alert('서버 오류가 발생했습니다.');
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  // 선택된 과목 추가
  const handleAddSelected = useCallback(() => {
    if (selectedCourseIds.size === 0) {
      alert(lang === 'ko' ? '추가할 과목을 선택해주세요.' : 'Please select courses to add.');
      return;
    }

    const newEnrollments = [...enrollments];
    const targetSemester = addAsPriorCredit
      ? { year: 0, semester: 'SPRING' as Semester }
      : { year: addYear, semester: addSemester };

    let addedCount = 0;
    selectedCourseIds.forEach((courseId) => {
      if (!courseId) return; // 빈 문자열 체크
      
      // selectedCourseIds에는 course.id 또는 course.code가 들어갈 수 있음 (AddCoursePanel에서 설정)
      const course = searchResults.find((c) => {
        return c.id === courseId || c.code === courseId;
      });
      
      if (!course) {
        console.warn(`Course not found for courseId: ${courseId}`, { searchResults, selectedCourseIds });
        return;
      }

      // 저장 시에는 고유 ID 사용
      const finalCourseId = course.id || courseId;
      if (!finalCourseId) {
        console.warn(`Course has no id:`, course);
        return;
      }
      
      // 중복 체크 (같은 과목이 같은 학기에 이미 있는지)
      const isDuplicate = newEnrollments.some(
        (e) =>
          e.courseId === finalCourseId &&
          e.enrolledYear === targetSemester.year &&
          e.enrolledSemester === targetSemester.semester
      );

      if (isDuplicate) {
        console.warn(`Duplicate course: ${finalCourseId} already exists in ${targetSemester.year}-${targetSemester.semester}`);
        return;
      }

      newEnrollments.push({
        courseId: finalCourseId, // UUID 저장
        course: {
          id: course.id || finalCourseId,
          code: course.code || '',
          title: course.title || '',
          department: course.department || '',
          category: course.category || '',
          credit: course.credit || 0,
          au: course.au || 0,
          tags: course.tags || [],
          level: course.level || 'UG',
          crossRecognition: course.crossRecognition || false
        },
        enrolledYear: targetSemester.year,
        enrolledSemester: targetSemester.semester,
        grade: addGrade,
      });
      addedCount++;
    });

    if (addedCount === 0) {
      alert(lang === 'ko' ? '추가할 수 있는 과목이 없습니다. 이미 추가된 과목이거나 검색 결과에서 찾을 수 없습니다.' : 'No courses to add. They may already be added or not found in search results.');
      return;
    }

    setEnrollments(newEnrollments);
    updateSelectedCourseIds(new Set());
    saveEnrollments(newEnrollments);
  }, [selectedCourseIds, searchResults, enrollments, addYear, addSemester, addGrade, addAsPriorCredit, saveEnrollments, lang]);

  // 성적 변경
  const handleGradeChange = useCallback(
    (enrollment: Enrollment, newGrade: Grade) => {
      const newEnrollments = enrollments.map((e) =>
        e.courseId === enrollment.courseId &&
        e.enrolledYear === enrollment.enrolledYear &&
        e.enrolledSemester === enrollment.enrolledSemester
          ? { ...e, grade: newGrade }
          : e
      );
      setEnrollments(newEnrollments);
      saveEnrollments(newEnrollments);
    },
    [enrollments, saveEnrollments]
  );

  // 삭제
  const handleRemove = useCallback(
    (enrollment: Enrollment) => {
      const newEnrollments = enrollments.filter(
        (e) =>
          !(
            e.courseId === enrollment.courseId &&
            e.enrolledYear === enrollment.enrolledYear &&
            e.enrolledSemester === enrollment.enrolledSemester
          )
      );
      setSelectedEnrollmentKeys((prev) => {
        const next = new Set(prev);
        next.delete(enrollmentKey(enrollment));
        return next;
      });
      setEnrollments(newEnrollments);
      saveEnrollments(newEnrollments);
    },
    [enrollments, saveEnrollments]
  );

  // 선택 삭제
  const handleRemoveSelected = useCallback(() => {
    if (selectedEnrollmentKeys.size === 0) return;
    const newEnrollments = enrollments.filter((e) => !selectedEnrollmentKeys.has(enrollmentKey(e)));
    setSelectedEnrollmentKeys(new Set());
    setEnrollments(newEnrollments);
    saveEnrollments(newEnrollments);
  }, [enrollments, selectedEnrollmentKeys, saveEnrollments]);

  // 전체 삭제
  const handleRemoveAll = useCallback(() => {
    if (enrollments.length === 0) return;
    if (!confirm(lang === 'ko' ? `수강 과목 ${enrollments.length}개를 모두 삭제하시겠습니까?` : `Delete all ${enrollments.length} enrolled courses?`)) return;
    setSelectedEnrollmentKeys(new Set());
    setEnrollments([]);
    saveEnrollments([]);
  }, [enrollments, saveEnrollments, lang]);

  // 학기 이동
  const handleMove = useCallback(
    (enrollment: Enrollment, newYear: number, newSemester: Semester) => {
      const newEnrollments = enrollments.map((e) =>
        e.courseId === enrollment.courseId &&
        e.enrolledYear === enrollment.enrolledYear &&
        e.enrolledSemester === enrollment.enrolledSemester
          ? { ...e, enrolledYear: newYear, enrolledSemester: newSemester }
          : e
      );
      setEnrollments(newEnrollments);
      saveEnrollments(newEnrollments);
    },
    [enrollments, saveEnrollments]
  );

  // 드래그 시작
  const handleDragStart = (e: React.DragEvent, enrollment: Enrollment, semesterKey: string) => {
    setDraggedEnrollment(enrollment);
    setDraggedFromSemester(semesterKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  // 드롭 (학기 섹션에)
  const handleDrop = useCallback(
    (e: React.DragEvent, targetSemesterKey: string) => {
      e.preventDefault();
      const [targetYear, targetSemester] = targetSemesterKey.split('-');

      if (draggedEnrollment) {
        // 기존 수강 내역을 다른 학기로 이동
        const newEnrollments = enrollments
          .filter(
            (e) =>
              !(
                e.courseId === draggedEnrollment.courseId &&
                e.enrolledYear === draggedEnrollment.enrolledYear &&
                e.enrolledSemester === draggedEnrollment.enrolledSemester
              )
          )
          .map((e) => e);

        newEnrollments.push({
          ...draggedEnrollment,
          enrolledYear: parseInt(targetYear),
          enrolledSemester: targetSemester as Semester,
        });

        setEnrollments(newEnrollments);
        setDraggedEnrollment(null);
        setDraggedFromSemester(null);
        saveEnrollments(newEnrollments);
      } else if (draggedCourse) {
        // 검색 결과에서 드래그한 과목을 수강 내역에 추가
        const targetSemesterObj =
          enrollments.length === 0
            ? findNearestPastSemester()
            : { year: parseInt(targetYear), semester: targetSemester as Semester };
        const courseId = draggedCourse.id;
        if (!courseId) {
          console.warn('Dragged course has no id:', draggedCourse);
          setDraggedCourse(null);
          return;
        }
        const au = draggedCourse.au || 0;
        const defaultGrade = au > 0 ? 'S' : 'A+';
        const newEnrollment: Enrollment = {
          courseId: courseId, // UUID 저장
          course: {
            id: draggedCourse.id,
            code: draggedCourse.code || '',
            title: draggedCourse.title || '',
            department: draggedCourse.department || '',
            category: draggedCourse.category || '',
            credit: draggedCourse.credit || 0,
            au,
            tags: draggedCourse.tags || [],
            level: draggedCourse.level || 'UG',
            crossRecognition: draggedCourse.crossRecognition || false
          },
          enrolledYear: targetSemesterObj.year,
          enrolledSemester: targetSemesterObj.semester,
          grade: defaultGrade,
        };

        // 중복 체크 (같은 과목이 같은 학기에 이미 있는지)
        const isDuplicate = enrollments.some(
          (e) =>
            e.courseId === newEnrollment.courseId &&
            e.enrolledYear === newEnrollment.enrolledYear &&
            e.enrolledSemester === newEnrollment.enrolledSemester
        );

        if (isDuplicate) {
          alert(lang === 'ko' ? '이미 해당 학기에 추가된 과목입니다.' : 'This course is already added for that semester.');
          setDraggedCourse(null);
          return;
        }

        const newEnrollments = [...enrollments, newEnrollment];
        setEnrollments(newEnrollments);
        setDraggedCourse(null);
        saveEnrollments(newEnrollments);
      }
    },
    [draggedEnrollment, draggedCourse, enrollments, saveEnrollments, lang]
  );

  // 목록 밖으로 드롭 (삭제)
  const handleDropOutside = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (draggedEnrollment) {
        handleRemove(draggedEnrollment);
        setDraggedEnrollment(null);
        setDraggedFromSemester(null);
      }
      if (draggedCourse) {
        setDraggedCourse(null);
      }
    },
    [draggedEnrollment, draggedCourse, handleRemove]
  );

  const handleXlsxFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.xlsx')) {
      alert(lang === 'ko' ? '.xlsx 파일만 업로드할 수 있습니다.' : 'Only .xlsx files can be uploaded.');
      if (xlsxInputRef.current) xlsxInputRef.current.value = '';
      return;
    }
    setXlsxLoading(true);
    setXlsxParsedRows(null);
    setXlsxFileName(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        if (!data || typeof data !== 'object' || !(data instanceof ArrayBuffer)) {
          setXlsxLoading(false);
          return;
        }
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          setXlsxLoading(false);
          alert(lang === 'ko' ? '엑셀 파일에 시트가 없습니다.' : 'The Excel file has no sheets.');
          return;
        }
        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
        setXlsxParsedRows(rows);
        setXlsxFileName(file.name);
        if (xlsxInputRef.current) xlsxInputRef.current.value = '';
        setXlsxLoading(false);
        setXlsxDialogOpen(false); // 다이얼로그 먼저 닫기
        
        // 다이얼로그 닫은 후 confirm 띄우기
        setTimeout(() => {
          if (confirm(lang === 'ko' ? `기존 수강 내역 ${enrollments.length}건을 모두 지우고, 엑셀 파일 내용(${rows.length}행)으로 수강 목록을 대체하시겠습니까?\n(엑셀의 '구분'과 DB의 과목구분이 일치하는 과목만 반영됩니다.)` : `Replace all ${enrollments.length} enrollments with ${rows.length} rows from the Excel file?\n(Only courses matching the DB category will be applied.)`)) {
            setXlsxShouldApply(true);
          } else {
            // 취소하면 업로드 정보 초기화
            setXlsxParsedRows(null);
            setXlsxFileName(null);
          }
        }, 100);
      } catch (err) {
        console.error('xlsx parse error:', err);
        alert(lang === 'ko' ? '엑셀 파일을 읽는 중 오류가 발생했습니다.' : 'An error occurred while reading the Excel file.');
        setXlsxLoading(false);
        if (xlsxInputRef.current) xlsxInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  }, [enrollments.length, lang]);

  const handleXlsxButtonClick = useCallback(() => {
    setXlsxDialogOpen(true);
  }, []);

  useEffect(() => {
    onRegisterXlsxHeader?.({ open: handleXlsxButtonClick, isApplying: xlsxApplying });
  }, [onRegisterXlsxHeader, handleXlsxButtonClick, xlsxApplying]);

  const handleXlsxDialogClose = useCallback(() => {
    if (!xlsxLoading && !xlsxApplying) {
      setXlsxDialogOpen(false);
      if (xlsxInputRef.current) xlsxInputRef.current.value = '';
    }
  }, [xlsxLoading, xlsxApplying]);

  // xlsx 파싱 결과로 기존 수강 내역 전부 지우고 일괄 반영
  const handleXlsxApply = useCallback(async () => {
    if (!xlsxParsedRows || xlsxParsedRows.length === 0) return;

    setXlsxApplying(true);
    try {
      const parsed: { year: number; semester: Semester; courseCode: string; categoryBaseLabel: string; requiredTags: string[]; grade: Grade }[] = [];
      for (const row of xlsxParsedRows) {
        const p = parseXlsxRow(row);
        if (p) parsed.push(p);
      }

      const courseCategoriesRes = await fetch(`${API}/courseCategories`);
      const courseCategoriesJson = await courseCategoriesRes.json();
      const courseCategories: Array<{ id: string; name: string }> = Array.isArray(courseCategoriesJson) ? courseCategoriesJson : [];
      const categoryNameToId = new Map(courseCategories.map((c) => [String(c.name).trim(), String(c.id).trim()]));
      const categoryIdToName = new Map(courseCategories.map((c) => [String(c.id).trim(), String(c.name).trim()]));
      const categoryAliasToName: Record<string, string> = {
        교필: '교양필수',
        자선: '자유선택',
        기필: '기초필수',
        기선: '기초선택',
        전필: '전공필수',
        전선: '전공선택',
        인선: '인문사회선택',
        선택: '선택(석/박사)',
      };
      const getCategoryId = (label: string): string | null => {
        const t = String(label ?? '').trim();
        if (!t) return null;
        // 이미 id로 들어온 경우
        if (categoryIdToName.has(t)) return t;
        // name이 그대로 들어온 경우
        if (categoryNameToId.has(t)) return categoryNameToId.get(t)!;
        // 약어(교필/기필 등) 매핑
        const aliased = categoryAliasToName[t];
        if (aliased && categoryNameToId.has(aliased)) return categoryNameToId.get(aliased)!;
        return null;
      };

      const hasAllTags = (courseTags: unknown, required: string[]) => {
        if (!required || required.length === 0) return true;
        const tags = Array.isArray(courseTags) ? courseTags.map((t) => String(t)) : [];
        return required.every((r) => tags.includes(r));
      };

      const pickCourse = (courses: any[], expectedCategoryId: string | null, requiredTags: string[], allowFallback = false) => {
        const list = Array.isArray(courses) ? courses : [];
        
        // 1) 정확히 매칭되는 것 찾기
        const exactMatch = list.find((c) => {
          if (expectedCategoryId && String(c?.category ?? '').trim() !== expectedCategoryId) return false;
          if (!hasAllTags(c?.tags, requiredTags)) return false;
          return true;
        });
        if (exactMatch) return exactMatch;
        
        // 2) fallback: 인선 과목이고 태그가 2개인 경우에만
        if (allowFallback && expectedCategoryId === 'HSE' && requiredTags.length === 2) {
          const firstTag = requiredTags[0];
          // 첫 번째 태그만 일치하고 두 번째가 '핵심'인 것
          const firstTagPlusCore = list.find((c) => {
            if (String(c?.category ?? '').trim() !== expectedCategoryId) return false;
            const tags = Array.isArray(c?.tags) ? c.tags.map((t: unknown) => String(t)) : [];
            return tags.includes(firstTag) && tags.includes('핵심');
          });
          if (firstTagPlusCore) return firstTagPlusCore;
          
          // 태그 없이 category만 인선인 것
          const noTags = list.find((c) => {
            if (String(c?.category ?? '').trim() !== expectedCategoryId) return false;
            const tags = Array.isArray(c?.tags) ? c.tags : [];
            return tags.length === 0;
          });
          if (noTags) return noTags;
        }
        
        return null;
      };

      const rawMap = new Map<string, RawEnrollment>();
      const notFoundCodes: string[] = [];
      const categoryMismatch: string[] = [];
      const unknownCategory: string[] = [];
      const tagMismatch: string[] = [];
      for (const p of parsed) {
        const expectedCategoryId = getCategoryId(p.categoryBaseLabel);
        if (!expectedCategoryId) {
          unknownCategory.push(`${p.courseCode}(${p.categoryBaseLabel || '구분없음'})`);
        }

        // 1) code+category 우선 조회 (가능할 때만)
        let course: any | null = null;
        if (expectedCategoryId) {
          const res = await fetch(`${API}/courses?code=${encodeURIComponent(p.courseCode)}&category=${encodeURIComponent(expectedCategoryId)}`);
          const courses = await res.json();
          const isHSE = expectedCategoryId === 'HSE'; // 인문사회선택
          course = pickCourse(courses, expectedCategoryId, p.requiredTags, isHSE);
          // category는 맞는데 tags가 안 맞는 경우 (fallback도 시도했지만 실패)
          if (!course && Array.isArray(courses) && courses.length > 0 && p.requiredTags.length > 0 && !isHSE) {
            tagMismatch.push(`${p.courseCode}(${p.requiredTags.join('+')})`);
          }
        }

        // 2) fallback: code만 조회 (category 미상 또는 매칭 실패 시)
        if (!course) {
          const res2 = await fetch(`${API}/courses?code=${encodeURIComponent(p.courseCode)}`);
          const courses2 = await res2.json();
          const isHSE = expectedCategoryId === 'HSE';
          const fallback = pickCourse(courses2, expectedCategoryId, p.requiredTags, isHSE);
          if (!fallback?.id) {
            // code는 있는데 tags 조건 때문에 못 찾았는지 구분 (인선은 fallback 시도했으므로 제외)
            if (Array.isArray(courses2) && courses2.length > 0 && p.requiredTags.length > 0 && !isHSE) {
              tagMismatch.push(`${p.courseCode}(${p.requiredTags.join('+')})`);
              continue;
            }
            notFoundCodes.push(p.courseCode);
            continue;
          }
          course = fallback;
        }

        if (course?.id) {
          const key = `${course.id}-${p.year}-${p.semester}`;
          rawMap.set(key, {
            courseId: course.id,
            enrolledYear: p.year,
            enrolledSemester: p.semester,
            grade: p.grade,
          });
        } else {
          notFoundCodes.push(p.courseCode);
        }
      }
      const rawEnrollments = Array.from(rawMap.values());

      const newEnrollments = await convertToEnrollments(rawEnrollments);
      setSelectedEnrollmentKeys(new Set());
      setEnrollments(newEnrollments);
      await saveEnrollments(newEnrollments);

      setXlsxParsedRows(null);
      setXlsxFileName(null);
      setXlsxDialogOpen(false);
      if (xlsxInputRef.current) xlsxInputRef.current.value = '';

      const msgs: string[] = lang === 'ko'
        ? [`수강 목록을 적용했습니다. (${newEnrollments.length}건)`]
        : [`Enrollments applied. (${newEnrollments.length} items)`];
      if (tagMismatch.length > 0) {
        const unique = [...new Set(tagMismatch)];
        msgs.push(lang === 'ko' ? `태그 불일치로 제외: ${unique.length}건${unique.length > 10 ? ` (예: ${unique.slice(0, 10).join(', ')} …)` : ` (예: ${unique.join(', ')})`}` : `Excluded (tag mismatch): ${unique.length}${unique.length > 10 ? ` (e.g. ${unique.slice(0, 10).join(', ')} …)` : ` (e.g. ${unique.join(', ')})`}`);
      }
      if (categoryMismatch.length > 0) {
        const unique = [...new Set(categoryMismatch)];
        msgs.push(lang === 'ko' ? `구분 불일치로 제외: ${unique.length}건${unique.length > 10 ? ` (예: ${unique.slice(0, 10).join(', ')} …)` : ` (예: ${unique.join(', ')})`}` : `Excluded (category mismatch): ${unique.length}${unique.length > 10 ? ` (e.g. ${unique.slice(0, 10).join(', ')} …)` : ` (e.g. ${unique.join(', ')})`}`);
      }
      if (unknownCategory.length > 0) {
        const unique = [...new Set(unknownCategory)];
        msgs.push(lang === 'ko' ? `구분 해석 불가(코드만으로 시도): ${unique.length}건${unique.length > 10 ? ` (예: ${unique.slice(0, 10).join(', ')} …)` : ` (예: ${unique.join(', ')})`}` : `Unknown category: ${unique.length}${unique.length > 10 ? ` (e.g. ${unique.slice(0, 10).join(', ')} …)` : ` (e.g. ${unique.join(', ')})`}`);
      }
      if (notFoundCodes.length > 0) {
        const unique = [...new Set(notFoundCodes)];
        msgs.push(lang === 'ko' ? `과목 DB에 없어 제외: ${unique.length}건${unique.length > 10 ? ` (예: ${unique.slice(0, 10).join(', ')} …)` : ` (예: ${unique.join(', ')})`}` : `Excluded (not in DB): ${unique.length}${unique.length > 10 ? ` (e.g. ${unique.slice(0, 10).join(', ')} …)` : ` (e.g. ${unique.join(', ')})`}`);
      }
      alert(msgs.join('\n'));
    } catch (err) {
      console.error('xlsx apply error:', err);
      alert(lang === 'ko' ? '적용 중 오류가 발생했습니다.' : 'An error occurred while applying.');
    } finally {
      setXlsxApplying(false);
    }
  }, [xlsxParsedRows, enrollments.length, saveEnrollments, lang]);

  // xlsx 파일 파싱 후 confirm에서 확인하면 자동으로 apply 실행
  useEffect(() => {
    if (xlsxShouldApply && xlsxParsedRows && xlsxParsedRows.length > 0) {
      setXlsxShouldApply(false);
      handleXlsxApply();
    }
  }, [xlsxShouldApply, xlsxParsedRows, handleXlsxApply]);

  const semesterGroups = useMemo(() => groupBySemester(enrollments), [enrollments]);
  const sortedSemesterKeys = Array.from(semesterGroups.keys()).sort((a, b) => {
    const [yearA, semA] = a.split('-');
    const [yearB, semB] = b.split('-');
    if (yearA !== yearB) return parseInt(yearA) - parseInt(yearB);
    const order: Semester[] = ['SPRING', 'SUMMER', 'FALL', 'WINTER'];
    return order.indexOf(semA as Semester) - order.indexOf(semB as Semester);
  });

  return (
    <>
      {/* 1열: 모바일/태블릿 탭 */}
      <div className="flex flex-col md:hidden h-full overflow-y-auto overflow-x-hidden">
        {/* 상단: 모드 전환 */}
        <div className="md:sticky md:top-0 md:z-20 bg-gradient-to-b from-gray-50 dark:from-black from-[70%] to-transparent flex items-center gap-2 p-3 pt-0 mb-2">
          <button
            type="button"
            onClick={() => setCourseMode('add')}
            className={`flex-1 px-2 py-1 text-sm font-medium transition-all rounded-lg truncate hover:bg-gray-200 dark:hover:bg-zinc-700 active:scale-90 ${
              courseMode === 'add'
                ? 'text-black dark:text-white'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            <span className={'px-2 py-1 border-b border-b-2 transition-color ' + (courseMode === 'add' ? 'border-violet-500' : 'border-transparent')}>
              {lang === 'ko' ? '과목 추가' : 'Add Course'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setCourseMode('view')}
            className={`flex-1 px-2 py-1 text-sm font-medium transition-all rounded-lg truncate hover:bg-gray-200 dark:hover:bg-zinc-700 active:scale-90 ${
              courseMode === 'view'
                ? 'text-black dark:text-white'
                : 'text-gray-400 dark:text-gray-500'
            }`}
          >
            <span className={'px-2 py-1 border-b border-b-2 transition-color ' + (courseMode === 'view' ? 'border-violet-500' : 'border-transparent')}>
              {lang === 'ko' ? '수강한 과목' : 'Enrolled Courses'}<span className="opacity-40 ml-2">{enrollments.length}</span>
            </span>
          </button>
        </div>

        {/* 본문 영역 */}
        <div className="">
          <div className="px-4 pt-2 pb-4">
              {courseMode === 'add' ? (
                <AddCoursePanel
                  lang={lang}
                  searchQuery={courseSearchQuery}
                  onSearchQueryChange={setCourseSearchQuery}
                  searchResults={searchResults}
                  isSearching={isSearching}
                  selectedCourseIds={selectedCourseIds}
                  onSelectionChange={updateSelectedCourseIds}
                  addYear={addYear}
                  onAddYearChange={setAddYear}
                  addSemester={addSemester}
                  onAddSemesterChange={setAddSemester}
                  addGrade={addGrade}
                  onAddGradeChange={setAddGrade}
                  addAsPriorCredit={addAsPriorCredit}
                  onAddAsPriorCreditChange={setAddAsPriorCredit}
                  onAddSelected={handleAddSelected}
                  onDragStart={(course) => setDraggedCourse(course)}
                  filterDepartment={filterDepartment}
                  onFilterDepartmentChange={setFilterDepartment}
                  filterCategory={filterCategory}
                  onFilterCategoryChange={setFilterCategory}
                  stickyTopOffset="3.25rem"
                  enrolledCourseIds={enrollments.map((e) => e.courseId)}
                />
              ) : (
                <EnrollmentsList
                  lang={lang}
                  enrollments={enrollments}
                  semesterGroups={semesterGroups}
                  sortedSemesterKeys={sortedSemesterKeys}
                  selectedEnrollmentKeys={selectedEnrollmentKeys}
                  onSelectionChange={setSelectedEnrollmentKeys}
                  onGradeChange={handleGradeChange}
                  onMove={handleMove}
                  onRemove={handleRemove}
                  onRemoveSelected={handleRemoveSelected}
                  onRemoveAll={handleRemoveAll}
                  onDragStart={handleDragStart}
                  onDrop={handleDrop}
                  onDropOutside={handleDropOutside}
                  findNearestPastSemester={findNearestPastSemester}
                />
              )}
          </div>
        </div>
      </div>

      {/* 2열: 넓은 화면 - 열별로 독립 스크롤 */}
      <div className="hidden md:flex flex-1 min-h-0 md:gap-6 overflow-hidden">
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="sticky top-0 z-100 flex-shrink-0 flex items-center justify-between gap-4 bg-gradient-to-b from-gray-50 dark:from-black from-[70%] to-transparent pb-4">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">{lang === 'ko' ? '과목 추가' : 'Add Course'}</h2>
            </div>
            <div className="space-y-4 pt-0 px-2 pb-4">
              <AddCoursePanel
                lang={lang}
                searchQuery={courseSearchQuery}
                onSearchQueryChange={setCourseSearchQuery}
                searchResults={searchResults}
                isSearching={isSearching}
                selectedCourseIds={selectedCourseIds}
                onSelectionChange={updateSelectedCourseIds}
                addYear={addYear}
                onAddYearChange={setAddYear}
                addSemester={addSemester}
                onAddSemesterChange={setAddSemester}
                addGrade={addGrade}
                onAddGradeChange={setAddGrade}
                addAsPriorCredit={addAsPriorCredit}
                onAddAsPriorCreditChange={setAddAsPriorCredit}
                onAddSelected={handleAddSelected}
                onDragStart={(course) => setDraggedCourse(course)}
                filterDepartment={filterDepartment}
                onFilterDepartmentChange={setFilterDepartment}
                filterCategory={filterCategory}
                onFilterCategoryChange={setFilterCategory}
                stickyTopOffset="2.5rem"
                enrolledCourseIds={enrollments.map((e) => e.courseId)}
              />
            </div>
          </div>
        </div>
        <div
          className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDropOutside(e);
          }}
        >
          <h2 className="flex-shrink-0 bg-gradient-to-b from-gray-50 dark:from-black from-[70%] to-transparent pb-4 text-xl font-semibold text-gray-800 dark:text-gray-200">
            {lang === 'ko' ? '수강한 과목' : 'Enrolled Courses'} <span className="text-md opacity-50">{enrollments.length}</span>
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 pb-4">
            <EnrollmentsList
              lang={lang}
              enrollments={enrollments}
              semesterGroups={semesterGroups}
              sortedSemesterKeys={sortedSemesterKeys}
              selectedEnrollmentKeys={selectedEnrollmentKeys}
              onSelectionChange={setSelectedEnrollmentKeys}
              onGradeChange={handleGradeChange}
              onMove={handleMove}
              onRemove={handleRemove}
              onRemoveSelected={handleRemoveSelected}
              onRemoveAll={handleRemoveAll}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onDropOutside={handleDropOutside}
              findNearestPastSemester={findNearestPastSemester}
            />
          </div>
        </div>
      </div>

      {/* 엑셀 업로드 다이얼로그 (공통) */}
      {xlsxDialogOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 dark:bg-black/70" onClick={handleXlsxDialogClose}>
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{lang === 'ko' ? '파일 업로드' : 'File Upload'}</h3>
              <button
                type="button"
                onClick={handleXlsxDialogClose}
                disabled={xlsxLoading}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {lang === 'ko' ? <>‘<a href="https://erp.kaist.ac.kr" target="_blank" className="text-violet-500 font-medium hover:underline">ERP</a> → 학사 → 성적 → 성적조회’ 메뉴에서 내려받은 .xlsx 파일을 업로드하여 수강한 과목을 일괄 등록할 수 있습니다.</> : <>Upload an .xlsx file downloaded from the ‘<a href="https://erp.kaist.ac.kr" target="_blank" className="text-violet-500 font-medium hover:underline">ERP</a> → Academic&nbsp;Affairs → Grades → Grade&nbsp;Report’ menu to bulk register enrolled courses.</>}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              {lang === 'ko' ? '주의: 기존에 등록한 과목들은 모두 삭제됩니다.' : 'Note: All existing enrollments will be deleted.'}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {lang === 'ko' ? '주의: 특강, 개별연구, 세미나 과목은 올바르게 처리되지 않을 수 있습니다.' : 'Note: Special lectures, independent study, and seminar courses may not be processed correctly.'}
            </p>
            <input
              ref={xlsxInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleXlsxFileChange}
              className="block w-full text-sm text-gray-600 dark:text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-50 file:text-violet-700 dark:file:bg-violet-900/30 dark:file:text-violet-300 hover:file:bg-violet-100 dark:hover:file:bg-violet-900/50"
            />
            {xlsxLoading && (
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{lang === 'ko' ? '파일 읽는 중...' : 'Reading file...'}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
