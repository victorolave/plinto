'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useErrorMessage } from '../../../lib/api/use-error-message'
import {
  Category,
  deleteCategory,
  listCategories,
} from '../services/categories'
import { queryKeys } from '../../../lib/api/query-keys'
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
  const t = useTranslations('categories')
  const tCommon = useTranslations('common')
  const toErrorMessage = useErrorMessage()
  const queryClient = useQueryClient()

  const {
    data: categories = [],
    isLoading: loading,
    error: loadError,
  } = useQuery({
    queryKey: queryKeys.categories,
    queryFn: async () => (await listCategories()).data.categories,
  })

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      setPendingDelete(null)
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories })
    },
  })

  const error = toErrorMessage(deleteMutation.error ?? loadError)
  const deleting = deleteMutation.isPending

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

  const handleSaved = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.categories })
    closeDrawer()
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    deleteMutation.mutate(pendingDelete.id)
  }

  return (
    <div className="page">
      {error ? <p className="error-text">{error}</p> : null}

      {!loading && categories.length > 0 ? (
        <div className="categories-head">
          <span className="muted">{t('count', { count: categories.length })}</span>
          <Button leftIcon={<Plus size={18} />} onClick={openCreate}>
            {t('newCategory')}
          </Button>
        </div>
      ) : null}

      {!loading && categories.length === 0 ? (
        <EmptyState
          icon={<Tag size={30} />}
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <Button leftIcon={<Plus size={18} />} onClick={openCreate}>
              {t('newCategory')}
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
                    {t(`type.${category.type}`)}
                  </Badge>
                </div>
                <ActionsMenu
                  label={t('actionsFor', { name: category.name })}
                  items={[
                    {
                      label: tCommon('edit'),
                      icon: <Pencil size={15} />,
                      onClick: () => openEdit(category),
                    },
                    {
                      label: tCommon('delete'),
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
        title={editing ? t('editCategory') : t('newCategory')}
        description={t('drawerDescription')}
      >
        <CategoryForm editing={editing} onSaved={handleSaved} />
      </Drawer>

      {/* Delete confirmation */}
      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={t('deleteModal.title')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDelete(null)}>
              {tCommon('cancel')}
            </Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
              {deleting ? t('deleteModal.deleting') : t('deleteModal.confirm')}
            </Button>
          </>
        }
      >
        <p className="muted">
          {t.rich('deleteModal.body', {
            name: pendingDelete?.name ?? '',
            strong: (chunks) => (
              <strong style={{ color: 'var(--text-strong)' }}>{chunks}</strong>
            ),
          })}
        </p>
      </Modal>
    </div>
  )
}
