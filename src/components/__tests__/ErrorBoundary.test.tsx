import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ErrorBoundary } from '@/components/ErrorBoundary'

function ThrowingComponent({
  message,
}: {
  message: string
}): React.JSX.Element {
  throw new Error(message)
}

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <div>child content</div>
      </ErrorBoundary>,
    )

    expect(screen.getByText('child content')).toBeInTheDocument()
  })

  it('displays error message when child throws', () => {
    // Suppress React's console.error for expected error boundary logging
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ThrowingComponent message="sketch render failed" />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Error')).toBeInTheDocument()
    expect(screen.getByText('sketch render failed')).toBeInTheDocument()

    vi.restoreAllMocks()
  })

  it('shows a retry button after an error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ThrowingComponent message="oops" />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()

    vi.restoreAllMocks()
  })

  it('resets error state when retry is clicked', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = userEvent.setup()

    let shouldThrow = true

    function MaybeThrows(): React.JSX.Element {
      if (shouldThrow) throw new Error('temporary error')
      return <div>recovered</div>
    }

    render(
      <ErrorBoundary>
        <MaybeThrows />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()

    // Fix the error condition, then retry
    shouldThrow = false
    await user.click(screen.getByRole('button', { name: /retry/i }))

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('recovered')).toBeInTheDocument()

    vi.restoreAllMocks()
  })
})
