'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input, Select, NumberInput } from '../components/formFields';
import { DepartmentDropdown } from '../components/DepartmentDropdown';
import { API } from '../lib/api';

type Tab = 'courses' | 'general' | 'major' | 'substitutions';

interface GeneralEdRequirement {
  id: string;
  year: number;
  type: string;
  requirements: any;
}

interface MajorRequirement {
  id: string;
  year: number;
  department: string;
  type: string;
  requirements: any;
}

interface CourseSubstitution {
  id: string;
  originalCourseCode: string;
  substituteCourseCode: string;
  department: string | null;
  startYear: number;
  endYear: number | null;
  description: string | null;
}

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('courses');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // 인증 확인
  useEffect(() => {
    const auth = localStorage.getItem('adminAuthenticated');
    if (auth !== 'true') {
      router.push('/admin/login');
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('adminAuthenticated');
    router.push('/admin/login');
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="bg-white dark:bg-zinc-900 dark:border-zinc-700 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4 border-b border-gray-200 dark:border-zinc-700">
            <h1 className="text-2xl font-bold flex-shrink-0">관리자 페이지</h1>
            <div className="flex space-x-1 flex-1 justify-center">
              <button
                onClick={() => setActiveTab('courses')}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === 'courses'
                    ? 'border-b-2 border-violet-500 text-violet-600 dark:text-violet-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                과목
              </button>
              <button
                onClick={() => setActiveTab('general')}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === 'general'
                    ? 'border-b-2 border-violet-500 text-violet-600 dark:text-violet-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                졸업요건(공통)
              </button>
              <button
                onClick={() => setActiveTab('major')}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === 'major'
                    ? 'border-b-2 border-violet-500 text-violet-600 dark:text-violet-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                졸업요건(학과별)
              </button>
              <button
                onClick={() => setActiveTab('substitutions')}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === 'substitutions'
                    ? 'border-b-2 border-violet-500 text-violet-600 dark:text-violet-400'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                대체과목
              </button>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex-shrink-0"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'courses' && <CoursesTab />}
        {activeTab === 'general' && <GeneralEdRequirementsTab />}
        {activeTab === 'major' && <MajorRequirementsTab />}
        {activeTab === 'substitutions' && <SubstitutionsTab />}
      </div>
    </div>
  );
}

// 과목 탭
function CoursesTab() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setMessage(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      alert('파일을 선택해주세요.');
      return;
    }

    setUploading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('csv', file);

    try {
      const res = await fetch(`${API}/admin/courses/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setMessage(`성공: ${data.message}`);
        setFile(null);
        // 파일 input 초기화
        const fileInput = document.getElementById('csv-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        setMessage(`오류: ${data.message}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setMessage('업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">과목 정보 업데이트</h2>
      <form onSubmit={handleUpload} className="space-y-4">
        <div>
          <label htmlFor="csv-file" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            CSV 파일 선택
          </label>
          <input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 dark:file:bg-violet-900 dark:file:text-violet-300"
            required
          />
        </div>
        {message && (
          <div className={`p-3 rounded-md ${message.startsWith('성공') ? 'bg-green-50 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-50 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
            {message}
          </div>
        )}
        <button
          type="submit"
          disabled={uploading || !file}
          className="px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {uploading ? '업로드 중...' : '업로드'}
        </button>
      </form>
    </div>
  );
}

// 졸업요건(공통) 탭: 행=연도, 열=구분(기필·인선·교필 등), 전공 탭과 같은 테이블 형태
const GENERAL_ED_TYPE_COLUMNS = [
  { value: 'GENERAL', label: '일반 요건' },
  { value: 'BR', label: '기초필수' },
  { value: 'MGC', label: '교양필수' },
  { value: 'HSE', label: '인문사회선택' },
  { value: 'HSE_D', label: '인문사회선택 (복수전공)' },
  { value: 'IDM', label: '자유융합전공' },
] as const;

function GeneralEdRequirementsTab() {
  const [requirements, setRequirements] = useState<GeneralEdRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    year: '',
    type: '',
    requirements: '',
  });

  useEffect(() => {
    loadRequirements();
  }, []);

  const loadRequirements = async () => {
    try {
      const res = await fetch(`${API}/admin/general-ed-requirements`);
      const data = await res.json();
      if (data.success) {
        setRequirements(data.data);
      }
    } catch (error) {
      console.error('Error loading requirements:', error);
    } finally {
      setLoading(false);
    }
  };

  // type별 요건 목록 (연도 순)
  const byType = (() => {
    const map = new Map<string, GeneralEdRequirement[]>();
    for (const req of requirements) {
      if (!map.has(req.type)) map.set(req.type, []);
      map.get(req.type)!.push(req);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.year - b.year);
    }
    return map;
  })();

  const handleCreate = () => {
    setEditingId(null);
    setFormData({ year: '', type: '', requirements: '' });
  };

  const handleAddForCell = (type: string) => {
    setEditingId(null);
    setFormData({ year: '', type, requirements: '' });
  };

  const handleEdit = (req: GeneralEdRequirement) => {
    setEditingId(req.id);
    setFormData({
      year: req.year.toString(),
      type: req.type,
      requirements: typeof req.requirements === 'string' ? req.requirements : JSON.stringify(req.requirements, null, 2),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId
        ? `${API}/admin/general-ed-requirements/${editingId}`
        : `${API}/admin/general-ed-requirements`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: parseInt(formData.year),
          type: formData.type,
          requirements: formData.requirements,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message);
        loadRequirements();
        setEditingId(null);
        setFormData({ year: '', type: '', requirements: '' });
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error('Error saving requirement:', error);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`${API}/admin/general-ed-requirements/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message);
        loadRequirements();
      } else {
        alert(`오류: ${data.message}`);
      }
    } catch (error: any) {
      console.error('Error deleting requirement:', error);
      const errorMessage = error?.message || '삭제 중 오류가 발생했습니다.';
      alert(`삭제 중 오류가 발생했습니다: ${errorMessage}`);
    }
  };

  if (loading) {
    return <div className="text-center py-8">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">
          {editingId ? '졸업요건(공통) 수정' : '졸업요건(공통) 생성'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-row gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                연도
              </label>
              <NumberInput
                value={formData.year}
                onChange={(val) => setFormData({ ...formData, year: val })}
                required
                min="2000"
                max="2100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                구분
              </label>
              <Select
                value={formData.type}
                onChange={(val) => setFormData({ ...formData, type: val })}
                required
              >
                <option value="">선택하세요</option>
                {GENERAL_ED_TYPE_COLUMNS.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              요건 (JSON)
            </label>
            <textarea
              value={formData.requirements}
              onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
              required
              rows={10}
              className="w-full bg-white dark:bg-black border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 font-mono text-sm"
              placeholder='{"key": "value"}'
            />
          </div>
          <div className="flex space-x-2">
            <button
              type="submit"
              className="px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700"
            >
              {editingId ? '수정' : '생성'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCreate}
                className="px-4 py-2 bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600"
              >
                취소
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">졸업요건(공통) 목록</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          열: 구분(기필·인선·교필 등). 각 셀에 해당 구분의 요건을 연도 순으로 표시합니다.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700 border border-gray-200 dark:border-zinc-700">
            <thead className="bg-gray-50 dark:bg-zinc-800">
              <tr>
                {GENERAL_ED_TYPE_COLUMNS.map((col) => (
                  <th
                    key={col.value}
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap border-b border-r border-gray-200 dark:border-zinc-700 last:border-r-0"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-900">
              <tr className="divide-x divide-gray-200 dark:divide-zinc-700">
                {GENERAL_ED_TYPE_COLUMNS.map((col) => {
                  const list = byType.get(col.value) ?? [];
                  return (
                    <td
                      key={col.value}
                      className="px-2 py-2 text-sm align-top border-r border-gray-200 dark:border-zinc-700 last:border-r-0 min-w-[140px]"
                    >
                      <div className="space-y-1">
                        {list.map((req) => (
                          <div
                            key={req.id}
                            className="flex items-center justify-between gap-1 rounded bg-gray-50 dark:bg-zinc-800 px-2 py-1"
                          >
                            <span className="text-gray-700 dark:text-gray-300 text-xs">
                              {req.year}년
                            </span>
                            <span className="flex gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => handleEdit(req)}
                                className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 text-xs"
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(req.id)}
                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs"
                              >
                                삭제
                              </button>
                            </span>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleAddForCell(col.value)}
                          className="w-full text-xs text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 border border-dashed border-gray-300 dark:border-zinc-600 rounded px-2 py-1"
                        >
                          + 추가
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 졸업요건(학과별) 탭: 행=학과, 열=구분(type), 셀=해당 연도별 요건
const MAJOR_TYPE_COLUMNS = [
  { value: 'BE', label: '기초선택' },
  { value: 'BE_D', label: '기초선택 (복수전공)' },
  { value: 'Major', label: '주전공' },
  { value: 'DoubleMajor', label: '복수전공' },
  { value: 'Minor', label: '부전공' },
  { value: 'AdvancedMajor', label: '심화전공' },
  { value: 'RS', label: '연구' },
  { value: 'RS_D', label: '연구 (복수전공)' },
] as const;

function MajorRequirementsTab() {
  const [requirements, setRequirements] = useState<MajorRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    year: '',
    department: '',
    type: '',
    requirements: '',
  });

  useEffect(() => {
    loadRequirements();
  }, []);

  const loadRequirements = async () => {
    try {
      const res = await fetch(`${API}/admin/major-requirements`);
      const data = await res.json();
      if (data.success) {
        setRequirements(data.data);
      }
    } catch (error) {
      console.error('Error loading requirements:', error);
    } finally {
      setLoading(false);
    }
  };

  // (department, type)별로 요건을 연도 순 정리
  const byDeptAndType = (() => {
    const map = new Map<string, MajorRequirement[]>();
    for (const req of requirements) {
      const key = `${req.department}\t${req.type}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(req);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.year - b.year);
    }
    return map;
  })();

  // 테이블에 표시할 학과 목록 (데이터에 등장하는 학과만, 정렬)
  const departments = Array.from(
    new Set(requirements.map((r) => r.department))
  ).sort((a, b) => a.localeCompare(b));

  const handleCreate = () => {
    setEditingId(null);
    setFormData({ year: '', department: '', type: '', requirements: '' });
  };

  const handleEdit = (req: MajorRequirement) => {
    setEditingId(req.id);
    setFormData({
      year: req.year.toString(),
      department: req.department,
      type: req.type,
      requirements: typeof req.requirements === 'string' ? req.requirements : JSON.stringify(req.requirements, null, 2),
    });
  };

  const handleAddForCell = (department: string, type: string) => {
    setEditingId(null);
    setFormData({
      year: '',
      department,
      type,
      requirements: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingId
        ? `${API}/admin/major-requirements/${editingId}`
        : `${API}/admin/major-requirements`;
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: parseInt(formData.year),
          department: formData.department,
          type: formData.type,
          requirements: formData.requirements,
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message);
        loadRequirements();
        setEditingId(null);
        setFormData({ year: '', department: '', type: '', requirements: '' });
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error('Error saving requirement:', error);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`${API}/admin/major-requirements/${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message);
        loadRequirements();
      } else {
        alert(`오류: ${data.message}`);
      }
    } catch (error: any) {
      console.error('Error deleting requirement:', error);
      const errorMessage = error?.message || '삭제 중 오류가 발생했습니다.';
      alert(`삭제 중 오류가 발생했습니다: ${errorMessage}`);
    }
  };

  if (loading) {
    return <div className="text-center py-8">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">
          {editingId ? '졸업요건(학과별) 수정' : '졸업요건(학과별) 생성'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-row gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                연도
              </label>
              <NumberInput
                value={formData.year}
                onChange={(val) => setFormData({ ...formData, year: val })}
                required
                min="2000"
                max="2100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                학과
              </label>
              <DepartmentDropdown
                value={formData.department}
                onChange={(val) => setFormData({ ...formData, department: val })}
                mode="course"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                구분
              </label>
              <Select
                value={formData.type}
                onChange={(val) => setFormData({ ...formData, type: val })}
                required
              >
                <option value="">선택하세요</option>
                {MAJOR_TYPE_COLUMNS.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              요건 (JSON)
            </label>
            <textarea
              value={formData.requirements}
              onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
              required
              rows={10}
              className="w-full bg-white dark:bg-black border border-gray-300 dark:border-zinc-700 rounded-md px-3 py-2 font-mono text-sm"
              placeholder='{"key": "value"}'
            />
          </div>
          <div className="flex space-x-2">
            <button
              type="submit"
              className="px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700"
            >
              {editingId ? '수정' : '생성'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCreate}
                className="px-4 py-2 bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600"
              >
                취소
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">졸업요건(학과별) 목록</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          행: 학과, 열: 구분. 각 셀은 해당 학과·구분의 요건을 연도 순으로 표시합니다.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700 border border-gray-200 dark:border-zinc-700">
            <thead className="bg-gray-50 dark:bg-zinc-800">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border-b border-r border-gray-200 dark:border-zinc-700 sticky left-0 bg-gray-50 dark:bg-zinc-800 z-10">
                  학과
                </th>
                {MAJOR_TYPE_COLUMNS.map((col) => (
                  <th
                    key={col.value}
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap border-b border-r border-gray-200 dark:border-zinc-700 last:border-r-0"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
              {departments.length === 0 ? (
                <tr>
                  <td
                    colSpan={MAJOR_TYPE_COLUMNS.length + 1}
                    className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                  >
                    등록된 요건이 없습니다. 위 폼에서 생성하세요.
                  </td>
                </tr>
              ) : (
                departments.map((dept) => (
                  <tr key={dept} className="divide-x divide-gray-200 dark:divide-zinc-700">
                    <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap border-r border-gray-200 dark:border-zinc-700 sticky left-0 bg-white dark:bg-zinc-900 z-10">
                      {dept}
                    </td>
                    {MAJOR_TYPE_COLUMNS.map((col) => {
                      const key = `${dept}\t${col.value}`;
                      const list = byDeptAndType.get(key) ?? [];
                      return (
                        <td
                          key={col.value}
                          className="px-2 py-2 text-sm align-top border-r border-gray-200 dark:border-zinc-700 last:border-r-0 min-w-[140px]"
                        >
                          <div className="space-y-1">
                            {list.map((req) => (
                              <div
                                key={req.id}
                                className="flex items-center justify-between gap-1 rounded bg-gray-50 dark:bg-zinc-800 px-2 py-1"
                              >
                                <span className="text-gray-700 dark:text-gray-300">
                                  {req.year}년
                                </span>
                                <span className="flex gap-1 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleEdit(req)}
                                    className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 text-xs"
                                  >
                                    수정
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(req.id)}
                                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs"
                                  >
                                    삭제
                                  </button>
                                </span>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => handleAddForCell(dept, col.value)}
                              className="w-full text-xs text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 border border-dashed border-gray-300 dark:border-zinc-600 rounded px-2 py-1"
                            >
                              + 추가
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 대체과목 관리 탭
function SubstitutionsTab() {
  const [substitutions, setSubstitutions] = useState<CourseSubstitution[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    originalCourseCode: '',
    substituteCourseCode: '',
    department: '',
    startYear: '',
    endYear: '',
    description: '',
  });

  useEffect(() => {
    loadSubstitutions();
  }, []);

  const loadSubstitutions = async () => {
    try {
      const res = await fetch(`${API}/admin/substitutions`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.error('Expected JSON but got:', contentType, text);
        throw new Error('Response is not JSON');
      }
      const data = await res.json();
      if (data.success) {
        setSubstitutions(data.data);
      }
    } catch (error) {
      console.error('Error loading substitutions:', error);
      // 빈 배열로 설정하여 UI가 깨지지 않도록 함
      setSubstitutions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingId(null);
    setShowForm(true);
    setFormData({
      originalCourseCode: '',
      substituteCourseCode: '',
      department: '',
      startYear: '',
      endYear: '',
      description: '',
    });
  };

  const handleEdit = (sub: CourseSubstitution) => {
    setEditingId(sub.id);
    setShowForm(true);
    setFormData({
      originalCourseCode: sub.originalCourseCode,
      substituteCourseCode: sub.substituteCourseCode,
      department: sub.department || '',
      startYear: sub.startYear.toString(),
      endYear: sub.endYear?.toString() || '',
      description: sub.description || '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body = {
        originalCourseCode: formData.originalCourseCode,
        substituteCourseCode: formData.substituteCourseCode,
        department: formData.department || null,
        startYear: parseInt(formData.startYear),
        endYear: formData.endYear ? parseInt(formData.endYear) : null,
        description: formData.description || null,
      };

      if (editingId) {
        const res = await fetch(`${API}/admin/substitutions/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.success) {
          await loadSubstitutions();
          setShowForm(false);
          handleCreate();
        } else {
          alert(data.message || '수정에 실패했습니다.');
        }
      } else {
        const res = await fetch(`${API}/admin/substitutions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (data.success) {
          await loadSubstitutions();
          setShowForm(false);
          handleCreate();
        } else {
          alert(data.message || '생성에 실패했습니다.');
        }
      }
    } catch (error) {
      console.error('Error saving substitution:', error);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`${API}/admin/substitutions/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        await loadSubstitutions();
      } else {
        alert(data.message || '삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error deleting substitution:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return <div className="text-center py-8">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">대체과목 관리</h2>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600"
        >
          새 대체과목 추가
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-md space-y-4">
          <h3 className="text-lg font-semibold mb-4">
            {editingId ? '대체과목 수정' : '새 대체과목 추가'}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">원본 과목 코드</label>
              <Input
                type="text"
                value={formData.originalCourseCode}
                onChange={(val) => setFormData({ ...formData, originalCourseCode: val })}
                placeholder="예: EE.20100"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">대체 과목 코드</label>
              <Input
                type="text"
                value={formData.substituteCourseCode}
                onChange={(val) => setFormData({ ...formData, substituteCourseCode: val })}
                placeholder="예: CS.10100"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">학과 코드 (선택, 비우면 전역 규칙)</label>
              <Input
                type="text"
                value={formData.department}
                onChange={(val) => setFormData({ ...formData, department: val })}
                placeholder="예: EE 또는 비워두기"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">적용 시작 연도</label>
              <NumberInput
                value={formData.startYear}
                onChange={(val) => setFormData({ ...formData, startYear: val })}
                placeholder="예: 2020"
                required
                min="2000"
                max="2100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">적용 중지 연도 (선택, 비우면 현재도 적용)</label>
              <NumberInput
                value={formData.endYear}
                onChange={(val) => setFormData({ ...formData, endYear: val })}
                placeholder="예: 2025 또는 비워두기"
                min="2000"
                max="2100"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">설명 (선택)</label>
              <Input
                type="text"
                value={formData.description}
                onChange={(val) => setFormData({ ...formData, description: val })}
                placeholder="설명을 입력하세요"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-violet-600 text-white rounded-md hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600"
            >
              {editingId ? '수정' : '생성'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                handleCreate();
              }}
              className="px-4 py-2 bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-zinc-600"
            >
              취소
            </button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
            <thead className="bg-gray-50 dark:bg-zinc-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  원본 과목
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  대체 과목
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  학과
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  적용 기간
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  설명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
              {substitutions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    대체과목이 없습니다.
                  </td>
                </tr>
              ) : (
                substitutions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {sub.originalCourseCode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {sub.substituteCourseCode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {sub.department || '(전역)'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {sub.startYear} ~ {sub.endYear || '현재'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {sub.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleEdit(sub)}
                        className="text-violet-600 hover:text-violet-900 dark:text-violet-400 dark:hover:text-violet-300 mr-4"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(sub.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
