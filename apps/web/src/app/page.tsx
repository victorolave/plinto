import { LogoutButton } from '../components/layout/logout-button'

export default function HomePage() {
  return (
    <div>
      <header className="app-header">
        <div></div>
        <LogoutButton />
      </header>
      <main className="page-shell">
        <h1>Plinto</h1>
        <p>Welcome to Plinto.</p>
      </main>
    </div>
  )
}
