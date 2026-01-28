'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Tab, User, Profile } from './types';
import AccountTab from './AccountTab';
import ProfileTab from './ProfileTab';
import CoursesTab from './CoursesTab';
import { API } from '../../lib/api';

function ProfileSettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>('account');
  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // URL 쿼리 파라미터에서 탭 설정
    const tabParam = searchParams.get('tab');
    if (tabParam && ['account', 'profile', 'courses'].includes(tabParam)) {
      setTab(tabParam as Tab);
    }
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`${API}/auth/me`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`${API}/profile`, { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([meRes, profileRes]) => {
        if (!meRes.success) {
          if (meRes.message?.includes('인증')) {
            router.push('/login');
            return;
          }
          setError(meRes.message || '인증에 실패했습니다.');
          return;
        }

        // 프로필이 없거나 필수 정보가 없으면 setup 페이지로 리다이렉트
        if (!profileRes.success || !profileRes.profile) {
          router.push('/profile/setup');
          return;
        }

        const p = profileRes.profile as Profile;
        // 필수 정보 확인: studentId, name, admissionYear, major
        if (!p.studentId || !p.name || !p.admissionYear || !p.major) {
          router.push('/profile/setup');
          return;
        }

        setUser(meRes.user);
        setProfile(p);
        setUserId(meRes.user?.id || null);
      })
      .catch((err) => {
        setError(err?.message || '서버 오류');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const handleDeleteSuccess = () => {
    // 쿠키는 서버에서 삭제되므로 여기서는 리다이렉트만 수행
    alert('회원 탈퇴가 완료되었습니다.');
    router.push('/login');
  };

  const handleLogout = async () => {
    try {
      const res = await fetch(`${API}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        router.push('/login');
      } else {
        alert(data.message || '로그아웃에 실패했습니다.');
      }
    } catch (error) {
      console.error('로그아웃 오류:', error);
      alert('로그아웃 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
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
    <>
      {/* 데스크톱 버전 */}
      <div className="hidden md:flex h-screen bg-gray-50 dark:bg-black overflow-hidden select-none">
        <aside className="w-48 flex-shrink-0 bg-white dark:bg-zinc-900 shadow-[0.1rem_0_1rem_rgba(0,0,0,0.1)] dark:shadow-[0.2rem_0_2rem_rgba(255,255,255,0.2)] flex flex-col h-full">
          <div className="p-4 active:scale-90 transition-all">
            <Link href="/simulation" className="text-sm text-violet-600 dark:text-violet-400">
              ← 시뮬레이션
            </Link>
          </div>
          <nav className="p-2 space-y-1 flex-1">
            {menuItems.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`w-full rounded-lg px-4 py-2.5 text-left text-sm active:scale-90 transition-all ${
                  tab === key
                    ? 'bg-violet-100 font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="p-4">
            <button
              onClick={handleLogout}
              className="w-full rounded-lg px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800 active:scale-90 transition-all"
            >
              로그아웃
            </button>
          </div>
        </aside>

        <main className={"flex-1 p-6" + (tab === 'courses' ? ' overflow-hidden md:px-8 md:pt-8 md:py-0' : ' overflow-y-auto md:p-8')}>
          <div className={"mx-auto max-w-2xl " + (tab === 'courses' ? 'h-full lg:max-w-6xl overflow-hidden' : '')}>
            {tab === 'account' && (
              <AccountTab
                user={user}
                userId={userId}
                onDeleteSuccess={handleDeleteSuccess}
              />
            )}

            {tab === 'profile' && (
              <ProfileTab
                profile={profile}
                userId={userId}
                onProfileUpdate={setProfile}
              />
            )}

            {tab === 'courses' && (
              <CoursesTab
                profile={profile}
                userId={userId}
                onProfileUpdate={setProfile}
              />
            )}
          </div>
        </main>
      </div>

      {/* 모바일 버전 */}
      <div className="md:hidden min-h-screen bg-gray-50 dark:bg-black pb-24">
        {/* 상단바 */}
        <div className="sticky top-0 z-20 backdrop-blur-md">
          <div className="p-2 flex flex-row justify-between items-center">
            <Link
              href="/simulation"
              className="px-2 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 active:bg-gray-100 dark:active:bg-zinc-800 rounded-lg active:scale-90 transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 p-1">프로필 설정</h1>
            <button
              onClick={handleLogout}
              className="px-2 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 active:bg-gray-100 dark:active:bg-zinc-800 rounded-lg active:scale-90 transition-all"
              aria-label="로그아웃"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* 본문 영역 */}
        <div className="p-4 pb-24">
          {tab === 'account' && (
            <AccountTab
              user={user}
              userId={userId}
              onDeleteSuccess={handleDeleteSuccess}
            />
          )}

          {tab === 'profile' && (
            <ProfileTab
              profile={profile}
              userId={userId}
              onProfileUpdate={setProfile}
            />
          )}

          {tab === 'courses' && (
            <CoursesTab
              profile={profile}
              userId={userId}
              onProfileUpdate={setProfile}
            />
          )}
        </div>

        {/* 하단 내비게이션 */}
        <div className="fixed bottom-0 left-0 right-0 z-30 p-2 flex justify-center pointer-events-none">
          <nav className="p-1 flex flex-row backdrop-blur-md pointer-events-auto rounded-full bg-white/50 dark:bg-zinc-900/50 shadow-lg">
            <button
              onClick={() => setTab('account')}
              className={`w-24 flex-1 flex flex-col items-center justify-center py-2 px-1 min-h-[60px] transition-all active:scale-85 rounded-full ${
                tab === 'account'
                  ? 'text-violet-600 dark:text-violet-400 bg-violet-100/50 dark:bg-violet-900/20'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-xs font-medium">계정</span>
            </button>
            <button
              onClick={() => setTab('profile')}
              className={`w-24 flex-1 flex flex-col items-center justify-center py-2 px-1 min-h-[60px] transition-all active:scale-85 rounded-full ${
                tab === 'profile'
                  ? 'text-violet-600 dark:text-violet-400 bg-violet-100/50 dark:bg-violet-900/20'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="text-xs font-medium">프로필</span>
            </button>
            <button
              onClick={() => setTab('courses')}
              className={`w-24 flex-1 flex flex-col items-center justify-center py-2 px-1 min-h-[60px] transition-all active:scale-85 rounded-full ${
                tab === 'courses'
                  ? 'text-violet-600 dark:text-violet-400 bg-violet-100/50 dark:bg-violet-900/20'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="text-xs font-medium">과목</span>
            </button>
          </nav>
        </div>
      </div>
    </>
  );
}

export default function ProfileSettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-gray-500 dark:text-gray-400">로딩 중…</p>
      </div>
    }>
      <ProfileSettingsContent />
    </Suspense>
  );
}
