import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, monthLabel } from '../lib/utils'
import { useToast } from '../lib/toast'

const CONFIG_DEFAULT = [
  { id: 'caba', nombre: 'CABA',  costo_ml: 4611,  costo_moto: 3500, activo: true },
  { id: 'gba1', nombre: 'GBA 1', costo_ml: 7371,  costo_moto: 4500, activo: true },
  { id: 'gba2', nombre: 'GBA 2', costo_ml: 10246, costo_moto: 5000, activo: true },
  { id: 'gba3', nombre: 'GBA 3', costo_ml: 14000, costo_moto: 8000, activo: true },
]

function debeExcluir(estado) {
  const e = (estado || '').toLowerCase()
  return e.includes('cancelad') || e.includes('devoluci') || e.includes('reembolso')
}

function parseFecha(fechaStr) {
  const meses = { enero:'01', febrero:'02', marzo:'03', abril:'04', mayo:'05', junio:'06', julio:'07', agosto:'08', septiembre:'09', octubre:'10', noviembre:'11', diciembre:'12' }
  const match = (fechaStr || '').match(/(\d+) de (\w+) de (\d+)/)
  if (!match) return null
  const [, dia, mes, anio] = match
  return `${anio}-${meses[mes.toLowerCase()] || '01'}-${dia.padStart(2, '0')}`
}

function detectarZona(ingresoEnvio, config) {
  // Para Flex: ML no cobra costo separado, el ingreso envío ES lo que paga el comprador
  // Detectamos zona por el ingreso de envío
  if (!ingresoEnvio || ingresoEnvio === 0) return null
  let closest = null, minDiff = Infinity
  config.filter(z => z.activo).forEach(z => {
    const diff = Math.abs(ingresoEnvio - z.costo_ml)
    if (diff < minDiff) { minDiff = diff; closest = z }
  })
  return (closest && minDiff / (closest.costo_ml || 1) < 0.08) ? closest : null
}

function calcularVenta(v, config) {
  const neto_producto = (v.ingresos_producto || 0)
    + (v.cargo_venta || 0)
    + (v.costo_fijo || 0)
    + (v.costo_cuotas || 0)

  const ingreso_envio = v.ingresos_envio || 0
  const costo_envio_ml = Math.abs(v.costos_envio_ml || 0)
  let ganancia_envio = 0, zona = null, tipo_envio = 'otro'
  const fe = (v.forma_entrega || '').toLowerCase()

  if (fe.includes('flex')) {
    tipo_envio = 'flex'
    // Para Flex: ML no cobra aparte, ingreso_envio ya es lo que te transfiere ML
    // Ganancia = ingreso envío ML - lo que pagás al moto
    zona = detectarZona(ingreso_envio, config)
    ganancia_envio = zona
      ? ingreso_envio - zona.costo_moto
      : ingreso_envio
  } else if (fe.includes('correo') || fe.includes('punto')) {
    tipo_envio = 'correo'
    ganancia_envio = 0 // ML absorbe correo completamente
  } else if (fe.includes('acuerdo') || fe.includes('retira') || fe.includes('local')) {
    tipo_envio = 'retiro'
    ganancia_envio = 0
  } else {
    ganancia_envio = ingreso_envio - costo_envio_ml
  }

  return { neto_producto, ingreso_envio, costo_envio_ml, ganancia_envio, zona, tipo_envio }
}

function parseMLExcel(data) {
  const rows = data.slice(5).filter(r => r[0])
  return rows.map(r => ({
    numero_venta:      String(r[0]  || ''),
    fecha_raw:         String(r[1]  || ''),
    estado:            String(r[2]  || ''),
    unidades:          parseFloat(r[6])  || 0,
    ingresos_producto: parseFloat(r[7])  || 0,
    cargo_venta:       parseFloat(r[8])  || 0,
    costo_fijo:        parseFloat(r[9])  || 0,
    costo_cuotas:      parseFloat(r[10]) || 0,
    ingresos_envio:    parseFloat(r[11]) || 0,
    costos_envio_ml:   parseFloat(r[12]) || 0,
    total:             parseFloat(r[18]) || 0,
    titulo:            String(r[23] || ''),
    variante:          String(r[24] || ''),
    forma_entrega:     String(r[39] || ''),
  })).filter(r => !debeExcluir(r.estado) && r.total && r.total !== 0)
}

function ConfigEnviosModal({ config, onClose, onSaved }) {
  const toast = useToast()
  const [zonas, setZonas] = useState(config.map(z => ({ ...z })))
  const [saving, setSaving] = useState(false)
  const upd = (id, key, val) => setZonas(p => p.map(z => z.id === id ? { ...z, [key]: val } : z))

  async function handleSave() {
    setSaving(true)
    await supabase.from('ml_config_envios').upsert(zonas.map(z => ({
      id: z.id, nombre: z.nombre,
      costo_ml: parseFloat(z.costo_ml) || 0,
      costo_moto: parseFloat(z.costo_moto) || 0,
      activo: z.activo, updated_at: new Date().toISOString()
    })))
    toast('✓ Configuración guardada')
    setSaving(false); onSaved(); onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-title">⚙️ Configuración de envíos Flex</div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
          El sistema detecta la zona por el monto que cobra ML al comprador. Si ML aumenta sus tarifas, actualizá "Costo ML" y todos los cálculos se ajustan automáticamente.
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'70px 1fr 1fr 1fr 40px', gap:8, marginBottom:8 }}>
          {['Zona','Nombre','Costo ML ($)','Tu moto ($)','On'].map((h,i) => (
            <span key={i} style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', letterSpacing:1 }}>{h}</span>
          ))}
        </div>
        {zonas.map(z => (
          <div key={z.id} style={{ display:'grid', gridTemplateColumns:'70px 1fr 1fr 1fr 40px', gap:8, marginBottom:10, alignItems:'center' }}>
            <span style={{ fontSize:13, color:'var(--accent)', fontWeight:500 }}>{z.id.toUpperCase()}</span>
            <input value={z.nombre} onChange={e => upd(z.id,'nombre',e.target.value)}
              style={{ background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 10px', borderRadius:6, fontFamily:'DM Mono', fontSize:13, outline:'none' }} />
            <input type="number" value={z.costo_ml} onChange={e => upd(z.id,'costo_ml',e.target.value)}
              style={{ background:'var(--surface2)', border:'1px solid var(--mp)', color:'var(--mp)', padding:'8px 10px', borderRadius:6, fontFamily:'DM Mono', fontSize:13, outline:'none' }} />
            <input type="number" value={z.costo_moto} onChange={e => upd(z.id,'costo_moto',e.target.value)}
              style={{ background:'var(--surface2)', border:'1px solid var(--cash)', color:'var(--cash)', padding:'8px 10px', borderRadius:6, fontFamily:'DM Mono', fontSize:13, outline:'none' }} />
            <input type="checkbox" checked={z.activo} onChange={e => upd(z.id,'activo',e.target.checked)}
              style={{ width:16, height:16, cursor:'pointer' }} />
          </div>
        ))}
        <div style={{ background:'var(--surface2)', borderRadius:8, padding:'12px 14px', margin:'16px 0', fontSize:12, color:'var(--muted)' }}>
          💡 <strong style={{color:'var(--text)'}}>Ganancia envío Flex</strong> = Ingreso envío (lo que paga el comprador) − Costo ML − Tu moto
        </div>
        <div className="actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'Guardando...':'Guardar'}</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

export default function MercadoLibrePage() {
  const toast = useToast()
  const [importados, setImportados] = useState([])
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [filtroAnio, setFiltroAnio] = useState(String(new Date().getFullYear()))
  const [filtroMes, setFiltroMes] = useState(new Date().toISOString().slice(0, 7))
  const [tab, setTab] = useState('resumen')
  const [config, setConfig] = useState(CONFIG_DEFAULT)
  const [showConfig, setShowConfig] = useState(false)

  useEffect(() => { loadConfig() }, [])
  useEffect(() => { loadImportados() }, [filtroMes])

  async function loadConfig() {
    const { data } = await supabase.from('ml_config_envios').select('*').order('id')
    if (data && data.length > 0) setConfig(data)
  }

  async function loadImportados() {
    const { data } = await supabase.from('mercadolibre_ventas').select('*')
      .gte('fecha', filtroMes + '-01').lte('fecha', (() => { const [y,m] = filtroMes.split('-'); return new Date(parseInt(y), parseInt(m), 0).toISOString().slice(0,10) })())
      .order('fecha', { ascending: false })
    setImportados(data || [])
  }

  const aniosDisponibles = ['2025', '2026', '2027']
  const mesesDelAnio = Array.from({ length: 12 }, (_, i) => `${filtroAnio}-${String(i+1).padStart(2,'0')}`)
  const selectStyle = { background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', padding:'10px 14px', borderRadius:8, fontFamily:'DM Mono', fontSize:14, outline:'none', cursor:'pointer' }

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setLoading(true)
    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      const parsed = parseMLExcel(data)
      if (!parsed.length) toast('No se encontraron ventas', 'error')
      else { setPreview(parsed); toast(`✓ ${parsed.length} ventas encontradas`) }
    } catch (err) { toast('Error al leer el archivo', 'error'); console.error(err) }
    setLoading(false); e.target.value = ''
  }

  async function handleImport() {
    if (!preview?.length) return
    setSaving(true)
    const rows = preview.map(v => ({
      numero_venta: v.numero_venta,
      fecha: parseFecha(v.fecha_raw) || new Date().toISOString().split('T')[0],
      estado: v.estado, unidades: v.unidades,
      ingresos_producto: v.ingresos_producto,
      cargo_venta: v.cargo_venta, costo_fijo: v.costo_fijo, costo_cuotas: v.costo_cuotas,
      ingresos_envio: v.ingresos_envio, costos_envio_ml: v.costos_envio_ml,
      total: v.total, titulo: v.titulo, variante: v.variante, forma_entrega: v.forma_entrega,
    }))
    // Import in batches of 50
    const BATCH = 50
    let imported = 0, errors = 0
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const { error } = await supabase.from('mercadolibre_ventas').upsert(batch, { onConflict: 'numero_venta' })
      if (error) { console.error('Batch error:', error); errors++ }
      else imported += batch.length
    }
    if (errors > 0) toast('Importadas ' + imported + ' ventas (' + errors + ' lotes con error)', 'error')
    else toast('✓ ' + imported + ' ventas importadas')
    setPreview(null); setSaving(false); loadImportados()
  }

  async function handleDeleteAll() {
    if (!confirm(`¿Eliminar ventas de ${monthLabel(filtroMes)}?`)) return
    await supabase.from('mercadolibre_ventas').delete()
      .gte('fecha', filtroMes + '-01').lte('fecha', (() => { const [y,m] = filtroMes.split('-'); return new Date(parseInt(y), parseInt(m), 0).toISOString().slice(0,10) })())
    toast('Eliminado'); loadImportados()
  }

  const vc = importados.map(v => ({ ...v, calc: calcularVenta(v, config) }))
  const totalCobrado  = vc.reduce((a,v) => a + v.total, 0)
  const totalNetoProd = vc.reduce((a,v) => a + v.calc.neto_producto, 0)
  const totalIngEnvio = vc.reduce((a,v) => a + v.calc.ingreso_envio, 0)
  const totalGanEnvio = vc.reduce((a,v) => a + v.calc.ganancia_envio, 0)
  const totalUnidades = vc.reduce((a,v) => a + v.unidades, 0)
  const ticketProm    = vc.length > 0 ? totalCobrado / vc.length : 0
  const flex   = vc.filter(v => v.calc.tipo_envio === 'flex').length
  const correo = vc.filter(v => v.calc.tipo_envio === 'correo').length
  const retiro = vc.filter(v => v.calc.tipo_envio === 'retiro').length

  const prodMap = {}
  vc.forEach(v => {
    const key = v.titulo?.slice(0, 60) || 'Sin título'
    if (!prodMap[key]) prodMap[key] = { unidades:0, total:0, neto:0, count:0 }
    prodMap[key].unidades += v.unidades; prodMap[key].total += v.total
    prodMap[key].neto += v.calc.neto_producto; prodMap[key].count++
  })
  const topProductos = Object.entries(prodMap).sort((a,b) => b[1].unidades - a[1].unidades).slice(0, 10)

  const zonaBreakdown = {}
  vc.filter(v => v.calc.tipo_envio==='flex' && v.calc.zona).forEach(v => {
    const z = v.calc.zona.nombre
    if (!zonaBreakdown[z]) zonaBreakdown[z] = { count:0, ganancia:0 }
    zonaBreakdown[z].count++; zonaBreakdown[z].ganancia += v.calc.ganancia_envio
  })

  return (
    <div>
      <h1 className="page-title">Mercado Libre</h1>
      <p className="page-sub">Importá el excel de ventas para ver estadísticas y rentabilidad real</p>

      <div className="card" style={{ marginBottom:20, borderColor:'var(--accent)', borderStyle:'dashed' }}>
        <div className="card-title">📥 Importar excel de ML</div>
        <p style={{ fontSize:13, color:'var(--muted)', marginBottom:16 }}>
          Descargá desde ML → Mi cuenta → Ventas → Exportar. Podés subir el mismo excel varias veces sin duplicar.
        </p>
        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <label style={{ cursor:'pointer' }}>
            <div className="btn btn-primary">{loading ? 'Leyendo...' : '📂 Seleccionar .xlsx'}</div>
            <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display:'none' }} disabled={loading} />
          </label>
          {preview && <span style={{ fontSize:13, color:'var(--accent2)' }}>{preview.length} ventas listas</span>}
        </div>
        {preview && preview.length > 0 && (
          <div style={{ marginTop:16 }}>
            <div style={{ background:'var(--surface2)', borderRadius:8, padding:'12px 16px', marginBottom:12, fontSize:13 }}>
              <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
                <span>📦 <strong>{preview.length}</strong> ventas</span>
                <span>💰 <strong>{fmt(preview.reduce((a,v)=>a+v.total,0))}</strong> cobrado</span>
                <span>📅 <strong>{parseFecha(preview[preview.length-1]?.fecha_raw)}</strong> → <strong>{parseFecha(preview[0]?.fecha_raw)}</strong></span>
              </div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-success" onClick={handleImport} disabled={saving}>{saving?'Importando...':'✓ Confirmar'}</button>
              <button className="btn btn-ghost" onClick={() => setPreview(null)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <select value={filtroAnio} onChange={e => { setFiltroAnio(e.target.value); setFiltroMes(`${e.target.value}-${filtroMes.slice(5)}`) }} style={selectStyle}>
            {aniosDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} style={selectStyle}>
            {mesesDelAnio.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowConfig(true)}>⚙️ Config envíos</button>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {[['resumen','📊 Resumen'],['ventas','📋 Ventas'],['productos','🏆 Productos']].map(([t,l]) => (
            <button key={t} className={`btn btn-sm ${tab===t?'btn-primary':'btn-ghost'}`} onClick={()=>setTab(t)}>{l}</button>
          ))}
        </div>
      </div>

      {importados.length === 0 ? (
        <div className="empty-state"><div className="icon">🟡</div><p>No hay ventas importadas para este mes</p></div>
      ) : (
        <>
          {tab === 'resumen' && (
            <>
              <div className="grid-4" style={{ marginBottom:16 }}>
                <div className="stat-card" style={{ borderColor:'var(--cash)' }}>
                  <div className="stat-label">💰 Total cobrado</div>
                  <div className="stat-amount" style={{ color:'var(--cash)' }}>{fmt(totalCobrado)}</div>
                  <div className="stat-sub">{vc.length} ventas · {totalUnidades} uds</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">📦 Neto producto</div>
                  <div className="stat-amount" style={{ fontSize:20, color:'var(--accent2)' }}>{fmt(totalNetoProd)}</div>
                  <div className="stat-sub">después de cargos ML</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">🚚 Ganancia envíos</div>
                  <div className="stat-amount" style={{ fontSize:20, color: totalGanEnvio>=0?'var(--accent2)':'var(--danger)' }}>{fmt(totalGanEnvio)}</div>
                  <div className="stat-sub">cobrado − ML − moto</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">🎯 Ticket promedio</div>
                  <div className="stat-amount" style={{ fontSize:20 }}>{fmt(ticketProm)}</div>
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom:16 }}>
                <div className="card">
                  <div className="card-title">📦 Desglose producto</div>
                  {[
                    { label:'Ingresos brutos', val: vc.reduce((a,v)=>a+(v.ingresos_producto||0),0), color:'var(--text)' },
                    { label:'Cargo por venta ML', val: vc.reduce((a,v)=>a+(v.cargo_venta||0),0), color:'var(--danger)' },
                    { label:'Costo fijo ML', val: vc.reduce((a,v)=>a+(v.costo_fijo||0),0), color:'var(--danger)' },
                    { label:'Costo cuotas ML', val: vc.reduce((a,v)=>a+(v.costo_cuotas||0),0), color:'var(--danger)' },
                  ].map(({label,val,color}) => (
                    <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                      <span style={{ fontSize:12, color:'var(--muted)' }}>{label}</span>
                      <span style={{ fontSize:14, color }}>{fmt(val)}</span>
                    </div>
                  ))}
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0' }}>
                    <span style={{ fontSize:13, fontWeight:500 }}>Neto producto</span>
                    <span style={{ fontFamily:'Fraunces, serif', fontSize:18, color:'var(--accent2)' }}>{fmt(totalNetoProd)}</span>
                  </div>
                </div>

                <div className="card">
                  <div className="card-title">🚀 Envíos Flex</div>
                  <div style={{ marginBottom:12 }}>
                    {[
                      { label:'Ingreso envío Flex (lo que paga el comprador)', val: vc.filter(v=>v.calc.tipo_envio==='flex').reduce((a,v)=>a+v.calc.ingreso_envio,0), color:'var(--text)' },
                      { label:'Costo motoquero', val: -vc.filter(v=>v.calc.zona).reduce((a,v)=>a+(v.calc.zona?.costo_moto||0),0), color:'var(--danger)' },
                    ].map(({label,val,color}) => (
                      <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                        <span style={{ fontSize:12, color:'var(--muted)' }}>{label}</span>
                        <span style={{ fontSize:14, color }}>{fmt(val)}</span>
                      </div>
                    ))}
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0' }}>
                      <span style={{ fontSize:13, fontWeight:500 }}>Ganancia Flex</span>
                      <span style={{ fontFamily:'Fraunces, serif', fontSize:18, color: totalGanEnvio>=0?'var(--accent2)':'var(--danger)' }}>{fmt(totalGanEnvio)}</span>
                    </div>
                  </div>
                  {Object.keys(zonaBreakdown).length > 0 && (
                    <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
                      <div style={{ fontSize:11, color:'var(--muted)', marginBottom:10, textTransform:'uppercase', letterSpacing:1 }}>Por zona</div>
                      <div style={{ display:'flex', gap:12, flexWrap:'wrap' }}>
                        {Object.entries(zonaBreakdown).map(([zona, d]) => (
                          <div key={zona} style={{ background:'var(--surface2)', borderRadius:8, padding:'10px 16px', minWidth:110 }}>
                            <div style={{ fontSize:13, fontWeight:500, marginBottom:4 }}>{zona}</div>
                            <div style={{ fontSize:11, color:'var(--muted)' }}>{d.count} envíos</div>
                            <div style={{ fontSize:13, color: d.ganancia>=0?'var(--accent2)':'var(--danger)', marginTop:4 }}>{fmt(d.ganancia)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="card">
                <div className="card-title">🚚 Formas de entrega</div>
                <div className="grid-3">
                  {[
                    ['🚀 Flex', flex, vc.filter(v=>v.calc.tipo_envio==='flex').reduce((a,v)=>a+v.calc.ingreso_envio,0), 'var(--accent)'],
                    ['📦 Correo', correo, vc.filter(v=>v.calc.tipo_envio==='correo').reduce((a,v)=>a+v.calc.ingreso_envio,0), 'var(--muted)'],
                    ['🏪 Retiro local', retiro, 0, 'var(--muted)'],
                  ].map(([label, cant, monto, color]) => (
                    <div key={label} style={{ textAlign:'center', padding:'12px 0' }}>
                      <div style={{ fontFamily:'Fraunces, serif', fontSize:28, color }}>{cant}</div>
                      <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>{label}</div>
                      {monto > 0 && <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>{fmt(monto)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'ventas' && (
            <div className="card">
              <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
                <button className="btn btn-danger btn-sm" onClick={handleDeleteAll}>Eliminar mes</button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Fecha</th><th>Producto</th><th>Uds</th><th>Cobrado</th><th>Neto prod.</th><th>G. envío</th><th>Entrega</th></tr>
                  </thead>
                  <tbody>
                    {vc.map(v => (
                      <tr key={v.id}>
                        <td>{fmtDate(v.fecha)}</td>
                        <td style={{ maxWidth:220, fontSize:12, color:'var(--muted)' }}>{(v.titulo||'').slice(0,55)}{(v.titulo||'').length>55?'...':''}</td>
                        <td>{v.unidades}</td>
                        <td style={{ fontFamily:'Fraunces, serif', fontSize:14, color:'var(--cash)' }}>{fmt(v.total)}</td>
                        <td style={{ fontSize:13, color:'var(--accent2)' }}>{fmt(v.calc.neto_producto)}</td>
                        <td style={{ fontSize:13, color: v.calc.ganancia_envio>=0?'var(--accent2)':'var(--danger)' }}>
                          {v.calc.tipo_envio==='retiro' ? '—' : fmt(v.calc.ganancia_envio)}
                        </td>
                        <td style={{ fontSize:11 }}>
                          {v.calc.tipo_envio==='flex' ? `🚀 ${v.calc.zona?.nombre||'Flex'}` :
                           v.calc.tipo_envio==='correo' ? '📦 Correo' :
                           v.calc.tipo_envio==='retiro' ? '🏪 Retiro' : '📦'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'productos' && (
            <div className="card">
              <div className="card-title">🏆 Productos más vendidos</div>
              {topProductos.map(([titulo, s], i) => (
                <div key={titulo} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 0', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ fontFamily:'Fraunces, serif', fontSize:20, color:i===0?'var(--cash)':i===1?'var(--muted)':'var(--border)', minWidth:28 }}>#{i+1}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, marginBottom:2 }}>{titulo}</div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>{s.count} órdenes · {s.unidades} uds</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontFamily:'Fraunces, serif', fontSize:15, color:'var(--cash)' }}>{fmt(s.total)}</div>
                    <div style={{ fontSize:11, color:'var(--accent2)' }}>neto {fmt(s.neto)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showConfig && <ConfigEnviosModal config={config} onClose={() => setShowConfig(false)} onSaved={loadConfig} />}
    </div>
  )
}
