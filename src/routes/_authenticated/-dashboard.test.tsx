import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Route } from './dashboard'

describe('DashboardPage route component', () => {
  test('renders page heading with title and icon successfully', () => {
    const DashboardPageComponent = (Route as any).options.component
    render(<DashboardPageComponent />)

    expect(
      screen.getByRole('heading', { name: 'nav.dashboard' }),
    ).toBeInTheDocument()
  })
})
