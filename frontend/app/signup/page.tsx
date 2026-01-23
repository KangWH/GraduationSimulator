'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const signupHandler = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // 비밀번호 확인 검증
    if (password !== passwordConfirm) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }
    
    fetch('http://localhost:4000/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .then(async (res) => {
      const data = await res.json();
      console.log('서버 응답:', data);
      
      if (data.success) {
        alert(data.message || '회원가입이 완료되었습니다!');
        // 로그인 페이지로 리다이렉트
        router.push('/login');
      } else {
        alert(data.message || '회원가입에 실패했습니다.');
      }
    })
    .catch(err => {
      console.error('에러 발생:', err);
      alert('서버 오류가 발생했습니다.');
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
        <div>
          <h1 className="text-3xl font-bold text-center">졸업시뮬레이터</h1>
          <h2 className="mt-2 text-xl text-center text-gray-600 dark:text-gray-400">
            회원가입
          </h2>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={signupHandler}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                이메일
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                placeholder="이메일을 입력하세요"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                비밀번호
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                placeholder="비밀번호를 입력하세요"
              />
            </div>

            <div>
              <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                비밀번호 확인
              </label>
              <input
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                id="passwordConfirm"
                name="passwordConfirm"
                type="password"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                placeholder="비밀번호를 다시 입력하세요"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              회원가입
            </button>
          </div>

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              이미 계정이 있으신가요? 로그인
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
