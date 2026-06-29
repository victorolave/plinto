import { AuthLayout } from '../components/layout/auth-layout'

export default function NotFound() {
  return (
    <AuthLayout
      eyebrow="404"
      title="Page not found"
      subtitle="The page you’re looking for doesn’t exist."
    >
      <a href="/dashboard" className="btn btn--block">
        Back to dashboard
      </a>
    </AuthLayout>
  )
}
