import { Routes, Route, Navigate, useLocation, Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import UserManagement from './pages/UserManagement'
import Login from './pages/Login'
import { getToken, setToken, clearToken, api } from './lib/api'
import Chatters from './pages/Chatters'
import ChatterEdit from './pages/ChatterEdit'
import { useTheme } from './contexts/ThemeContext'

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

      // Try to refresh using the cookie
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
        // ignore
      }

      // Not authenticated
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

  // Not authenticated - redirect to login
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
  const [currentUser, setCurrentUser] = useState<{ id: number; email: string; full_name?: string; is_admin?: boolean } | null>(null)
  const { isDark, toggleTheme } = useTheme()

  useEffect(() => {
    async function fetchCurrentUser() {
      try {
        const user = await api('/auth/me')
        setCurrentUser(user)
      } catch (error) {
        // not logged in; handled by RequireAuth
      }
    }
    fetchCurrentUser()
  }, [])

  async function logout() {
    try { await api('/auth/logout', { method: 'POST' }) } catch (e) {}
    clearToken()
    navigate('/login', { replace: true })
  }

  const navItems = [
    { 
      path: '/', 
      label: 'Dashboard', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    // Expose Chatters to authenticated users; server will enforce roles
    { 
      path: '/chatters', 
      label: 'Chatters', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    // User Management reserved for admins
    ...(currentUser?.is_admin ? [{ 
      path: '/users', 
      label: 'User Management', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    }] : []),
  ]

  const getBreadcrumbs = () => {
    return [{ label: 'Chatters Dashboard', path: '/' }]
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col`}>
        {/* Logo/Brand */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-700">
          {sidebarOpen ? (
            <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">Chatters Dashboard</h1>
          ) : (
            <span className="text-2xl">📊</span>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
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
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {item.icon}
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* User Profile Section */}
        <div className="border-t border-gray-200 dark:border-gray-700">
          {currentUser && sidebarOpen && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold">
                  {(() => {
                    const displayName = currentUser.full_name || currentUser.email || 'U'
                    return (displayName && displayName.length > 0 ? displayName[0] : 'U').toUpperCase()
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{currentUser.full_name || currentUser.email}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{currentUser.is_admin ? 'Administrator' : 'User'}</div>
                </div>
              </div>
            </div>
          )}
          
          {/* Theme Toggle */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors ${
                sidebarOpen 
                  ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700' 
                  : 'justify-center text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {isDark ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
              {sidebarOpen && <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
            </button>
          </div>

          {/* Logout */}
          <div className="p-4">
            <button
              onClick={logout}
              className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ${
                !sidebarOpen && 'justify-center'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {sidebarOpen && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-2 text-sm">
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb.path} className="flex items-center gap-2">
                  {index > 0 && <span className="text-gray-400 dark:text-gray-500">/</span>}
                  <span className="font-medium text-gray-900 dark:text-gray-100">{crumb.label}</span>
                </div>
              ))}
            </nav>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {currentUser?.is_admin ? 'Admin View' : 'User View'}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
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
      <Route path="/users" element={<RequireAuth><Layout><UserManagement /></Layout></RequireAuth>} />
      <Route path="/chatters" element={<RequireAuth><Layout><Chatters /></Layout></RequireAuth>} />
      <Route path="/chatters/:id/view" element={<RequireAuth><Layout><Profile /></Layout></RequireAuth>} />
      <Route path="/chatters/:id" element={<RequireAuth><Layout><ChatterEdit /></Layout></RequireAuth>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
