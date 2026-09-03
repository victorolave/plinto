import { MembersPanel } from '../../../features/members/components/members-panel'
import { DataExportCard } from '../../../features/settings/components/data-export-card'
import { ExampleHouseholdCard } from '../../../features/settings/components/example-household-card'
import { HelpCard } from '../../../features/settings/components/help-card'
import { LanguageSelector } from '../../../features/settings/components/language-selector'
import { sectionMetadata } from '../../../lib/section-metadata'

export const generateMetadata = sectionMetadata('settings')

export default function SettingsPage() {
  return (
    <>
      <MembersPanel />
      {/* Outside MembersPanel on purpose, but inside the same `.page` as the
          language selector below: exporting the household is a property of
          the household itself (owner-only, like membership), not a per-user
          preference the way the language choice is — it belongs with the
          household-scoped settings, above the one that is per-browser. */}
      <div className="page">
        <DataExportCard />
        <ExampleHouseholdCard />
        {/* Household-level help (replay the tour / bring back first steps),
            same tier as export and the example household — placed below
            them and above the per-browser language selector so the
            household-scoped settings stay grouped together. */}
        <HelpCard />
        <LanguageSelector />
      </div>
    </>
  )
}
