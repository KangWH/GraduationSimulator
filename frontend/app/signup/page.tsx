'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Input, NumberInput, Select } from '../components/formFields';
import { DepartmentDropdown, MultipleDepartmentDropdown } from '../components/DepartmentDropdown';
import AddCoursePanel from '../profile/settings/AddCoursePanel';
import EnrollmentsList, { enrollmentKey } from '../profile/settings/EnrollmentsList';
import { API } from '../lib/api';
import Logo from '../components/Logo';
import { parseXlsxRows, applyXlsxParsedRows } from '../profile/settings/xlsxEnrollments';
import type { Enrollment, RawEnrollment, Semester, Grade } from '../profile/settings/types';

const SEMESTER_ORDER: Semester[] = ['SPRING', 'SUMMER', 'FALL', 'WINTER'];

async function convertToEnrollments(rawEnrollments: RawEnrollment[]): Promise<Enrollment[]> {
  const enrollments: Enrollment[] = [];
  for (const raw of rawEnrollments) {
    try {
      const courseRes = await fetch(`${API}/courses?id=${encodeURIComponent(raw.courseId)}`);
      const courses = await courseRes.json();
      const course = Array.isArray(courses) && courses.length > 0 ? courses[0] : null;
      if (course) {
        enrollments.push({
          courseId: raw.courseId,
          course: {
            id: course.id || raw.courseId,
            code: course.code || '',
            title: course.title || '',
            department: course.department || '',
            category: course.category || '',
            credit: course.credit || 0,
            au: course.au || 0,
            tags: course.tags || [],
            level: course.level || 'UG',
            crossRecognition: course.crossRecognition || false,
          },
          enrolledYear: raw.enrolledYear,
          enrolledSemester: raw.enrolledSemester,
          grade: raw.grade,
        });
      }
    } catch (error) {
      console.error(`Failed to fetch course ${raw.courseId}:`, error);
    }
  }
  return enrollments;
}

function convertToRawEnrollments(enrollments: Enrollment[]): RawEnrollment[] {
  return enrollments.map((e) => ({
    courseId: e.courseId,
    enrolledYear: e.enrolledYear,
    enrolledSemester: e.enrolledSemester,
    grade: e.grade,
  }));
}

function groupBySemester(enrollments: Enrollment[]): Map<string, Enrollment[]> {
  const map = new Map<string, Enrollment[]>();
  enrollments.forEach((e) => {
    const key = `${e.enrolledYear}-${e.enrolledSemester}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  });
  return map;
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [lang, setLang] = useState<'ko' | 'en'>('ko');

  // Step 1
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  // Step 2 & 3
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

  // Step 4 - enrollments
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const selectedCourseIdsRef = useRef<Set<string>>(new Set());
  const [addYear, setAddYear] = useState(new Date().getFullYear());
  const [addSemester, setAddSemester] = useState<Semester>('SPRING');
  const [addGrade, setAddGrade] = useState<Grade>('A+');
  const [addAsPriorCredit, setAddAsPriorCredit] = useState(false);
  const [filterDepartment, setFilterDepartment] = useState<string>('none');
  const [filterCategory, setFilterCategory] = useState<string>('none');
  const [draggedEnrollment, setDraggedEnrollment] = useState<Enrollment | null>(null);
  const [draggedFromSemester, setDraggedFromSemester] = useState<string | null>(null);
  const [draggedCourse, setDraggedCourse] = useState<any | null>(null);
  const [selectedEnrollmentKeys, setSelectedEnrollmentKeys] = useState<Set<string>>(new Set());
  const [courseMode, setCourseMode] = useState<'add' | 'view'>('add');
  const [xlsxLoading, setXlsxLoading] = useState(false);
  const [xlsxApplying, setXlsxApplying] = useState(false);
  const [xlsxDialogOpen, setXlsxDialogOpen] = useState(false);
  const xlsxInputRef = useRef<HTMLInputElement>(null);

  const updateSelectedCourseIds = useCallback((newIds: Set<string>) => {
    selectedCourseIdsRef.current = newIds;
    setSelectedCourseIds(newIds);
  }, []);

  useEffect(() => {
    fetch(`${API}/auth/me`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          router.push('/simulation');
        } else {
          setStep(1);
        }
      })
      .catch(() => setStep(1))
      .finally(() => setIsCheckingAuth(false));
  }, [router]);

  useEffect(() => {
    if (courseSearchQuery.trim() || (filterDepartment && filterDepartment !== 'none') || (filterCategory && filterCategory !== 'none')) {
      setIsSearching(true);
      const params = new URLSearchParams();
      if (courseSearchQuery.trim()) params.append('query', courseSearchQuery.trim());
      if (filterDepartment && filterDepartment !== 'none') params.append('department', filterDepartment);
      if (filterCategory && filterCategory !== 'none') params.append('category', filterCategory);
      const t = setTimeout(() => {
        fetch(`${API}/courses?${params.toString()}`)
          .then((r) => r.json())
          .then((courses) => setSearchResults(Array.isArray(courses) ? courses : []))
          .catch(() => setSearchResults([]))
          .finally(() => setIsSearching(false));
      }, 500);
      return () => clearTimeout(t);
    }
    setSearchResults([]);
    setIsSearching(false);
  }, [courseSearchQuery, filterDepartment, filterCategory]);

  const handleAddSelected = useCallback(() => {
    if (selectedCourseIds.size === 0) {
      alert(lang === 'ko' ? '추가할 과목을 선택해주세요.' : 'Please select courses to add.');
      return;
    }
    const newEnrollments: Enrollment[] = [];
    for (const courseId of selectedCourseIds) {
      const course = searchResults.find((c) => (c.id || c.code || '') === courseId);
      if (!course) continue;
      newEnrollments.push({
        courseId: course.id || courseId,
        course: {
          id: course.id || courseId,
          code: course.code || '',
          title: course.title || course.name || '',
          department: course.department || '',
          category: course.category || '',
          credit: course.credit || 0,
          au: course.au || 0,
          tags: course.tags || [],
          level: course.level || 'UG',
          crossRecognition: course.crossRecognition || false,
        },
        enrolledYear: addYear,
        enrolledSemester: addSemester,
        grade: addGrade,
      });
    }
    setEnrollments((prev) => [...prev, ...newEnrollments]);
    updateSelectedCourseIds(new Set());
  }, [selectedCourseIds, searchResults, addYear, addSemester, addGrade, updateSelectedCourseIds, lang]);

  const handleGradeChange = useCallback(
    (enrollment: Enrollment, grade: Grade) => {
      setEnrollments((prev) =>
        prev.map((e) =>
          e.courseId === enrollment.courseId &&
          e.enrolledYear === enrollment.enrolledYear &&
          e.enrolledSemester === enrollment.enrolledSemester
            ? { ...e, grade }
            : e
        )
      );
    },
    []
  );

  const handleRemove = useCallback(
    (enrollment: Enrollment) => {
      setEnrollments((prev) =>
        prev.filter(
          (e) =>
            !(
              e.courseId === enrollment.courseId &&
              e.enrolledYear === enrollment.enrolledYear &&
              e.enrolledSemester === enrollment.enrolledSemester
            )
        )
      );
      setSelectedEnrollmentKeys((prev) => {
        const k = enrollmentKey(enrollment);
        const next2 = new Set(prev);
        next2.delete(k);
        return next2;
      });
    },
    []
  );

  const handleMove = useCallback(
    (enrollment: Enrollment, newYear: number, newSemester: Semester) => {
      setEnrollments((prev) =>
        prev.map((e) =>
          e.courseId === enrollment.courseId &&
          e.enrolledYear === enrollment.enrolledYear &&
          e.enrolledSemester === enrollment.enrolledSemester
            ? { ...e, enrolledYear: newYear, enrolledSemester: newSemester }
            : e
        )
      );
    },
    []
  );

  const handleRemoveSelected = useCallback(() => {
    setEnrollments((prev) => prev.filter((e) => !selectedEnrollmentKeys.has(enrollmentKey(e))));
    setSelectedEnrollmentKeys(new Set());
  }, [selectedEnrollmentKeys]);

  const handleRemoveAll = useCallback(() => {
    setEnrollments((prev) => {
      if (prev.length === 0) return prev;
      if (!confirm(lang === 'ko' ? `수강 과목 ${prev.length}개를 모두 삭제하시겠습니까?` : `Are you sure you want to delete all ${prev.length} enrolled courses?`)) return prev;
      return [];
    });
    setSelectedEnrollmentKeys(new Set());
  }, [lang]);

  const findNearestPastSemester = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    if (month < 2) return { year: year - 1, semester: 'FALL' as Semester };
    if (month < 6) return { year, semester: 'SPRING' as Semester };
    if (month < 8) return { year, semester: 'SUMMER' as Semester };
    if (month < 11) return { year, semester: 'FALL' as Semester };
    return { year, semester: 'WINTER' as Semester };
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent, enrollment: Enrollment, semesterKey: string) => {
      setDraggedEnrollment(enrollment);
      setDraggedFromSemester(semesterKey);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetSemesterKey: string) => {
      e.preventDefault();
      if (!draggedEnrollment) return;
      const [targetYear, targetSem] = targetSemesterKey.split('-');
      setEnrollments((prev) =>
        prev.map((e) =>
          e.courseId === draggedEnrollment.courseId &&
          e.enrolledYear === draggedEnrollment.enrolledYear &&
          e.enrolledSemester === draggedEnrollment.enrolledSemester
            ? { ...e, enrolledYear: parseInt(targetYear), enrolledSemester: targetSem as Semester }
            : e
        )
      );
      setDraggedEnrollment(null);
      setDraggedFromSemester(null);
    },
    [draggedEnrollment]
  );

  const handleDropOutside = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!draggedEnrollment) return;
      const target = findNearestPastSemester();
      setEnrollments((prev) =>
        prev.map((e) =>
          e.courseId === draggedEnrollment.courseId &&
          e.enrolledYear === draggedEnrollment.enrolledYear &&
          e.enrolledSemester === draggedEnrollment.enrolledSemester
            ? { ...e, enrolledYear: target.year, enrolledSemester: target.semester }
            : e
        )
      );
      setDraggedEnrollment(null);
      setDraggedFromSemester(null);
    },
    [draggedEnrollment, findNearestPastSemester]
  );

  const handleXlsxFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.xlsx')) {
      alert(lang === 'ko' ? '.xlsx 파일만 업로드할 수 있습니다.' : 'Only .xlsx files can be uploaded.');
      if (xlsxInputRef.current) xlsxInputRef.current.value = '';
      return;
    }
    setXlsxLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        if (!data || typeof data !== 'object' || !(data instanceof ArrayBuffer)) {
          setXlsxLoading(false);
          return;
        }
        const XLSX = await import('xlsx');
        const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          setXlsxLoading(false);
          alert(lang === 'ko' ? '엑셀 파일에 시트가 없습니다.' : 'The Excel file has no sheets.');
          return;
        }
        const sheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
        const parsed = parseXlsxRows(rows);
        setXlsxLoading(false);
        if (xlsxInputRef.current) xlsxInputRef.current.value = '';
        setXlsxDialogOpen(false);
        if (parsed.length === 0) {
          alert(lang === 'ko' ? '파싱된 과목이 없습니다. 학사 포털 "성적 → 성적조회"에서 내려받은 형식인지 확인해주세요.' : 'No courses were parsed. Please ensure the file is from the Academic Portal "Grades → Grade Inquiry" menu.');
          return;
        }
        if (confirm(lang === 'ko' ? `기존 수강 내역 ${enrollments.length}건을 모두 지우고, 엑셀 파일 내용(${parsed.length}행)으로 수강 목록을 대체하시겠습니까?\n(엑셀의 '구분'과 DB의 과목구분이 일치하는 과목만 반영됩니다.)` : `Replace all ${enrollments.length} enrollments with ${parsed.length} rows from the Excel file?\n(Only courses matching the DB category will be applied.)`)) {
          setXlsxApplying(true);
          try {
            const result = await applyXlsxParsedRows(parsed, API);
            const newEnrollments = await convertToEnrollments(result.rawEnrollments);
            setEnrollments(newEnrollments);
            setSelectedEnrollmentKeys(new Set());
            const msgs: string[] = lang === 'ko' ? [`수강 목록을 적용했습니다. (${newEnrollments.length}건)`] : [`Enrollments applied. (${newEnrollments.length} items)`];
            if (result.tagMismatch.length > 0) {
              const unique = [...new Set(result.tagMismatch)];
              msgs.push(lang === 'ko' ? `태그 불일치로 제외: ${unique.length}건` : `Excluded (tag mismatch): ${unique.length}`);
            }
            if (result.categoryMismatch.length > 0) {
              const unique = [...new Set(result.categoryMismatch)];
              msgs.push(lang === 'ko' ? `구분 불일치로 제외: ${unique.length}건` : `Excluded (category mismatch): ${unique.length}`);
            }
            if (result.unknownCategory.length > 0) {
              const unique = [...new Set(result.unknownCategory)];
              msgs.push(lang === 'ko' ? `구분 해석 불가: ${unique.length}건` : `Unknown category: ${unique.length}`);
            }
            if (result.notFoundCodes.length > 0) {
              const unique = [...new Set(result.notFoundCodes)];
              msgs.push(lang === 'ko' ? `과목 DB에 없어 제외: ${unique.length}건` : `Excluded (not in DB): ${unique.length}`);
            }
            alert(msgs.join('\n'));
          } catch (err) {
            console.error('xlsx apply error:', err);
            alert(lang === 'ko' ? '적용 중 오류가 발생했습니다.' : 'An error occurred while applying.');
          } finally {
            setXlsxApplying(false);
          }
        }
      } catch (err) {
        console.error('xlsx parse error:', err);
        alert(lang === 'ko' ? '엑셀 파일을 읽는 중 오류가 발생했습니다.' : 'An error occurred while reading the Excel file.');
        setXlsxLoading(false);
        if (xlsxInputRef.current) xlsxInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  }, [enrollments.length, lang]);

  const handleXlsxButtonClick = useCallback(() => {
    setXlsxDialogOpen(true);
  }, []);

  const handleXlsxDialogClose = useCallback(() => {
    if (!xlsxLoading && !xlsxApplying) {
      setXlsxDialogOpen(false);
      if (xlsxInputRef.current) xlsxInputRef.current.value = '';
    }
  }, [xlsxLoading, xlsxApplying]);

  const semesterGroups = useMemo(() => groupBySemester(enrollments), [enrollments]);
  const sortedSemesterKeys = useMemo(
    () =>
      Array.from(semesterGroups.keys()).sort((a, b) => {
        const [yA, sA] = a.split('-');
        const [yB, sB] = b.split('-');
        if (yA !== yB) return parseInt(yA) - parseInt(yB);
        return SEMESTER_ORDER.indexOf(sA as Semester) - SEMESTER_ORDER.indexOf(sB as Semester);
      }),
    [semesterGroups]
  );

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      alert(lang === 'ko' ? '이메일을 입력해주세요.' : 'Please enter your email.');
      return;
    }
    if (password !== passwordConfirm) {
      alert(lang === 'ko' ? '비밀번호가 일치하지 않습니다.' : 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      alert(lang === 'ko' ? '비밀번호는 최소 6자 이상이어야 합니다.' : 'Password must be at least 6 characters.');
      return;
    }
    setIsCheckingEmail(true);
    try {
      const res = await fetch(`${API}/auth/check-email?email=${encodeURIComponent(email.trim())}`);
      const data = await res.json();
      if (!data.success) {
        alert(data.message || (lang === 'ko' ? '이메일 확인 중 오류가 발생했습니다.' : 'An error occurred while checking email.'));
        return;
      }
      if (!data.available) {
        alert(lang === 'ko' ? '이미 사용 중인 이메일입니다.' : 'This email is already in use.');
        return;
      }
      setStep(2);
    } catch {
      alert(lang === 'ko' ? '이메일 확인 중 오류가 발생했습니다.' : 'An error occurred while checking email.');
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentId || !formData.name || !formData.admissionYear) {
      alert(lang === 'ko' ? '학번, 이름, 입학연도를 모두 입력해주세요.' : 'Please enter your student ID, name, and admission year.');
      return;
    }
    setStep(3);
  };

  const handleStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.major) {
      alert(lang === 'ko' ? '전공학과를 선택해주세요.' : 'Please select your major.');
      return;
    }
    setStep(4);
  };

  const handleStep4 = () => doSignup();

  const doSignup = async () => {
    if (password !== passwordConfirm) {
      alert(lang === 'ko' ? '비밀번호가 일치하지 않습니다.' : 'Passwords do not match.');
      return;
    }
    if (!formData.studentId || !formData.name || !formData.major) {
      alert(lang === 'ko' ? '필수 정보를 모두 입력해주세요.' : 'Please fill in all required fields.');
      return;
    }
    setIsSubmitting(true);
    try {
      const validDoubleMajors = formData.doubleMajors.filter((v) => v && v !== 'none' && v.trim() !== '');
      const validMinors = formData.minors.filter((v) => v && v !== 'none' && v.trim() !== '');
      const rawEnrollments = convertToRawEnrollments(enrollments);
      const res = await fetch(`${API}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          profile: {
            name: formData.name,
            studentId: formData.studentId,
            admissionYear: Number(formData.admissionYear),
            isFallAdmission: formData.isFallAdmission,
            major: formData.major,
            doubleMajor: validDoubleMajors.length > 0 ? validDoubleMajors : null,
            minor: validMinors.length > 0 ? validMinors : null,
            advancedMajor: formData.advancedMajor,
            individuallyDesignedMajor: formData.individuallyDesignedMajor,
          },
          enrollments: rawEnrollments,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(lang === 'ko' ? '회원가입이 완료되었습니다. 로그인해주세요.' : 'Signup complete. Please log in.');
        router.push('/login');
      } else {
        alert(data.message || (lang === 'ko' ? '회원가입에 실패했습니다.' : 'Signup failed.'));
      }
    } catch (err) {
      console.error(err);
      alert(lang === 'ko' ? '서버 오류가 발생했습니다.' : 'A server error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-zinc-900">
        <p className="text-gray-500 dark:text-gray-400">{lang === 'ko' ? '로딩 중…' : 'Loading…'}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-zinc-900">
      {/* 데스크톱 상단바 */}
      <header className="sticky top-0 z-10 hidden h-14 shrink-0 select-none items-center justify-between bg-white px-6 text-lg shadow-lg dark:bg-black sm:flex">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-800 dark:text-gray-100 hover:opacity-80 transition-opacity text-2xl">
            <Logo language={lang} />
          </Link>
          <span className="font-medium text-gray-700 dark:text-gray-300">{lang === 'ko' ? '회원가입' : 'Sign up'}</span>
        </div>
        <button
          type="button"
          onClick={() => setLang((l) => (l === 'ko' ? 'en' : 'ko'))}
          className="flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700 transition-colors"
          aria-label={lang === 'ko' ? '한국어' : 'English'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
          {lang === 'ko' ? '한국어' : 'English'}
        </button>
      </header>

      {/* 모바일 상단바 */}
      <header className="sticky top-0 z-10 flex h-14 shrink-0 select-none items-center justify-center bg-gray-50/50 px-4 text-lg dark:bg-zinc-900/50 backdrop-blur sm:hidden">
        <div className="absolute left-2 top-1/2 -translate-y-1/2">
          {step === 1 ? (
            <Link href="/login" className="flex items-center justify-center w-10 h-10 rounded-md text-gray-600 hover:bg-gray-200/50 dark:text-gray-400 dark:hover:bg-zinc-700/50 transition-all active:scale-85" aria-label={lang === 'ko' ? '취소' : 'Cancel'}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </Link>
          ) : (
            <button type="button" onClick={() => setStep(step - 1)} className="flex items-center justify-center w-10 h-10 rounded-md text-gray-600 hover:bg-gray-200/50 dark:text-gray-400 dark:hover:bg-zinc-700/50 transition-all active:scale-85" aria-label={lang === 'ko' ? '이전' : 'Previous'}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}
        </div>
        <span className="font-medium text-gray-700 dark:text-zinc-300">{lang === 'ko' ? '회원가입' : 'Sign up'}</span>
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <button
            type="button"
            onClick={() => setLang((l) => (l === 'ko' ? 'en' : 'ko'))}
            className="flex items-center justify-center w-10 h-10 rounded-md text-gray-600 hover:bg-gray-200/50 dark:text-gray-400 dark:hover:bg-zinc-700/50 transition-all active:scale-85"
            aria-label={lang === 'ko' ? '한국어' : 'English'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
          </button>
        </div>
      </header>

      <div className={`w-full mx-auto flex-1 flex flex-col p-4 pb-20 sm:pb-4 ${step === 4 ? 'max-w-none px-4' : 'max-w-2xl px-4 justify-start sm:justify-center'}`}>
        {step === 1 && (
          <form id="signup-step1" onSubmit={handleStep1} className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{lang === 'ko' ? '계정 정보 입력' : 'Account Information'}</h2>
            <div className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{lang === 'ko' ? '이메일' : 'Email'}</label>
                <Input value={email} onChange={(v) => setEmail(v)} id="email" type="email" inputMode="email" required placeholder={lang === 'ko' ? '이메일을 입력하세요' : 'Enter your email'} />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{lang === 'ko' ? '비밀번호' : 'Password'}</label>
                <Input value={password} onChange={(v) => setPassword(v)} id="password" type="password" required placeholder={lang === 'ko' ? '비밀번호를 입력하세요' : 'Enter your password'} />
              </div>
              <div>
                <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{lang === 'ko' ? '비밀번호 확인' : 'Confirm Password'}</label>
                <Input value={passwordConfirm} onChange={(v) => setPasswordConfirm(v)} id="passwordConfirm" type="password" required placeholder={lang === 'ko' ? '비밀번호를 다시 입력하세요' : 'Re-enter your password'} />
              </div>
            </div>
            <div className="hidden sm:flex justify-between items-center gap-3">
              <Link href="/login" className="flex-shrink-0 rounded-md bg-white px-4 py-2 text-center text-gray-700 hover:bg-gray-50 dark:bg-black dark:text-gray-300 dark:hover:bg-zinc-700 shadow-md transition-all active:scale-90">
                {lang === 'ko' ? '취소' : 'Cancel'}
              </Link>
              <div className="flex justify-center gap-2 flex-1">
                {[1, 2, 3, 4].map((s) => (
                  <span key={s} className={`w-2 h-2 rounded-full ${s <= step ? 'bg-violet-600' : 'bg-gray-300 dark:bg-zinc-600'}`} />
                ))}
              </div>
              <button type="submit" disabled={isCheckingEmail} className="flex-shrink-0 flex items-center gap-1.5 rounded-md bg-violet-600 px-4 py-2 text-white hover:bg-violet-700 active:scale-90 transition-all shadow-md disabled:opacity-50">
                {isCheckingEmail ? (lang === 'ko' ? '확인 중…' : 'Checking…') : (lang === 'ko' ? <>다음 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></> : <>Next <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></>)}
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form id="signup-step2" onSubmit={handleStep2} className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{lang === 'ko' ? '학적 기본 정보 입력' : 'Basic Academic Info'}</h2>
            <div className="space-y-6">
              <div>
                <label htmlFor="studentId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{lang === 'ko' ? '학번' : 'Student ID'} <span className="text-red-500">*</span></label>
                <Input
                  id="studentId"
                  value={formData.studentId}
                  onChange={(v) => {
                    const studentId = v.replace(/[^0-9]/g, '');
                    const admissionYear = Number(v.slice(0, 4));
                    setFormData((p) => ({ ...p, studentId, admissionYear: admissionYear >= 2016 ? admissionYear : p.admissionYear }));
                  }}
                  type="text"
                  inputMode="numeric"
                  required
                  placeholder={lang === 'ko' ? '학번을 입력하세요' : 'Enter your student ID'}
                />
              </div>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{lang === 'ko' ? '이름' : 'Name'} <span className="text-red-500">*</span></label>
                <Input id="name" value={formData.name} onChange={(v) => setFormData((p) => ({ ...p, name: v }))} type="text" required />
              </div>
              <div>
                <label htmlFor="admissionYear" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{lang === 'ko' ? '입학 연도' : 'Admission Year'} <span className="text-red-500">*</span></label>
                <NumberInput id="admissionYear" min="2016" max="2050" value={String(formData.admissionYear)} onChange={(v) => setFormData((p) => ({ ...p, admissionYear: Number(v) || 0 }))} required />
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={formData.isFallAdmission} onChange={(e) => setFormData((p) => ({ ...p, isFallAdmission: e.target.checked }))} className="h-5 w-5 rounded border-gray-300 text-violet-600 focus:ring-violet-500 focus:ring-2" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{lang === 'ko' ? '가을학기 입학' : 'Fall admission'}</span>
                </label>
              </div>
              <div>
                <label htmlFor="admissionType" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{lang === 'ko' ? '입학 구분' : 'Admission Type'} <span className="text-red-500">*</span></label>
                <Select id="admissionType" value="national" onChange={() => {}} required disabled>
                  <option value="national">{lang === 'ko' ? '한국인' : 'Korean'}</option>
                  <option value="nationalForeignSchool">{lang === 'ko' ? '한국인 (외국고 졸업)' : 'Korean (foreign high school)'}</option>
                  <option value="international">{lang === 'ko' ? '외국인' : 'International'}</option>
                </Select>
                <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {lang === 'ko' ? (
                    <>학번과 입학 구분은 가입 후 변경할 수 없습니다.<br />현재는 한국인 계정만 생성할 수 있습니다.</>
                  ) : (
                    <>Student ID and admission type cannot be changed after signup.<br />Currently, only Korean accounts can be created.</>
                  )}
                </p>
              </div>
            </div>
            <div className="hidden sm:flex justify-between items-center gap-3">
              <button type="button" onClick={() => setStep(1)} className="flex-shrink-0 flex items-center gap-1.5 rounded-md bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700 shadow-md active:scale-90 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg> {lang === 'ko' ? '이전' : 'Previous'}
              </button>
              <div className="flex justify-center gap-2 flex-1">
                {[1, 2, 3, 4].map((s) => (
                  <span key={s} className={`w-2 h-2 rounded-full ${s <= step ? 'bg-violet-600' : 'bg-gray-300 dark:bg-zinc-600'}`} />
                ))}
              </div>
              <button type="submit" className="flex-shrink-0 flex items-center gap-1.5 rounded-md bg-violet-600 px-4 py-2 text-white hover:bg-violet-700 active:scale-90 transition-all shadow-md">{lang === 'ko' ? '다음' : 'Next'} <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form id="signup-step3" onSubmit={handleStep3} className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{lang === 'ko' ? '학과 지정' : 'Major Selection'}</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{lang === 'ko' ? '전공(예정)학과' : 'Major (intended)'} <span className="text-red-500">*</span></label>
                <DepartmentDropdown lang={lang} value={formData.major} onChange={(v) => setFormData((p) => ({ ...p, major: v }))} mode="major" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{lang === 'ko' ? '복수전공' : 'Double major'}</label>
                <MultipleDepartmentDropdown lang={lang} value={formData.doubleMajors} onChange={(v) => setFormData((p) => ({ ...p, doubleMajors: v }))} mode="doubleMajor" className="min-w-40" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{lang === 'ko' ? '부전공' : 'Minor'}</label>
                <MultipleDepartmentDropdown lang={lang} value={formData.minors} onChange={(v) => setFormData((p) => ({ ...p, minors: v }))} mode="minor" className="min-w-40" />
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={formData.advancedMajor} onChange={(e) => setFormData((p) => ({ ...p, advancedMajor: e.target.checked }))} className="h-5 w-5 rounded border-gray-300 text-violet-600 focus:ring-violet-500 focus:ring-2" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{lang === 'ko' ? '심화전공' : 'Advanced major'}</span>
                </label>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={formData.individuallyDesignedMajor} onChange={(e) => setFormData((p) => ({ ...p, individuallyDesignedMajor: e.target.checked }))} className="h-5 w-5 rounded border-gray-300 text-violet-600 focus:ring-violet-500 focus:ring-2" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{lang === 'ko' ? '자유융합전공' : 'Individually designed major'}</span>
                </label>
              </div>
            </div>
            <div className="hidden sm:flex justify-between items-center gap-3">
              <button type="button" onClick={() => setStep(2)} className="flex-shrink-0 flex items-center gap-1.5 rounded-md bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700 shadow-md active:scale-90 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg> {lang === 'ko' ? '이전' : 'Previous'}
              </button>
              <div className="flex justify-center gap-2 flex-1">
                {[1, 2, 3, 4].map((s) => (
                  <span key={s} className={`w-2 h-2 rounded-full ${s <= step ? 'bg-violet-600' : 'bg-gray-300 dark:bg-zinc-600'}`} />
                ))}
              </div>
              <button type="submit" className="flex-shrink-0 flex items-center gap-1.5 rounded-md bg-violet-600 px-4 py-2 text-white hover:bg-violet-700 active:scale-90 transition-all shadow-md">
                {lang === 'ko' ? '다음' : 'Next'} <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </form>
        )}

        {step === 4 && (
          <div className="space-y-6 flex-1 flex flex-col min-h-0">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{lang === 'ko' ? '수강한 과목 저장' : 'Enrolled Courses'}</h2>
            <p className="text-sm text-center text-gray-600 dark:text-gray-400">
              {lang === 'ko' ? '수강한 과목을 등록하면 새로운 시나리오를 만들 때 자동으로 로드됩니다. 건너뛰어도 나중에 프로필 설정에서 등록할 수 있습니다.' : 'Enrolled courses will be loaded automatically when creating new scenarios. You can also add them later in Profile Settings.'}
            </p>
            <div className="flex-1 flex flex-col min-h-0 md:flex-row md:gap-6">
              {/* 넓은 화면: 2열 */}
              <div className="hidden md:flex flex-1 gap-6 min-h-0 overflow-hidden">
                <div className="flex-1 min-w-0 overflow-y-auto space-y-4 px-2">
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{lang === 'ko' ? '과목 추가' : 'Add Course'}</h2>
                  <AddCoursePanel
                    lang={lang}
                    searchQuery={courseSearchQuery}
                    onSearchQueryChange={setCourseSearchQuery}
                    searchResults={searchResults}
                    isSearching={isSearching}
                    selectedCourseIds={selectedCourseIds}
                    onSelectionChange={updateSelectedCourseIds}
                    addYear={addYear}
                    onAddYearChange={setAddYear}
                    addSemester={addSemester}
                    onAddSemesterChange={setAddSemester}
                    addGrade={addGrade}
                    onAddGradeChange={setAddGrade}
                    addAsPriorCredit={addAsPriorCredit}
                    onAddAsPriorCreditChange={setAddAsPriorCredit}
                    onAddSelected={handleAddSelected}
                    onDragStart={(c) => setDraggedCourse(c)}
                    filterDepartment={filterDepartment}
                    onFilterDepartmentChange={setFilterDepartment}
                    filterCategory={filterCategory}
                    onFilterCategoryChange={setFilterCategory}
                    enrolledCourseIds={enrollments.map((e) => e.courseId)}
                  />
                </div>
                <div
                  className="flex-1 min-w-0 overflow-y-auto px-2"
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => { e.preventDefault(); handleDropOutside(e); }}
                >
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">{lang === 'ko' ? '수강한 과목' : 'Enrolled Courses'} <span className="opacity-60">{enrollments.length}</span></h2>
                  <EnrollmentsList
                    lang={lang}
                    enrollments={enrollments}
                    semesterGroups={semesterGroups}
                    sortedSemesterKeys={sortedSemesterKeys}
                    selectedEnrollmentKeys={selectedEnrollmentKeys}
                    onSelectionChange={setSelectedEnrollmentKeys}
                    onGradeChange={handleGradeChange}
                    onMove={handleMove}
                    onRemove={handleRemove}
                    onRemoveSelected={handleRemoveSelected}
                    onRemoveAll={handleRemoveAll}
                    onDragStart={handleDragStart}
                    onDrop={handleDrop}
                    onDropOutside={handleDropOutside}
                    findNearestPastSemester={findNearestPastSemester}
                  />
                </div>
              </div>
              {/* 좁은 화면: 탭 */}
              <div className="flex flex-col md:hidden flex-1 min-h-0 overflow-hidden">
                <div className="bg-gradient-to-b from-gray-50 dark:from-black from-[70%] to-transparent flex items-center gap-2 p-3 pt-0 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setCourseMode('add')}
                    className={`flex-1 px-2 py-1 text-sm font-medium transition-all rounded-lg truncate hover:bg-gray-200 dark:hover:bg-zinc-700 active:scale-90 ${
                      courseMode === 'add' ? 'text-black dark:text-white' : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    <span className={`px-2 py-1 border-b border-b-2 transition-colors ${courseMode === 'add' ? 'border-violet-500' : 'border-transparent'}`}>
                      {lang === 'ko' ? '과목 추가' : 'Add Course'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCourseMode('view')}
                    className={`flex-1 px-2 py-1 text-sm font-medium transition-all rounded-lg truncate hover:bg-gray-200 dark:hover:bg-zinc-700 active:scale-90 ${
                      courseMode === 'view' ? 'text-black dark:text-white' : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    <span className={`px-2 py-1 border-b border-b-2 transition-colors ${courseMode === 'view' ? 'border-violet-500' : 'border-transparent'}`}>
                      {lang === 'ko' ? '수강한 과목' : 'Enrolled Courses'}<span className="opacity-40 ml-2">{enrollments.length}</span>
                    </span>
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto py-4 px-2">
                  {courseMode === 'add' ? (
                    <AddCoursePanel
                      lang={lang}
                      searchQuery={courseSearchQuery}
                      onSearchQueryChange={setCourseSearchQuery}
                      searchResults={searchResults}
                      isSearching={isSearching}
                      selectedCourseIds={selectedCourseIds}
                      onSelectionChange={updateSelectedCourseIds}
                      addYear={addYear}
                      onAddYearChange={setAddYear}
                      addSemester={addSemester}
                      onAddSemesterChange={setAddSemester}
                      addGrade={addGrade}
                      onAddGradeChange={setAddGrade}
                      addAsPriorCredit={addAsPriorCredit}
                      onAddAsPriorCreditChange={setAddAsPriorCredit}
                      onAddSelected={handleAddSelected}
                      onDragStart={(c) => setDraggedCourse(c)}
                      filterDepartment={filterDepartment}
                      onFilterDepartmentChange={setFilterDepartment}
                      filterCategory={filterCategory}
                      onFilterCategoryChange={setFilterCategory}
                      enrolledCourseIds={enrollments.map((e) => e.courseId)}
                    />
                  ) : (
                    <div
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDrop={(e) => { e.preventDefault(); handleDropOutside(e); }}
                    >
                      <EnrollmentsList
                        lang={lang}
                        enrollments={enrollments}
                        semesterGroups={semesterGroups}
                        sortedSemesterKeys={sortedSemesterKeys}
                        selectedEnrollmentKeys={selectedEnrollmentKeys}
                        onSelectionChange={setSelectedEnrollmentKeys}
                        onGradeChange={handleGradeChange}
                        onMove={handleMove}
                        onRemove={handleRemove}
                        onRemoveSelected={handleRemoveSelected}
                        onRemoveAll={handleRemoveAll}
                        onDragStart={handleDragStart}
                        onDrop={handleDrop}
                        onDropOutside={handleDropOutside}
                        findNearestPastSemester={findNearestPastSemester}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="hidden sm:block h-20 flex-shrink-0" aria-hidden="true" />
            <div className="hidden sm:flex justify-between items-center gap-3 flex-shrink-0 py-4 fixed bottom-0 left-0 right-0 z-10 backdrop-blur px-4">
              <button type="button" onClick={() => setStep(3)} className="flex-shrink-0 flex items-center gap-1.5 rounded-md bg-white dark:bg-zinc-800 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-700 shadow-md active:scale-90 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg> {lang === 'ko' ? '이전' : 'Previous'}
              </button>
              <div className="flex justify-center gap-2 flex-1">
                {[1, 2, 3, 4].map((s) => (
                  <span key={s} className={`w-2 h-2 rounded-full ${s <= step ? 'bg-violet-600' : 'bg-gray-300 dark:bg-zinc-600'}`} />
                ))}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {xlsxApplying ? (
                  <div className="flex items-center justify-center gap-1.5 rounded-md bg-white dark:bg-zinc-800 px-4 h-10 shadow-md min-w-[7rem]">
                    <svg className="animate-spin h-4 w-4 text-gray-500 dark:text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm text-gray-600 dark:text-gray-400">{lang === 'ko' ? '적용 중…' : 'Applying…'}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleXlsxButtonClick}
                    className="flex items-center justify-center gap-1.5 rounded-md bg-white dark:bg-zinc-800 px-4 h-10 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 shadow-md active:scale-90 transition-all min-w-[7rem]"
                  >
                    {lang === 'ko' ? '파일 업로드' : 'File Upload'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleStep4}
                  disabled={isSubmitting}
                  className="flex items-center justify-center gap-1.5 rounded-md bg-violet-600 px-4 h-10 text-white hover:bg-violet-700 disabled:opacity-50 shadow-md active:scale-90 transition-all min-w-[7rem]"
                >
                  {isSubmitting ? (lang === 'ko' ? '가입 중…' : 'Signing up…') : (enrollments.length > 0 ? (lang === 'ko' ? <>확인 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></> : <>Confirm <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></>) : (lang === 'ko' ? <>건너뛰기 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></> : <>Skip <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></>))}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 엑셀(.xlsx) 업로드 다이얼로그 */}
        {xlsxDialogOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 dark:bg-black/70" onClick={handleXlsxDialogClose}>
            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">{lang === 'ko' ? '파일 업로드' : 'File Upload'}</h3>
                <button
                  type="button"
                  onClick={handleXlsxDialogClose}
                  disabled={xlsxLoading}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {lang === 'ko' ? <>‘<a href="https://erp.kaist.ac.kr" target="_blank" rel="noopener noreferrer" className="text-violet-500 font-medium hover:underline">ERP</a> → 학사 → 성적 → 성적조회’ 메뉴에서 내려받은 .xlsx 파일을 업로드하여 수강한 과목을 일괄 등록할 수 있습니다.</> : <>Upload an .xlsx file downloaded from the ‘<a href="https://erp.kaist.ac.kr" target="_blank" rel="noopener noreferrer" className="text-violet-500 font-medium hover:underline">ERP</a> → Academic&nbsp;Affairs → Grades → Grade&nbsp;Report’ menu to bulk register enrolled courses.</>}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {lang === 'ko' ? '주의: 기존에 등록한 과목들은 모두 삭제됩니다.' : 'Note: All existing enrollments will be deleted.'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {lang === 'ko' ? '주의: 특강, 개별연구, 세미나 과목은 올바르게 처리되지 않을 수 있습니다.' : 'Note: Special lectures, independent study, and seminar courses may not be processed correctly.'}
              </p>
              <input
                ref={xlsxInputRef}
                type="file"
                accept=".xlsx"
                onChange={handleXlsxFileChange}
                className="block w-full text-sm text-gray-600 dark:text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-violet-50 file:text-violet-700 dark:file:bg-violet-900/30 dark:file:text-violet-300 hover:file:bg-violet-100 dark:hover:file:bg-violet-900/50"
              />
              {xlsxLoading && (
                <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>{lang === 'ko' ? '파일 읽는 중...' : 'Reading file...'}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 모바일: 하단 고정 다음 버튼 */}
        <div className="fixed bottom-0 left-0 right-0 z-20 flex flex-col items-center gap-3 bg-gray-50/50 dark:bg-zinc-900/50 backdrop-blur p-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:hidden">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4].map((s) => (
              <span key={s} className={`w-2 h-2 rounded-full ${s <= step ? 'bg-violet-600' : 'bg-gray-300 dark:bg-zinc-600'}`} />
            ))}
          </div>
          {step === 1 && (
            <button
              type="submit"
              form="signup-step1"
              disabled={isCheckingEmail}
              className="w-full flex items-center justify-center gap-1.5 rounded-md bg-violet-600 px-4 py-3 text-white hover:bg-violet-700 active:scale-96 transition-all shadow-md disabled:opacity-50"
            >
              {isCheckingEmail ? (lang === 'ko' ? '확인 중…' : 'Checking…') : (lang === 'ko' ? <>다음 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></> : <>Next <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></>)}
            </button>
          )}
          {step === 2 && (
            <button
              type="submit"
              form="signup-step2"
              className="w-full flex items-center justify-center gap-1.5 rounded-md bg-violet-600 px-4 py-3 text-white hover:bg-violet-700 active:scale-96 transition-all shadow-md"
            >
              {lang === 'ko' ? '다음' : 'Next'} <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          )}
          {step === 3 && (
            <button
              type="submit"
              form="signup-step3"
              className="w-full flex items-center justify-center gap-1.5 rounded-md bg-violet-600 px-4 py-3 text-white hover:bg-violet-700 active:scale-96 transition-all shadow-md"
            >
              {lang === 'ko' ? '다음' : 'Next'} <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          )}
          {step === 4 && (
            <div className="w-full flex items-center gap-2">
              {xlsxApplying ? (
                <div className="flex items-center justify-center gap-1.5 rounded-md bg-white dark:bg-zinc-800 px-4 h-12 shadow-md flex-1 min-w-0">
                  <svg className="animate-spin h-5 w-5 text-gray-500 dark:text-gray-400 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm text-gray-600 dark:text-gray-400">{lang === 'ko' ? '적용 중…' : 'Applying…'}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleXlsxButtonClick}
                  className="flex-1 flex items-center justify-center rounded-md bg-white dark:bg-zinc-800 px-4 h-12 text-sm hover:bg-gray-100 dark:hover:bg-zinc-700 shadow-md active:scale-96 transition-all min-w-0"
                >
                  {lang === 'ko' ? '파일 업로드' : 'File Upload'}
                </button>
              )}
              <button
                type="button"
                onClick={handleStep4}
                disabled={isSubmitting}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-violet-600 px-4 h-12 text-white hover:bg-violet-700 disabled:opacity-50 active:scale-96 transition-all shadow-md min-w-0"
              >
                {isSubmitting ? (lang === 'ko' ? '가입 중…' : 'Signing up…') : (enrollments.length > 0 ? (lang === 'ko' ? <>확인 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></> : <>Confirm <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></>) : (lang === 'ko' ? <>건너뛰기 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></> : <>Skip <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></>))}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
