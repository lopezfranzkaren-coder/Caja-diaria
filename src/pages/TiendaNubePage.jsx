import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, monthLabel } from '../lib/utils'
import { useToast } from '../lib/toast'

const LIMITE_MAYORISTA = 200000

const CONFIG_DEFAULT = {
  cpt_tn: 2.0,
  transferencia_total: 4.70,
  debito_total: 9.88,
  credito_total: 11.01,
  credito_cuotas_total: 20.0,
  iibb_prom: 0.86,
  sirtac_prom: 0.46,
}

function calcularCostos(subtotal, medio_pago, config) {
  const mp = (medio_pago || '').toLowerCase()
  let tasa_total = config.transferencia_total
  if (mp.includes('crédito') || mp.includes('credito')) tasa_total = config.credito_total
  else if (mp.includes('débito') || mp.includes('debito')) tasa_total = config.debito_total

  const costo_total = subtotal * tasa_total / 100
  const cpt = subtotal * config.cpt_tn / 100
  const tasa_pn = subtotal * (tasa_total - config.cpt_tn - config.iibb_prom - config.sirtac_prom) / 100
  const iibb = subtotal * config.iibb_prom / 100
  const sirtac = subtotal * config.sirtac_prom / 100
  const neto = subtotal - costo_total
  return { costo_total, cpt, tasa_pn, iibb, sirtac, neto, tasa_total }
}

function ConfigModal({ config, onClose, onSaved }) {
  const toast = useToast()
  const [form, setForm] = useState({ ...config })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  async function handleSave() {
    setSaving(true)
    await supabase.from('tn_config_costos').upsert({ id: 'default', ...form, updated_at: new Date().toISOString() })
    toast('✓ Configuración guardada')
    setSaving(false)
    onSaved(form)
    onClose()
  }

  const inputStyle = { background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '8px 10px', borderRadius: 6, fontFamily: 'DM Mono', fontSize: 13, outline: 'none', width: '100%' }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-title">⚙️ Config costos Tienda Nube</div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
          Basado en tus datos reales. Actualizá si TN cambia sus tasas.
        </p>

        <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Costo total por medio de pago (%)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              ['transferencia_total', 'Transferencia'],
              ['debito_total', 'Tarjeta débito'],
              ['credito_total', 'Tarjeta crédito (1 cuota)'],
              ['credito_cuotas_total', 'Tarjeta crédito (3 cuotas)'],
            ].map(([k, label]) => (
              <div key={k}>
                <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{label}</label>
                <input type="number" step="0.01" value={form[k]} onChange={e => set(k, parseFloat(e.target.value))} style={inputStyle} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Desglose impuestos (%)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {[
              ['cpt_tn', 'CPT TN'],
              ['iibb_prom', 'IIBB prom.'],
              ['sirtac_prom', 'SIRTAC prom.'],
            ].map(([k, label]) => (
              <div key={k}>
                <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>{label}</label>
                <input type="number" step="0.01" value={form[k]} onChange={e => set(k, parseFloat(e.target.value))} style={inputStyle} />
              </div>
            ))}
          </div>
        </div>

        <div className="actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

export default function TiendaNubePage() {
  const toast = useToast()
  const now = new Date()
  const [tab, setTab] = useState('resumen')
  const [registros, setRegistros] = useState([])
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ mes: now.toISOString().slice(0, 7), ventas: '', facturado: '', ticket_promedio: '', notas: '' })
  const [saving, setSaving] = useState(false)
  const [filtroMes, setFiltroMes] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`)
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [config, setConfig] = useState(CONFIG_DEFAULT)
  const [showConfig, setShowConfig] = useState(false)

  const months = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(d.toISOString().slice(0, 7))
  }

  useEffect(() => { loadRegistros(); loadConfig() }, [])
  useEffect(() => { loadProductos() }, [filtroMes])

  async function loadConfig() {
    const { data } = await supabase.from('tn_config_costos').select('*').eq('id', 'default').single()
    if (data) setConfig(data)
  }

  async function loadRegistros() {
    const { data } = await supabase.from('tiendanube').select('*').order('mes', { ascending: false })
    setRegistros(data || [])
  }

  async function loadProductos() {
    setLoading(true)
    const { data } = await supabase.from('tiendanube_productos').select('*').eq('mes', filtroMes).order('subtotal', { ascending: false })
    setProductos(data || [])
    setLoading(false)
  }

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  function abrirNuevo() {
    setForm({ mes: now.toISOString().slice(0, 7), ventas: '', facturado: '', ticket_promedio: '', notas: '' })
    setEditando({})
  }

  function abrirEditar(r) {
    setForm({ mes: r.mes, ventas: r.ventas, facturado: r.facturado, ticket_promedio: r.ticket_promedio || '', notas: r.notas || '' })
    setEditando(r)
  }

  async function handleSave() {
    if (!form.mes || !form.facturado) { toast('Completá mes y facturado', 'error'); return }
    setSaving(true)
    const row = { mes: form.mes, ventas: parseInt(form.ventas) || 0, facturado: parseFloat(form.facturado) || 0, ticket_promedio: parseFloat(form.ticket_promedio) || 0, notas: form.notas, updated_at: new Date().toISOString() }
    if (editando?.id) await supabase.from('tiendanube').update(row).eq('id', editando.id)
    else await supabase.from('tiendanube').insert(row)
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

  async function handleCSV(e) {
    const file = e.target.files[0]
    if (!file) return
    setLoading(true)
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      const headers = lines[0].split(';').map(h => h.replace(/"/g, '').trim())
      const rows = lines.slice(1).map(line => {
        const vals = line.split(';').map(v => v.replace(/"/g, '').trim())
        const obj = {}
        headers.forEach((h, i) => obj[h] = vals[i] || '')
        return obj
      }).filter(r => r['Número de orden'])

      // Agrupar por orden para detectar mayoristas
      const porOrden = {}
      rows.forEach(r => {
        const num = r['Número de orden']
        if (!porOrden[num]) porOrden[num] = { total: 0, medio_pago: r['Medio de pago'] || '', rows: [] }
        porOrden[num].total += parseFloat(r['Total'] || 0)
        porOrden[num].rows.push(r)
      })

      // Filtrar mayoristas y armar items
      const minoristas = Object.values(porOrden).filter(o => o.total <= LIMITE_MAYORISTA)
      const mayoristas = Object.values(porOrden).filter(o => o.total > LIMITE_MAYORISTA)

      const items = []
      minoristas.forEach(orden => {
        orden.rows.forEach(r => {
          if (!r['Nombre del producto']) return
          const fecha = r['Fecha'] || ''
          const mes = fecha.slice(6, 10) + '-' + fecha.slice(3, 5)
          items.push({
            mes,
            numero_orden: parseInt(r['Número de orden']),
            producto: r['Nombre del producto'],
            cantidad: parseInt(r['Cantidad del producto']) || 1,
            precio_unitario: parseFloat(r['Precio del producto']) || 0,
            medio_pago: orden.medio_pago,
          })
        })
      })

      setPreview({ items, mayoristas: mayoristas.length, minoristas: minoristas.length, mes: items[0]?.mes })
      toast(`✓ ${items.length} productos encontrados (${mayoristas.length} órdenes mayoristas omitidas)`)
    } catch (err) {
      toast('Error al leer el archivo', 'error')
      console.error(err)
    }
    setLoading(false)
    e.target.value = ''
  }

  async function handleImport() {
    if (!preview?.items?.length) return
    setSaving(true)
    const BATCH = 50
    let imported = 0
    for (let i = 0; i < preview.items.length; i += BATCH) {
      const batch = preview.items.slice(i, i + BATCH)
      const { error } = await supabase.from('tiendanube_productos').upsert(batch, { onConflict: 'numero_orden,producto' })
      if (!error) imported += batch.length
    }
    toast(`✓ ${imported} productos importados`)
    setPreview(null)
    setSaving(false)
    loadProductos()
  }

  // Análisis de productos
  const porProducto = {}
  productos.forEach(p => {
    const k = p.producto
    if (!porProducto[k]) porProducto[k] = { cantidad: 0, subtotal: 0, ordenes: new Set() }
    porProducto[k].cantidad += p.cantidad
    porProducto[k].subtotal += parseFloat(p.subtotal) || 0
    porProducto[k].ordenes.add(p.numero_orden)
  })

  const ranking = Object.entries(porProducto)
    .map(([prod, d]) => ({ prod, ...d, ordenes: d.ordenes.size, precio_unit: d.subtotal / d.cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)

  const totalBruto = ranking.reduce((a, r) => a + r.subtotal, 0)
  const totalUnidades = ranking.reduce((a, r) => a + r.cantidad, 0)
  const totalOrdenes = new Set(productos.map(p => p.numero_orden)).size

  // Costos totales estimados
  const costosProm = productos.reduce((a, p) => {
    const c = calcularCostos(parseFloat(p.subtotal) || 0, p.medio_pago, config)
    return a + c.costo_total
  }, 0)
  const netoTotal = totalBruto - costosProm
  const cptTotal = totalBruto * config.cpt_tn / 100
  const iibbTotal = totalBruto * config.iibb_prom / 100
  const sirtacTotal = totalBruto * config.sirtac_prom / 100
  const tasaPNTotal = costosProm - cptTotal - iibbTotal - sirtacTotal

  const totalFacturado = registros.reduce((a, r) => a + r.facturado, 0)
  const totalVentas = registros.reduce((a, r) => a + r.ventas, 0)

  const selectStyle = { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 14px', borderRadius: 8, fontFamily: 'DM Mono', fontSize: 14, outline: 'none', cursor: 'pointer' }

  return (
    <div>
      <h1 className="page-title">Tienda Nube</h1>
      <p className="page-sub">Registros mensuales y análisis de productos vendidos</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[['resumen', '📊 Resumen'], ['productos', '📦 Productos']].map(([t, l]) => (
          <button key={t} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      {tab === 'resumen' && (
        <>
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
                <div className="stat-sub">en {registros.length} meses</div>
              </div>
            </div>
          )}
          <div className="card">
            {registros.length === 0 ? (
              <div className="empty-state"><div className="icon">🛍️</div><p>No hay registros todavía</p></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Mes</th><th>Ventas</th><th>Facturado</th><th>Ticket prom.</th><th>Notas</th><th></th></tr></thead>
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
        </>
      )}

      {tab === 'productos' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} style={selectStyle}>
                {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowConfig(true)}>⚙️ Config costos</button>
            </div>
            <label style={{ cursor: 'pointer' }}>
              <div className="btn btn-primary">{loading ? 'Leyendo...' : '📂 Importar CSV'}</div>
              <input type="file" accept=".csv" onChange={handleCSV} style={{ display: 'none' }} disabled={loading} />
            </label>
          </div>

          {preview && (
            <div className="card" style={{ marginBottom: 20, borderColor: 'var(--accent)', borderStyle: 'dashed' }}>
              <div className="card-title">Vista previa</div>
              <div style={{ display: 'flex', gap: 24, fontSize: 13, marginBottom: 16, flexWrap: 'wrap' }}>
                <span>📦 <strong>{preview.items.length}</strong> productos</span>
                <span>🛍️ <strong>{preview.minoristas}</strong> órdenes minoristas</span>
                <span style={{ color: 'var(--muted)' }}>🚫 <strong>{preview.mayoristas}</strong> mayoristas omitidas (+$200k)</span>
                <span>📅 Mes detectado: <strong>{monthLabel(preview.mes)}</strong></span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-success" onClick={handleImport} disabled={saving}>{saving ? 'Importando...' : '✓ Confirmar'}</button>
                <button className="btn btn-ghost" onClick={() => setPreview(null)}>Cancelar</button>
              </div>
            </div>
          )}

          {productos.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                {[
                  ['💰 Facturado bruto', fmt(totalBruto), 'var(--accent)'],
                  ['📦 Unidades', totalUnidades, null],
                  ['🛍️ Órdenes', totalOrdenes, null],
                  ['✅ Neto estimado', fmt(netoTotal), 'var(--accent2)'],
                ].map(([label, val, color]) => (
                  <div key={label} className="stat-card" style={{ minWidth: 150 }}>
                    <div className="stat-label">{label}</div>
                    <div className="stat-amount" style={{ fontSize: 18, ...(color ? { color } : {}) }}>{val}</div>
                  </div>
                ))}
              </div>

              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title">💸 Desglose de costos estimados del mes</div>
                {[
                  ['CPT Tienda Nube (2%)', cptTotal],
                  ['Tasa Pago Nube', tasaPNTotal],
                  ['IIBB promedio', iibbTotal],
                  ['SIRTAC promedio', sirtacTotal],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>{label}</span>
                    <span style={{ fontSize: 13, color: 'var(--danger)' }}>−{fmt(Math.abs(val))} ({(Math.abs(val)/totalBruto*100).toFixed(2)}%)</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
                  <span style={{ fontWeight: 500 }}>Total costos</span>
                  <span style={{ fontFamily: 'Fraunces, serif', fontSize: 18, color: 'var(--danger)' }}>−{fmt(costosProm)} ({(costosProm/totalBruto*100).toFixed(1)}%)</span>
                </div>
              </div>

              <div className="card">
                <div className="card-title">🏆 Ranking de productos</div>
                {ranking.map((r, i) => {
                  const costos = calcularCostos(r.subtotal, '', config)
                  return (
                    <div key={r.prod} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, color: i === 0 ? 'var(--cash)' : i === 1 ? 'var(--muted)' : 'var(--border)', minWidth: 28 }}>#{i+1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, marginBottom: 2 }}>{r.prod}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{r.ordenes} órdenes · {r.cantidad} uds · {fmt(r.precio_unit)} c/u</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 15, color: 'var(--cash)' }}>{fmt(r.subtotal)}</div>
                        <div style={{ fontSize: 11, color: 'var(--accent2)' }}>neto ~{fmt(costos.neto)}</div>
                        <div style={{ fontSize: 10, color: 'var(--muted)' }}>−{costos.tasa_total.toFixed(1)}% costos</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {!loading && productos.length === 0 && !preview && (
            <div className="card">
              <div className="empty-state">
                <div className="icon">🛍️</div>
                <p>No hay productos importados para este mes</p>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Exportá el CSV desde Tienda Nube → Estadísticas → Ventas → Exportar</p>
              </div>
            </div>
          )}
        </>
      )}

      {editando !== null && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditando(null)}>
          <div className="modal">
            <div className="modal-title">{editando?.id ? 'Editar mes' : 'Nuevo mes — Tienda Nube'}</div>
            <div className="field"><label>Mes</label><input type="month" value={form.mes} onChange={e => set('mes', e.target.value)} /></div>
            <div className="grid-2">
              <div className="field"><label>Cantidad de ventas</label><input type="number" min="0" placeholder="0" value={form.ventas} onChange={e => set('ventas', e.target.value)} /></div>
              <div className="field"><label>Facturado ($)</label><input type="number" min="0" placeholder="0" value={form.facturado} onChange={e => set('facturado', e.target.value)} /></div>
            </div>
            <div className="field"><label>Ticket promedio ($)</label><input type="number" min="0" placeholder="0 (opcional)" value={form.ticket_promedio} onChange={e => set('ticket_promedio', e.target.value)} /></div>
            <div className="field"><label>Notas</label><textarea placeholder="Opcional..." value={form.notas} onChange={e => set('notas', e.target.value)} /></div>
            <div className="actions">
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
              <button className="btn btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showConfig && <ConfigModal config={config} onClose={() => setShowConfig(false)} onSaved={setConfig} />}
    </div>
  )
}
