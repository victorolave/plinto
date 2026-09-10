/**
 * Lucide-style line icons (2px stroke, round caps) as typed React components.
 * Substitution for an official Plinto icon set — see design system ICONOGRAPHY.
 * Icons inherit text color via `currentColor`.
 */
import type { SVGProps } from 'react'

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'stroke'> {
  size?: number
  stroke?: number
}

function svg(
  { size = 20, stroke = 2, ...props }: IconProps,
  children: React.ReactNode,
) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export const Home = (p: IconProps) =>
  svg(p, [<path key="0" d="M3 11.5 12 4l9 7.5" />, <path key="1" d="M5 10v10h14V10" />])

export const Wallet = (p: IconProps) =>
  svg(p, [
    <path key="0" d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2" />,
    <path key="1" d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6" />,
    <circle key="2" cx="16" cy="13" r="1.3" />,
  ])

export const List = (p: IconProps) =>
  svg(p, [
    <path key="0" d="M8 6h13" />,
    <path key="1" d="M8 12h13" />,
    <path key="2" d="M8 18h13" />,
    <path key="3" d="M3 6h.01" />,
    <path key="4" d="M3 12h.01" />,
    <path key="5" d="M3 18h.01" />,
  ])

export const Chart = (p: IconProps) =>
  svg(p, [<path key="0" d="M3 3v18h18" />, <path key="1" d="M7 14l3-3 3 3 5-6" />])

export const Target = (p: IconProps) =>
  svg(p, [
    <circle key="0" cx="12" cy="12" r="8" />,
    <circle key="1" cx="12" cy="12" r="4" />,
    <circle key="2" cx="12" cy="12" r="0.6" fill="currentColor" />,
  ])

export const Settings = (p: IconProps) =>
  svg(p, [
    <circle key="0" cx="12" cy="12" r="3" />,
    <path
      key="1"
      d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"
    />,
  ])

export const Search = (p: IconProps) =>
  svg(p, [<circle key="0" cx="11" cy="11" r="7" />, <path key="1" d="M21 21l-4-4" />])

export const Plus = (p: IconProps) =>
  svg(p, [<path key="0" d="M12 5v14" />, <path key="1" d="M5 12h14" />])

export const Bell = (p: IconProps) =>
  svg(p, [
    <path key="0" d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />,
    <path key="1" d="M13.7 21a2 2 0 0 1-3.4 0" />,
  ])

export const Bank = (p: IconProps) =>
  svg(p, [
    <path key="0" d="M3 21h18" />,
    <path key="1" d="M5 21V10l7-5 7 5v11" />,
    <path key="2" d="M9 21v-6h6v6" />,
  ])

export const Piggy = (p: IconProps) =>
  svg(p, [
    <path key="0" d="M19 11c1.1 0 2 .9 2 2s-.9 2-2 2" />,
    <path
      key="1"
      d="M5 12a6 5 0 0 1 6-5h2a6 5 0 0 1 6 5v2a6 5 0 0 1-6 5H9l-3 2v-3.6A5 5 0 0 1 5 14z"
    />,
    <path key="2" d="M9 7l1-2h2" />,
    <circle key="3" cx="9.5" cy="12.5" r="0.6" fill="currentColor" />,
  ])

export const Cash = (p: IconProps) =>
  svg(p, [
    <rect key="0" x="2" y="6" width="20" height="12" rx="2" />,
    <circle key="1" cx="12" cy="12" r="2.5" />,
    <path key="2" d="M6 12h.01M18 12h.01" />,
  ])

export const Card = (p: IconProps) =>
  svg(p, [
    <rect key="0" x="2" y="5" width="20" height="14" rx="2" />,
    <path key="1" d="M2 10h20" />,
  ])

export const Cart = (p: IconProps) =>
  svg(p, [
    <circle key="0" cx="9" cy="20" r="1.4" />,
    <circle key="1" cx="18" cy="20" r="1.4" />,
    <path key="2" d="M2 3h3l2.6 12.4a1 1 0 0 0 1 .8h8.4a1 1 0 0 0 1-.8L21 7H6" />,
  ])

export const Briefcase = (p: IconProps) =>
  svg(p, [
    <rect key="0" x="3" y="7" width="18" height="13" rx="2" />,
    <path key="1" d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />,
  ])

export const ArrowSwap = (p: IconProps) =>
  svg(p, [
    <path key="0" d="M7 10l-3-3 3-3" />,
    <path key="1" d="M4 7h11" />,
    <path key="2" d="M17 14l3 3-3 3" />,
    <path key="3" d="M20 17H9" />,
  ])

export const Check = (p: IconProps) => svg(p, [<path key="0" d="M20 6 9 17l-5-5" />])

export const HelpCircle = (p: IconProps) =>
  svg(p, [
    <circle key="0" cx="12" cy="12" r="9" />,
    <path key="1" d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2-2.4 3.4" />,
    <circle key="2" cx="12" cy="17" r="0.6" fill="currentColor" />,
  ])

export const ChevronRight = (p: IconProps) =>
  svg(p, [<path key="0" d="M9 6l6 6-6 6" />])

export const ChevronDown = (p: IconProps) =>
  svg(p, [<path key="0" d="M6 9l6 6 6-6" />])

export const Filter = (p: IconProps) =>
  svg(p, [<path key="0" d="M3 5h18l-7 8v6l-4-2v-4z" />])

export const Download = (p: IconProps) =>
  svg(p, [
    <path key="0" d="M12 3v12" />,
    <path key="1" d="M7 11l5 5 5-5" />,
    <path key="2" d="M4 21h16" />,
  ])

export const Calendar = (p: IconProps) =>
  svg(p, [
    <rect key="0" x="3" y="5" width="18" height="16" rx="2" />,
    <path key="1" d="M3 9h18M8 3v4M16 3v4" />,
  ])

export const Users = (p: IconProps) =>
  svg(p, [
    <circle key="0" cx="9" cy="8" r="3" />,
    <path key="1" d="M3 20a6 6 0 0 1 12 0" />,
    <path key="2" d="M16 5a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.6" />,
  ])

export const Menu = (p: IconProps) =>
  svg(p, [
    <path key="0" d="M3 6h18" />,
    <path key="1" d="M3 12h18" />,
    <path key="2" d="M3 18h18" />,
  ])

export const X = (p: IconProps) =>
  svg(p, [<path key="0" d="M18 6 6 18" />, <path key="1" d="M6 6l12 12" />])

export const LogOut = (p: IconProps) =>
  svg(p, [
    <path key="0" d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />,
    <path key="1" d="M16 17l5-5-5-5" />,
    <path key="2" d="M21 12H9" />,
  ])

export const Pencil = (p: IconProps) =>
  svg(p, [
    <path key="0" d="M12 20h9" />,
    <path key="1" d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />,
  ])

export const Trash = (p: IconProps) =>
  svg(p, [
    <path key="0" d="M3 6h18" />,
    <path key="1" d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />,
    <path key="2" d="M6 6v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6" />,
    <path key="3" d="M10 11v6M14 11v6" />,
  ])

export const MoreVertical = (p: IconProps) =>
  svg(p, [
    <circle key="0" cx="12" cy="5" r="1" />,
    <circle key="1" cx="12" cy="12" r="1" />,
    <circle key="2" cx="12" cy="19" r="1" />,
  ])

export const Repeat = (p: IconProps) =>
  svg(p, [
    <path key="0" d="M17 2l4 4-4 4" />,
    <path key="1" d="M3 11V9a4 4 0 0 1 4-4h14" />,
    <path key="2" d="M7 22l-4-4 4-4" />,
    <path key="3" d="M21 13v2a4 4 0 0 1-4 4H3" />,
  ])

export const Tag = (p: IconProps) =>
  svg(p, [
    <path
      key="0"
      d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 3 12V5a2 2 0 0 1 2-2h7a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.6z"
    />,
    <circle key="1" cx="7.5" cy="7.5" r="1.2" fill="currentColor" />,
  ])

export const TrendUp = (p: IconProps) =>
  svg(p, [
    <path key="0" d="M3 17l6-6 4 4 8-8" />,
    <path key="1" d="M17 7h4v4" />,
  ])

export const TrendDown = (p: IconProps) =>
  svg(p, [
    <path key="0" d="M3 7l6 6 4-4 8 8" />,
    <path key="1" d="M17 17h4v-4" />,
  ])

/** Map an account type to its representative icon. */
export const accountTypeIcon = {
  cash: Cash,
  bank: Bank,
  credit: Card,
  savings: Piggy,
  debt: TrendDown,
} as const
