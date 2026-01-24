'use client';

import { useState, useEffect } from 'react';
import { FieldSize, Select, MultipleSelect, Option } from './formFields';

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
  size?: FieldSize
}

export function CourseCategoryDropdown({ id, name, value, onChange, required = false, allowNone = false, size = 'medium' }: CourseCategoryDropdownProps) {
  const [data, setData] = useState<CourseCategoryData[]>([]);

  useEffect(() => {
    fetch('http://localhost:4000/courseCategories')
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
