'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Input,
  NumberInput,
  Select,
} from '../../components/formFields';
import { DepartmentDropdown, MultipleDepartmentDropdown } from '../../components/DepartmentDropeown';

type Tab = 'account' | 'profile' | 'courses';

interface User {
  id: string;
  email: string;
}

interface Course {
  id: string;
  code: string;
  title: string;
  credit: number;
  year: number;
  semester: number;
  section?: string;
  grade?: string | null;
}

interface Profile {
  id: string;
  userId: string;
  name: string;
  studentId: string;
  admissionYear: number;
  isFallAdmission: boolean;
  major: string;
  doubleMajors: string[];
  minors: string[];
  advancedMajor: boolean;
  individuallyDesignedMajor: boolean;
  enrollments?: { id: string; grade: string | null; course: Course }[];
}

const API = 'http://localhost:4000';

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('account');
  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 계정: 비밀번호 변경
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [accountSubmitting, setAccountSubmitting] = useState(false);

  // 프로필 수정 폼
  const [form, setForm] = useState({
    name: '',
    admissionYear: new Date().getFullYear(),
    isFallAdmission: false,
    major: '',
    doubleMajors: [] as string[],
    minors: [] as string[],
    advancedMajor: false,
    individuallyDesignedMajor: false,
  });
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  // 수강한 과목: 검색 및 추가
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([]);
  const [courseMode, setCourseMode] = useState<'add' | 'view'>('add');
  const [isAddFormExpanded, setIsAddFormExpanded] = useState(false);
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [newCourse, setNewCourse] = useState({
    name: '',
    code: '',
    department: '',
    category: '',
    credit: 3,
    year: new Date().getFullYear(),
    semester: '봄',
    grade: '',
  });

  const validGrades = ['A+', 'A0', 'A-', 'B+', 'B0', 'B-', 'C+', 'C0', 'C-', 'D+', 'D0', 'D-', 'F', 'S', 'U', 'P', 'NR', 'W'];
  const semesters = ['봄', '여름', '가을', '겨울'];
  const [availableCourses, setAvailableCourses] = useState<any[]>([]);

  useEffect(() => {
    const uid = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
    if (!uid) {
      router.push('/login');
      return;
    }
    setUserId(uid);
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`${API}/auth/me?userId=${encodeURIComponent(userId)}`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`${API}/profile?userId=${encodeURIComponent(userId)}`, { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([meRes, profileRes]) => {
        if (!meRes.success || !profileRes.success) {
          setError(meRes.message || profileRes.message || '데이터를 불러오지 못했습니다.');
          return;
        }
        setUser(meRes.user);
        const p = profileRes.profile as Profile;
        setProfile(p);
        setForm({
          name: p.name,
          admissionYear: p.admissionYear,
          isFallAdmission: p.isFallAdmission,
          major: p.major,
          doubleMajors: p.doubleMajors || [],
          minors: p.minors || [],
          advancedMajor: p.advancedMajor,
          individuallyDesignedMajor: p.individuallyDesignedMajor,
        });
      })
      .catch((err) => {
        setError(err?.message || '서버 오류');
      })
      .finally(() => setLoading(false));
  }, [userId]);

  // 학과 목록 및 과목 목록 로드
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== newPasswordConfirm) {
      alert('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPassword.length < 6) {
      alert('새 비밀번호는 최소 6자 이상이어야 합니다.');
      return;
    }
    if (!userId) return;
    setAccountSubmitting(true);
    try {
      const res = await fetch(`${API}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        alert('비밀번호가 변경되었습니다.');
        setCurrentPassword('');
        setNewPassword('');
        setNewPasswordConfirm('');
      } else {
        alert(data.message || '비밀번호 변경에 실패했습니다.');
      }
    } catch {
      alert('서버 오류가 발생했습니다.');
    } finally {
      setAccountSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!userId) return;
    if (!deletePassword) {
      alert('비밀번호를 입력해주세요.');
      return;
    }
    if (!confirm('정말 회원 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    setAccountSubmitting(true);
    try {
      const res = await fetch(`${API}/auth/delete-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, password: deletePassword }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.removeItem('userId');
        alert('회원 탈퇴가 완료되었습니다.');
        router.push('/login');
      } else {
        alert(data.message || '회원 탈퇴에 실패했습니다.');
      }
    } catch {
      alert('서버 오류가 발생했습니다.');
    } finally {
      setAccountSubmitting(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (!form.name || !form.major) {
      alert('이름과 주전공을 입력해주세요.');
      return;
    }
    setProfileSubmitting(true);
    try {
      const res = await fetch(`${API}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId,
          name: form.name,
          admissionYear: form.admissionYear,
          isFallAdmission: form.isFallAdmission,
          major: form.major,
          doubleMajor: (() => {
            const valid = form.doubleMajors.filter((v) => v && v !== 'none' && v.trim() !== '');
            return valid.length > 0 ? valid : null;
          })(),
          minor: (() => {
            const valid = form.minors.filter((v) => v && v !== 'none' && v.trim() !== '');
            return valid.length > 0 ? valid : null;
          })(),
          advancedMajor: form.advancedMajor,
          individuallyDesignedMajor: form.individuallyDesignedMajor,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('프로필이 수정되었습니다.');
        setProfile(data.profile ? { ...profile!, ...data.profile } : profile);
      } else {
        alert(data.message || '프로필 수정에 실패했습니다.');
      }
    } catch {
      alert('서버 오류가 발생했습니다.');
    } finally {
      setProfileSubmitting(false);
    }
  };

  const deptName = (id: string) => depts.find((d) => d.id === id)?.name ?? id;

  // 검색어 정규화 (띄어쓰기, 문장부호, 특수문자 제거, 한글/로마자/숫자만)
  const normalizeSearchText = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/\s+/g, '') // 띄어쓰기 제거
      .replace(/[^\w가-힣]/g, '') // 한글, 로마자, 숫자만 남김
      .toLowerCase();
  };

  // 과목 검색 필터링
  const filteredCourses = useMemo(() => {
    if (!courseSearchQuery.trim()) return availableCourses;
    
    const normalizedQuery = normalizeSearchText(courseSearchQuery);
    
    return availableCourses.filter((course) => {
      const normalizedName = normalizeSearchText(course.title || course.name || '');
      const deptNameStr = course.department ? deptName(course.department) : '';
      const normalizedDept = normalizeSearchText(deptNameStr);
      const normalizedCode = normalizeSearchText(course.code || '');
      
      return (
        normalizedName.includes(normalizedQuery) ||
        normalizedDept.includes(normalizedQuery) ||
        normalizedCode.includes(normalizedQuery)
      );
    });
  }, [availableCourses, courseSearchQuery, depts]);

  const removeEnrollment = async (enrollmentId: string) => {
    if (!userId) return;
    try {
      const res = await fetch(
        `${API}/profile/enrollments/${enrollmentId}?userId=${encodeURIComponent(userId)}`,
        { method: 'DELETE', credentials: 'include' }
      );
      const data = await res.json();
      if (data.success && profile) {
        setProfile({
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
    if (newCourse.grade && !validGrades.includes(newCourse.grade.toUpperCase())) {
      alert(`올바른 성적을 입력해주세요. 허용된 성적: ${validGrades.join(', ')}`);
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

      const updatedEnrollments = [...currentEnrollments, newEnrollment];

      const res = await fetch(`${API}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId,
          enrollments: updatedEnrollments,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // 프로필 새로고침
        const profileRes = await fetch(`${API}/profile?userId=${encodeURIComponent(userId)}`, {
          credentials: 'include',
        });
        const profileData = await profileRes.json();
        if (profileData.success) {
          setProfile(profileData.profile);
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

  if (loading || !userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-gray-500 dark:text-gray-400">로딩 중…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-black">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Link href="/simulation" className="text-violet-600 hover:underline">
          시뮬레이션으로 돌아가기
        </Link>
      </div>
    );
  }

  const menuItems: { key: Tab; label: string }[] = [
    { key: 'account', label: '계정 정보' },
    { key: 'profile', label: '프로필 수정' },
    { key: 'courses', label: '수강한 과목' },
  ];

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-black">
      <aside className="w-56 flex-shrink-0 border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-zinc-900">
        <div className="border-b border-gray-200 p-4 dark:border-gray-700">
          <Link href="/simulation" className="text-sm text-violet-600 hover:underline dark:text-violet-400">
            ← 시뮬레이션
          </Link>
        </div>
        <nav className="p-2 space-y-1">
          {menuItems.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`w-full rounded-lg px-4 py-2.5 text-left text-sm transition-colors ${
                tab === key
                  ? 'bg-violet-100 font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <div className={"mx-auto max-w-2xl " + tab === 'courses' ? 'lg:max-w-4xl' : ''}>
          {tab === 'account' && (
            <div className="space-y-8">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">계정 정보</h1>
              <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-zinc-900">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">이메일</label>
                  <p className="text-gray-900 dark:text-white">{user?.email}</p>
                </div>
              </div>

              <section>
                <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-200">비밀번호 변경</h2>
                <form onSubmit={handleChangePassword} className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-zinc-900">
                  <div>
                    <label htmlFor="currentPassword" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      현재 비밀번호
                    </label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={setCurrentPassword}
                      required
                      placeholder="현재 비밀번호"
                    />
                  </div>
                  <div>
                    <label htmlFor="newPassword" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      새 비밀번호
                    </label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={setNewPassword}
                      required
                      placeholder="새 비밀번호 (6자 이상)"
                    />
                  </div>
                  <div>
                    <label htmlFor="newPasswordConfirm" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      새 비밀번호 확인
                    </label>
                    <Input
                      id="newPasswordConfirm"
                      type="password"
                      value={newPasswordConfirm}
                      onChange={setNewPasswordConfirm}
                      required
                      placeholder="새 비밀번호 다시 입력"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={accountSubmitting}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    비밀번호 변경
                  </button>
                </form>
              </section>

              <section>
                <h2 className="mb-4 text-lg font-semibold text-red-600 dark:text-red-400">회원 탈퇴</h2>
                <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/30">
                  <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                    탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다.
                  </p>
                  <div className="mb-4">
                    <label htmlFor="deletePassword" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      비밀번호 확인
                    </label>
                    <Input
                      id="deletePassword"
                      type="password"
                      value={deletePassword}
                      onChange={setDeletePassword}
                      placeholder="비밀번호 입력"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={accountSubmitting}
                    className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    회원 탈퇴
                  </button>
                </div>
              </section>
            </div>
          )}

          {tab === 'profile' && (
            <div className="space-y-8">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">프로필 수정</h1>
              <form onSubmit={handleProfileSubmit} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-zinc-900">
                <div>
                  <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    이름 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="name"
                    type="text"
                    value={form.name}
                    onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                    required
                    placeholder="이름"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">학번</label>
                  <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-600 dark:border-gray-700 dark:bg-zinc-800 dark:text-gray-400">
                    {profile?.studentId}
                  </p>
                </div>
                <div>
                  <label htmlFor="admissionYear" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    입학연도 <span className="text-red-500">*</span>
                  </label>
                  <NumberInput
                    id="admissionYear"
                    min="2000"
                    max="2030"
                    value={String(form.admissionYear)}
                    onChange={(v) => setForm((f) => ({ ...f, admissionYear: parseInt(v, 10) || 0 }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isFallAdmission"
                    checked={form.isFallAdmission}
                    onChange={(e) => setForm((f) => ({ ...f, isFallAdmission: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <label htmlFor="isFallAdmission" className="text-sm text-gray-700 dark:text-gray-300">
                    가을학기 입학
                  </label>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    주전공 <span className="text-red-500">*</span>
                  </label>
                  <DepartmentDropdown
                    value={form.major}
                    onChange={(v) => setForm((f) => ({ ...f, major: v }))}
                    mode="major"
                    size="medium"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">복수전공</label>
                  <MultipleDepartmentDropdown
                    value={form.doubleMajors}
                    onChange={(v) => setForm((f) => ({ ...f, doubleMajors: v }))}
                    mode="doubleMajor"
                    size="medium"
                    className="min-w-40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">부전공</label>
                  <MultipleDepartmentDropdown
                    value={form.minors}
                    onChange={(v) => setForm((f) => ({ ...f, minors: v }))}
                    mode="minor"
                    size="medium"
                    className="min-w-40"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="advancedMajor"
                    checked={form.advancedMajor}
                    onChange={(e) => setForm((f) => ({ ...f, advancedMajor: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <label htmlFor="advancedMajor" className="text-sm text-gray-700 dark:text-gray-300">
                    심화전공
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="individuallyDesignedMajor"
                    checked={form.individuallyDesignedMajor}
                    onChange={(e) => setForm((f) => ({ ...f, individuallyDesignedMajor: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                  />
                  <label htmlFor="individuallyDesignedMajor" className="text-sm text-gray-700 dark:text-gray-300">
                    자유융합전공
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={profileSubmitting}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  저장하기
                </button>
              </form>
            </div>
          )}

          {tab === 'courses' && (
            <div className="space-y-8">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">들은 과목 변경</h1>
              
              {/* 모바일/태블릿: 탭 방식 */}
              <div className="lg:hidden rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-zinc-900">
                {/* 모드 전환 버튼 */}
                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setCourseMode('add')}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      courseMode === 'add'
                        ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-700'
                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700 border border-transparent'
                    }`}
                  >
                    과목 추가
                  </button>
                  <button
                    type="button"
                    onClick={() => setCourseMode('view')}
                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                      courseMode === 'view'
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    수강한 과목 ({profile?.enrollments?.length ?? 0})
                  </button>
                </div>

                {courseMode === 'add' ? (
                  <div className="space-y-4">
                    {/* 검색창 */}
                    {isAddFormExpanded || (
                      <div className="relative">
                        <Input
                          type="text"
                          value={courseSearchQuery}
                          onChange={setCourseSearchQuery}
                          placeholder="과목명, 과목코드, 개설학과로 검색..."
                          size="medium"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setIsAddFormExpanded(!isAddFormExpanded)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          title={isAddFormExpanded ? '폼 접기' : '폼 펼치기'}
                        >
                          <svg
                            className={`w-5 h-5 transition-transform ${isAddFormExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* 통합검색 결과 (폼이 접혀있을 때만 표시) */}
                    {!isAddFormExpanded && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          검색 결과 ({filteredCourses.length})
                        </h3>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {filteredCourses.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
                              {courseSearchQuery ? '검색 결과가 없습니다.' : '검색어를 입력하거나 과목을 직접 추가하세요.'}
                            </p>
                          ) : (
                            filteredCourses.map((course) => {
                              const isAlreadyAdded = profile?.enrollments?.some((e: any) => 
                                (e.course?.code || e.code) === course.code || 
                                (e.course?.title || e.course?.name || e.courseName) === (course.title || course.name)
                              );
                              
                              return (
                                <div
                                  key={course.id}
                                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{course.title || course.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                      {course.code && `${course.code} | `}
                                      {course.department && `${deptName(course.department)} | `}
                                      {course.category || '구분 없음'}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (isAlreadyAdded) {
                                        alert('이미 추가된 과목입니다.');
                                        return;
                                      }
                                      setNewCourse({
                                        name: course.title || course.name || '',
                                        code: course.code || '',
                                        department: course.department || '',
                                        category: course.category || '',
                                        credit: course.credit || 3,
                                        year: new Date().getFullYear(),
                                        semester: '봄',
                                        grade: '',
                                      });
                                      setIsAddFormExpanded(true);
                                    }}
                                    className={`ml-3 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap ${
                                      isAlreadyAdded
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-zinc-700 dark:text-gray-400'
                                        : 'bg-green-600 text-white hover:bg-green-700'
                                    }`}
                                    disabled={isAlreadyAdded}
                                  >
                                    {isAlreadyAdded ? '추가됨' : '추가'}
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    {/* 과목 추가 폼 (접을 수 있음) */}
                    {isAddFormExpanded && (
                      <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
                        <div className="relative">
                          {/* 과목명 */}
                          <div className="grow flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">과목명</label>
                            <Input
                              type="text"
                              value={newCourse.name}
                              onChange={(value) => setNewCourse({ ...newCourse, name: value })}
                              placeholder="예: 컴퓨터네트워크"
                              size="medium"
                            />
                          </div>
                          {/* 폼 접기 버튼 */}
                          <button
                            type="button"
                            onClick={() => setIsAddFormExpanded(false)}
                            className="absolute top-[-1rem] right-[-1rem] p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            title="폼 접기"
                          >
                            <svg
                              className="w-5 h-5 transition-transform rotate-180"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>

                        {/* 과목코드, 개설학과, 과목구분 (한 줄 3분할) */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">과목코드</label>
                            <Input
                              type="text"
                              value={newCourse.code}
                              onChange={(value) => setNewCourse({ ...newCourse, code: value })}
                              placeholder="예: CS330"
                              size="small"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">개설학과</label>
                            <DepartmentDropdown
                              value={newCourse.department}
                              onChange={(value) => setNewCourse({ ...newCourse, department: value === 'none' ? '' : value })}
                              mode="course"
                              size="small"
                              allowNone={true}
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">과목구분</label>
                            <Select
                              value={newCourse.category}
                              onChange={(value) => setNewCourse({ ...newCourse, category: value })}
                              size="small"
                            >
                              <option value="">선택</option>
                              <option value="전필">전필</option>
                              <option value="전선">전선</option>
                              <option value="인선">인선</option>
                              <option value="자선">자선</option>
                              <option value="교필">교필</option>
                              <option value="교선">교선</option>
                            </Select>
                          </div>
                        </div>

                        {/* 학점, 연도, 학기, 성적 */}
                        <div className="grid grid-cols-4 gap-3">
                          <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">학점</label>
                            <NumberInput
                              min="1"
                              max="10"
                              value={String(newCourse.credit)}
                              onChange={(value) => setNewCourse({ ...newCourse, credit: parseInt(value) || 3 })}
                              size="small"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">연도</label>
                            <NumberInput
                              min="2000"
                              max="2050"
                              value={String(newCourse.year)}
                              onChange={(value) => setNewCourse({ ...newCourse, year: parseInt(value) || new Date().getFullYear() })}
                              size="small"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">학기</label>
                            <Select
                              value={newCourse.semester}
                              onChange={(value) => setNewCourse({ ...newCourse, semester: value })}
                              size="small"
                            >
                              {semesters.map((sem) => (
                                <option key={sem} value={sem}>{sem}</option>
                              ))}
                            </Select>
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">성적</label>
                            <Select
                              value={newCourse.grade}
                              onChange={(value) => setNewCourse({ ...newCourse, grade: value })}
                              size="small"
                            >
                              <option value="">선택</option>
                              {validGrades.map((grade) => (
                                <option key={grade} value={grade}>{grade}</option>
                              ))}
                            </Select>
                          </div>
                        </div>

                        {/* 추가 버튼 */}
                        <button
                          type="button"
                          onClick={addEnrollment}
                          className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors"
                        >
                          과목 추가
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* 수강한 과목 보기 */
                  <div className="space-y-2">
                    {(profile?.enrollments?.length ?? 0) === 0 ? (
                      <p className="rounded-lg bg-gray-50 py-8 text-center text-gray-500 dark:bg-zinc-800 dark:text-gray-400">
                        등록된 수강 과목이 없습니다.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {(profile?.enrollments ?? []).map((e: any) => (
                          <li
                            key={e.id}
                            className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white truncate">
                                {e.course?.title || e.course?.name || e.courseName} ({e.course?.code || e.code || '코드 없음'})
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {e.course?.credit || e.credit || 3}학점
                                {e.course?.year && e.course?.semester && ` · ${e.course.year}년 ${e.course.semester}`}
                                {e.grade != null && ` · ${e.grade}`}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeEnrollment(e.id)}
                              className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50 whitespace-nowrap ml-3"
                            >
                              삭제
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* 넓은 화면: 2열 레이아웃 */}
              <div className="hidden lg:grid lg:grid-cols-2 lg:gap-6">
                {/* 왼쪽: 과목 추가 */}
                <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-zinc-900">
                  <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">과목 추가</h2>
                  <div className="space-y-4">
                    {/* 검색창 */}
                    {isAddFormExpanded || (
                      <div className="relative">
                        <Input
                          type="text"
                          value={courseSearchQuery}
                          onChange={setCourseSearchQuery}
                          placeholder="과목명, 과목코드, 개설학과로 검색..."
                          size="medium"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setIsAddFormExpanded(!isAddFormExpanded)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          title={isAddFormExpanded ? '폼 접기' : '폼 펼치기'}
                        >
                          <svg
                            className={`w-5 h-5 transition-transform ${isAddFormExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* 통합검색 결과 (폼이 접혀있을 때만 표시) */}
                    {!isAddFormExpanded && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          검색 결과 ({filteredCourses.length})
                        </h3>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {filteredCourses.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
                              {courseSearchQuery ? '검색 결과가 없습니다.' : '검색어를 입력하거나 과목을 직접 추가하세요.'}
                            </p>
                          ) : (
                            filteredCourses.map((course) => {
                              const isAlreadyAdded = profile?.enrollments?.some((e: any) => 
                                (e.course?.code || e.code) === course.code || 
                                (e.course?.title || e.course?.name || e.courseName) === (course.title || course.name)
                              );
                              
                              return (
                                <div
                                  key={course.id}
                                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-zinc-800"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{course.title || course.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                      {course.code && `${course.code} | `}
                                      {course.department && `${deptName(course.department)} | `}
                                      {course.category || '구분 없음'}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (isAlreadyAdded) {
                                        alert('이미 추가된 과목입니다.');
                                        return;
                                      }
                                      setNewCourse({
                                        name: course.title || course.name || '',
                                        code: course.code || '',
                                        department: course.department || '',
                                        category: course.category || '',
                                        credit: course.credit || 3,
                                        year: new Date().getFullYear(),
                                        semester: '봄',
                                        grade: '',
                                      });
                                      setIsAddFormExpanded(true);
                                    }}
                                    className={`ml-3 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap ${
                                      isAlreadyAdded
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-zinc-700 dark:text-gray-400'
                                        : 'bg-green-600 text-white hover:bg-green-700'
                                    }`}
                                    disabled={isAlreadyAdded}
                                  >
                                    {isAlreadyAdded ? '추가됨' : '추가'}
                                  </button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    {/* 과목 추가 폼 (접을 수 있음) */}
                    {isAddFormExpanded && (
                      <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-zinc-800/50">
                        <div className="relative">
                          {/* 과목명 */}
                          <div className="grow flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">과목명</label>
                            <Input
                              type="text"
                              value={newCourse.name}
                              onChange={(value) => setNewCourse({ ...newCourse, name: value })}
                              placeholder="예: 컴퓨터네트워크"
                              size="medium"
                            />
                          </div>
                          {/* 폼 접기 버튼 */}
                          <button
                            type="button"
                            onClick={() => setIsAddFormExpanded(false)}
                            className="absolute top-[-1rem] right-[-1rem] p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            title="폼 접기"
                          >
                            <svg
                              className="w-5 h-5 transition-transform rotate-180"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>

                        {/* 과목코드, 개설학과, 과목구분 (한 줄 3분할) */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">과목코드</label>
                            <Input
                              type="text"
                              value={newCourse.code}
                              onChange={(value) => setNewCourse({ ...newCourse, code: value })}
                              placeholder="예: CS330"
                              size="small"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">개설학과</label>
                            <DepartmentDropdown
                              value={newCourse.department}
                              onChange={(value) => setNewCourse({ ...newCourse, department: value === 'none' ? '' : value })}
                              mode="course"
                              size="small"
                              allowNone={true}
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">과목구분</label>
                            <Select
                              value={newCourse.category}
                              onChange={(value) => setNewCourse({ ...newCourse, category: value })}
                              size="small"
                            >
                              <option value="">선택</option>
                              <option value="전필">전필</option>
                              <option value="전선">전선</option>
                              <option value="인선">인선</option>
                              <option value="자선">자선</option>
                              <option value="교필">교필</option>
                              <option value="교선">교선</option>
                            </Select>
                          </div>
                        </div>

                        {/* 학점, 연도, 학기, 성적 */}
                        <div className="grid grid-cols-4 gap-3">
                          <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">학점</label>
                            <NumberInput
                              min="1"
                              max="10"
                              value={String(newCourse.credit)}
                              onChange={(value) => setNewCourse({ ...newCourse, credit: parseInt(value) || 3 })}
                              size="small"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">연도</label>
                            <NumberInput
                              min="2000"
                              max="2050"
                              value={String(newCourse.year)}
                              onChange={(value) => setNewCourse({ ...newCourse, year: parseInt(value) || new Date().getFullYear() })}
                              size="small"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">학기</label>
                            <Select
                              value={newCourse.semester}
                              onChange={(value) => setNewCourse({ ...newCourse, semester: value })}
                              size="small"
                            >
                              {semesters.map((sem) => (
                                <option key={sem} value={sem}>{sem}</option>
                              ))}
                            </Select>
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">성적</label>
                            <Select
                              value={newCourse.grade}
                              onChange={(value) => setNewCourse({ ...newCourse, grade: value })}
                              size="small"
                            >
                              <option value="">선택</option>
                              {validGrades.map((grade) => (
                                <option key={grade} value={grade}>{grade}</option>
                              ))}
                            </Select>
                          </div>
                        </div>

                        {/* 추가 버튼 */}
                        <button
                          type="button"
                          onClick={addEnrollment}
                          className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors"
                        >
                          과목 추가
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 오른쪽: 수강한 과목 */}
                <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-zinc-900">
                  <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
                    수강한 과목 ({profile?.enrollments?.length ?? 0})
                  </h2>
                  <div className="space-y-2">
                    {(profile?.enrollments?.length ?? 0) === 0 ? (
                      <p className="rounded-lg bg-gray-50 py-8 text-center text-gray-500 dark:bg-zinc-800 dark:text-gray-400">
                        등록된 수강 과목이 없습니다.
                      </p>
                    ) : (
                      <ul className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
                        {(profile?.enrollments ?? []).map((e: any) => (
                          <li
                            key={e.id}
                            className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white truncate">
                                {e.course?.title || e.course?.name || e.courseName} ({e.course?.code || e.code || '코드 없음'})
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {e.course?.credit || e.credit || 3}학점
                                {e.course?.year && e.course?.semester && ` · ${e.course.year}년 ${e.course.semester}`}
                                {e.grade != null && ` · ${e.grade}`}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeEnrollment(e.id)}
                              className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50 whitespace-nowrap ml-3"
                            >
                              삭제
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
