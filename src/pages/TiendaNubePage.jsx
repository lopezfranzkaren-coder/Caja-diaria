import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, monthLabel } from '../lib/utils'
import { useToast } from '../lib/toast'

export default function TiendaNubePage() {
  const toast = useToast()
  const [registros, setRegistros] = useState([])
  const [editando, setEditando] = useState(null) // null | {} | {existing}
  const [form, setForm] = useState({ mes: new Date().toISOString().slice(0, 7), ventas: '', facturado: '', ticket_promedio: '', notas: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadRegistros() }, [])

  async function loadRegistros() {
    const { data } = await supabase.from('tiendanube').select('*').order('mes', { ascending: false })
    setRegistros(data || [])
  }

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  function abrirNuevo() {
    setForm({ mes: new Date().toISOString().slice(0, 7), ventas: '', facturado: '', ticket_promedio: '', notas: '' })
    setEditando({})
  }

  function abrirEditar(r) {
    setForm({ mes: r.mes, ventas: r.ventas, facturado: r.facturado, ticket_promedio: r.ticket_promedio || '', notas: r.notas || '' })
    setEditando(r)
  }

  async function handleSave() {
    if (!form.mes || !form.facturado) { toast('Completá mes y facturado', 'error'); return }
    setSaving(true)
    const row = {
      mes: form.mes,
      ventas: parseInt(form.ventas) || 0,
      facturado: parseFloat(form.facturado) || 0,
      ticket_promedio: parseFloat(form.ticket_promedio) || 0,
      notas: form.notas,
      updated_at: new Date().toISOString()
    }
    if (editando?.id) {
      await supabase.from('tiendanube').update(row).eq('id', editando.id)
    } else {
      await supabase.from('tiendanube').insert(row)
    }
    toast('✓ Guardado')
    setSaving(false)
    setEditando(null)
    loadRegistros()
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este registro?')) return
    await supabase.from('tiendanube').delete().eq('id', id)
    toast('Eliminado')
    loadRegistros()
  }

  const totalFacturado = registros.reduce((a, r) => a + r.facturado, 0)
  const totalVentas = registros.reduce((a, r) => a + r.ventas, 0)

  return (
    <div>
      <h1 className="page-title">Tienda Nube</h1>
      <p className="page-sub">Registrá los datos mensuales de tu tienda online</p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={abrirNuevo}>+ Nuevo mes</button>
      </div>

      {registros.length > 0 && (
        <div className="grid-2" style={{ marginBottom: 20 }}>
          <div className="stat-card">
            <div className="stat-label">Total facturado histórico</div>
            <div className="stat-amount" style={{ color: 'var(--accent)' }}>{fmt(totalFacturado)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total ventas históricas</div>
            <div className="stat-amount">{totalVentas.toLocaleString('es-AR')}</div>
            <div className="stat-sub">en {registros.length} meses registrados</div>
          </div>
        </div>
      )}

      <div className="card">
        {registros.length === 0 ? (
          <div className="empty-state"><div className="icon">🛍️</div><p>No hay registros de Tienda Nube todavía</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Mes</th><th>Ventas</th><th>Facturado</th><th>Ticket promedio</th><th>Notas</th><th></th></tr>
              </thead>
              <tbody>
                {registros.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 500 }}>{monthLabel(r.mes)}</td>
                    <td>{r.ventas.toLocaleString('es-AR')}</td>
                    <td style={{ fontFamily: 'Fraunces, serif', fontSize: 16, color: 'var(--accent)' }}>{fmt(r.facturado)}</td>
                    <td style={{ color: 'var(--muted)' }}>{r.ticket_promedio ? fmt(r.ticket_promedio) : '—'}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{r.notas || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(r)}>✏️</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editando !== null && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditando(null)}>
          <div className="modal">
            <div className="modal-title">{editando?.id ? 'Editar mes' : 'Nuevo mes — Tienda Nube'}</div>
            <div className="field">
              <label>Mes</label>
              <input type="month" value={form.mes} onChange={e => set('mes', e.target.value)} />
            </div>
            <div className="grid-2">
              <div className="field">
                <label>Cantidad de ventas</label>
                <input type="number" min="0" placeholder="0" value={form.ventas} onChange={e => set('ventas', e.target.value)} />
              </div>
              <div className="field">
                <label>Facturado ($)</label>
                <input type="number" min="0" placeholder="0" value={form.facturado} onChange={e => set('facturado', e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label>Ticket promedio ($)</label>
              <input type="number" min="0" placeholder="0 (opcional)" value={form.ticket_promedio} onChange={e => set('ticket_promedio', e.target.value)} />
            </div>
            <div className="field">
              <label>Notas</label>
              <textarea placeholder="Opcional..." value={form.notas} onChange={e => set('notas', e.target.value)} />
            </div>
            <div className="actions">
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
              <button className="btn btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
