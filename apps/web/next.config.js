const createNextIntlPlugin = require('next-intl/plugin')

// Points the plugin at our request config. The path is explicit because the
// locale is resolved from a cookie, not from a `[locale]` route segment — there
// is no routing convention for the plugin to infer it from.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Self-host packaging (ADR 0005): produces `.next/standalone`, a
  // self-contained server bundle with only the production dependencies this
  // app actually traces through its import graph. The Docker runtime image
  // copies just that bundle plus `.next/static` and `public` rather than the
  // full node_modules tree, which is what keeps the web image small.
  output: 'standalone',
}

module.exports = withNextIntl(nextConfig)
