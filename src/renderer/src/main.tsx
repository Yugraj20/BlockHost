import React, { Component, ErrorInfo, ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles.css'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled React Render Error in BlockHost:', error, info)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-[#0b101b] text-slate-100 flex flex-col items-center justify-center p-6 select-none font-sans">
          <div className="max-w-md w-full bg-[#121827] border border-red-500/30 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 mx-auto flex items-center justify-center font-black text-xl">
              !
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">BlockHost Interface Exception</h1>
              <p className="text-xs text-slate-400 mt-1">
                An unexpected error occurred during rendering. You can reload the UI safely.
              </p>
            </div>
            {this.state.error && (
              <pre className="text-left text-[11px] font-mono bg-black/60 p-3 rounded-lg border border-slate-800 text-red-300 overflow-x-auto max-h-36">
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <div className="flex gap-2 justify-center pt-2">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/30"
              >
                Reload Interface
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
)

