import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ msg: '', type: 'success', show: false })

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type, show: true })
    setTimeout(() => setToast(t => ({ ...t, show: false })), 2500)
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className={`toast toast-${toast.type} ${toast.show ? 'show' : ''}`}>
        {toast.msg}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
