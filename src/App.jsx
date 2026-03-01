import { useState } from 'react'
import { ToastProvider } from './lib/toast'
import VentasPage from './pages/VentasPage'
import GastosPage from './pages/GastosPage'
import MayoristasPage from './pages/MayoristasPage'
import StockPage from './pages/StockPage'
import MensualPage from './pages/MensualPage'
import TiendaNubePage from './pages/TiendaNubePage'
import MercadoLibrePage from './pages/MercadoLibrePage'
import ComparativaPage from './pages/ComparativaPage'

const PAGES = [
  { id: 'ventas', icon: '📝', label: 'Ventas' },
  { id: 'gastos', icon: '💸', label: 'Gastos' },
  { id: 'mayoristas', icon: '📦', label: 'Mayoristas' },
  { id: 'tiendanube', icon: '🛍️', label: 'Tienda Nube' },
  { id: 'mercadolibre', icon: '🟡', label: 'Mercado Libre' },
  { id: 'stock', icon: '🗃️', label: 'Stock' },
  { id: 'mensual', icon: '📊', label: 'Mensual' },
  { id: 'comparativa', icon: '📈', label: 'Comparativa' },
]

function PageComponent({ page }) {
  switch (page) {
    case 'ventas': return <VentasPage />
    case 'gastos': return <GastosPage />
    case 'mayoristas': return <MayoristasPage />
    case 'tiendanube': return <TiendaNubePage />
    case 'mercadolibre': return <MercadoLibrePage />
    case 'stock': return <StockPage />
    case 'mensual': return <MensualPage />
    case 'comparativa': return <ComparativaPage />
    default: return <VentasPage />
  }
}

export default function App() {
  const [page, setPage] = useState('ventas')

  return (
    <ToastProvider>
      <div className="app-layout">
        <nav className="sidebar">
          <div className="sidebar-logo">
            <h1>Caja Diaria</h1>
            <span>control de ventas</span>
          </div>
          {PAGES.map(p => (
            <button
              key={p.id}
              className={`nav-item ${page === p.id ? 'active' : ''}`}
              onClick={() => setPage(p.id)}
            >
              <span className="icon">{p.icon}</span>
              {p.label}
            </button>
          ))}
        </nav>
        <main className="main-content">
          <PageComponent page={page} />
        </main>
      </div>
    </ToastProvider>
  )
}
