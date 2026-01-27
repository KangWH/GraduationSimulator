'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Tab, User, Profile } from './types';
import AccountTab from './AccountTab';
import ProfileTab from './ProfileTab';
import CoursesTab from './CoursesTab';
import { API } from '../../lib/api';

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('account');
  const [userId, setUserId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetch(`${API}/auth/me`, { credentials: 'include' }).then((r) => r.json()),
      fetch(`${API}/profile`, { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([meRes, profileRes]) => {
        if (!meRes.success || !profileRes.success) {
          if (meRes.message?.includes('인증') || profileRes.message?.includes('인증')) {
            router.push('/login');
            return;
          }
          setError(meRes.message || profileRes.message || '데이터를 불러오지 못했습니다.');
          return;
        }
        setUser(meRes.user);
        setProfile(profileRes.profile as Profile);
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
    <div className="flex h-screen bg-zinc-50 dark:bg-black overflow-hidden">
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

      <main className={"flex-1 p-6 md:p-8" + (tab === 'courses' ? ' overflow-hidden' : ' overflow-y-auto')}>
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
  );
}
