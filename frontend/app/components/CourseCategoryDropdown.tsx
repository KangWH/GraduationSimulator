'use client';

import { useState, useEffect } from 'react';
import { FieldSize, Select, MultipleSelect, Option } from './formFields';
import { API } from '../lib/api';

interface CourseCategoryData {
  id: string;
  name: string;
}

interface CourseCategoryDropdownProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (newValue: string) => void;
  required?: boolean;
  allowNone?: boolean;
  size?: FieldSize;
  className?: string;
}

export function CourseCategoryDropdown({ id, name, value, onChange, required = false, allowNone = false, size = 'medium', className = '' }: CourseCategoryDropdownProps) {
  const [data, setData] = useState<CourseCategoryData[]>([]);

  useEffect(() => {
    fetch(`${API}/courseCategories`)
    .then(res => res.json())
    .then(data => {
      setData(data as CourseCategoryData[])
    });
  }, []);

  return (
    <Select
      id={id}
      name={name}
      value={value}
      onChange={(newValue) => onChange(newValue)}
      required={required}
      size={size}
      className={className}
    >
      {allowNone && (
        <option value="none">없음</option>
      )}
      {data.map(({ id, name }) => (
        <option key={id} value={id}>
          {name}
        </option>
      ))}
    </Select>
  )
}

interface MultipleCourseCategoryDropdownProps {
  id?: string;
  name?: string;
  value: string[];
  onChange: (newValue: string[]) => void;
  required?: boolean;
  mode: 'major' | 'doubleMajor' | 'minor' | 'course';
  allowNone?: boolean;
  size?: FieldSize;
  className?: string;
}

export function MultipleDepartmentDropdown({ id, name, value, onChange, required = false, mode, allowNone = false, size = 'medium', className = '' }: MultipleCourseCategoryDropdownProps) {
  const [data, setData] = useState<CourseCategoryData[]>([]);

  useEffect(() => {
    fetch(`${API}/departments`)
    .then(res => res.json())
    .then(data => {
      setData(data as CourseCategoryData[])
    });
  }, []);

  const options: Option[] = data.map(d => ({
    label: d.name, value: d.id
  }));

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
    />
  )
}
