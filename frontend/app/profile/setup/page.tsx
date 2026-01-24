'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfileSetupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    studentId: '',
    name: '', // 이름은 Profile에 없지만 UI에 포함
    admissionYear: new Date().getFullYear(),
    isFallAdmission: false,
    major: '',
    doubleMajor: '',
    minor: '',
    advancedMajor: false,
    individuallyDesignedMajor: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // 필수 필드 검증
    if (!formData.studentId || !formData.major || !formData.admissionYear) {
      alert('학번, 전공학과, 입학연도를 모두 입력해주세요.');
      return;
    }

    try {
      // localStorage에서 userId 가져오기 (임시, 나중에 JWT로 변경)
      const userId = localStorage.getItem('userId');
      if (!userId) {
        alert('로그인이 필요합니다.');
        router.push('/login');
        return;
      }

      const res = await fetch('http://localhost:4000/profile', {
        method: 'POST',
        body: JSON.stringify({
          userId,
          name: formData.name,
          studentId: formData.studentId,
          admissionYear: parseInt(formData.admissionYear.toString()),
          isFallAdmission: formData.isFallAdmission,
          major: formData.major,
          doubleMajor: formData.doubleMajor || null,
          minor: formData.minor || null,
          advancedMajor: formData.advancedMajor,
          individuallyDesignedMajor: formData.individuallyDesignedMajor,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // 쿠키 포함
      });

      const data = await res.json();
      console.log('서버 응답:', data);

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black py-12 px-4">
      <div className="w-full max-w-2xl space-y-8 rounded-lg bg-white p-8 shadow-lg dark:bg-zinc-900">
        <div>
          <h1 className="text-3xl font-bold text-center">졸업시뮬레이터</h1>
          <h2 className="mt-2 text-xl text-center text-gray-600 dark:text-gray-400">
            기본 정보 입력
          </h2>
          <p className="mt-2 text-sm text-center text-gray-500 dark:text-gray-400">
            최초 로그인 시 기본 정보를 입력해주세요.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* 학번 */}
            <div>
              <label htmlFor="studentId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                학번 <span className="text-red-500">*</span>
              </label>
              <input
                id="studentId"
                name="studentId"
                type="text"
                value={formData.studentId}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                placeholder="학번을 입력하세요"
              />
            </div>

            {/* 이름 */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
              />
            </div>

            {/* 입학연도 */}
            <div>
              <label htmlFor="admissionYear" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                입학연도 <span className="text-red-500">*</span>
              </label>
              <input
                id="admissionYear"
                name="admissionYear"
                type="number"
                min="2000"
                max="2030"
                value={formData.admissionYear}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
              />
            </div>

            {/* 추가입학 여부 */}
            <div className="flex items-center">
              <input
                id="isFallAdmission"
                name="isFallAdmission"
                type="checkbox"
                checked={formData.isFallAdmission}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="isFallAdmission" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                가을학기 입학
              </label>
            </div>

            {/* 전공학과 */}
            <div>
              <label htmlFor="major" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                전공학과 <span className="text-red-500">*</span>
              </label>
              <input
                id="major"
                name="major"
                type="text"
                value={formData.major}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                placeholder="전공학과를 입력하세요"
              />
            </div>

            {/* 복수전공 */}
            <div>
              <label htmlFor="doubleMajor" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                복수전공
              </label>
              <input
                id="doubleMajor"
                name="doubleMajor"
                type="text"
                value={formData.doubleMajor}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                placeholder="복수전공이 있으면 입력하세요"
              />
            </div>

            {/* 부전공 */}
            <div>
              <label htmlFor="minor" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                부전공
              </label>
              <input
                id="minor"
                name="minor"
                type="text"
                value={formData.minor}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-600 dark:bg-zinc-800 dark:text-white"
                placeholder="부전공이 있으면 입력하세요"
              />
            </div>

            {/* 심화전공 */}
            <div className="flex items-center">
              <input
                id="advancedMajor"
                name="advancedMajor"
                type="checkbox"
                checked={formData.advancedMajor}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="advancedMajor" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                심화전공
              </label>
            </div>

            {/* 자유전공 */}
            <div className="flex items-center">
              <input
                id="individuallyDesignedMajor"
                name="individuallyDesignedMajor"
                type="checkbox"
                checked={formData.individuallyDesignedMajor}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="individuallyDesignedMajor" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                자유전공 (개별설계전공)
              </label>
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              저장하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
