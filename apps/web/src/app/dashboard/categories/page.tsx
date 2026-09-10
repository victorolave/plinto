import { CategoriesPanel } from '../../../features/categories/components/categories-panel'
import { sectionMetadata } from '../../../lib/section-metadata'

export const generateMetadata = sectionMetadata('categories')

export default function CategoriesPage() {
  return <CategoriesPanel />
}
