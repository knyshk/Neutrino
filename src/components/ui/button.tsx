'use client'

import { forwardRef, ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          {
            primary:
              'bg-violet-600 text-white hover:bg-violet-700 active:bg-violet-800 shadow-sm',
            secondary:
              'bg-neutral-100 text-neutral-900 hover:bg-neutral-200 active:bg-neutral-300',
            ghost:
              'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 active:bg-neutral-200',
            danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm',
            outline:
              'border border-neutral-200 text-neutral-700 hover:bg-neutral-50 active:bg-neutral-100',
          }[variant],
          {
            sm: 'h-7 px-3 text-xs',
            md: 'h-9 px-4 text-sm',
            lg: 'h-11 px-6 text-base',
            icon: 'h-8 w-8 p-0',
          }[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : null}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button }
