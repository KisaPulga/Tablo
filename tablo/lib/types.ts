export type Role = 'admin' | 'serveur' | 'bar'

export type TicketStatus = 'brouillon' | 'envoye' | 'en_preparation' | 'pret' | 'servi' | 'annule'

export type Profile = {
  id: string
  display_name: string
  role: Role
}

export type DiningTable = {
  id: string
  name: string
  sort_order: number
  is_active: boolean
}

export type Category = {
  id: string
  name: string
  sort_order: number
}

export type Product = {
  id: string
  category_id: string | null
  name: string
  price_cents: number
  is_available: boolean
  sort_order: number
}

export type TicketItem = {
  id: string
  ticket_id: string
  product_id: string | null
  product_name: string
  unit_price_cents: number
  quantity: number
  note: string | null
  position: number
}

export type Ticket = {
  id: string
  number: number
  table_id: string
  waiter_id: string
  status: TicketStatus
  note: string | null
  created_at: string
  sent_at: string | null
  preparing_at: string | null
  ready_at: string | null
  served_at: string | null
  cancelled_at: string | null
  modified_at: string | null
  updated_at: string
}

export type TicketWithItems = Ticket & { ticket_items: TicketItem[] }

export const STATUS_LABEL: Record<TicketStatus, string> = {
  brouillon: 'Brouillon',
  envoye: 'Envoyé',
  en_preparation: 'En préparation',
  pret: 'Prêt',
  servi: 'Servi',
  annule: 'Annulé',
}

export const STATUS_CLASS: Record<TicketStatus, string> = {
  brouillon: 'bg-slate-600 text-white',
  envoye: 'bg-sky-500 text-sky-950',
  en_preparation: 'bg-amber-400 text-amber-950',
  pret: 'bg-emerald-400 text-emerald-950',
  servi: 'bg-slate-300 text-slate-900',
  annule: 'bg-red-800 text-red-100 line-through',
}

export const ALL_STATUSES: TicketStatus[] = ['brouillon', 'envoye', 'en_preparation', 'pret', 'servi', 'annule']

/** Tickets qui comptent dans les totaux et le décompte */
export function isCounted(status: TicketStatus) {
  return status !== 'brouillon' && status !== 'annule'
}

/** Tickets « en cours » (pas encore servis ni annulés) */
export function isOpen(status: TicketStatus) {
  return status === 'brouillon' || status === 'envoye' || status === 'en_preparation' || status === 'pret'
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  serveur: 'Serveur',
  bar: 'Bar',
}
