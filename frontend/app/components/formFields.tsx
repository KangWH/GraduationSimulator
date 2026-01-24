import { ReactNode } from "react";

export type FieldSize = 'small' | 'medium' | 'large';
const fieldSizeClassNames: Record<FieldSize, string> = {
  'small': 'text-sm px-2 py-1',
  'medium': 'text-md px-3 py-2',
  'large': 'text-lg px-4 py-3'
};

interface InputProps {
  id?: string;
  name?: string;
  value: any;
  onChange: (newValue: any) => void;
  type: 'text' | 'email' | 'url' | 'password';
  required?: boolean;
  placeholder?: string;
  size?: FieldSize;
}

export function Input({ id, name, value, onChange, type = 'text', required = false, placeholder, size = 'medium' }: InputProps) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      value={value}
      onChange={(e) => {onChange(e.target.value)}}
      required={required}
      placeholder={placeholder}
      className={
        "w-full bg-white dark:bg-black shadow-sm border border-gray-300 dark:border-zinc-700 focus:border-violet-500 rounded-md outline-none appearance-none "
        + fieldSizeClassNames[size]
      }
    />
  )
}

interface NumberInputProps {
  id?: string;
  name?: string;
  min?: string;
  max?: string;
  step?: string;
  value: any;
  onChange: (newValue: any) => void;
  type?: 'number';
  required?: boolean;
  placeholder?: string;
  size?: FieldSize;
}

export function NumberInput({ id, name, min = '0', max = '100', step = '1', value, onChange, type = 'number', required = false, placeholder, size = 'medium' }: NumberInputProps) {
  return (
    <div
      className={
        "flex flex-row w-full bg-white dark:bg-black shadow-sm border border-gray-300 dark:border-zinc-700 focus-within:border-violet-500 rounded-md overflow-hidden"
      }
    >
      <input
        id={id}
        name={name}
        type={type}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {onChange(e.target.value)}}
        required={required}
        placeholder={placeholder}
        className={"grow outline-none appearance-none " + fieldSizeClassNames[size] /* + " pr-0" */}
        style={{ WebkitAppearance: 'none' }}
      />
      {/* <div className="ml-1 w-4 flex flex-col items-stretch">
        <button className="grow bg-green-300"></button>
        <button className="grow bg-red-300"></button>
      </div> */}
    </div>
  )
}


interface SelectProps {
  id?: string;
  name?: string;
  value: any;
  onChange: (newValue: any) => void;
  required?: boolean;
  size?: FieldSize;
  children?: ReactNode;
}

export function Select({ id, name, value, onChange, required, size = 'medium', children }: SelectProps) {
  return (
    <div>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className={
          "w-full bg-white dark:bg-black shadow-sm border border-gray-300 dark:border-zinc-700 focus:border-violet-500 rounded-md outline-none appearance-none "
          + fieldSizeClassNames[size]
        }
      >
        {children}
      </select>
    </div>
  )
}