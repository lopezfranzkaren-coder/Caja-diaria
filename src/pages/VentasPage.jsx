import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, fmtDateLong, todayStr, DOT_COLORS, METODOS } from '../lib/utils'
import { useToast } from '../lib/toast'

const CANALES = ['local', 'online']
const METODOS_VENTA = METODOS.filter(m => m.value !== 'pendiente')

function VentaForm({ fecha, onSaved }) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [notas, setNotas] = useState('')
  const [montos, setMontos] = useState({
    local_mp: '', local_transferencia: '', local_efectivo: '',
    online_mp: '', online_transferencia: '', online_efectivo: '',
  })

  useEffect(() => {
    loadExisting()
  }, [fecha])

  async function loadExisting() {
    const { data } = await supabase
      .from('ventas')
      .select('*')
      .eq('fecha', fecha)
    if (data && data.length > 0) {
      const m = {}
      data.forEach(v => { m[`${v.canal}_${v.metodo}`] = v.monto || '' })
      setMontos(prev => ({ ...prev, ...m }))
      setNotas(data[0]?.notas || '')
    } else {
      setMontos({ local_mp: '', local_transferencia: '', local_efectivo: '', online_mp: '', online_transferencia: '', online_efectivo: '' })
      setNotas('')
    }
  }

  const val = (k) => parseFloat(montos[k]) || 0
  const subtotalLocal = val('local_mp') + val('local_transferencia') + val('local_efectivo')
  const subtotalOnline = val('online_mp') + val('online_transferencia') + val('online_efectivo')
  const totalDia = subtotalLocal + subtotalOnline

  async function handleSave() {
    if (totalDia === 0) { toast('Ingresá al menos un monto', 'error'); return }
    setSaving(true)
    try {
      // Delete existing for this date
      await supabase.from('ventas').delete().eq('fecha', fecha)
      // Insert all non-zero
      const rows = []
      CANALES.forEach(canal => {
        METODOS_VENTA.forEach(m => {
          const v = parseFloat(montos[`${canal}_${m.value}`]) || 0
          if (v > 0) rows.push({ fecha, canal, metodo: m.value, monto: v, notas })
        })
      })
      if (rows.length > 0) await supabase.from('ventas').insert(rows)
      toast('✓ Día guardado')
      onSaved?.()
    } catch (e) {
      toast('Error al guardar', 'error')
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm(`¿Eliminar el registro del ${fmtDate(fecha)}?`)) return
    await supabase.from('ventas').delete().eq('fecha', fecha)
    setMontos({ local_mp: '', local_transferencia: '', local_efectivo: '', online_mp: '', online_transferencia: '', online_efectivo: '' })
    setNotas('')
    toast('Registro eliminado')
    onSaved?.()
  }

  return (
    <div>
      <div className="card">
        <div className="card-title">🏪 Local presencial</div>
        <div className="grid-3">
          {METODOS_VENTA.map(m => (
            <div className="field" key={m.value}>
              <label>{m.label}</label>
              <div className="input-prefix">
                <div className="dot" style={{ background: m.color }} />
                <input
                  type="number" min="0" placeholder="0"
                  value={montos[`local_${m.value}`]}
                  onChange={e => setMontos(p => ({ ...p, [`local_${m.value}`]: e.target.value }))}
                />
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--surface2)', borderRadius: 8, padding: '12px 16px', marginTop: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Subtotal presencial</span>
          <span style={{ fontFamily: 'Fraunces, serif', fontSize: 22 }}>{fmt(subtotalLocal)}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-title">🌐 Online</div>
        <div className="grid-3">
          {METODOS_VENTA.map(m => (
            <div className="field" key={m.value}>
              <label>{m.label}</label>
              <div className="input-prefix">
                <div className="dot" style={{ background: m.color }} />
                <input
                  type="number" min="0" placeholder="0"
                  value={montos[`online_${m.value}`]}
                  onChange={e => setMontos(p => ({ ...p, [`online_${m.value}`]: e.target.value }))}
                />
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--surface2)', borderRadius: 8, padding: '12px 16px', marginTop: 4 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Subtotal online</span>
          <span style={{ fontFamily: 'Fraunces, serif', fontSize: 22 }}>{fmt(subtotalOnline)}</span>
        </div>
      </div>

      <div className="field">
        <label>Notas del día (opcional)</label>
        <textarea placeholder="Ej: feriado, liquidación, lluvia..." value={notas} onChange={e => setNotas(e.target.value)} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 14px', borderRadius: 8, fontFamily: 'DM Mono', fontSize: 13, width: '100%', outline: 'none', resize: 'vertical', minHeight: 70 }} />
      </div>

      <div className="total-bar">
        <span className="label">TOTAL DEL DÍA</span>
        <span className="amount">{fmt(totalDia)}</span>
      </div>

      <div className="actions">
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar día'}
        </button>
        <button className="btn btn-ghost" onClick={loadExisting}>Cancelar</button>
        <button className="btn btn-danger btn-sm" onClick={handleDelete}>Eliminar día</button>
      </div>
    </div>
  )
}

function HistorialRow({ fecha, total, mp, transfer, cash, notas, onClick }) {
  return (
    <tr style={{ cursor: 'pointer' }} onClick={onClick}>
      <td>{fmtDate(fecha)}</td>
      <td style={{ color: 'var(--mp)' }}>{fmt(mp)}</td>
      <td style={{ color: 'var(--transfer)' }}>{fmt(transfer)}</td>
      <td style={{ color: 'var(--cash)' }}>{fmt(cash)}</td>
      <td style={{ fontFamily: 'Fraunces, serif', fontSize: 16 }}>{fmt(total)}</td>
      <td style={{ color: 'var(--muted)', fontSize: 12 }}>{notas || '—'}</td>
    </tr>
  )
}

export default function VentasPage() {
  const [selectedDate, setSelectedDate] = useState(todayStr())
  const [historial, setHistorial] = useState([])
  const [tab, setTab] = useState('registro')
  const [refresh, setRefresh] = useState(0)

  useEffect(() => { loadHistorial() }, [refresh])

  async function loadHistorial() {
    const { data } = await supabase.from('ventas').select('*').order('fecha', { ascending: false })
    if (!data) return
    // Group by date
    const grouped = {}
    data.forEach(v => {
      if (!grouped[v.fecha]) grouped[v.fecha] = { mp: 0, transferencia: 0, efectivo: 0, notas: v.notas }
      grouped[v.fecha][v.metodo] = (grouped[v.fecha][v.metodo] || 0) + v.monto
    })
    setHistorial(Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])))
  }

  return (
    <div>
      <h1 className="page-title">Ventas diarias</h1>
      <p className="page-sub">Registrá las ventas del local y online por método de pago</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[['registro', '📝 Registrar'], ['historial', '📋 Historial']].map(([t, l]) => (
          <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      {tab === 'registro' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 14px', borderRadius: 8, fontFamily: 'DM Mono', fontSize: 14, outline: 'none', cursor: 'pointer' }} />
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>{fmtDateLong(selectedDate)}</span>
          </div>
          <VentaForm fecha={selectedDate} onSaved={() => setRefresh(r => r + 1)} />
        </div>
      )}

      {tab === 'historial' && (
        <div className="card">
          {historial.length === 0 ? (
            <div className="empty-state"><div className="icon">📭</div><p>No hay registros todavía</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th style={{ color: 'var(--mp)' }}>MP</th>
                    <th style={{ color: 'var(--transfer)' }}>Transferencia</th>
                    <th style={{ color: 'var(--cash)' }}>Efectivo</th>
                    <th>Total</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map(([fecha, d]) => (
                    <HistorialRow
                      key={fecha} fecha={fecha}
                      total={(d.mp || 0) + (d.transferencia || 0) + (d.efectivo || 0)}
                      mp={d.mp || 0} transfer={d.transferencia || 0} cash={d.efectivo || 0}
                      notas={d.notas}
                      onClick={() => { setSelectedDate(fecha); setTab('registro') }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
