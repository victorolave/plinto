import { MembersPanel } from '../../../features/members/components/members-panel'
import { LanguageSelector } from '../../../features/settings/components/language-selector'

export default function SettingsPage() {
  return (
    <>
      <MembersPanel />
      {/* Outside MembersPanel on purpose: the language is a per-user display
          preference, not a property of the household roster. */}
      <div className="page">
        <LanguageSelector />
      </div>
    </>
  )
}
