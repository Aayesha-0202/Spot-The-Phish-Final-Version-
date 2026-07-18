import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-xl font-bold transition-all focus:outline-none focus:ring-2 focus:ring-white/50 active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
          {
            'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500': variant === 'primary',
            'glass text-white hover:bg-white/20': variant === 'secondary',
            'bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-600': variant === 'danger',
            'bg-transparent text-white hover:bg-white/10': variant === 'ghost',
            'px-3 py-2 text-sm': size === 'sm',
            'px-5 py-2.5 text-base': size === 'md',
            'px-8 py-4 text-lg font-bold': size === 'lg',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
