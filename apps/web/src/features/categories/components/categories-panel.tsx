'use client'

import { useState, useEffect } from 'react'
import {
  Category,
  deleteCategory,
  listCategories,
} from '../services/categories'
import { CategoryForm } from './category-form'
import { CategoriesSkeleton } from './categories-skeleton'
import { Card } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import { Modal } from '../../../components/ui/modal'
import { Drawer } from '../../../components/ui/drawer'
import { EmptyState } from '../../../components/ui/empty-state'
import { ActionsMenu } from '../../../components/ui/actions-menu'
import { Plus, Pencil, Trash, Tag } from '../../../components/ui/icons'

export function CategoriesPanel() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadCategories = async () => {
    const response = await listCategories()
    setCategories(response.data.categories)
  }

  useEffect(() => {
    const run = async () => {
      try {
        await loadCategories()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load categories')
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setDrawerOpen(true)
  }

  const openEdit = (category: Category) => {
    setEditing(category)
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setEditing(null)
  }

  const handleSaved = async () => {
    await loadCategories()
    closeDrawer()
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    setError(null)
    try {
      await deleteCategory(pendingDelete.id)
      setPendingDelete(null)
      await loadCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="page">
      {error ? <p className="error-text">{error}</p> : null}

      {!loading && categories.length > 0 ? (
        <div className="categories-head">
          <span className="muted">
            {categories.length} categor{categories.length > 1 ? 'ies' : 'y'}
          </span>
          <Button leftIcon={<Plus size={18} />} onClick={openCreate}>
            New category
          </Button>
        </div>
      ) : null}

      {!loading && categories.length === 0 ? (
        <EmptyState
          icon={<Tag size={30} />}
          title="No categories yet"
          description="Categories label your income and expenses so you can see where the money actually goes."
          action={
            <Button leftIcon={<Plus size={18} />} onClick={openCreate}>
              New category
            </Button>
          }
        />
      ) : null}

      {loading || categories.length > 0 ? (
        <Card flush>
          <div className="category-list">
            {loading ? <CategoriesSkeleton /> : null}
            {categories.map((category) => (
              <div key={category.id} className="data-row">
                <div className="category-main">
                  <span
                    aria-hidden
                    className="category-swatch"
                    style={{ background: category.color || 'var(--neutral-300)' }}
                  />
                  <span className="account-name">{category.name}</span>
                  <Badge tone={category.type === 'income' ? 'success' : 'neutral'}>
                    {category.type}
                  </Badge>
                </div>
                <ActionsMenu
                  label={`Actions for ${category.name}`}
                  items={[
                    {
                      label: 'Edit',
                      icon: <Pencil size={15} />,
                      onClick: () => openEdit(category),
                    },
                    {
                      label: 'Delete',
                      icon: <Trash size={15} />,
                      danger: true,
                      onClick: () => setPendingDelete(category),
                    },
                  ]}
                />
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* On-demand create / edit */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editing ? 'Edit category' : 'New category'}
        description="Used to label income and expenses"
      >
        <CategoryForm editing={editing} onSaved={handleSaved} />
      </Drawer>

      {/* Delete confirmation */}
      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete category?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete category'}
            </Button>
          </>
        }
      >
        <p className="muted">
          <strong style={{ color: 'var(--text-strong)' }}>
            {pendingDelete?.name}
          </strong>{' '}
          will be removed. Transactions using it keep their record but lose this
          label.
        </p>
      </Modal>
    </div>
  )
}
