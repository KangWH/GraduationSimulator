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
  lang?: 'ko' | 'en';
  profile: Profile | null;
  userId: string | null;
  onProfileUpdate: (p: Profile) => void;
}

export default function ProfileTab({ lang = 'ko', profile, userId, onProfileUpdate }: ProfileTabProps) {
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
    if (!form.name || !form.major) {
      alert(lang === 'ko' ? '이름과 주전공을 입력해주세요.' : 'Please enter your name and major.');
      return;
    }
    setProfileSubmitting(true);
    try {
      const res = await fetch(`${API}/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
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
        alert(lang === 'ko' ? '프로필이 수정되었습니다.' : 'Profile updated successfully.');
        onProfileUpdate(data.profile ? { ...profile!, ...data.profile } : profile!);
      } else {
        alert(data.message || (lang === 'ko' ? '프로필 수정에 실패했습니다.' : 'Failed to update profile.'));
      }
    } catch {
      alert(lang === 'ko' ? '서버 오류가 발생했습니다.' : 'A server error occurred.');
    } finally {
      setProfileSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">{lang === 'ko' ? '프로필 수정' : 'Edit profile'}</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {lang === 'ko' ? '이름' : 'Name'} <span className="text-red-500">*</span>
          </label>
          <Input
            id="name"
            type="text"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            required
            placeholder={lang === 'ko' ? '이름' : 'Name'}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{lang === 'ko' ? '학번' : 'Student ID'}</label>
          <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-600 dark:border-gray-700 dark:bg-zinc-800 dark:text-gray-400 shadow-sm">
            {profile?.studentId}
          </p>
        </div>
        <div>
          <label htmlFor="admissionYear" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {lang === 'ko' ? '입학연도' : 'Admission year'} <span className="text-red-500">*</span>
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
            {lang === 'ko' ? '가을학기 입학' : 'Fall admission'}
          </label>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            {lang === 'ko' ? '주전공' : 'Major'} <span className="text-red-500">*</span>
          </label>
          <DepartmentDropdown
            lang={lang}
            value={form.major}
            onChange={(v) => setForm((f) => ({ ...f, major: v }))}
            mode="major"
            size="medium"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{lang === 'ko' ? '복수전공' : 'Double major'}</label>
          <MultipleDepartmentDropdown
            lang={lang}
            value={form.doubleMajors}
            onChange={(v) => setForm((f) => ({ ...f, doubleMajors: v }))}
            mode="doubleMajor"
            size="medium"
            className="min-w-40"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{lang === 'ko' ? '부전공' : 'Minor'}</label>
          <MultipleDepartmentDropdown
            lang={lang}
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
            {lang === 'ko' ? '심화전공' : 'Advanced major'}
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
            {lang === 'ko' ? '자유융합전공' : 'Individually designed major'}
          </label>
        </div>
        <button
          type="submit"
          disabled={profileSubmitting}
          className="rounded-lg bg-violet-600 px-4 py-2 text-white hover:bg-violet-700 disabled:opacity-50 active:scale-90 transition-all"
        >
          {lang === 'ko' ? '저장하기' : 'Save'}
        </button>
      </form>
    </div>
  );
}
