'use client';

import { useState } from 'react';
import { Input } from '../../components/formFields';
import { API } from '../../lib/api';

interface AccountTabProps {
  user: { email?: string } | null;
  userId: string | null;
  onDeleteSuccess: () => void;
}

export default function AccountTab({ user, userId, onDeleteSuccess }: AccountTabProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [accountSubmitting, setAccountSubmitting] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== newPasswordConfirm) {
      alert('새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (newPassword.length < 6) {
      alert('새 비밀번호는 최소 6자 이상이어야 합니다.');
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
        alert('비밀번호가 변경되었습니다.');
        setCurrentPassword('');
        setNewPassword('');
        setNewPasswordConfirm('');
      } else {
        alert(data.message || '비밀번호 변경에 실패했습니다.');
      }
    } catch {
      alert('서버 오류가 발생했습니다.');
    } finally {
      setAccountSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      alert('비밀번호를 입력해주세요.');
      return;
    }
    if (!confirm('정말 회원 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
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
        alert(data.message || '회원 탈퇴에 실패했습니다.');
      }
    } catch {
      alert('서버 오류가 발생했습니다.');
    } finally {
      setAccountSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">계정 정보</h1>
      <div className="rounded-lg bg-white p-6 dark:bg-zinc-900 shadow-lg">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-500 dark:text-gray-400">이메일</label>
          <p className="text-gray-900 dark:text-white">{user?.email}</p>
        </div>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-200">비밀번호 변경</h2>
        <form onSubmit={handleChangePassword} className="space-y-4 rounded-lg bg-white p-6 dark:bg-zinc-900 shadow-lg">
          <div>
            <label htmlFor="currentPassword" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              현재 비밀번호
            </label>
            <Input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={setCurrentPassword}
              required
              placeholder="현재 비밀번호"
            />
          </div>
          <div>
            <label htmlFor="newPassword" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              새 비밀번호
            </label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={setNewPassword}
              required
              placeholder="새 비밀번호 (6자 이상)"
            />
          </div>
          <div>
            <label htmlFor="newPasswordConfirm" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              새 비밀번호 확인
            </label>
            <Input
              id="newPasswordConfirm"
              type="password"
              value={newPasswordConfirm}
              onChange={setNewPasswordConfirm}
              required
              placeholder="새 비밀번호 다시 입력"
            />
          </div>
          <button
            type="submit"
            disabled={accountSubmitting}
            className="rounded-lg bg-violet-600 px-4 py-2 text-white hover:bg-violet-700 disabled:opacity-50 active:scale-90 transition-all"
          >
            비밀번호 변경
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-red-600 dark:text-red-400">회원 탈퇴</h2>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/30 shadow-lg">
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다.
          </p>
          <div className="mb-4">
            <label htmlFor="deletePassword" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              비밀번호 확인
            </label>
            <Input
              id="deletePassword"
              type="password"
              value={deletePassword}
              onChange={setDeletePassword}
              placeholder="비밀번호 입력"
            />
          </div>
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={accountSubmitting}
            className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50 active:scale-90 transition-all"
          >
            회원 탈퇴
          </button>
        </div>
      </section>
    </div>
  );
}
