'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input, NumberInput, Select } from '../../components/formFields';
import { DepartmentDropdown, MultipleDepartmentDropdown } from '../../components/DepartmentDropdown';
import { API } from '../../lib/api';
import Logo from '@/app/components/Logo';

export default function ProfileSetupPage() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [formData, setFormData] = useState({
    studentId: '',
    name: '',
    admissionYear: new Date().getFullYear(),
    isFallAdmission: false,
    major: '',
    doubleMajors: [] as string[],
    minors: [] as string[],
    advancedMajor: false,
    individuallyDesignedMajor: false,
  });

  // 인증 확인
  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          router.push('/login');
        } else {
          setIsCheckingAuth(false);
        }
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.studentId || !formData.major || !formData.admissionYear) {
      alert('학번, 전공학과, 입학연도를 모두 입력해주세요.');
      return;
    }
    try {
      // 유효한 값만 필터링 (빈 문자열, "none" 제거)
      const validDoubleMajors = formData.doubleMajors.filter((v) => v && v !== 'none' && v.trim() !== '');
      const validMinors = formData.minors.filter((v) => v && v !== 'none' && v.trim() !== '');

      const res = await fetch(`${API}/profile`, {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name,
          studentId: formData.studentId,
          admissionYear: Number(formData.admissionYear),
          isFallAdmission: formData.isFallAdmission,
          major: formData.major,
          doubleMajor: validDoubleMajors.length > 0 ? validDoubleMajors : null,
          minor: validMinors.length > 0 ? validMinors : null,
          advancedMajor: formData.advancedMajor,
          individuallyDesignedMajor: formData.individuallyDesignedMajor,
        }),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        alert('기본 정보가 저장되었습니다!');
        router.push('/simulation');
      } else {
        alert(data.message || '정보 저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('에러 발생:', err);
      alert('서버 오류가 발생했습니다.');
    }
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
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black py-12 px-4">
      <div className="w-full max-w-2xl space-y-8 rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
        <div>
          <h1 className="text-3xl font-bold text-center" style={{ fontFamily: 'var(--font-logo)', fontWeight: 'var(--font-weight-logo)' }}><Logo language="en" /></h1>
          <p className="text-center mt-4">KAIST 졸업 사정 시뮬레이터</p>
          <h2 className="mt-8 text-xl text-center text-gray-600 dark:text-gray-400">기본 정보 입력</h2>
          <p className="mt-2 text-sm text-center text-gray-500 dark:text-gray-400">
            최초 로그인 시 기본 정보를 입력해주세요.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="studentId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                학번 <span className="text-red-500">*</span>
              </label>
              <Input
                id="studentId"
                name="studentId"
                type="text"
                value={formData.studentId}
                onChange={(v) => setFormData((p) => ({ ...p, studentId: v }))}
                required
                placeholder="학번을 입력하세요"
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                이름 <span className="text-red-500">*</span>
              </label>
              <Input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={(v) => setFormData((p) => ({ ...p, name: v }))}
                required
              />
            </div>
            <div>
              <label htmlFor="admissionYear" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                입학연도 <span className="text-red-500">*</span>
              </label>
              <NumberInput
                id="admissionYear"
                name="admissionYear"
                min="2000"
                max="2030"
                value={String(formData.admissionYear)}
                onChange={(v) => setFormData((p) => ({ ...p, admissionYear: Number(v) || 0 }))}
                required
              />
            </div>
            <div>
              <label htmlFor="isFallAdmission" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                가을학기 입학
              </label>
              <Select
                id="isFallAdmission"
                value={formData.isFallAdmission ? 'true' : 'false'}
                onChange={(v) => setFormData((p) => ({ ...p, isFallAdmission: v === 'true' }))}
              >
                <option value="false">아니오</option>
                <option value="true">예</option>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                전공학과 <span className="text-red-500">*</span>
              </label>
              <DepartmentDropdown
                value={formData.major}
                onChange={(v) => setFormData((p) => ({ ...p, major: v }))}
                mode="major"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">복수전공</label>
              <MultipleDepartmentDropdown
                value={formData.doubleMajors}
                onChange={(v) => setFormData((p) => ({ ...p, doubleMajors: v }))}
                mode="doubleMajor"
                allowNone
                className="min-w-40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">부전공</label>
              <MultipleDepartmentDropdown
                value={formData.minors}
                onChange={(v) => setFormData((p) => ({ ...p, minors: v }))}
                mode="minor"
                allowNone
                className="min-w-40"
              />
            </div>
            <div>
              <label htmlFor="advancedMajor" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                심화전공
              </label>
              <Select
                id="advancedMajor"
                value={formData.advancedMajor ? 'true' : 'false'}
                onChange={(v) => setFormData((p) => ({ ...p, advancedMajor: v === 'true' }))}
              >
                <option value="false">아니오</option>
                <option value="true">예</option>
              </Select>
            </div>
            <div>
              <label htmlFor="individuallyDesignedMajor" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                자유융합전공
              </label>
              <Select
                id="individuallyDesignedMajor"
                value={formData.individuallyDesignedMajor ? 'true' : 'false'}
                onChange={(v) => setFormData((p) => ({ ...p, individuallyDesignedMajor: v === 'true' }))}
              >
                <option value="false">아니오</option>
                <option value="true">예</option>
              </Select>
            </div>
          </div>
          <div>
            <button
              type="submit"
              className="w-full rounded-md bg-violet-600 px-4 py-2 text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
            >
              저장하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
