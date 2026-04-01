import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Collapsible } from '../collapsible'

describe('Collapsible', () => {
  it('renders collapsed by default', () => {
    render(<Collapsible title="Section">Hidden content</Collapsible>)

    expect(screen.getByText('Section')).toBeInTheDocument()
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument()
  })

  it('opens when header is clicked', async () => {
    render(<Collapsible title="Section">Revealed content</Collapsible>)

    await userEvent.click(screen.getByText('Section'))

    expect(screen.getByText('Revealed content')).toBeInTheDocument()
  })

  it('closes when header is clicked again', async () => {
    render(<Collapsible title="Section">Content</Collapsible>)

    await userEvent.click(screen.getByText('Section'))
    expect(screen.getByText('Content')).toBeInTheDocument()

    await userEvent.click(screen.getByText('Section'))
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('renders open when defaultOpen is true', () => {
    render(<Collapsible title="Section" defaultOpen>Open content</Collapsible>)

    expect(screen.getByText('Open content')).toBeInTheDocument()
  })

  it('sets aria-expanded correctly', async () => {
    render(<Collapsible title="Section">Content</Collapsible>)

    const button = screen.getByRole('button', { name: 'Section' })
    expect(button).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })
})
