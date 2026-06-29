import { useId } from 'react'
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'

export interface FieldProps {
  label?: ReactNode
  hint?: ReactNode
  htmlFor?: string
  children: ReactNode
  className?: string
}

/** Label + control wrapper. Pairs with Input/Select or any control. */
export function Field({ label, hint, htmlFor, children, className = '' }: FieldProps) {
  return (
    <div className={`field ${className}`.trim()}>
      {label ? (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  )
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: ReactNode
  prefix?: string
}

export function Input({ leftIcon, prefix, className = '', ...rest }: InputProps) {
  if (leftIcon || prefix) {
    return (
      <div className="input-group">
        {leftIcon ? <span className="input-group-icon">{leftIcon}</span> : null}
        {prefix ? <span className="input-prefix">{prefix}</span> : null}
        <input
          className={`input ${prefix ? 'has-prefix' : ''} ${className}`.trim()}
          {...rest}
        />
      </div>
    )
  }
  return <input className={`input ${className}`.trim()} {...rest} />
}

export function Select({
  className = '',
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`select ${className}`.trim()} {...rest}>
      {children}
    </select>
  )
}

export interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
  name?: string
}

/** Segmented toggle used for the transaction type switch. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="segmented" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          className={`segmented-option ${value === option.value ? 'is-active' : ''}`.trim()}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Stable id helper for label/control association. */
export function useFieldId(provided?: string) {
  const generated = useId()
  return provided ?? generated
}
