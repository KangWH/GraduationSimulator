'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Tab, User, Profile } from './types';
import AccountTab from './AccountTab';
import ProfileTab from './ProfileTab';
import CoursesTab from './CoursesTab';
import { API } from '../../lib/api';

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const handler = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

function ProfileSettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDesktop = useIsDesktop();
  const [tab, setTab] = useState<Tab>('account');
  const [lang, setLang] = useState<'ko' | 'en'>('ko');
  const [xlsxHeaderAction, setXlsxHeaderAction] = useState<{ open: () => void; isApplying: boolean } | null>(null);
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
    if (tab !== 'courses') setXlsxHeaderAction(null);
  }, [tab]);

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
          router.push('/signup');
          return;
        }

        const p = profileRes.profile as Profile;
        // 필수 정보 확인: studentId, name, admissionYear, major
        if (!p.studentId || !p.name || !p.admissionYear || !p.major) {
          router.push('/signup');
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
    alert(lang === 'ko' ? '회원 탈퇴가 완료되었습니다.' : 'Account deleted successfully.');
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
        alert(data.message || (lang === 'ko' ? '로그아웃에 실패했습니다.' : 'Logout failed.'));
      }
    } catch (error) {
      console.error('로그아웃 오류:', error);
      alert(lang === 'ko' ? '로그아웃 중 오류가 발생했습니다.' : 'An error occurred while logging out.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] md:min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-gray-500 dark:text-gray-400">{lang === 'ko' ? '로딩 중…' : 'Loading…'}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] md:min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 dark:bg-black">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Link href="/simulation" className="text-violet-600 hover:underline">
          {lang === 'ko' ? '시뮬레이션으로 돌아가기' : 'Back to simulation'}
        </Link>
      </div>
    );
  }

  const menuItems: { key: Tab; labelKo: string; labelEn: string }[] = [
    { key: 'account', labelKo: '계정 정보', labelEn: 'Account' },
    { key: 'profile', labelKo: '프로필 수정', labelEn: 'Profile' },
    { key: 'courses', labelKo: '수강한 과목', labelEn: 'Courses' },
  ];

  return (
    <>
      {/* 데스크톱 버전 - courses 탭일 때는 h-screen으로 고정해 열별 스크롤 가능 */}
      {isDesktop && (
      <div className={`flex flex-col bg-gray-50 dark:bg-zinc-900 overflow-x-hidden ${tab === 'courses' ? 'h-screen' : 'min-h-screen'}`}>
        {/* 상단바 - 탭 네비게이션 중앙 */}
        <header className="relative sticky top-0 z-10 flex h-14 shrink-0 select-none items-center bg-white px-4 text-lg shadow-lg dark:bg-black">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Link
              href="/simulation"
              className="flex items-center justify-center w-10 h-10 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700 transition-all active:scale-85"
              aria-label={lang === 'ko' ? '돌아가기' : 'Back'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <span className="font-medium text-gray-700 dark:text-gray-300">{lang === 'ko' ? '프로필 설정' : 'Profile Settings'}</span>
          </div>
          <nav className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1">
            {menuItems.map(({ key, labelKo, labelEn }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`px-4 py-2 text-sm font-medium transition-all active:scale-95 ${
                  tab === key
                    ? 'opacity-100 border-b-2 border-violet-500 text-gray-900 dark:text-white'
                    : 'opacity-60 hover:opacity-80 text-gray-700 dark:text-gray-300'
                }`}
              >
                {lang === 'ko' ? labelKo : labelEn}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
            {tab === 'courses' && xlsxHeaderAction && (
              <button
                type="button"
                onClick={xlsxHeaderAction.open}
                disabled={xlsxHeaderAction.isApplying}
                className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {xlsxHeaderAction.isApplying ? (
                  lang === 'ko' ? '적용 중…' : 'Applying…'
                ) : (
                  lang === 'ko' ? '파일 업로드' : 'File upload'
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => setLang((l) => (l === 'ko' ? 'en' : 'ko'))}
              className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700 transition-colors"
              aria-label={lang === 'ko' ? '한국어' : 'English'}
            >
              {lang === 'ko' ? '한국어' : 'English'}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {lang === 'ko' ? '로그아웃' : 'Log out'}
            </button>
          </div>
        </header>

        {/* 본문 */}
        <main className={"flex-1 flex flex-col " + (tab === 'courses' ? 'min-h-0' : '')}>
          <div className={"mx-auto w-full max-w-2xl px-6 " + (tab === 'courses' ? 'flex-1 min-h-0 md:max-w-6xl flex flex-col pt-6 pb-0' : 'py-6')}>
            {tab === 'account' && (
              <AccountTab
                lang={lang}
                user={user}
                userId={userId}
                onDeleteSuccess={handleDeleteSuccess}
              />
            )}

            {tab === 'profile' && (
              <ProfileTab
                lang={lang}
                profile={profile}
                userId={userId}
                onProfileUpdate={setProfile}
              />
            )}

            {tab === 'courses' && (
              <CoursesTab
                lang={lang}
                profile={profile}
                userId={userId}
                onProfileUpdate={setProfile}
                onRegisterXlsxHeader={setXlsxHeaderAction}
              />
            )}
          </div>
        </main>
      </div>
      )}

      {/* 모바일 버전 */}
      {!isDesktop && (
      <div className="bg-gray-50 dark:bg-black">
        {/* 상단바 */}
        <div className="sticky top-0 z-20 select-none backdrop-blur-md">
          <div className="p-2 flex flex-row items-center">
            <div className="w-28 shrink-0 flex justify-start">
              <Link
                href="/simulation"
                className="px-2 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 active:bg-gray-100 dark:active:bg-zinc-800 rounded-lg active:scale-85 transition-all flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
            </div>
            <h1 className="flex-1 text-center text-lg font-semibold text-gray-900 dark:text-gray-100 p-1">{lang === 'ko' ? '프로필 설정' : 'Profile Settings'}</h1>
            <div className="w-28 shrink-0 flex items-center gap-1 justify-end">
              {tab === 'courses' && xlsxHeaderAction && (
                <button
                  type="button"
                  onClick={xlsxHeaderAction.open}
                  disabled={xlsxHeaderAction.isApplying}
                  className="flex items-center justify-center p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800 rounded-lg active:scale-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={lang === 'ko' ? '파일 업로드' : 'File upload'}
                >
                  {xlsxHeaderAction.isApplying ? (
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="14" width="16" height="6" />
                      <path d="M12 14V6" />
                      <path d="M9 9l3-3 3 3" />
                    </svg>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => setLang((l) => (l === 'ko' ? 'en' : 'ko'))}
                className="flex items-center justify-center p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800 rounded-lg active:scale-90 transition-colors"
                aria-label={lang === 'ko' ? '한국어' : 'English'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </button>
              <button
                onClick={handleLogout}
                className="px-2 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 active:bg-gray-100 dark:active:bg-zinc-800 rounded-lg active:scale-90 transition-all"
                aria-label={lang === 'ko' ? '로그아웃' : 'Log out'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* 본문 영역 */}
        <div className={'pt-2 pb-20 ' + (tab === 'courses' ? 'px-2' : 'px-4')}>
          {tab === 'account' && (
            <AccountTab
              lang={lang}
              user={user}
              userId={userId}
              onDeleteSuccess={handleDeleteSuccess}
            />
          )}

          {tab === 'profile' && (
            <ProfileTab
              lang={lang}
              profile={profile}
              userId={userId}
              onProfileUpdate={setProfile}
            />
          )}

          {tab === 'courses' && (
            <CoursesTab
              lang={lang}
              profile={profile}
              userId={userId}
              onProfileUpdate={setProfile}
              onRegisterXlsxHeader={setXlsxHeaderAction}
            />
          )}
        </div>

        {/* 하단 내비게이션 */}
        <div className="fixed bottom-0 left-0 right-0 z-30 px-2 pt-2 pb-1 flex justify-center pointer-events-none">
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
              <span className="text-xs font-medium">{lang === 'ko' ? '계정' : 'Account'}</span>
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
              <span className="text-xs font-medium">{lang === 'ko' ? '프로필' : 'Profile'}</span>
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
              <span className="text-xs font-medium">{lang === 'ko' ? '과목' : 'Courses'}</span>
            </button>
          </nav>
        </div>
      </div>
      )}
    </>
  );
}

export default function ProfileSettingsPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[50vh] md:min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-gray-500 dark:text-gray-400">Loading…</p>
      </div>
    }>
      <ProfileSettingsContent />
    </Suspense>
  );
}
