'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "../../components/formFields";
import { API } from "@/app/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [adminId, setAdminId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const loginHandler = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetch(`${API}/admin/login`, {
      method: 'POST',
      body: JSON.stringify({ adminId, adminPassword }),
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        localStorage.setItem('adminAuthenticated', 'true');
        router.push('/admin');
      } else {
        alert(data.message || '로그인에 실패했습니다.');
      }
    })
    .catch(err => {
      console.error('에러 발생:', err);
      alert('로그인 중 오류가 발생했습니다.');
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
        <div>
          <h1 className="text-3xl font-bold text-center" style={{ fontFamily: 'var(--font-logo)', fontWeight: 'var(--font-weight-logo)' }}>grad.log</h1>
          <p className="text-center mt-4">KAIST 졸업 사정 시뮬레이터</p>
          <h2 className="mt-8 text-xl text-center text-gray-600 dark:text-gray-400">
            관리자 로그인
          </h2>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={loginHandler}>
          <div className="space-y-4">
            <div>
              <label htmlFor="adminId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                관리자 ID
              </label>
              <Input
                value={adminId}
                onChange={(newValue) => setAdminId(newValue)}
                id="adminId"
                name="adminId"
                type="text"
                required
                placeholder="관리자 ID를 입력하세요"
              />
            </div>
            
            <div>
              <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                비밀번호
              </label>
              <Input
                value={adminPassword}
                onChange={(newValue) => setAdminPassword(newValue)}
                id="adminPassword"
                name="adminPassword"
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
        </form>
      </div>
    </div>
  );
}
