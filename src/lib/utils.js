export const fmt = (n) =>
  '$' + (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

export const fmtDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })
}

export const fmtDateLong = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export const todayStr = () => new Date().toISOString().split('T')[0]

export const currentMonth = () => new Date().toISOString().slice(0, 7)

export const monthLabel = (m) => {
  if (!m) return ''
  const [y, mo] = m.split('-')
  const label = new Date(y, mo - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export const METODOS = [
  { value: 'mp', label: 'Mercado Pago', color: 'var(--mp)', badge: 'badge-mp' },
  { value: 'transferencia', label: 'Transferencia', color: 'var(--transfer)', badge: 'badge-transfer' },
  { value: 'efectivo', label: 'Efectivo', color: 'var(--cash)', badge: 'badge-cash' },
  { value: 'pendiente', label: 'Pendiente', color: 'var(--warning)', badge: 'badge-pendiente' },
]

export const DOT_COLORS = {
  mp: 'var(--mp)',
  transferencia: 'var(--transfer)',
  efectivo: 'var(--cash)',
  pendiente: 'var(--warning)',
}

export const CATEGORIAS_GASTO = [
  'mercadería', 'envíos', 'servicios', 'alquiler', 'sueldos', 'packaging', 'publicidad', 'general'
]
