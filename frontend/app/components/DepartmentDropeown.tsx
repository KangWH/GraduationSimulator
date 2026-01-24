'use client';

import { useState, useEffect } from 'react';

interface DepartmentData {
  id: string;
  name: string;
  category: string;
  majorable: boolean;
  doubleMajorable: boolean;
  minorable: boolean;
}

interface DepartmentDropdownProps {
  value: string;
  onChange: (newValue: string) => void;
  mode: 'major' | 'doubleMajor' | 'minor' | 'course';
  allowNone?: boolean;
  multipleChoices?: boolean;
}

export default function DepartmentDropdown({ value, onChange, mode, allowNone = false, multipleChoices = false }: DepartmentDropdownProps) {
  const [data, setData] = useState<DepartmentData[]>([]);

  useEffect(() => {
    fetch('http://localhost:4000/departments')
    .then(res => res.json())
    .then(data => {
      const allData = data as DepartmentData[]

      switch (mode) {
        case 'major':
          setData(allData.filter(d => d.majorable));
          break;
        case 'doubleMajor':
          setData(allData.filter(d => d.doubleMajorable));
          break;
        case 'minor':
          setData(allData.filter(d => d.minorable));
          break;
        case 'course':
          setData(allData);
          break;
      }
    });
  }, []);

  const groupedMajors = data.reduce((acc: Record<string, DepartmentData[]>, major) => {
    const { category } = major;
    if (!acc[category])
      acc[category] = [];
    acc[category].push(major);
    acc[category].sort((a, b) => a.name.localeCompare(b.name));
    return acc;
  }, {});

  return (
    <select
      value={value}
      onChange={(e) => {onChange(e.target.value)}}
      className="rounded-md border border-gray-300 dark:border-zinc-700 bg-white dark:bg-white rounded shadow-sm focus:border-violet-500 outline-none px-2 py-1 appearance-none text-sm"
    >
      {allowNone && (
        <option value="none">없음</option>
      )}
      {Object.entries(groupedMajors).map(([category, list]) => (
        <optgroup key={category} label={category}>
          {list.map(department => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
