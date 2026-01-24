'use client';

import { useState, useEffect } from 'react';
import { FieldSize, Select, MultipleSelect, Option } from './formFields';

interface DepartmentData {
  id: string;
  name: string;
  category: string;
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
  size?: FieldSize
}

export function DepartmentDropdown({ id, name, value, onChange, required = false, mode, allowNone = false, size = 'medium' }: DepartmentDropdownProps) {
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
      {Object.entries(groupedMajors).map(([category, list]) => (
        <optgroup key={category} label={category}>
          {list.map(department => (
            <option key={department.id} value={department.id}>
              {department.name}
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
}

export function MultipleDepartmentDropdown({ id, name, value, onChange, required = false, mode, allowNone = false, size = 'medium', className = '' }: MultipleDepartmentDropdownProps) {
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

  const options: Option[] = data.map(d => ({
    label: d.name, value: d.id
  }))

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
