import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Tabs, TabList, Tab, TabPanel } from '../tabs'

describe('Tabs', () => {
  function renderTabs() {
    return render(
      <Tabs defaultValue="a">
        <TabList>
          <Tab value="a">Tab A</Tab>
          <Tab value="b">Tab B</Tab>
        </TabList>
        <TabPanel value="a">Content A</TabPanel>
        <TabPanel value="b">Content B</TabPanel>
      </Tabs>,
    )
  }

  it('renders the default active tab', () => {
    renderTabs()
    expect(screen.getByText('Content A')).toBeVisible()
  })

  it('hides inactive tab panel via display:none', () => {
    renderTabs()
    // Both panels are mounted (for Leva compatibility)
    expect(screen.getByText('Content A')).toBeVisible()
    expect(screen.getByText('Content B')).not.toBeVisible()
  })

  it('switches tabs on click', async () => {
    renderTabs()

    await userEvent.click(screen.getByText('Tab B'))

    expect(screen.getByText('Content B')).toBeVisible()
    expect(screen.getByText('Content A')).not.toBeVisible()
  })

  it('applies active styling to current tab', () => {
    renderTabs()

    const tabA = screen.getByRole('tab', { name: 'Tab A' })
    const tabB = screen.getByRole('tab', { name: 'Tab B' })

    expect(tabA).toHaveAttribute('aria-selected', 'true')
    expect(tabB).toHaveAttribute('aria-selected', 'false')
  })

  it('keeps both panels in the DOM', () => {
    renderTabs()
    // Both should be findable even though one is hidden
    expect(screen.getByText('Content A')).toBeInTheDocument()
    expect(screen.getByText('Content B')).toBeInTheDocument()
  })
})
