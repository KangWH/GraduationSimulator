'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { API } from '../../lib/api';
import type { Profile, Enrollment, RawEnrollment, Semester, Grade } from './types';
import AddCoursePanel from './AddCoursePanel';
import EnrollmentsList from './EnrollmentsList';

const VALID_GRADES: Grade[] = ['A+', 'A0', 'A-', 'B+', 'B0', 'B-', 'C+', 'C0', 'C-', 'D+', 'D0', 'D-', 'F', 'S', 'U', 'P', 'NR', 'W'];
const SEMESTER_OPTIONS: { value: Semester; label: string }[] = [
  { value: 'SPRING', label: '봄' },
  { value: 'SUMMER', label: '여름' },
  { value: 'FALL', label: '가을' },
  { value: 'WINTER', label: '겨울' },
];

interface CoursesTabProps {
  profile: Profile | null;
  userId: string | null;
  onProfileUpdate: (p: Profile) => void;
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
            tags: course.tags || []
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

export default function CoursesTab({ profile, userId, onProfileUpdate }: CoursesTabProps) {
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
      alert('추가할 과목을 선택해주세요.');
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
          tags: course.tags || []
        },
        enrolledYear: targetSemester.year,
        enrolledSemester: targetSemester.semester,
        grade: addGrade,
      });
      addedCount++;
    });

    if (addedCount === 0) {
      alert('추가할 수 있는 과목이 없습니다. 이미 추가된 과목이거나 검색 결과에서 찾을 수 없습니다.');
      return;
    }

    setEnrollments(newEnrollments);
    updateSelectedCourseIds(new Set());
    saveEnrollments(newEnrollments);
  }, [selectedCourseIds, searchResults, enrollments, addYear, addSemester, addGrade, addAsPriorCredit, saveEnrollments]);

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
            tags: draggedCourse.tags || []
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
          alert('이미 해당 학기에 추가된 과목입니다.');
          setDraggedCourse(null);
          return;
        }

        const newEnrollments = [...enrollments, newEnrollment];
        setEnrollments(newEnrollments);
        setDraggedCourse(null);
        saveEnrollments(newEnrollments);
      }
    },
    [draggedEnrollment, draggedCourse, enrollments, saveEnrollments]
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
      <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-zinc-900 lg:hidden">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 flex-shrink-0 space-y-4 border-b border-gray-200 bg-white p-6 pb-4 dark:border-gray-700 dark:bg-zinc-900">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCourseMode('add')}
                className={`flex-1 rounded-lg px-4 py-2 font-medium transition-colors ${
                  courseMode === 'add'
                    ? 'border border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                    : 'border border-transparent bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700'
                }`}
              >
                과목 추가
              </button>
              <button
                type="button"
                onClick={() => setCourseMode('view')}
                className={`flex-1 rounded-lg px-4 py-2 font-medium transition-colors ${
                  courseMode === 'view'
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700'
                }`}
              >
                수강한 과목 ({enrollments.length})
              </button>
            </div>
          </div>
          <div className="p-6 pt-4">
            {courseMode === 'add' ? (
              <AddCoursePanel
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
              />
            ) : (
              <EnrollmentsList
                enrollments={enrollments}
                semesterGroups={semesterGroups}
                sortedSemesterKeys={sortedSemesterKeys}
                onGradeChange={handleGradeChange}
                onRemove={handleRemove}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                onDropOutside={handleDropOutside}
                findNearestPastSemester={findNearestPastSemester}
              />
            )}
          </div>
        </div>
      </div>

      {/* 2열: 넓은 화면 */}
      <div className="hidden h-full lg:flex justify-center items-start lg:gap-6 overflow-hidden">
        <div className="h-full flex-1 flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-zinc-900">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex-shrink-0 space-y-4 p-6 pb-0">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">과목 추가</h2>
            </div>
            <div className="space-y-4 p-6 pt-0">
              <AddCoursePanel
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
              />
            </div>
          </div>
        </div>
        <div
          className="flex-1 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-zinc-900 h-full overflow-y-auto"
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
          <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-200">
            수강한 과목 ({enrollments.length})
          </h2>
          <EnrollmentsList
            enrollments={enrollments}
            semesterGroups={semesterGroups}
            sortedSemesterKeys={sortedSemesterKeys}
            onGradeChange={handleGradeChange}
            onRemove={handleRemove}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
            onDropOutside={handleDropOutside}
            findNearestPastSemester={findNearestPastSemester}
          />
        </div>
      </div>
    </>
  );
}
