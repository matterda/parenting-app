import { Component } from 'react'

// A crashed render must never look like a dead black screen (see index.css's
// html.dark background) — show the error so it's debuggable from the device
// that hit it, with a reset that clears state that could crash-loop a reload.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Render error', error, info)
  }

  handleReset = () => {
    localStorage.removeItem('active_tab')
    location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 text-gray-900 dark:text-gray-100">
        <h1 className="text-lg font-bold mb-2">Something went wrong</h1>
        <pre className="whitespace-pre-wrap text-xs bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 p-3 rounded-xl overflow-auto mb-4">
          {this.state.error.message}
          {'\n'}
          {this.state.error.stack}
        </pre>
        <button
          onClick={this.handleReset}
          className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition"
        >
          Reset to Log tab
        </button>
      </div>
    )
  }
}
