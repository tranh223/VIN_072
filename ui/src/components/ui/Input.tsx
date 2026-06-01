import type { InputHTMLAttributes, ReactNode } from 'react';

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label?: string;
  hint?: string;
  error?: string;
  /** Icon bên trái (component Lucide hoặc SVG) */
  leftIcon?: ReactNode;
  /** Chiều cao trường (login dùng lg) */
  size?: 'md' | 'lg';
};

export function Input({
  label,
  hint,
  error,
  leftIcon,
  size = 'md',
  className = '',
  id,
  ...rest
}: InputProps) {
  const inputId = id ?? rest.name;
  const h = size === 'lg' ? 'min-h-14' : 'min-h-11';
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="ml-1 text-[10px] font-display font-bold uppercase tracking-widest text-outline"
        >
          {label}
        </label>
      )}
      <div
        className={`relative flex w-full items-center rounded-xl border bg-white transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/5 ${h} ${
          error ? 'border-red-400' : 'border-outline-variant'
        }`}
      >
        {leftIcon && (
          <span className="pointer-events-none absolute left-3.5 text-outline [&_svg]:size-[18px]">
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          className={`size-full rounded-xl bg-transparent px-4 py-2 text-sm text-on-surface outline-none placeholder:text-outline/60 ${
            leftIcon ? 'pl-11' : ''
          } ${className}`}
          {...rest}
        />
      </div>
      {hint && !error && (
        <p className="ml-1 text-[11px] text-outline">{hint}</p>
      )}
      {error && (
        <p className="ml-1 text-[11px] font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}
