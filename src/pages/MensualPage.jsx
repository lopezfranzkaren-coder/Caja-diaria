import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, monthLabel, currentMonth } from '../lib/utils'
import { useToast } from '../lib/toast'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const COLORS_PIE = ['#009ee3', '#4fc4a0', '#e8c547', '#e86547']

export default function MensualPage() {
  const toast = useToast()
  const [mes, setMes] = useState(currentMonth())
  const [ventas, setVentas] = useState([])
  const [gastos, setGastos] = useState([])
  const [ventasMay, setVentasMay] = useState([])
  const [tiendaNube, setTiendaNube] = useState(null)
  const [mlVentas, setMlVentas] = useState([])
  const [meta, setMeta] = useState(null)
  const [editMeta, setEditMeta] = useState(false)
  const [metaInput, setMetaInput] = useState('')
  const [loading, setLoading] = useState(false)

  const months = []
  for (let i = 0; i < 18; i++) {
    const d = new Date(); d.setMonth(d.getMonth() - i)
    months.push(d.toISOString().slice(0, 7))
  }

  useEffect(() => { loadData() }, [mes])

  async function loadData() {
    setLoading(true)
    const start = mes + '-01'
    const [y, mo] = mes.split('-')
    const end = new Date(parseInt(y), parseInt(mo), 0).toISOString().slice(0, 10)
    const [{ data: v }, { data: g }, { data: vm }, { data: m }, { data: tn }, { data: ml }] = await Promise.all([
      supabase.from('ventas').select('*').gte('fecha', start).lte('fecha', end),
      supabase.from('gastos').select('*').gte('fecha', start).lte('fecha', end),
      supabase.from('ventas_mayoristas').select('*').gte('fecha', start).lte('fecha', end),
      supabase.from('metas').select('*').eq('mes', mes).single(),
      supabase.from('tiendanube').select('*').eq('mes', mes).single(),
      supabase.from('mercadolibre_ventas').select('total').gte('fecha', start).lte('fecha', end)
    ])
    setVentas(v || [])
    setGastos(g || [])
    setVentasMay(vm || [])
    setTiendaNube(tn || null)
    setMlVentas(ml || [])
    setMeta(m || null)
    setMetaInput(m?.meta_pesos || '')
    setLoading(false)
  }

  async function saveMeta() {
    const val = parseFloat(metaInput)
    if (!val) { toast('Ingresá un monto válido', 'error'); return }
    if (meta?.id) {
      await supabase.from('metas').update({ meta_pesos: val, updated_at: new Date().toISOString() }).eq('id', meta.id)
    } else {
      await supabase.from('metas').insert({ mes, meta_pesos: val })
    }
    toast('✓ Meta guardada')
    setEditMeta(false)
    loadData()
  }

  // Aggregations
  const totalVentas = ventas.reduce((a, v) => a + v.monto, 0)
  const totalGastos = gastos.reduce((a, g) => a + g.monto, 0)
  const totalMayoristas = ventasMay.reduce((a, v) => a + v.monto, 0)
  const totalTiendaNube = tiendaNube?.facturado || 0
  const totalML = mlVentas.reduce((a, v) => a + v.total, 0)
  const totalGeneral = totalVentas + totalMayoristas + totalTiendaNube + totalML
  const ganancia = totalGeneral - totalGastos

  const totalMp = ventas.filter(v => v.metodo === 'mp').reduce((a, v) => a + v.monto, 0)
    + ventasMay.filter(v => v.metodo === 'mp').reduce((a, v) => a + v.monto, 0)
  const totalTransfer = ventas.filter(v => v.metodo === 'transferencia').reduce((a, v) => a + v.monto, 0)
    + ventasMay.filter(v => v.metodo === 'transferencia').reduce((a, v) => a + v.monto, 0)
  const totalCash = ventas.filter(v => v.metodo === 'efectivo').reduce((a, v) => a + v.monto, 0)
    + ventasMay.filter(v => v.metodo === 'efectivo').reduce((a, v) => a + v.monto, 0)
  const totalPendienteMay = ventasMay.filter(v => !v.pagado).reduce((a, v) => a + (v.monto - (v.monto_pagado || 0)), 0)

  const totalLocal = ventas.filter(v => v.canal === 'local').reduce((a, v) => a + v.monto, 0)
  const totalOnline = ventas.filter(v => v.canal === 'online').reduce((a, v) => a + v.monto, 0)

  // Days aggregation for chart
  const [y, mo] = mes.split('-').map(Number)
  const daysInMonth = new Date(y, mo, 0).getDate()
  const byDay = {}
  ;[...ventas, ...ventasMay].forEach(v => { byDay[v.fecha] = (byDay[v.fecha] || 0) + v.monto })
  const chartData = Array.from({ length: daysInMonth }, (_, i) => {
    const d = String(i + 1).padStart(2, '0')
    const dateStr = `${mes}-${d}`
    return { dia: i + 1, total: byDay[dateStr] || 0 }
  })

  const pieData = [
    { name: 'Mercado Pago', value: totalMp },
    { name: 'Transferencia', value: totalTransfer },
    { name: 'Efectivo', value: totalCash },
    { name: 'Pendiente', value: totalPendienteMay },
  ].filter(d => d.value > 0)

  // Top/bottom days
  const diasConVenta = Object.entries(byDay).sort((a, b) => b[1] - a[1])
  const top3 = diasConVenta.slice(0, 3)
  const bot3 = diasConVenta.slice(-3).reverse()

  const diasRegistrados = new Set([...ventas.map(v => v.fecha), ...ventasMay.map(v => v.fecha)]).size
  const progreso = meta ? Math.min(100, Math.round(totalGeneral / meta.meta_pesos * 100)) : 0

  const customTooltip = ({ active, payload }) => {
    if (active && payload?.length) {
      return <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>{fmt(payload[0].value)}</div>
    }
    return null
  }

  return (
    <div>
      <h1 className="page-title">Resumen mensual</h1>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div className="month-bar" style={{ marginBottom: 0 }}>
          <select value={mes} onChange={e => setMes(e.target.value)}>
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {editMeta ? (
            <>
              <input type="number" placeholder="Meta en $" value={metaInput} onChange={e => setMetaInput(e.target.value)}
                style={{ background: 'var(--surface)', border: '1px solid var(--accent)', color: 'var(--text)', padding: '8px 12px', borderRadius: 8, fontFamily: 'DM Mono', fontSize: 14, outline: 'none', width: 160 }} />
              <button className="btn btn-primary btn-sm" onClick={saveMeta}>Guardar</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditMeta(false)}>Cancelar</button>
            </>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => setEditMeta(true)}>
              🎯 {meta ? `Meta: ${fmt(meta.meta_pesos)}` : 'Fijar meta'}
            </button>
          )}
        </div>
      </div>

      {loading && <div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center' }}>Cargando...</div>}

      {!loading && (
        <>
          {/* META PROGRESS */}
          {meta && (
            <div className="card" style={{ marginBottom: 20, borderColor: progreso >= 100 ? 'var(--accent2)' : 'var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>🎯 Meta mensual: {fmt(meta.meta_pesos)}</span>
                <span style={{ fontSize: 13, fontFamily: 'Fraunces, serif', color: progreso >= 100 ? 'var(--accent2)' : 'var(--accent)' }}>{progreso}%</span>
              </div>
              <div className="progress-wrap">
                <div className="progress-bar" style={{ width: `${progreso}%`, background: progreso >= 100 ? 'var(--accent2)' : 'var(--accent)' }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                {progreso >= 100 ? '🎉 ¡Meta alcanzada!' : `Faltan ${fmt(meta.meta_pesos - totalGeneral)} para la meta`}
              </div>
            </div>
          )}

          {/* MAIN STATS */}
          <div className="grid-4" style={{ marginBottom: 20 }}>
            <div className="stat-card" style={{ borderColor: 'var(--accent)' }}>
              <div className="stat-label">Total ingresos</div>
              <div className="stat-amount" style={{ color: 'var(--accent)' }}>{fmt(totalGeneral)}</div>
              <div className="stat-sub">{diasRegistrados} días con venta</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">🏪 Local + Online</div>
              <div className="stat-amount" style={{ fontSize: 20 }}>{fmt(totalVentas)}</div>
              <div className="stat-sub">Promedio: {fmt(diasRegistrados > 0 ? Math.round(totalVentas / diasRegistrados) : 0)}/día</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">👥 Mayoristas</div>
              <div className="stat-amount" style={{ fontSize: 20 }}>{fmt(totalMayoristas)}</div>
              <div className="stat-sub" style={{ color: totalPendienteMay > 0 ? 'var(--warning)' : 'var(--muted)' }}>
                {totalPendienteMay > 0 ? `Pendiente: ${fmt(totalPendienteMay)}` : 'Sin pendientes'}
              </div>
            </div>
            <div className="stat-card" style={{ borderColor: ganancia >= 0 ? 'var(--accent2)' : 'var(--danger)' }}>
              <div className="stat-label">Ganancia neta</div>
              <div className="stat-amount" style={{ fontSize: 20, color: ganancia >= 0 ? 'var(--accent2)' : 'var(--danger)' }}>{fmt(ganancia)}</div>
              <div className="stat-sub">Gastos: {fmt(totalGastos)}</div>
            </div>
          </div>

          {/* CANALES EXTRA */}
          {(totalTiendaNube > 0 || totalML > 0) && (
            <div className="grid-2" style={{ marginBottom: 20 }}>
              {totalTiendaNube > 0 && (
                <div className="stat-card">
                  <div className="stat-label">🛍️ Tienda Nube</div>
                  <div className="stat-amount" style={{ fontSize: 20, color: 'var(--online)' }}>{fmt(totalTiendaNube)}</div>
                  <div className="stat-sub">{tiendaNube?.ventas || 0} ventas · ticket {fmt(tiendaNube?.ticket_promedio || 0)}</div>
                </div>
              )}
              {totalML > 0 && (
                <div className="stat-card">
                  <div className="stat-label">🟡 Mercado Libre</div>
                  <div className="stat-amount" style={{ fontSize: 20, color: 'var(--cash)' }}>{fmt(totalML)}</div>
                  <div className="stat-sub">{mlVentas.length} ventas</div>
                </div>
              )}
            </div>
          )}

          {/* METODOS + CANALES */}
          <div className="grid-2" style={{ marginBottom: 20 }}>
            <div className="card">
              <div className="card-title">💳 Métodos de pago — Local</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Mercado Pago', val: totalMp, color: 'var(--mp)' },
                  { label: 'Transferencia', val: totalTransfer, color: 'var(--transfer)' },
                  { label: 'Efectivo', val: totalCash, color: 'var(--cash)' },
                ].map(({ label, val, color }) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
                      <span style={{ fontSize: 14, color }}>{fmt(val)} <span style={{ fontSize: 11, color: 'var(--muted)' }}>({totalVentas > 0 ? Math.round(val / totalVentas * 100) : 0}%)</span></span>
                    </div>
                    <div className="progress-wrap">
                      <div className="progress-bar" style={{ width: `${totalVentas > 0 ? val / totalVentas * 100 : 0}%`, background: color }} />
                    </div>
                  </div>
                ))}
              </div>

            </div>

            <div className="card">
              <div className="card-title">📍 Local vs Online</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: '🏪 Presencial', val: totalLocal, color: 'var(--accent)' },
                  { label: '🌐 Online', val: totalOnline, color: 'var(--online)' },
                ].map(({ label, val, color }) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</span>
                      <span style={{ fontSize: 14, color }}>{fmt(val)} <span style={{ fontSize: 11, color: 'var(--muted)' }}>({totalGeneral > 0 ? Math.round(val / totalGeneral * 100) : 0}%)</span></span>
                    </div>
                    <div className="progress-wrap">
                      <div className="progress-bar" style={{ width: `${totalGeneral > 0 ? val / totalGeneral * 100 : 0}%`, background: color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* BAR CHART */}
          {chartData.some(d => d.total > 0) && (
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-title">📈 Ventas por día</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <XAxis dataKey="dia" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip content={customTooltip} cursor={{ fill: 'var(--surface2)' }} />
                  <Bar dataKey="total" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* TOP / BOTTOM DAYS */}
          {diasConVenta.length > 0 && (
            <div className="grid-2" style={{ marginBottom: 20 }}>
              <div className="card">
                <div className="card-title">🔥 Días más movidos</div>
                {top3.map(([f, v]) => (
                  <div key={f} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13 }}>{fmtDate(f)}</span>
                    <span style={{ fontFamily: 'Fraunces, serif', color: 'var(--accent2)' }}>{fmt(v)}</span>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="card-title">🌙 Días más tranquilos</div>
                {bot3.map(([f, v]) => (
                  <div key={f} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13 }}>{fmtDate(f)}</span>
                    <span style={{ fontFamily: 'Fraunces, serif', color: 'var(--muted)' }}>{fmt(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalVentas === 0 && totalMayoristas === 0 && (
            <div className="empty-state"><div className="icon">📅</div><p>No hay datos para este mes</p></div>
          )}
        </>
      )}
    </div>
  )
}
