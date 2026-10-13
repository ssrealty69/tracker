'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  badge?: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: (string | SelectOption)[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  id?: string;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = '-- Select an option --',
  required = false,
  disabled = false,
  className = '',
  triggerClassName = '',
  id,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize options into { value, label } objects
  const rawOptions: SelectOption[] = options.map((opt) => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt;
  });

  // Prepend placeholder option at the top so user can explicitly pick it or leave unselected
  const hasEmptyOption = rawOptions.some((o) => o.value === '');
  const normalizedOptions: SelectOption[] =
    hasEmptyOption || !placeholder
      ? rawOptions
      : [{ value: '', label: placeholder }, ...rawOptions];

  const selectedOption = normalizedOptions.find((o) => o.value === value);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
  };

  const isValEmpty = !value || value === '';

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${isOpen ? 'z-40' : 'z-10'} ${className}`}
    >
      {/* Hidden input for form state */}
      <input
        type="text"
        id={id}
        value={value}
        readOnly
        tabIndex={-1}
        className="sr-only"
        aria-hidden="true"
      />

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold flex items-center justify-between gap-2 transition-all cursor-pointer outline-none shadow-2xs select-none ${
          isOpen
            ? 'border-indigo-600 ring-2 ring-indigo-100 shadow-sm'
            : 'hover:border-slate-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''} ${triggerClassName}`}
        aria-expanded={isOpen}
      >
        <span
          className={`truncate ${
            !isValEmpty ? 'text-slate-900 font-semibold' : 'text-slate-400 font-normal'
          }`}
        >
          {selectedOption && selectedOption.value !== '' ? selectedOption.label : placeholder}
        </span>

        <ChevronDown
          size={16}
          className={`text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-indigo-600' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div
          className="absolute left-0 right-0 top-full mt-1.5 w-full max-w-full bg-white border border-slate-200/90 rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto py-1 divide-y divide-slate-50 animate-scale-in"
          style={{
            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)',
          }}
        >
          {normalizedOptions.map((opt) => {
            const isSelected = opt.value === value;
            const isPlaceholderOpt = opt.value === '';
            return (
              <button
                key={opt.value || '__placeholder__'}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full px-3.5 py-2.5 text-xs sm:text-sm text-left flex items-center justify-between gap-2 transition-colors cursor-pointer select-none ${
                  isSelected
                    ? 'bg-indigo-50/90 text-indigo-700 font-bold'
                    : isPlaceholderOpt
                    ? 'text-slate-400 hover:bg-slate-50 hover:text-slate-600 font-medium italic'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-medium'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && (
                  <Check size={14} className="text-indigo-600 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
