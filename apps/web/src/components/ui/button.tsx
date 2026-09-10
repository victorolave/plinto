import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'sm'

const variantClass: Record<Variant, string> = {
  primary: '',
  secondary: 'btn--secondary',
  ghost: 'btn--ghost',
  danger: 'btn--danger',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  block?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  leftIcon,
  rightIcon,
  className = '',
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  const classes = [
    'btn',
    variantClass[variant],
    size === 'sm' ? 'btn--sm' : '',
    block ? 'btn--block' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    // eslint-disable-next-line react/button-has-type
    <button type={type} className={classes} {...rest}>
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  )
}

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  children: ReactNode
}

export function IconButton({
  label,
  className = '',
  type = 'button',
  children,
  ...rest
}: IconButtonProps) {
  return (
    // eslint-disable-next-line react/button-has-type
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`icon-btn ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  )
}
