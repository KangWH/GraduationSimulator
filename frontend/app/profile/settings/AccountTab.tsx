'use client';

import { useState } from 'react';
import { Input } from '../../components/formFields';
import Button from '../../components/Button';
import { API } from '../../lib/api';

interface AccountTabProps {
  lang?: 'ko' | 'en';
  user: { email?: string } | null;
  userId: string | null;
  onDeleteSuccess: () => void;
}

export default function AccountTab({ lang = 'ko', user, userId, onDeleteSuccess }: AccountTabProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [accountSubmitting, setAccountSubmitting] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== newPasswordConfirm) {
      alert(lang === 'ko' ? '새 비밀번호가 일치하지 않습니다.' : 'New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      alert(lang === 'ko' ? '새 비밀번호는 최소 6자 이상이어야 합니다.' : 'Password must be at least 6 characters.');
      return;
    }
    setAccountSubmitting(true);
    try {
      const res = await fetch(`${API}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        alert(lang === 'ko' ? '비밀번호가 변경되었습니다.' : 'Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setNewPasswordConfirm('');
      } else {
        alert(data.message || (lang === 'ko' ? '비밀번호 변경에 실패했습니다.' : 'Failed to change password.'));
      }
    } catch {
      alert(lang === 'ko' ? '서버 오류가 발생했습니다.' : 'A server error occurred.');
    } finally {
      setAccountSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      alert(lang === 'ko' ? '비밀번호를 입력해주세요.' : 'Please enter your password.');
      return;
    }
    if (!confirm(lang === 'ko' ? '정말 회원 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.' : 'Are you sure you want to delete your account? This cannot be undone.')) return;
    setAccountSubmitting(true);
    try {
      const res = await fetch(`${API}/auth/delete-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (data.success) {
        onDeleteSuccess();
      } else {
        alert(data.message || (lang === 'ko' ? '회원 탈퇴에 실패했습니다.' : 'Failed to delete account.'));
      }
    } catch {
      alert(lang === 'ko' ? '서버 오류가 발생했습니다.' : 'A server error occurred.');
    } finally {
      setAccountSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">{lang === 'ko' ? '계정 정보' : 'Account'}</h1>
      <div className="space-y-1">
        <label className="text-sm font-medium text-gray-500 dark:text-gray-400">{lang === 'ko' ? '이메일' : 'Email'}</label>
        <p className="text-gray-900 dark:text-white">{user?.email}</p>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-200">{lang === 'ko' ? '비밀번호 변경' : 'Change password'}</h2>
        <form onSubmit={handleChangePassword} className="space-y-4 rounded-lg bg-white p-6 dark:bg-zinc-900 shadow-lg">
          <div>
            <label htmlFor="currentPassword" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {lang === 'ko' ? '현재 비밀번호' : 'Current password'}
            </label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={setCurrentPassword}
              required
              placeholder={lang === 'ko' ? '현재 비밀번호' : 'Current password'}
            />
          </div>
          <div>
            <label htmlFor="newPassword" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {lang === 'ko' ? '새 비밀번호' : 'New password'}
            </label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={setNewPassword}
              required
              placeholder={lang === 'ko' ? '새 비밀번호 (6자 이상)' : 'New password (6+ characters)'}
            />
          </div>
          <div>
            <label htmlFor="newPasswordConfirm" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {lang === 'ko' ? '새 비밀번호 확인' : 'Confirm new password'}
            </label>
            <Input
              id="newPasswordConfirm"
              type="password"
              value={newPasswordConfirm}
              onChange={setNewPasswordConfirm}
              required
              placeholder={lang === 'ko' ? '새 비밀번호 다시 입력' : 'Re-enter new password'}
            />
          </div>
          <Button
            type="submit"
            style="prominent"
            size="medium"
            disabled={accountSubmitting}
          >
            {lang === 'ko' ? '비밀번호 변경' : 'Change password'}
          </Button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-red-600 dark:text-red-400">{lang === 'ko' ? '회원 탈퇴' : 'Delete account'}</h2>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/30 shadow-lg">
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            {lang === 'ko' ? '탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다.' : 'All data will be permanently deleted and cannot be recovered.'}
          </p>
          <div className="mb-4">
            <label htmlFor="deletePassword" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {lang === 'ko' ? '비밀번호 확인' : 'Confirm password'}
            </label>
            <Input
              id="deletePassword"
              type="password"
              value={deletePassword}
              onChange={setDeletePassword}
              placeholder={lang === 'ko' ? '비밀번호 입력' : 'Enter password'}
            />
          </div>
          <Button
            type="button"
            style="destructive"
            size="medium"
            disabled={accountSubmitting}
            onClick={handleDeleteAccount}
          >
            {lang === 'ko' ? '회원 탈퇴' : 'Delete account'}
          </Button>
        </div>
      </section>
    </div>
  );
}
