import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'

function StockModal({ item, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ nombre: '', cantidad: '', alerta_minimo: '5', notas: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (item?.id) setForm({ nombre: item.nombre, cantidad: item.cantidad, alerta_minimo: item.alerta_minimo ?? 5, notas: item.notas || '' })
  }, [item])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.nombre) { toast('Ingresá el nombre del producto', 'error'); return }
    setSaving(true)
    const row = { nombre: form.nombre, cantidad: parseInt(form.cantidad) || 0, alerta_minimo: parseInt(form.alerta_minimo) || 5, notas: form.notas, updated_at: new Date().toISOString() }
    if (item?.id) {
      await supabase.from('stock').update(row).eq('id', item.id)
    } else {
      await supabase.from('stock').insert({ ...row, activo: true })
    }
    toast('✓ Guardado')
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">{item?.id ? 'Editar producto' : 'Nuevo producto'}</div>
        <div className="field"><label>Nombre del producto</label><input type="text" placeholder="Ej: Remera talle M blanca" value={form.nombre} onChange={e => set('nombre', e.target.value)} /></div>
        <div className="grid-2">
          <div className="field"><label>Cantidad actual</label><input type="number" min="0" placeholder="0" value={form.cantidad} onChange={e => set('cantidad', e.target.value)} /></div>
          <div className="field"><label>Alerta si baja de</label><input type="number" min="0" placeholder="5" value={form.alerta_minimo} onChange={e => set('alerta_minimo', e.target.value)} /></div>
        </div>
        <div className="field"><label>Notas</label><textarea placeholder="Opcional..." value={form.notas} onChange={e => set('notas', e.target.value)} /></div>
        <div className="actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function AjusteModal({ item, onClose, onSaved }) {
  const toast = useToast()
  const [delta, setDelta] = useState('')
  const [tipo, setTipo] = useState('sumar')
  const [saving, setSaving] = useState(false)

  async function handleAjuste() {
    const n = parseInt(delta)
    if (!n || n <= 0) { toast('Ingresá una cantidad válida', 'error'); return }
    setSaving(true)
    const nueva = tipo === 'sumar' ? item.cantidad + n : Math.max(0, item.cantidad - n)
    await supabase.from('stock').update({ cantidad: nueva, updated_at: new Date().toISOString() }).eq('id', item.id)
    toast(`✓ Stock actualizado: ${nueva} unidades`)
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Ajustar stock: {item.nombre}</div>
        <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>Stock actual: </span>
          <span style={{ fontFamily: 'Fraunces, serif', fontSize: 24 }}>{item.cantidad}</span>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Tipo de ajuste</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="sumar">➕ Sumar (ingreso)</option>
              <option value="restar">➖ Restar (egreso)</option>
            </select>
          </div>
          <div className="field">
            <label>Cantidad</label>
            <input type="number" min="1" placeholder="0" value={delta} onChange={e => setDelta(e.target.value)} />
          </div>
        </div>
        {delta && (
          <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: 'var(--muted)' }}>
            Resultado: <span style={{ color: 'var(--text)', fontFamily: 'Fraunces, serif', fontSize: 18 }}>
              {tipo === 'sumar' ? item.cantidad + (parseInt(delta) || 0) : Math.max(0, item.cantidad - (parseInt(delta) || 0))}
            </span>
          </div>
        )}
        <div className="actions">
          <button className="btn btn-primary" onClick={handleAjuste} disabled={saving}>{saving ? 'Guardando...' : 'Confirmar ajuste'}</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

export default function StockPage() {
  const toast = useToast()
  const [stock, setStock] = useState([])
  const [modal, setModal] = useState(null)
  const [ajuste, setAjuste] = useState(null)
  const [buscar, setBuscar] = useState('')
  const [filtro, setFiltro] = useState('todos')

  useEffect(() => { loadStock() }, [])

  async function loadStock() {
    const { data } = await supabase.from('stock').select('*').eq('activo', true).order('nombre')
    setStock(data || [])
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este producto del stock?')) return
    await supabase.from('stock').update({ activo: false }).eq('id', id)
    toast('Producto eliminado')
    loadStock()
  }

  const filtrados = stock.filter(s => {
    const matchBuscar = s.nombre.toLowerCase().includes(buscar.toLowerCase())
    const matchFiltro = filtro === 'todos' ? true : filtro === 'bajo' ? s.cantidad <= s.alerta_minimo : s.cantidad === 0
    return matchBuscar && matchFiltro
  })

  const sinStock = stock.filter(s => s.cantidad === 0).length
  const stockBajo = stock.filter(s => s.cantidad > 0 && s.cantidad <= s.alerta_minimo).length

  return (
    <div>
      <h1 className="page-title">Stock</h1>
      <p className="page-sub">Control de inventario con alertas de stock bajo</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[['todos', 'Todos'], ['bajo', `⚠️ Stock bajo (${stockBajo})`], ['cero', `❌ Sin stock (${sinStock})`]].map(([v, l]) => (
            <button key={v} className={`btn btn-sm ${filtro === v ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFiltro(v)}>{l}</button>
          ))}
        </div>
        <button className="btn btn-primary" onClick={() => setModal({})}>+ Nuevo producto</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input type="text" placeholder="🔍 Buscar producto..." value={buscar} onChange={e => setBuscar(e.target.value)}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 14px', borderRadius: 8, fontFamily: 'DM Mono', fontSize: 13, outline: 'none', width: '100%', maxWidth: 320 }} />
      </div>

      <div className="card">
        {filtrados.length === 0 ? (
          <div className="empty-state"><div className="icon">📦</div><p>No hay productos</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Producto</th><th>Cantidad</th><th>Alerta</th><th>Estado</th><th>Notas</th><th></th></tr></thead>
              <tbody>
                {filtrados.map(s => {
                  const low = s.cantidad <= s.alerta_minimo && s.cantidad > 0
                  const zero = s.cantidad === 0
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 500 }}>{s.nombre}</td>
                      <td style={{ fontFamily: 'Fraunces, serif', fontSize: 22, color: zero ? 'var(--danger)' : low ? 'var(--warning)' : 'var(--accent2)' }}>{s.cantidad}</td>
                      <td style={{ color: 'var(--muted)', fontSize: 13 }}>≤ {s.alerta_minimo}</td>
                      <td>
                        {zero ? <span className="badge badge-danger">❌ Sin stock</span>
                          : low ? <span className="badge badge-pendiente">⚠️ Stock bajo</span>
                            : <span className="badge badge-ok">✓ OK</span>}
                      </td>
                      <td style={{ color: 'var(--muted)', fontSize: 12 }}>{s.notas || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setAjuste(s)}>±</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setModal(s)}>✏️</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.id)}>✕</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal !== null && <StockModal item={modal} onClose={() => setModal(null)} onSaved={loadStock} />}
      {ajuste !== null && <AjusteModal item={ajuste} onClose={() => setAjuste(null)} onSaved={loadStock} />}
    </div>
  )
}
