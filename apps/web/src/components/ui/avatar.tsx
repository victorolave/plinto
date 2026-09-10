export interface AvatarProps {
  name: string
  size?: 'sm' | 'md'
  className?: string
}

/** Derive up to two uppercase initials from a display name. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({ name, size = 'md', className = '' }: AvatarProps) {
  return (
    <span
      className={`avatar avatar--${size} ${className}`.trim()}
      title={name}
      aria-label={name}
    >
      {initialsOf(name)}
    </span>
  )
}
