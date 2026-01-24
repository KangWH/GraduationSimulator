'use client';

import { useState, useEffect, useMemo } from 'react';
import { API } from '../../lib/api';
import type { Profile } from './types';
import CourseSearchInput from './CourseSearchInput';
import AddCoursePanel from './AddCoursePanel';
import EnrollmentsList from './EnrollmentsList';

const VALID_GRADES = ['A+', 'A0', 'A-', 'B+', 'B0', 'B-', 'C+', 'C0', 'C-', 'D+', 'D0', 'D-', 'F', 'S', 'U', 'P', 'NR', 'W'];
const SEMESTERS = ['봄', '여름', '가을', '겨울'];

interface NewCourse {
  name: string;
  code: string;
  department: string;
  category: string;
  credit: number;
  year: number;
  semester: string;
  grade: string;
}

interface CoursesTabProps {
  profile: Profile | null;
  userId: string | null;
  onProfileUpdate: (p: Profile) => void;
}

function normalizeSearchText(text: string): string {
  if (!text) return '';
  return text.replace(/\s+/g, '').replace(/[^\w가-힣]/g, '').toLowerCase();
}

export default function CoursesTab({ profile, userId, onProfileUpdate }: CoursesTabProps) {
  const [courseMode, setCourseMode] = useState<'add' | 'view'>('add');
  const [isAddFormExpanded, setIsAddFormExpanded] = useState(false);
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [newCourse, setNewCourse] = useState<NewCourse>({
    name: '',
    code: '',
    department: '',
    category: '',
    credit: 3,
    year: new Date().getFullYear(),
    semester: '봄',
    grade: '',
  });
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([]);
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);

  const deptName = (id: string) => depts.find((d) => d.id === id)?.name ?? id;

  const filteredCourses = useMemo(() => {
    if (!courseSearchQuery.trim()) return availableCourses;
    const q = normalizeSearchText(courseSearchQuery);
    return availableCourses.filter((course) => {
      const name = normalizeSearchText(course.title || course.name || '');
      const dept = course.department ? normalizeSearchText(deptName(course.department)) : '';
      const code = normalizeSearchText(course.code || '');
      return name.includes(q) || dept.includes(q) || code.includes(q);
    });
  }, [availableCourses, courseSearchQuery, depts]);

  useEffect(() => {
    fetch(`${API}/departments`)
      .then((r) => r.json())
      .then((arr: { id: string; name: string }[]) => setDepts(arr))
      .catch(() => {});
    fetch(`${API}/courses`)
      .then((r) => r.json())
      .then((arr: any[]) => setAvailableCourses(arr))
      .catch(() => {});
  }, []);

  const removeEnrollment = async (enrollmentId: string) => {
    if (!userId || !profile) return;
    try {
      const res = await fetch(
        `${API}/profile/enrollments/${enrollmentId}?userId=${encodeURIComponent(userId)}`,
        { method: 'DELETE', credentials: 'include' }
      );
      const data = await res.json();
      if (data.success) {
        onProfileUpdate({
          ...profile,
          enrollments: (profile.enrollments || []).filter((e) => e.id !== enrollmentId),
        });
      } else {
        alert(data.message || '삭제에 실패했습니다.');
      }
    } catch {
      alert('서버 오류가 발생했습니다.');
    }
  };

  const addEnrollment = async () => {
    if (!userId || !profile) return;
    if (!newCourse.name.trim()) {
      alert('과목명을 입력해주세요.');
      return;
    }
    if (newCourse.grade && !VALID_GRADES.includes(newCourse.grade.toUpperCase())) {
      alert(`올바른 성적을 입력해주세요. 허용된 성적: ${VALID_GRADES.join(', ')}`);
      return;
    }
    try {
      const currentEnrollments = Array.isArray(profile.enrollments)
        ? profile.enrollments.map((e: any) => ({
            courseId: e.course?.id || e.courseId || '',
            courseName: e.course?.title || e.course?.name || e.courseName || '',
            code: e.course?.code || e.code || newCourse.code,
            department: e.course?.department || e.department || newCourse.department,
            category: e.course?.category || e.category || newCourse.category,
            credit: e.course?.credit || e.credit || newCourse.credit,
            year: e.course?.year || e.year || newCourse.year,
            semester: e.course?.semester || e.semester || newCourse.semester,
            grade: e.grade || (newCourse.grade ? newCourse.grade.toUpperCase() : null),
          }))
        : [];
      const newEnrollment = {
        courseId: newCourse.code || `temp-${Date.now()}`,
        courseName: newCourse.name,
        code: newCourse.code,
        department: newCourse.department,
        category: newCourse.category,
        credit: newCourse.credit,
        year: newCourse.year,
        semester: newCourse.semester,
        grade: newCourse.grade ? newCourse.grade.toUpperCase() : null,
      };
      const updated = [...currentEnrollments, newEnrollment];
      const res = await fetch(`${API}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, enrollments: updated }),
      });
      const data = await res.json();
      if (data.success) {
        const profileRes = await fetch(`${API}/profile?userId=${encodeURIComponent(userId)}`, {
          credentials: 'include',
        });
        const profileData = await profileRes.json();
        if (profileData.success) {
          onProfileUpdate(profileData.profile);
        }
        setNewCourse({
          name: '',
          code: '',
          department: '',
          category: '',
          credit: 3,
          year: new Date().getFullYear(),
          semester: '봄',
          grade: '',
        });
        setIsAddFormExpanded(false);
        alert('과목이 추가되었습니다.');
      } else {
        alert(data.message || '과목 추가에 실패했습니다.');
      }
    } catch {
      alert('서버 오류가 발생했습니다.');
    }
  };

  const enrollments = profile?.enrollments ?? [];
  const searchInput = !isAddFormExpanded && (
    <CourseSearchInput
      value={courseSearchQuery}
      onChange={setCourseSearchQuery}
      onExpand={() => setIsAddFormExpanded(!isAddFormExpanded)}
      isExpanded={isAddFormExpanded}
    />
  );
  const addPanel = (
    <AddCoursePanel
      isExpanded={isAddFormExpanded}
      setIsExpanded={setIsAddFormExpanded}
      newCourse={newCourse}
      setNewCourse={setNewCourse}
      filteredCourses={filteredCourses}
      profile={profile}
      deptName={deptName}
      validGrades={VALID_GRADES}
      semesters={SEMESTERS}
      searchQuery={courseSearchQuery}
      onAdd={addEnrollment}
    />
  );
  const takenList = (
    <EnrollmentsList
      enrollments={enrollments}
      onRemove={removeEnrollment}
      ulClassName="space-y-2"
    />
  );
  const takenListScrollable = (
    <EnrollmentsList
      enrollments={enrollments}
      onRemove={removeEnrollment}
      ulClassName="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto"
    />
  );

  return (
    <div className="flex flex-col space-y-8">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">들은 과목 변경</h1>

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
            {courseMode === 'add' && searchInput}
          </div>
          <div className="p-6 pt-4">
            {courseMode === 'add' ? addPanel : takenList}
          </div>
        </div>
      </div>

      {/* 2열: 넓은 화면 */}
      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-6">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-zinc-900">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="sticky top-0 z-10 flex-shrink-0 space-y-4 border-b border-gray-200 bg-white p-6 pb-4 dark:border-gray-700 dark:bg-zinc-900">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">과목 추가</h2>
              {searchInput}
            </div>
            <div className="space-y-4 p-6 pt-4">
              {addPanel}
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-zinc-900">
          <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-gray-200">
            수강한 과목 ({enrollments.length})
          </h2>
          {takenListScrollable}
        </div>
      </div>
    </div>
  );
}
