'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "../components/formFields";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const loginHandler = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('loginHandler 실행됨', { email, password });
    fetch('http://localhost:4000/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .then(res => res.json())
    .then(data => {
      console.log('서버 응답:', data);
      if (data.success) {
        localStorage.setItem('userId', data.user.id);
        if (!data.hasProfile) {
          router.push('/profile/setup');
        } else {
          // alert(data.message || '로그인이 완료되었습니다!');
          router.push('/simulation');
        }
      } else {
        alert(data.message || '로그인에 실패했습니다.');
      }
    })
    .catch(err => {
      console.error('에러 발생:', err);
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
        <div>
          <h1 className="text-3xl font-bold text-center">졸업시뮬레이터</h1>
          <h2 className="mt-2 text-xl text-center text-gray-600 dark:text-gray-400">
            로그인
          </h2>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={loginHandler}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                이메일
              </label>
              <Input
                value={email}
                onChange={(newValue) => setEmail(newValue)}
                id="email"
                name="email"
                type="email"
                required
                placeholder="이메일을 입력하세요"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                비밀번호
              </label>
              <Input
                value={password}
                onChange={(newValue) => setPassword(newValue)}
                id="password"
                name="password"
                type="password"
                required
                placeholder="비밀번호를 입력하세요"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="w-full rounded-md bg-violet-600 px-4 py-2 text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
            >
              로그인
            </button>
          </div>

          <div className="text-center">
            <Link
              href="/signup"
              className="text-sm text-violet-600 hover:text-violet-500 dark:text-violet-400"
            >
              계정이 없으신가요? 회원가입
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
