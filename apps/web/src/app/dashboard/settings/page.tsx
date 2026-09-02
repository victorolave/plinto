import { MembersPanel } from '../../../features/members/components/members-panel'
import { LanguageSelector } from '../../../features/settings/components/language-selector'
import { sectionMetadata } from '../../../lib/section-metadata'

export const generateMetadata = sectionMetadata('settings')

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
