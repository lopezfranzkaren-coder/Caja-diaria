import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, todayStr, CATEGORIAS_GASTO } from '../lib/utils'
import { useToast } from '../lib/toast'

function GastoModal({ gasto, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({
    fecha: todayStr(), descripcion: '', monto: '', categoria: 'general', notas: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (gasto) setForm({ fecha: gasto.fecha, descripcion: gasto.descripcion, monto: gasto.monto, categoria: gasto.categoria || 'general', notas: gasto.notas || '' })
  }, [gasto])

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    if (!form.descripcion || !form.monto) { toast('Completá descripción y monto', 'error'); return }
    setSaving(true)
    const row = { fecha: form.fecha, descripcion: form.descripcion, monto: parseFloat(form.monto), categoria: form.categoria, notas: form.notas, updated_at: new Date().toISOString() }
    if (gasto?.id) {
      await supabase.from('gastos').update(row).eq('id', gasto.id)
    } else {
      await supabase.from('gastos').insert(row)
    }
    toast('✓ Gasto guardado')
    setSaving(false)
    onSaved()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">{gasto?.id ? 'Editar gasto' : 'Nuevo gasto'}</div>
        <div className="grid-2">
          <div className="field">
            <label>Fecha</label>
            <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
          </div>
          <div className="field">
            <label>Categoría</label>
            <select value={form.categoria} onChange={e => set('categoria', e.target.value)}>
              {CATEGORIAS_GASTO.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label>Descripción</label>
          <input type="text" placeholder="Ej: Compra mercadería proveedor X" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
        </div>
        <div className="field">
          <label>Monto</label>
          <input type="number" min="0" placeholder="0" value={form.monto} onChange={e => set('monto', e.target.value)} />
        </div>
        <div className="field">
          <label>Notas</label>
          <textarea placeholder="Opcional..." value={form.notas} onChange={e => set('notas', e.target.value)} />
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

export default function GastosPage() {
  const toast = useToast()
  const [gastos, setGastos] = useState([])
  const [modal, setModal] = useState(null)
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7))
  const [showImport, setShowImport] = useState(false)
  const [gastosAnteriores, setGastosAnteriores] = useState([])
  const [seleccionados, setSeleccionados] = useState({})
  const [importing, setImporting] = useState(false)

  useEffect(() => { loadGastos() }, [filtroMes])

  function mesAnterior(mes) {
    const [y, m] = mes.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    return d.toISOString().slice(0, 7)
  }

  async function abrirImport() {
    const prev = mesAnterior(filtroMes)
    const start = prev + '-01'
    const end = new Date(parseInt(prev.split('-')[0]), parseInt(prev.split('-')[1]), 0).toISOString().slice(0, 10)
    const { data } = await supabase.from('gastos').select('*').gte('fecha', start).lte('fecha', end).order('categoria')
    setGastosAnteriores(data || [])
    setSeleccionados({})
    setShowImport(true)
  }

  function toggleSeleccion(id) {
    setSeleccionados(p => ({ ...p, [id]: !p[id] }))
  }

  function seleccionarTodos() {
    const todos = {}
    gastosAnteriores.forEach(g => { todos[g.id] = true })
    setSeleccionados(todos)
  }

  async function confirmarImport() {
    const elegidos = gastosAnteriores.filter(g => seleccionados[g.id])
    if (!elegidos.length) { return }
    setImporting(true)
    const rows = elegidos.map(g => ({
      fecha: filtroMes + '-01',
      descripcion: g.descripcion,
      monto: g.monto,
      categoria: g.categoria,
      notas: g.notas,
      updated_at: new Date().toISOString()
    }))
    await supabase.from('gastos').insert(rows)
    toast(`✓ ${rows.length} gastos importados`)
    setImporting(false)
    setShowImport(false)
    loadGastos()
  }

  async function loadGastos() {
    const start = filtroMes + '-01'
    const end = ((() => { const [y,m] = filtroMes.split('-'); return new Date(parseInt(y), parseInt(m), 0).toISOString().slice(0,10) })())
    const { data } = await supabase.from('gastos').select('*').gte('fecha', start).lte('fecha', end).order('fecha', { ascending: false })
    setGastos(data || [])
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este gasto?')) return
    await supabase.from('gastos').delete().eq('id', id)
    toast('Gasto eliminado')
    loadGastos()
  }

  const total = gastos.reduce((a, g) => a + g.monto, 0)
  const porCategoria = gastos.reduce((acc, g) => {
    acc[g.categoria] = (acc[g.categoria] || 0) + g.monto
    return acc
  }, {})

  // Generate month options
  const months = []
  for (let i = 0; i < 12; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    months.push(d.toISOString().slice(0, 7))
  }

  return (
    <div>
      <h1 className="page-title">Gastos</h1>
      <p className="page-sub">Registrá todos los egresos del negocio</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div className="month-bar" style={{ marginBottom: 0 }}>
          <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
            {months.map(m => {
              const [y, mo] = m.split('-')
              const label = new Date(y, mo - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
              return <option key={m} value={m}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>
            })}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={abrirImport}>📋 Importar del mes anterior</button>
          <button className="btn btn-primary" onClick={() => setModal({})}>+ Nuevo gasto</button>
        </div>
      </div>

      {gastos.length > 0 && (
        <>
          <div className="grid-4" style={{ marginBottom: 20 }}>
            <div className="stat-card" style={{ borderColor: 'var(--danger)', gridColumn: 'span 1' }}>
              <div className="stat-label">Total gastos</div>
              <div className="stat-amount" style={{ color: 'var(--danger)' }}>{fmt(total)}</div>
            </div>
            {Object.entries(porCategoria).slice(0, 3).map(([cat, monto]) => (
              <div className="stat-card" key={cat}>
                <div className="stat-label">{cat}</div>
                <div className="stat-amount" style={{ fontSize: 20 }}>{fmt(monto)}</div>
                <div className="stat-sub">{Math.round(monto / total * 100)}% del total</div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="card">
        {gastos.length === 0 ? (
          <div className="empty-state"><div className="icon">💸</div><p>No hay gastos registrados este mes</p></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Categoría</th>
                  <th>Monto</th>
                  <th>Notas</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {gastos.map(g => (
                  <tr key={g.id}>
                    <td>{fmtDate(g.fecha)}</td>
                    <td>{g.descripcion}</td>
                    <td><span className="badge" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>{g.categoria}</span></td>
                    <td style={{ color: 'var(--danger)', fontFamily: 'Fraunces, serif', fontSize: 16 }}>{fmt(g.monto)}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{g.notas || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setModal(g)}>✏️</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(g.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal !== null && (
        <GastoModal gasto={modal} onClose={() => setModal(null)} onSaved={loadGastos} />
      )}

      {showImport && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowImport(false)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-title">📋 Importar gastos del mes anterior</div>
            {gastosAnteriores.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>No hay gastos registrados en el mes anterior.</p>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>{Object.values(seleccionados).filter(Boolean).length} seleccionados</span>
                  <button className="btn btn-ghost btn-sm" onClick={seleccionarTodos}>Seleccionar todos</button>
                </div>
                <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {gastosAnteriores.map(g => (
                    <div key={g.id} onClick={() => toggleSeleccion(g.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                        background: seleccionados[g.id] ? 'var(--surface2)' : 'transparent',
                        border: `1px solid ${seleccionados[g.id] ? 'var(--accent)' : 'var(--border)'}` }}>
                      <input type="checkbox" checked={!!seleccionados[g.id]} onChange={() => toggleSeleccion(g.id)}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13 }}>{g.descripcion}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{g.categoria}</div>
                      </div>
                      <div style={{ fontFamily: 'Fraunces, serif', fontSize: 15, color: 'var(--danger)' }}>{fmt(g.monto)}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="actions" style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={confirmarImport} disabled={importing || !Object.values(seleccionados).some(Boolean)}>
                {importing ? 'Importando...' : `Importar ${Object.values(seleccionados).filter(Boolean).length} gastos`}
              </button>
              <button className="btn btn-ghost" onClick={() => setShowImport(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
