'use client';

import { useState, useEffect } from 'react';
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
        <div className="mx-auto max-w-2xl">
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
              <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-zinc-900">
                <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  수강한 과목을 조회·삭제할 수 있습니다. 과목 추가 기능은 추후 제공됩니다.
                </p>
                {(profile?.enrollments?.length ?? 0) === 0 ? (
                  <p className="rounded-lg bg-gray-50 py-8 text-center text-gray-500 dark:bg-zinc-800 dark:text-gray-400">
                    등록된 수강 과목이 없습니다.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {(profile?.enrollments ?? []).map((e) => (
                      <li
                        key={e.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 dark:border-gray-700"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {e.course.title} ({e.course.code})
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {e.course.credit}학점 · {e.course.year}년 {e.course.semester}학기
                            {e.grade != null && ` · ${e.grade}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeEnrollment(e.id)}
                          className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
                        >
                          삭제
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
