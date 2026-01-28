'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Input, Select, NumberInput } from '../components/formFields';
import { DepartmentDropdown } from '../components/DepartmentDropdown';
import { API } from '../lib/api';

type Tab = 'courses' | 'general' | 'major';

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

// 졸업요건(공통) 탭
function GeneralEdRequirementsTab() {
  const [requirements, setRequirements] = useState<GeneralEdRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    year: '',
    type: '',
    requirements: '',
  });

  const generalEdTypes = [
    { value: 'GENERAL', label: '일반 요건' },
    { value: 'BR', label: '기초필수' },
    { value: 'MGC', label: '교양필수' },
    { value: 'HSE', label: '인문사회선택' },
    { value: 'HSE_D', label: '인문사회선택 (복수전공 이수자)' },
    { value: 'IDM', label: '자유융합전공' },
  ];

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

  const handleCreate = () => {
    setEditingId(null);
    setFormData({ year: '', type: '', requirements: '' });
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
              {generalEdTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
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
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
            <thead className="bg-gray-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">연도</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">구분</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">작업</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
              {requirements.map((req) => (
                <tr key={req.id}>
                  <td className="px-4 py-3 text-sm">{req.year}</td>
                  <td className="px-4 py-3 text-sm">
                    {generalEdTypes.find(t => t.value === req.type)?.label || req.type}
                  </td>
                  <td className="px-4 py-3 text-sm space-x-2">
                    <button
                      onClick={() => handleEdit(req)}
                      className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(req.id)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {requirements.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              등록된 요건이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 졸업요건(학과별) 탭
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

  const majorTypes = [
    { value: 'BE', label: '기초선택' },
    { value: 'BE_D', label: '기초선택 (복수전공 이수자)' },
    { value: 'Major', label: '주전공' },
    { value: 'DoubleMajor', label: '복수전공' },
    { value: 'Minor', label: '부전공' },
    { value: 'AdvancedMajor', label: '심화전공' },
    { value: 'RS', label: '연구학점' },
    { value: 'RS_D', label: '연구학점 (복수전공 이수자)' },
  ];

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
              {majorTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
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
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700">
            <thead className="bg-gray-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">연도</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">학과</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">구분</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">작업</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
              {requirements.map((req) => (
                <tr key={req.id}>
                  <td className="px-4 py-3 text-sm">{req.year}</td>
                  <td className="px-4 py-3 text-sm">{req.department}</td>
                  <td className="px-4 py-3 text-sm">
                    {majorTypes.find(t => t.value === req.type)?.label || req.type}
                  </td>
                  <td className="px-4 py-3 text-sm space-x-2">
                    <button
                      onClick={() => handleEdit(req)}
                      className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(req.id)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {requirements.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              등록된 요건이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
