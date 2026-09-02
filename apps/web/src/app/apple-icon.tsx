import { ImageResponse } from 'next/og'

// iOS ignores SVG favicons, so the same mark is rasterised here at build time.
// Keep the shapes in step with icon.svg — this is the one place they are
// duplicated, and only because Apple needs a PNG. No edge runtime: on the
// default runtime the PNG is prerendered once at build time instead of on
// every request.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: '#0a0a0a' }}>
        <svg width="180" height="180" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="#ffffff"
            fillRule="evenodd"
            d="M11 9h24a16 16 0 0 1 0 32H22v23H11z M22 19v12h13a6 6 0 0 0 0-12z"
          />
          <rect x="0" y="43" width="11" height="9" fill="#ffffff" />
          <rect x="0" y="52" width="11" height="12" fill="#e8492c" />
        </svg>
      </div>
    ),
    size,
  )
}
