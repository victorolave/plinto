import { Settings } from '../../../components/ui/icons'

export default function SettingsPage() {
  return (
    <div className="page">
      <div className="plinto-card">
        <div className="empty-state">
          <span className="stat-icon">
            <Settings size={18} />
          </span>
          <strong style={{ color: 'var(--text-strong)' }}>Settings</strong>
          <p className="muted">
            Household and member settings live here. This area is coming next.
          </p>
        </div>
      </div>
    </div>
  )
}
