'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProfileSetupPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/signup');
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <p className="text-gray-500 dark:text-gray-400">이동 중…</p>
    </div>
  );
}
