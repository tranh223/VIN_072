import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const variantClass: Record<Variant, string> = {
  primary:
    'bg-primary text-white shadow-lg shadow-primary/20 hover:opacity-90 active:scale-[0.98]',
  secondary:
    'bg-primary-container text-white shadow-lg shadow-primary/15 hover:opacity-90 active:scale-[0.98]',
  outline:
    'border-2 border-outline-variant bg-white text-on-surface hover:bg-surface',
  ghost: 'text-outline hover:bg-surface hover:text-primary',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]',
};

const sizeClass: Record<Size, string> = {
  sm: 'h-9 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-14 px-6 text-sm gap-2 rounded-2xl',
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  /** full width on container */
  block?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`group inline-flex items-center justify-center font-display font-bold transition-all disabled:pointer-events-none disabled:opacity-50 ${variantClass[variant]} ${sizeClass[size]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
