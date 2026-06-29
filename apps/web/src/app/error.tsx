'use client'

import { Button } from '../components/ui/button'
import { AuthLayout } from '../components/layout/auth-layout'

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <AuthLayout
      eyebrow="Error"
      title="Something went wrong"
      subtitle="An unexpected error occurred. Please try again."
    >
      <Button onClick={reset} block>
        Try again
      </Button>
    </AuthLayout>
  )
}
