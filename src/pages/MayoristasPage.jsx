import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, todayStr, METODOS } from '../lib/utils'
import { useToast } from '../lib/toast'

function MayoristaModal({ mayorista, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ nombre: '', telefono: '', notas: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (mayorista?.id) setForm({ nombre: mayorista.nombre, telefono: mayorista.telefono || '', notas: mayorista.notas || '' })
  }, [mayorista])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.nombre) { toast('Ingresá el nombre', 'error'); return }
    setSaving(true)
    const row = { nombre: form.nombre, telefono: form.telefono, notas: form.notas }
    if (mayorista?.id) {
      await supabase.from('mayoristas').update(row).eq('id', mayorista.id)
    } else {
      await supabase.from('mayoristas').insert({ ...row, activo: true })
    }
    toast('✓ Guardado')
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">{mayorista?.id ? 'Editar mayorista' : 'Nuevo mayorista'}</div>
        <div className="field"><label>Nombre</label><input type="text" placeholder="Nombre del cliente" value={form.nombre} onChange={e => set('nombre', e.target.value)} /></div>
        <div className="field"><label>Teléfono</label><input type="text" placeholder="Opcional" value={form.telefono} onChange={e => set('telefono', e.target.value)} /></div>
        <div className="field"><label>Notas</label><textarea placeholder="Opcional..." value={form.notas} onChange={e => set('notas', e.target.value)} /></div>
        <div className="actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function VentaModal({ mayoristas, venta, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({
    mayorista_id: '', fecha: todayStr(), monto: '', metodo: 'transferencia',
    descripcion: '', pagado: false, monto_pagado: '', notas: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (venta?.id) {
      setForm({
        mayorista_id: venta.mayorista_id, fecha: venta.fecha, monto: venta.monto,
        metodo: venta.metodo, descripcion: venta.descripcion || '',
        pagado: venta.pagado, monto_pagado: venta.monto_pagado || '', notas: venta.notas || ''
      })
    }
  }, [venta])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.mayorista_id || !form.monto) { toast('Completá mayorista y monto', 'error'); return }
    setSaving(true)
    const row = {
      mayorista_id: form.mayorista_id, fecha: form.fecha,
      monto: parseFloat(form.monto), metodo: form.metodo,
      descripcion: form.descripcion, pagado: form.pagado,
      monto_pagado: parseFloat(form.monto_pagado) || 0,
      notas: form.notas, updated_at: new Date().toISOString()
    }
    if (venta?.id) {
      await supabase.from('ventas_mayoristas').update(row).eq('id', venta.id)
    } else {
      await supabase.from('ventas_mayoristas').insert(row)
    }
    toast('✓ Venta guardada')
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">{venta?.id ? 'Editar venta' : 'Nueva venta mayorista'}</div>
        <div className="grid-2">
          <div className="field">
            <label>Mayorista</label>
            <select value={form.mayorista_id} onChange={e => set('mayorista_id', e.target.value)}>
              <option value="">Seleccioná...</option>
              {mayoristas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Fecha</label>
            <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Monto total</label>
            <input type="number" min="0" placeholder="0" value={form.monto} onChange={e => set('monto', e.target.value)} />
          </div>
          <div className="field">
            <label>Método de pago</label>
            <select value={form.metodo} onChange={e => set('metodo', e.target.value)}>
              {METODOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>
        {form.metodo === 'pendiente' && (
          <div className="field">
            <label>Monto ya pagado (si hubo seña)</label>
            <input type="number" min="0" placeholder="0" value={form.monto_pagado} onChange={e => set('monto_pagado', e.target.value)} />
          </div>
        )}
        <div className="field">
          <label>Descripción / Producto</label>
          <input type="text" placeholder="Ej: 50 unidades remeras..." value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
        </div>
        <div className="field">
          <label>Notas</label>
          <textarea placeholder="Opcional..." value={form.notas} onChange={e => set('notas', e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <input type="checkbox" id="pagado-check" checked={form.pagado} onChange={e => set('pagado', e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
          <label htmlFor="pagado-check" style={{ fontSize: 13, cursor: 'pointer', color: 'var(--text)' }}>Marcar como pagado completo</label>
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

export default function MayoristasPage() {
  const toast = useToast()
  const [mayoristas, setMayoristas] = useState([])
  const [ventas, setVentas] = useState([])
  const [tab, setTab] = useState('ventas')
  const [modalMay, setModalMay] = useState(null)
  const [modalVenta, setModalVenta] = useState(null)
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7))

  useEffect(() => { loadAll() }, [filtroMes])

  async function loadAll() {
    const [{ data: mays }, { data: vs }] = await Promise.all([
      supabase.from('mayoristas').select('*').eq('activo', true).order('nombre'),
      supabase.from('ventas_mayoristas').select('*, mayoristas(nombre)').gte('fecha', filtroMes + '-01').lte('fecha', ((() => { const [y,m] = filtroMes.split('-'); return new Date(parseInt(y), parseInt(m), 0).toISOString().slice(0,10) })())).order('fecha', { ascending: false })
    ])
    setMayoristas(mays || [])
    setVentas(vs || [])
  }

  async function handleDeleteVenta(id) {
    if (!confirm('¿Eliminar esta venta?')) return
    await supabase.from('ventas_mayoristas').delete().eq('id', id)
    toast('Eliminado')
    loadAll()
  }

  async function togglePagado(v) {
    await supabase.from('ventas_mayoristas').update({ pagado: !v.pagado, updated_at: new Date().toISOString() }).eq('id', v.id)
    loadAll()
  }

  const totalMes = ventas.reduce((a, v) => a + v.monto, 0)
  const pendiente = ventas.filter(v => !v.pagado).reduce((a, v) => a + (v.monto - (v.monto_pagado || 0)), 0)

  const months = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    months.push(d.toISOString().slice(0, 7))
  }

  return (
    <div>
      <h1 className="page-title">Mayoristas</h1>
      <p className="page-sub">Ventas y saldos por cliente mayorista</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[['ventas', '📦 Ventas'], ['clientes', '👥 Clientes']].map(([t, l]) => (
          <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      {tab === 'ventas' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div className="month-bar" style={{ marginBottom: 0 }}>
              <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
                {months.map(m => {
                  const [y, mo] = m.split('-')
                  const label = new Date(y, mo - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
                  return <option key={m} value={m}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>
                })}
              </select>
            </div>
            <button className="btn btn-primary" onClick={() => setModalVenta({})}>+ Nueva venta</button>
          </div>

          {ventas.length > 0 && (
            <div className="grid-2" style={{ marginBottom: 20 }}>
              <div className="stat-card"><div className="stat-label">Total vendido</div><div className="stat-amount">{fmt(totalMes)}</div></div>
              <div className="stat-card" style={{ borderColor: pendiente > 0 ? 'var(--warning)' : 'var(--border)' }}>
                <div className="stat-label">Saldo pendiente</div>
                <div className="stat-amount" style={{ color: pendiente > 0 ? 'var(--warning)' : 'var(--accent2)' }}>{fmt(pendiente)}</div>
              </div>
            </div>
          )}

          <div className="card">
            {ventas.length === 0 ? (
              <div className="empty-state"><div className="icon">📦</div><p>No hay ventas este mes</p></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Fecha</th><th>Cliente</th><th>Descripción</th><th>Método</th><th>Monto</th><th>Estado</th><th></th></tr>
                  </thead>
                  <tbody>
                    {ventas.map(v => {
                      const metodo = METODOS.find(m => m.value === v.metodo)
                      const saldo = v.monto - (v.monto_pagado || 0)
                      return (
                        <tr key={v.id}>
                          <td>{fmtDate(v.fecha)}</td>
                          <td style={{ fontWeight: 500 }}>{v.mayoristas?.nombre}</td>
                          <td style={{ color: 'var(--muted)', fontSize: 12 }}>{v.descripcion || '—'}</td>
                          <td><span className={`badge badge-${v.metodo}`}>{metodo?.label}</span></td>
                          <td style={{ fontFamily: 'Fraunces, serif', fontSize: 16 }}>{fmt(v.monto)}</td>
                          <td>
                            {v.pagado
                              ? <span className="badge badge-ok">✓ Pagado</span>
                              : <span className="badge badge-pendiente">Debe {fmt(saldo)}</span>
                            }
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-ghost btn-sm" title={v.pagado ? 'Marcar pendiente' : 'Marcar pagado'} onClick={() => togglePagado(v)}>{v.pagado ? '↩' : '✓'}</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => setModalVenta(v)}>✏️</button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDeleteVenta(v.id)}>✕</button>
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
        </>
      )}

      {tab === 'clientes' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <button className="btn btn-primary" onClick={() => setModalMay({})}>+ Nuevo cliente</button>
          </div>
          <div className="card">
            {mayoristas.length === 0 ? (
              <div className="empty-state"><div className="icon">👥</div><p>No hay clientes mayoristas</p></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Nombre</th><th>Teléfono</th><th>Notas</th><th></th></tr></thead>
                  <tbody>
                    {mayoristas.map(m => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 500 }}>{m.nombre}</td>
                        <td style={{ color: 'var(--muted)' }}>{m.telefono || '—'}</td>
                        <td style={{ color: 'var(--muted)', fontSize: 12 }}>{m.notas || '—'}</td>
                        <td>
                          <button className="btn btn-ghost btn-sm" onClick={() => setModalMay(m)}>✏️ Editar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {modalMay !== null && <MayoristaModal mayorista={modalMay} onClose={() => setModalMay(null)} onSaved={loadAll} />}
      {modalVenta !== null && <VentaModal mayoristas={mayoristas} venta={modalVenta} onClose={() => setModalVenta(null)} onSaved={loadAll} />}
    </div>
  )
}
