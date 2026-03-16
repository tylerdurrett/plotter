import { Component } from 'react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Catches render errors from child components and displays them inline
 * instead of white-screening the app. Critical for the sketch dev loop
 * where code frequently throws during development.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }


  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-4 rounded-lg border border-destructive/20 bg-destructive/10 p-6"
      >
        <div className="text-center">
          <p className="text-sm font-semibold text-destructive">
            {error.name}
          </p>
          <p className="mt-1 font-mono text-xs text-destructive/80">
            {error.message}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => this.setState({ error: null })}
        >
          Retry
        </Button>
      </div>
    )
  }
}

export { ErrorBoundary }
