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
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showEnrollmentDialog, setShowEnrollmentDialog] = useState(false);
  const [cancelSheetVisible, setCancelSheetVisible] = useState(false);
  const [enrollSheetVisible, setEnrollSheetVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [logoLanguage, setLogoLanguage] = useState<'ko' | 'en'>('en');
  const [prevLogoLanguage, setPrevLogoLanguage] = useState<'ko' | 'en' | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [formData, setFormData] = useState({
    studentId: '',
    name: '',
    admissionYear: new Date().getFullYear(),
    isFallAdmission: false,
    major: 'PH',
    doubleMajors: [] as string[],
    minors: [] as string[],
    advancedMajor: false,
    individuallyDesignedMajor: false,
  });

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
        setShowEnrollmentDialog(true);
      } else {
        alert(data.message || '정보 저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('에러 발생:', err);
      alert('서버 오류가 발생했습니다.');
    }
  };

  const handleCancelClick = () => {
    setShowCancelModal(true);
  };

  const handleCancelConfirm = async () => {
    if (!deletePassword) {
      alert('비밀번호를 입력해주세요.');
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`${API}/auth/delete-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await res.json();
      if (data.success) {
        alert('계정이 삭제되었습니다.');
        router.push('/login');
      } else {
        alert(data.message || '계정 삭제에 실패했습니다.');
        setIsDeleting(false);
        setDeletePassword('');
      }
    } catch (err) {
      console.error('에러 발생:', err);
      alert('서버 오류가 발생했습니다.');
      setIsDeleting(false);
      setDeletePassword('');
    }
  };

  const handleCancelModalClose = () => {
    setCancelSheetVisible(false);
    window.setTimeout(() => {
      setShowCancelModal(false);
      setDeletePassword('');
    }, 200);
  };

  const closeEnrollmentDialog = (next: 'simulation' | 'courses') => {
    setEnrollSheetVisible(false);
    window.setTimeout(() => {
      setShowEnrollmentDialog(false);
      router.push(next === 'simulation' ? '/simulation' : '/profile/settings?tab=courses');
    }, 200);
  };

  useEffect(() => {
    if (showCancelModal) {
      setCancelSheetVisible(false);
      const t = window.setTimeout(() => setCancelSheetVisible(true), 10);
      return () => window.clearTimeout(t);
    }
    setCancelSheetVisible(false);
  }, [showCancelModal]);

  useEffect(() => {
    if (showEnrollmentDialog) {
      setEnrollSheetVisible(false);
      const t = window.setTimeout(() => setEnrollSheetVisible(true), 10);
      return () => window.clearTimeout(t);
    }
    setEnrollSheetVisible(false);
  }, [showEnrollmentDialog]);

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
                inputMode="numeric"
                value={formData.studentId}
                onChange={(v) => {
                  const studentId = v.replace(/[^0-9]/g, '');
                  const admissionYear = Number(v.slice(0, 4));
                  if (admissionYear >= 2016)
                    setFormData((p) => ({ ...p, admissionYear, studentId }))
                  else
                    setFormData((p) => ({ ...p, studentId }));
                }}
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
                min="2016"
                max="2050"
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
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancelClick}
              disabled={isDeleting}
              className="flex-1 rounded-md bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 active:scale-96 transition-all disabled:opacity-50 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700 shadow-md"
            >
              취소
            </button>
            <button
              type="submit"
              className="flex-1 rounded-md bg-violet-600 px-4 py-2 text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 active:scale-96 transition-all shadow-md"
            >
              저장하기
            </button>
          </div>
        </form>

        {/* 취소 확인 모달 */}
        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 select-none">
            <div
              className={`w-full sm:max-w-md mx-0 sm:mx-4 rounded-t-2xl sm:rounded-lg bg-gray-50 p-6 shadow-xl dark:bg-zinc-900 transition-transform duration-200 ${
                cancelSheetVisible ? 'translate-y-0' : 'translate-y-full sm:translate-y-0'
              }`}
            >
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
                계정 삭제 확인
              </h3>
              <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                정말 취소하시겠습니까? 계정이 삭제되며 모든 데이터가 영구적으로 삭제됩니다.
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
                  placeholder="비밀번호를 입력하세요"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancelModalClose}
                  disabled={isDeleting}
                  className="flex-1 rounded-md bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 active:scale-96 transition-all disabled:opacity-50 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700 shadow-md"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={handleCancelConfirm}
                  disabled={isDeleting || !deletePassword}
                  className="flex-1 rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 active:scale-96 transition-all disabled:opacity-50 shadow-md"
                >
                  {isDeleting ? '삭제 중...' : '계정 삭제'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 수강한 과목 등록 다이얼로그 */}
        {showEnrollmentDialog && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 select-none">
            <div
              className={`w-full sm:max-w-md mx-0 sm:mx-4 rounded-t-2xl sm:rounded-lg bg-gray-50 p-6 shadow-xl dark:bg-zinc-900 transition-transform duration-200 ${
                enrollSheetVisible ? 'translate-y-0' : 'translate-y-full sm:translate-y-0'
              }`}
            >
              <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
                기본 정보 저장 완료
              </h3>
              <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
                수강한 과목을 등록하시겠습니까? 과목을 등록하면 새로운 시나리오를 만들 때 과목이 자동으로 로드됩니다.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    closeEnrollmentDialog('simulation');
                  }}
                  className="flex-1 rounded-md bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 active:scale-96 transition-all dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700 shadow-md"
                >
                  아니오
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeEnrollmentDialog('courses');
                  }}
                  className="flex-1 rounded-md bg-violet-600 px-4 py-2 text-white hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 active:scale-96 transition-all shadow-md"
                >
                  확인
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
