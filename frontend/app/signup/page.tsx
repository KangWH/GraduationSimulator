'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '../components/formFields';
import { API } from '../lib/api';
import Logo from '../components/Logo';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [logoLanguage, setLogoLanguage] = useState<'ko' | 'en'>('en');
  const [prevLogoLanguage, setPrevLogoLanguage] = useState<'ko' | 'en' | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 로고 언어 전환 (6초마다)
  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setPrevLogoLanguage(logoLanguage);
      setTimeout(() => {
        setLogoLanguage((prev) => (prev === 'ko' ? 'en' : 'ko'));
        setTimeout(() => {
          setIsTransitioning(false);
          setPrevLogoLanguage(null);
        }, 700);
      }, 50);
    }, 6000);
    return () => clearInterval(interval);
  }, [logoLanguage]);

  // 이미 로그인된 경우 시뮬레이션 페이지로 리다이렉트
  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          // 이미 로그인되어 있으면 시뮬레이션 페이지로 이동
          router.push('/simulation');
        } else {
          setIsCheckingAuth(false);
        }
      })
      .catch(() => {
        setIsCheckingAuth(false);
      });
  }, [router]);

  const signupHandler = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (password !== passwordConfirm) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }
    fetch(`${API}/auth/signup`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: { 'Content-Type': 'application/json' },
    })
      .then(async (res) => {
        const data = await res.json();
        if (data.success) {
          alert(data.message || '회원가입이 완료되었습니다!');
          router.push('/login');
        } else {
          alert(data.message || '회원가입에 실패했습니다.');
        }
      })
      .catch((err) => {
        console.error('에러 발생:', err);
        alert('서버 오류가 발생했습니다.');
      });
  };

  // 인증 확인 중일 때는 로딩 표시
  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-gray-500 dark:text-gray-400">로딩 중…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
      <div>
          <h1 className="text-3xl font-bold text-center" style={{ fontFamily: 'var(--font-logo)', fontWeight: 'var(--font-weight-logo)' }}>
            <div className="relative" style={{ minHeight: '1.5em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {prevLogoLanguage !== null && (
                <div 
                  key={`prev-${prevLogoLanguage}`}
                  className="absolute"
                  style={{ 
                    animation: 'fadeOutSide 0.7s ease-in-out forwards',
                  }}
                >
                  <Logo language={prevLogoLanguage} />
                </div>
              )}
              <div 
                key={`current-${logoLanguage}`}
                className="absolute"
                style={{ 
                  animation: isTransitioning ? 'fadeInSide 0.7s ease-in-out forwards' : 'none',
                  opacity: isTransitioning ? 0 : 1,
                }}
              >
                <Logo language={logoLanguage} />
              </div>
            </div>
          </h1>
          <style jsx global>{`
            @keyframes fadeInSide {
              from {
                opacity: 0;
                transform: translateX(-10px);
              }
              to {
                opacity: 1;
                transform: translateX(0);
              }
            }
            @keyframes fadeOutSide {
              from {
                opacity: 1;
                transform: translateX(0);
              }
              to {
                opacity: 0;
                transform: translateX(10px);
              }
            }
          `}</style>
          <p className="text-center mt-4">KAIST 졸업 사정 시뮬레이터</p>
          <h2 className="mt-8 text-xl text-center text-gray-600 dark:text-gray-400">
            회원가입
          </h2>
        </div>

        <form className="mt-8 space-y-6" onSubmit={signupHandler}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                이메일
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(v) => setEmail(v)}
                required
                placeholder="이메일을 입력하세요"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                비밀번호
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(v) => setPassword(v)}
                required
                placeholder="비밀번호를 입력하세요"
              />
            </div>
            <div>
              <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                비밀번호 확인
              </label>
              <Input
                id="passwordConfirm"
                name="passwordConfirm"
                type="password"
                value={passwordConfirm}
                onChange={(v) => setPasswordConfirm(v)}
                required
                placeholder="비밀번호를 다시 입력하세요"
              />
            </div>
          </div>
          <div>
            <button
              type="submit"
              className="w-full rounded-md bg-violet-600 px-4 py-2 text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 active:scale-96 transition-all shadow-md"
            >
              회원가입
            </button>
          </div>
          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-violet-600 hover:text-violet-500 dark:text-violet-400"
            >
              이미 계정이 있으신가요? 로그인
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
