import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import { getToken, setToken, clearToken } from './lib/api'

function RequireAuth({ children }: { children: JSX.Element }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const location = useLocation()

  useEffect(() => {
    async function checkAuth() {
      // If we have an in-memory token, we're authenticated
      if (getToken()) {
        setIsAuthenticated(true)
        return
      }

      // Otherwise, try to refresh using the cookie
      try {
        const response = await fetch('/auth/refresh', { 
          method: 'POST', 
          credentials: 'include' 
        })
        if (response.ok) {
          const data = await response.json()
          if (data.access_token) {
            setToken(data.access_token)
            setIsAuthenticated(true)
            return
          }
        }
      } catch (error) {
        // Refresh failed
      }
      
      // No valid session
      setIsAuthenticated(false)
    }

    checkAuth()
  }, [])

  // Still checking
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Authenticated
  return children
}

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const getBreadcrumbs = () => {
    return [{ label: 'Chatters Dashboard', path: '/' }]
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <span className="text-2xl">📊</span>
            <h1 className="text-xl font-bold text-blue-600">Chatters Dashboard</h1>
          </div>
          <div className="text-sm text-gray-500">
            CEO Executive View
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RequireAuth><Layout><Dashboard /></Layout></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
