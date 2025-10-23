import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Rankings from './pages/Rankings'
import Chatters from './pages/Chatters'
import Shifts from './pages/Shifts'
import Performance from './pages/Performance'
import Offenses from './pages/Offenses'
import Reports from './pages/Reports'
import Import from './pages/Import'
import { getToken, setToken, clearToken, api } from './lib/api'

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
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  async function logout(){
    try { await api('/auth/logout', { method: 'POST' }) } catch (e) {}
    clearToken()
    navigate('/login')
  }

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/rankings', label: 'Rankings', icon: '🏆' },
    { path: '/chatters', label: 'Chatters', icon: '👥' },
    { path: '/shifts', label: 'Shifts', icon: '🕐' },
    { path: '/performance', label: 'Performance', icon: '📈' },
    { path: '/offenses', label: 'Offenses', icon: '⚠️' },
    { path: '/reports', label: 'Reports', icon: '📄' },
    { path: '/import', label: 'Import', icon: '📥' },
  ]

  const getBreadcrumbs = () => {
    const paths = location.pathname.split('/').filter(Boolean)
    if (paths.length === 0) return [{ label: 'Dashboard', path: '/' }]
    
    return paths.map((path, index) => ({
      label: path.charAt(0).toUpperCase() + path.slice(1),
      path: '/' + paths.slice(0, index + 1).join('/')
    }))
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white border-r border-gray-200 transition-all duration-300 flex flex-col`}>
        {/* Logo/Brand */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {sidebarOpen ? (
            <h1 className="text-xl font-bold text-blue-600">Chatters CRM</h1>
          ) : (
            <span className="text-2xl">💬</span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidebarOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              )}
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* User Profile / Logout */}
        <div className="border-t border-gray-200 p-4">
          <button
            onClick={logout}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors ${
              !sidebarOpen && 'justify-center'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar with Breadcrumbs */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6">
          <nav className="flex items-center gap-2 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.path} className="flex items-center gap-2">
                {index > 0 && <span className="text-gray-400">/</span>}
                {index === breadcrumbs.length - 1 ? (
                  <span className="font-medium text-gray-900">{crumb.label}</span>
                ) : (
                  <Link to={crumb.path} className="text-gray-500 hover:text-gray-900 transition-colors">
                    {crumb.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>
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
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><Layout><Dashboard /></Layout></RequireAuth>} />
      <Route path="/rankings" element={<RequireAuth><Layout><Rankings /></Layout></RequireAuth>} />
      <Route path="/chatters" element={<RequireAuth><Layout><Chatters /></Layout></RequireAuth>} />
      <Route path="/shifts" element={<RequireAuth><Layout><Shifts /></Layout></RequireAuth>} />
      <Route path="/performance" element={<RequireAuth><Layout><Performance /></Layout></RequireAuth>} />
      <Route path="/offenses" element={<RequireAuth><Layout><Offenses /></Layout></RequireAuth>} />
      <Route path="/reports" element={<RequireAuth><Layout><Reports /></Layout></RequireAuth>} />
      <Route path="/import" element={<RequireAuth><Layout><Import /></Layout></RequireAuth>} />
    </Routes>
  )
}

// Global error boundary-ish for UnauthorizedError: intercept API exceptions in link clicks/navigation
// (Simpler: rely on api() throwing UnauthorizedError; components can catch and navigate.)
