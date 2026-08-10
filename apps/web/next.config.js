const createNextIntlPlugin = require('next-intl/plugin')

// Points the plugin at our request config. The path is explicit because the
// locale is resolved from a cookie, not from a `[locale]` route segment — there
// is no routing convention for the plugin to infer it from.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
}

module.exports = withNextIntl(nextConfig)
