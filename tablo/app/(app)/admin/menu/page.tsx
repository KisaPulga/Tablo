'use client'

import { useState } from 'react'
import { useToast } from '@/components/Toaster'
import { ConfirmButton, Loading } from '@/components/ui'
import { centsToInput, formatPrice, parsePrice } from '@/lib/format'
import { must, sb, useLive } from '@/lib/live'
import { moveRow } from '@/lib/reorder'
import type { Product } from '@/lib/types'

type Write = (label: string, fn: () => Promise<unknown>) => Promise<void>

export default function AdminMenuPage() {
  const toast = useToast()
  const { data, error, reload } = useLive(
    async () => must(await sb().from('products').select('*').order('sort_order').order('name')) as Product[],
    { tables: ['products'] },
  )

  if (!data) return <Loading error={error} />

  const write: Write = async (label, fn) => {
    await toast.attempt(label, fn)
    reload()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Menu</h1>

      <NewProductForm products={data} write={write} />

      <section className="space-y-2">
        {data.length === 0 && <p className="text-sm text-muted">Aucun produit.</p>}
        {data.map((p, i) => (
          <ProductRow
            key={p.id}
            product={p}
            canUp={i > 0}
            canDown={i < data.length - 1}
            onMove={(d) => write('Réordonner', () => moveRow('products', data, i, d))}
            write={write}
          />
        ))}
      </section>
    </div>
  )
}

function NewProductForm({ products, write }: { products: Product[]; write: Write }) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const cents = parsePrice(price)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || cents == null) return
    const sort = products.length ? Math.max(...products.map((p) => p.sort_order)) + 10 : 0
    await write('Ajout du produit', async () => {
      must(
        await sb()
          .from('products')
          .insert({ name: name.trim(), price_cents: cents, sort_order: sort })
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
      <div className="flex gap-2">
        <input className="input flex-1" placeholder="Nom (ex. Pinte blonde)" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          className="input w-28"
          inputMode="decimal"
          placeholder="Prix €"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>
      <button className="btn btn-primary w-full" disabled={!name.trim() || cents == null}>
        Ajouter{cents != null && name.trim() ? ` · ${formatPrice(cents)}` : ''}
      </button>
    </form>
  )
}

function ProductRow({
  product: p,
  canUp,
  canDown,
  onMove,
  write,
}: {
  product: Product
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
        <div className="ml-auto flex gap-2">
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
    </div>
  )
}
