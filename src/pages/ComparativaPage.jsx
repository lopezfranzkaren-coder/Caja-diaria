import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, monthLabel } from '../lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'

export default function ComparativaPage() {
  const [datos, setDatos] = useState([])
  const [loading, setLoading] = useState(true)
  const [mesesMostrar, setMesesMostrar] = useState(6)

  useEffect(() => { loadTodo() }, [])

  async function loadTodo() {
    setLoading(true)
    const [{ data: ventas }, { data: gastos }, { data: mayoristas }, { data: tn }, { data: ml }] = await Promise.all([
      supabase.from('ventas').select('fecha, monto'),
      supabase.from('gastos').select('fecha, monto'),
      supabase.from('ventas_mayoristas').select('fecha, monto'),
      supabase.from('tiendanube').select('mes, facturado, ventas'),
      supabase.from('mercadolibre_ventas').select('fecha, total'),
    ])

    // Group everything by month
    const mesesSet = new Set()
    const byMes = {}

    const addToMes = (fecha, key, val) => {
      const mes = fecha?.slice(0, 7)
      if (!mes) return
      mesesSet.add(mes)
      if (!byMes[mes]) byMes[mes] = { ventas: 0, gastos: 0, mayoristas: 0, tiendanube: 0, ml: 0 }
      byMes[mes][key] = (byMes[mes][key] || 0) + val
    }

    ;(ventas || []).forEach(v => addToMes(v.fecha, 'ventas', v.monto))
    ;(gastos || []).forEach(g => addToMes(g.fecha, 'gastos', g.monto))
    ;(mayoristas || []).forEach(m => addToMes(m.fecha, 'mayoristas', m.monto))
    ;(ml || []).forEach(m => addToMes(m.fecha, 'ml', m.total))
    ;(tn || []).forEach(t => {
      mesesSet.add(t.mes)
      if (!byMes[t.mes]) byMes[t.mes] = { ventas: 0, gastos: 0, mayoristas: 0, tiendanube: 0, ml: 0 }
      byMes[t.mes].tiendanube = t.facturado
    })

    const sorted = [...mesesSet].sort()
    const result = sorted.map(mes => {
      const d = byMes[mes] || {}
      const totalIngresos = (d.ventas || 0) + (d.mayoristas || 0) + (d.tiendanube || 0) + (d.ml || 0)
      const ganancia = totalIngresos - (d.gastos || 0)
      const [y, mo] = mes.split('-')
      const label = new Date(y, mo - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
      return {
        mes, label,
        'Local/Online': Math.round(d.ventas || 0),
        'Mayoristas': Math.round(d.mayoristas || 0),
        'Tienda Nube': Math.round(d.tiendanube || 0),
        'Mercado Libre': Math.round(d.ml || 0),
        'Gastos': Math.round(d.gastos || 0),
        totalIngresos: Math.round(totalIngresos),
        ganancia: Math.round(ganancia),
      }
    })

    setDatos(result)
    setLoading(false)
  }

  const datosFiltrados = datos.slice(-mesesMostrar)

  const customTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      return (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: 8, fontSize: 12 }}>
          <div style={{ fontFamily: 'Fraunces, serif', marginBottom: 8, fontSize: 14 }}>{label}</div>
          {payload.map(p => (
            <div key={p.name} style={{ color: p.fill, marginBottom: 3 }}>
              {p.name}: {fmt(p.value)}
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  if (loading) return <div style={{ color: 'var(--muted)', padding: 60, textAlign: 'center' }}>Cargando...</div>

  if (datos.length === 0) return (
    <div>
      <h1 className="page-title">Comparativa mensual</h1>
      <div className="empty-state"><div className="icon">📈</div><p>Cargá datos en al menos 2 meses para ver la comparativa</p></div>
    </div>
  )

  // Best month
  const mejorMes = [...datosFiltrados].sort((a, b) => b.totalIngresos - a.totalIngresos)[0]
  const peorMes = [...datosFiltrados].sort((a, b) => a.totalIngresos - b.totalIngresos)[0]
  const ultimoMes = datosFiltrados[datosFiltrados.length - 1]
  const penultimoMes = datosFiltrados[datosFiltrados.length - 2]
  const variacion = penultimoMes ? Math.round((ultimoMes?.totalIngresos - penultimoMes?.totalIngresos) / penultimoMes?.totalIngresos * 100) : 0

  return (
    <div>
      <h1 className="page-title">Comparativa mensual</h1>
      <p className="page-sub">Evolución de ingresos, gastos y ganancia mes a mes</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[3, 6, 12].map(n => (
          <button key={n} className={`btn btn-sm ${mesesMostrar === n ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMesesMostrar(n)}>
            {n} meses
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card" style={{ borderColor: variacion >= 0 ? 'var(--accent2)' : 'var(--danger)' }}>
          <div className="stat-label">vs mes anterior</div>
          <div className="stat-amount" style={{ color: variacion >= 0 ? 'var(--accent2)' : 'var(--danger)', fontSize: 28 }}>
            {variacion >= 0 ? '↑' : '↓'} {Math.abs(variacion)}%
          </div>
          <div className="stat-sub">{ultimoMes ? monthLabel(ultimoMes.mes) : ''}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">🔥 Mejor mes</div>
          <div className="stat-amount" style={{ fontSize: 18, color: 'var(--accent)' }}>{fmt(mejorMes?.totalIngresos)}</div>
          <div className="stat-sub">{mejorMes ? monthLabel(mejorMes.mes) : ''}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">📊 Promedio mensual</div>
          <div className="stat-amount" style={{ fontSize: 18 }}>{fmt(Math.round(datosFiltrados.reduce((a, d) => a + d.totalIngresos, 0) / datosFiltrados.length))}</div>
          <div className="stat-sub">últimos {datosFiltrados.length} meses</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">🌙 Mes más tranquilo</div>
          <div className="stat-amount" style={{ fontSize: 18, color: 'var(--muted)' }}>{fmt(peorMes?.totalIngresos)}</div>
          <div className="stat-sub">{peorMes ? monthLabel(peorMes.mes) : ''}</div>
        </div>
      </div>

      {/* STACKED BAR - Ingresos por canal */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">📊 Ingresos por canal</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={datosFiltrados} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={customTooltip} cursor={{ fill: 'var(--surface2)' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted)' }} />
            <Bar dataKey="Local/Online" stackId="a" fill="var(--accent)" radius={[0,0,0,0]} />
            <Bar dataKey="Mayoristas" stackId="a" fill="var(--transfer)" />
            <Bar dataKey="Tienda Nube" stackId="a" fill="var(--online)" />
            <Bar dataKey="Mercado Libre" stackId="a" fill="var(--cash)" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* GANANCIA vs GASTOS */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title">💰 Ganancia neta vs Gastos</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={datosFiltrados} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={customTooltip} cursor={{ fill: 'var(--surface2)' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: 'var(--muted)' }} />
            <Bar dataKey="ganancia" fill="var(--accent2)" radius={[3,3,0,0]} name="Ganancia" />
            <Bar dataKey="Gastos" fill="var(--danger)" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* TABLE */}
      <div className="card">
        <div className="card-title">Detalle por mes</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mes</th>
                <th>Local/Online</th>
                <th>Mayoristas</th>
                <th>Tienda Nube</th>
                <th>Mercado Libre</th>
                <th>Total ingresos</th>
                <th>Gastos</th>
                <th>Ganancia</th>
              </tr>
            </thead>
            <tbody>
              {[...datosFiltrados].reverse().map(d => (
                <tr key={d.mes}>
                  <td style={{ fontWeight: 500 }}>{monthLabel(d.mes)}</td>
                  <td style={{ color: 'var(--accent)' }}>{fmt(d['Local/Online'])}</td>
                  <td style={{ color: 'var(--transfer)' }}>{fmt(d['Mayoristas'])}</td>
                  <td style={{ color: 'var(--online)' }}>{fmt(d['Tienda Nube'])}</td>
                  <td style={{ color: 'var(--cash)' }}>{fmt(d['Mercado Libre'])}</td>
                  <td style={{ fontFamily: 'Fraunces, serif', fontSize: 16 }}>{fmt(d.totalIngresos)}</td>
                  <td style={{ color: 'var(--danger)' }}>{fmt(d['Gastos'])}</td>
                  <td style={{ fontFamily: 'Fraunces, serif', fontSize: 16, color: d.ganancia >= 0 ? 'var(--accent2)' : 'var(--danger)' }}>{fmt(d.ganancia)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
