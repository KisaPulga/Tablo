'use client'

import { useState } from 'react'
import { useToast } from '@/components/Toaster'
import { ConfirmButton, Loading } from '@/components/ui'
import { centsToInput, formatPrice, parsePrice } from '@/lib/format'
import { must, sb, useLive } from '@/lib/live'
import { moveRow } from '@/lib/reorder'
import type { Category, Product } from '@/lib/types'

export default function AdminMenuPage() {
  const toast = useToast()
  const { data, error, reload } = useLive(
    async () => {
      const [categories, products] = await Promise.all([
        sb().from('categories').select('*').order('sort_order').order('name'),
        sb().from('products').select('*').order('sort_order').order('name'),
      ])
      return { categories: must(categories) as Category[], products: must(products) as Product[] }
    },
    { tables: ['categories', 'products'] },
  )

  if (!data) return <Loading error={error} />

  const write = async (label: string, fn: () => Promise<unknown>) => {
    await toast.attempt(label, fn)
    reload()
  }

  const groups = [
    ...data.categories.map((c) => ({ category: c as Category | null, items: data.products.filter((p) => p.category_id === c.id) })),
    {
      category: null,
      items: data.products.filter((p) => !p.category_id || !data.categories.some((c) => c.id === p.category_id)),
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Menu</h1>

      <CategoriesEditor categories={data.categories} write={write} />

      <NewProductForm categories={data.categories} products={data.products} write={write} />

      {groups.map((g) =>
        g.items.length === 0 && g.category === null ? null : (
          <section key={g.category?.id ?? 'none'} className="space-y-2">
            <h2 className="text-sm font-bold tracking-wide text-muted uppercase">{g.category?.name ?? 'Sans catégorie'}</h2>
            {g.items.length === 0 && <p className="text-sm text-muted">Aucun produit.</p>}
            {g.items.map((p, i) => (
              <ProductRow
                key={p.id}
                product={p}
                categories={data.categories}
                canUp={i > 0}
                canDown={i < g.items.length - 1}
                onMove={(d) => write('Réordonner', () => moveRow('products', g.items, i, d))}
                write={write}
              />
            ))}
          </section>
        ),
      )}
    </div>
  )
}

type Write = (label: string, fn: () => Promise<unknown>) => Promise<void>

function CategoriesEditor({ categories, write }: { categories: Category[]; write: Write }) {
  const [name, setName] = useState('')
  const [open, setOpen] = useState(categories.length === 0)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const n = name.trim()
    if (!n) return
    const sort = categories.length ? Math.max(...categories.map((c) => c.sort_order)) + 10 : 0
    await write('Ajout de la catégorie', async () => {
      must(await sb().from('categories').insert({ name: n, sort_order: sort }).select('id').single())
    })
    setName('')
  }

  return (
    <section className="card space-y-3 p-3">
      <button className="flex w-full items-center justify-between font-bold" onClick={() => setOpen(!open)}>
        Catégories ({categories.length}) <span>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <>
          <form onSubmit={add} className="flex gap-2">
            <input className="input" placeholder="Nouvelle catégorie (ex. Bières)" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn btn-primary shrink-0" disabled={!name.trim()}>
              Ajouter
            </button>
          </form>
          <ul className="space-y-2">
            {categories.map((c, i) => (
              <li key={c.id} className="flex items-center gap-2">
                <button
                  className="btn btn-sm btn-ghost px-2"
                  disabled={i === 0}
                  onClick={() => write('Réordonner', () => moveRow('categories', categories, i, -1))}
                  aria-label="Monter"
                >
                  ▲
                </button>
                <button
                  className="btn btn-sm btn-ghost px-2"
                  disabled={i === categories.length - 1}
                  onClick={() => write('Réordonner', () => moveRow('categories', categories, i, 1))}
                  aria-label="Descendre"
                >
                  ▼
                </button>
                <input
                  key={c.name}
                  className="input flex-1"
                  defaultValue={c.name}
                  aria-label="Nom de la catégorie"
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v && v !== c.name)
                      void write('Renommage', async () => {
                        must(await sb().from('categories').update({ name: v }).eq('id', c.id).select('id').single())
                      })
                  }}
                />
                <ConfirmButton
                  className="btn btn-sm btn-danger"
                  onConfirm={() =>
                    write('Suppression', async () => {
                      must(await sb().from('categories').delete().eq('id', c.id))
                    })
                  }
                >
                  Suppr.
                </ConfirmButton>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function NewProductForm({ categories, products, write }: { categories: Category[]; products: Product[]; write: Write }) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const cents = parsePrice(price)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || cents == null) return
    const cat = categoryId || categories[0]?.id || null
    const inCat = products.filter((p) => p.category_id === cat)
    const sort = inCat.length ? Math.max(...inCat.map((p) => p.sort_order)) + 10 : 0
    await write('Ajout du produit', async () => {
      must(
        await sb()
          .from('products')
          .insert({ name: name.trim(), price_cents: cents, category_id: cat, sort_order: sort })
          .select('id')
          .single(),
      )
    })
    setName('')
    setPrice('')
  }

  return (
    <form onSubmit={add} className="card space-y-2 p-3">
      <h2 className="font-bold">Nouveau produit</h2>
      <input className="input" placeholder="Nom (ex. Pinte blonde)" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex gap-2">
        <input
          className="input w-28"
          inputMode="decimal"
          placeholder="Prix €"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <select className="input" value={categoryId || categories[0]?.id || ''} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.length === 0 && <option value="">Sans catégorie</option>}
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <button className="btn btn-primary w-full" disabled={!name.trim() || cents == null}>
        Ajouter{cents != null && name.trim() ? ` · ${formatPrice(cents)}` : ''}
      </button>
    </form>
  )
}

function ProductRow({
  product: p,
  categories,
  canUp,
  canDown,
  onMove,
  write,
}: {
  product: Product
  categories: Category[]
  canUp: boolean
  canDown: boolean
  onMove: (delta: number) => void
  write: Write
}) {
  const update = (label: string, patch: Partial<Product>) =>
    write(label, async () => {
      must(await sb().from('products').update(patch).eq('id', p.id).select('id').single())
    })

  return (
    <div className={`card space-y-2 p-3 ${p.is_available ? '' : 'opacity-60'}`}>
      <div className="flex items-center gap-2">
        <input
          key={p.name}
          className="input flex-1 font-semibold"
          defaultValue={p.name}
          aria-label="Nom"
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          onBlur={(e) => {
            const v = e.target.value.trim()
            if (v && v !== p.name) void update('Renommage', { name: v })
          }}
        />
        <input
          key={p.price_cents}
          className="input w-24 text-right"
          inputMode="decimal"
          defaultValue={centsToInput(p.price_cents)}
          aria-label="Prix en euros"
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          onBlur={(e) => {
            const c = parsePrice(e.target.value)
            if (c == null) e.target.value = centsToInput(p.price_cents)
            else if (c !== p.price_cents) void update('Prix', { price_cents: c })
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className={`btn btn-sm ${p.is_available ? 'btn-success' : 'btn-danger'}`}
          onClick={() => update('Disponibilité', { is_available: !p.is_available })}
        >
          {p.is_available ? '✔ Disponible' : '✖ Rupture'}
        </button>
        <select
          className="input min-h-9 w-auto flex-1 py-1 text-sm"
          value={p.category_id ?? ''}
          aria-label="Catégorie"
          onChange={(e) => update('Catégorie', { category_id: e.target.value || null })}
        >
          <option value="">Sans catégorie</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="btn btn-sm btn-ghost px-2" disabled={!canUp} onClick={() => onMove(-1)} aria-label="Monter">
          ▲
        </button>
        <button className="btn btn-sm btn-ghost px-2" disabled={!canDown} onClick={() => onMove(1)} aria-label="Descendre">
          ▼
        </button>
        <ConfirmButton
          className="btn btn-sm btn-danger"
          onConfirm={() =>
            write('Suppression', async () => {
              must(await sb().from('products').delete().eq('id', p.id))
            })
          }
        >
          Suppr.
        </ConfirmButton>
      </div>
    </div>
  )
}
