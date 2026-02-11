'use client';

import { useState, useEffect } from 'react';
import { FieldSize, Select, MultipleSelect, Option } from './formFields';
import { API } from '../lib/api';

interface DepartmentData {
  id: string;
  name: string;
  nameEn?: string;
  category: string;
  categoryEn?: string;
  majorable: boolean;
  doubleMajorable: boolean;
  minorable: boolean;
}

interface DepartmentDropdownProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (newValue: string) => void;
  required?: boolean;
  mode: 'major' | 'doubleMajor' | 'minor' | 'course';
  allowNone?: boolean;
  size?: FieldSize;
  lang?: 'ko' | 'en';
}

export function DepartmentDropdown({ id, name, value, onChange, required = false, mode, allowNone = false, size = 'medium', lang = 'ko' }: DepartmentDropdownProps) {
  const [data, setData] = useState<DepartmentData[]>([]);

  useEffect(() => {
    fetch(`${API}/departments`)
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

  const getDisplayName = (d: DepartmentData) => (lang === 'en' && d.nameEn ? d.nameEn : d.name);
  const groupedMajors = data.reduce((acc: Record<string, DepartmentData[]>, major) => {
    const { category } = major;
    if (!acc[category])
      acc[category] = [];
    acc[category].push(major);
    acc[category].sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));
    return acc;
  }, {});

  return (
    <Select
      id={id}
      name={name}
      value={value}
      onChange={(newValue) => onChange(newValue)}
      required={required}
      size={size}
    >
      {allowNone && (
        <option value="none">{lang === 'en' ? 'None' : '없음'}</option>
      )}
      {Object.entries(groupedMajors)
        .map(([category, list]) => {
          const categoryLabel = lang === 'en' && list[0]?.categoryEn ? list[0].categoryEn : category;
          return { category, categoryLabel, list } as const;
        })
        .sort((a, b) => a.categoryLabel.localeCompare(b.categoryLabel))
        .map(({ category, categoryLabel, list }) => (
          <optgroup key={category} label={categoryLabel}>
            {list.map(department => (
              <option key={department.id} value={department.id}>
                {lang === 'en' && department.nameEn ? department.nameEn : department.name}
              </option>
            ))}
          </optgroup>
        ))}
    </Select>
  )
}

interface MultipleDepartmentDropdownProps {
  id?: string;
  name?: string;
  value: string[];
  onChange: (newValue: string[]) => void;
  required?: boolean;
  mode: 'major' | 'doubleMajor' | 'minor' | 'course';
  allowNone?: boolean;
  size?: FieldSize;
  className?: string;
  lang?: 'ko' | 'en';
}

export function MultipleDepartmentDropdown({ id, name, value, onChange, required = false, mode, allowNone = false, size = 'medium', className = '', lang = 'ko' }: MultipleDepartmentDropdownProps) {
  const [data, setData] = useState<DepartmentData[]>([]);

  useEffect(() => {
    fetch(`${API}/departments`)
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

  const getDisplayName = (d: DepartmentData) => (lang === 'en' && d.nameEn ? d.nameEn : d.name);
  const groupedMajors = data.reduce((acc: Record<string, DepartmentData[]>, major) => {
    const { category } = major;
    if (!acc[category])
      acc[category] = [];
    acc[category].push(major);
    acc[category].sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)));
    return acc;
  }, {});

  const options: Option[] = [...data]
    .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
    .map(d => ({ label: getDisplayName(d), value: d.id }));

  return (
    <MultipleSelect
      id={id}
      name={name}
      value={value}
      options={options}
      onChange={(newValues) => onChange(newValues)}
      size={size}
      allowNone={allowNone}
      className={className}
      lang={lang}
    />
  )
}
