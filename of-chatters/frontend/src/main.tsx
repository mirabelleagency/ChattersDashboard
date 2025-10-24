import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './ErrorBoundary'
import { ThemeProvider } from './contexts/ThemeContext'
import './index.css'

import { SharedDataProvider } from './contexts/SharedDataContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
  <HashRouter>
      <ErrorBoundary>
        <ThemeProvider>
          <SharedDataProvider>
            <App />
          </SharedDataProvider>
        </ThemeProvider>
      </ErrorBoundary>
  </HashRouter>
  </React.StrictMode>
)
