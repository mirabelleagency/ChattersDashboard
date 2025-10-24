import React from 'react'

type Props = { children: React.ReactNode }
type State = { hasError: boolean; error?: any }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error }
  }

  componentDidCatch(error: any, errorInfo: any) {
    // Optionally log to an external service
    // eslint-disable-next-line no-console
    console.error('UI ErrorBoundary caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 text-red-800 p-6">
          <div className="max-w-3xl mx-auto bg-white border border-red-200 rounded-lg p-4 shadow">
            <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
            <p className="text-sm mb-3">An error occurred while rendering the page. Please take a screenshot and share it so we can fix it quickly.</p>
            <pre className="text-xs overflow-auto bg-red-50 p-3 rounded border border-red-100">
              {String(this.state.error)}
            </pre>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
