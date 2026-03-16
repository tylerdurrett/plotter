import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PanelLayout } from '@/components/PanelLayout'

// Mock useIsMobile to control desktop vs mobile rendering
vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: vi.fn(() => false),
}))

// Import the mocked module so we can change its return value per test
import { useIsMobile } from '@/hooks/useIsMobile'
const mockUseIsMobile = vi.mocked(useIsMobile)

describe('PanelLayout', () => {
  const leftContent = <div data-testid="test-left">Left</div>
  const centerContent = <div data-testid="test-center">Center</div>
  const rightContent = <div data-testid="test-right">Right</div>

  describe('desktop mode', () => {
    it('renders all three content regions', () => {
      render(
        <PanelLayout
          leftContent={leftContent}
          centerContent={centerContent}
          rightContent={rightContent}
        />,
      )
      expect(screen.getByTestId('test-left')).toBeInTheDocument()
      expect(screen.getByTestId('test-center')).toBeInTheDocument()
      expect(screen.getByTestId('test-right')).toBeInTheDocument()
    })

    it('renders resize handles (separators)', () => {
      const { container } = render(
        <PanelLayout
          leftContent={leftContent}
          centerContent={centerContent}
          rightContent={rightContent}
        />,
      )
      const separators = container.querySelectorAll('[data-separator]')
      expect(separators.length).toBe(2)
    })

    it('renders a main element for the center panel', () => {
      render(
        <PanelLayout
          leftContent={leftContent}
          centerContent={centerContent}
          rightContent={rightContent}
        />,
      )
      expect(document.querySelector('main')).toBeInTheDocument()
    })
  })

  describe('mobile mode', () => {
    it('renders mobile header with drawer trigger buttons', () => {
      mockUseIsMobile.mockReturnValue(true)
      render(
        <PanelLayout
          leftContent={leftContent}
          centerContent={centerContent}
          rightContent={rightContent}
        />,
      )
      expect(
        screen.getByRole('button', { name: /open sketches/i }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /open controls/i }),
      ).toBeInTheDocument()
      mockUseIsMobile.mockReturnValue(false)
    })

    it('renders center content directly (no panels)', () => {
      mockUseIsMobile.mockReturnValue(true)
      const { container } = render(
        <PanelLayout
          leftContent={leftContent}
          centerContent={centerContent}
          rightContent={rightContent}
        />,
      )
      expect(screen.getByTestId('test-center')).toBeInTheDocument()
      // No resize separators in mobile mode
      const separators = container.querySelectorAll('[data-separator]')
      expect(separators.length).toBe(0)
      mockUseIsMobile.mockReturnValue(false)
    })
  })
})
