'use client';

import { useState, useEffect } from 'react';
import { Input, NumberInput } from '../../components/formFields';
import { DepartmentDropdown, MultipleDepartmentDropdown } from '../../components/DepartmentDropdown';
import { API } from '../../lib/api';
import type { Profile } from './types';

interface ProfileForm {
  name: string;
  admissionYear: number;
  isFallAdmission: boolean;
  major: string;
  doubleMajors: string[];
  minors: string[];
  advancedMajor: boolean;
  individuallyDesignedMajor: boolean;
}

interface ProfileTabProps {
  profile: Profile | null;
  userId: string | null;
  onProfileUpdate: (p: Profile) => void;
}

export default function ProfileTab({ profile, userId, onProfileUpdate }: ProfileTabProps) {
  const [form, setForm] = useState<ProfileForm>({
    name: '',
    admissionYear: new Date().getFullYear(),
    isFallAdmission: false,
    major: '',
    doubleMajors: [],
    minors: [],
    advancedMajor: false,
    individuallyDesignedMajor: false,
  });
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      name: profile.name,
      admissionYear: profile.admissionYear,
      isFallAdmission: profile.isFallAdmission,
      major: profile.major,
      doubleMajors: profile.doubleMajors || [],
      minors: profile.minors || [],
      advancedMajor: profile.advancedMajor,
      individuallyDesignedMajor: profile.individuallyDesignedMajor,
    });
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    if (!form.name || !form.major) {
      alert('이름과 주전공을 입력해주세요.');
      return;
    }
    setProfileSubmitting(true);
    try {
      const res = await fetch(`${API}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId,
          name: form.name,
          admissionYear: form.admissionYear,
          isFallAdmission: form.isFallAdmission,
          major: form.major,
          doubleMajor: (() => {
            const valid = form.doubleMajors.filter((v) => v && v !== 'none' && v.trim() !== '');
            return valid.length > 0 ? valid : null;
          })(),
          minor: (() => {
            const valid = form.minors.filter((v) => v && v !== 'none' && v.trim() !== '');
            return valid.length > 0 ? valid : null;
          })(),
          advancedMajor: form.advancedMajor,
          individuallyDesignedMajor: form.individuallyDesignedMajor,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert('프로필이 수정되었습니다.');
        onProfileUpdate(data.profile ? { ...profile!, ...data.profile } : profile!);
      } else {
        alert(data.message || '프로필 수정에 실패했습니다.');
      }
    } catch {
      alert('서버 오류가 발생했습니다.');
    } finally {
      setProfileSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">프로필 수정</h1>
      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-zinc-900">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            이름 <span className="text-red-500">*</span>
          </label>
          <Input
            id="name"
            type="text"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            required
            placeholder="이름"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">학번</label>
          <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-600 dark:border-gray-700 dark:bg-zinc-800 dark:text-gray-400">
            {profile?.studentId}
          </p>
        </div>
        <div>
          <label htmlFor="admissionYear" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            입학연도 <span className="text-red-500">*</span>
          </label>
          <NumberInput
            id="admissionYear"
            min="2000"
            max="2030"
            value={String(form.admissionYear)}
            onChange={(v) => setForm((f) => ({ ...f, admissionYear: parseInt(v, 10) || 0 }))}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isFallAdmission"
            checked={form.isFallAdmission}
            onChange={(e) => setForm((f) => ({ ...f, isFallAdmission: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
          />
          <label htmlFor="isFallAdmission" className="text-sm text-gray-700 dark:text-gray-300">
            가을학기 입학
          </label>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            주전공 <span className="text-red-500">*</span>
          </label>
          <DepartmentDropdown
            value={form.major}
            onChange={(v) => setForm((f) => ({ ...f, major: v }))}
            mode="major"
            size="medium"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">복수전공</label>
          <MultipleDepartmentDropdown
            value={form.doubleMajors}
            onChange={(v) => setForm((f) => ({ ...f, doubleMajors: v }))}
            mode="doubleMajor"
            size="medium"
            className="min-w-40"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">부전공</label>
          <MultipleDepartmentDropdown
            value={form.minors}
            onChange={(v) => setForm((f) => ({ ...f, minors: v }))}
            mode="minor"
            size="medium"
            className="min-w-40"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="advancedMajor"
            checked={form.advancedMajor}
            onChange={(e) => setForm((f) => ({ ...f, advancedMajor: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
          />
          <label htmlFor="advancedMajor" className="text-sm text-gray-700 dark:text-gray-300">
            심화전공
          </label>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="individuallyDesignedMajor"
            checked={form.individuallyDesignedMajor}
            onChange={(e) => setForm((f) => ({ ...f, individuallyDesignedMajor: e.target.checked }))}
            className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
          />
          <label htmlFor="individuallyDesignedMajor" className="text-sm text-gray-700 dark:text-gray-300">
            자유융합전공
          </label>
        </div>
        <button
          type="submit"
          disabled={profileSubmitting}
          className="rounded-lg bg-violet-600 px-4 py-2 text-white hover:bg-violet-700 disabled:opacity-50"
        >
          저장하기
        </button>
      </form>
    </div>
  );
}
