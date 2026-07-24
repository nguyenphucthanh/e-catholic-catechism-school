import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { ContactDeepLink } from './contact-deep-link'

describe('ContactDeepLink', () => {
  test('renders phone link with tel: href', () => {
    render(<ContactDeepLink value="0901234567" type="phone" />)

    const link = screen.getByRole('link', { name: '0901234567' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', 'tel:0901234567')
    expect(link).toHaveAttribute('target', '_blank')
  })

  test('renders email link with mailto: href', () => {
    render(<ContactDeepLink value="test@example.com" type="email" />)

    const link = screen.getByRole('link', { name: 'test@example.com' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', 'mailto:test@example.com')
    expect(link).toHaveAttribute('target', '_blank')
  })

  test('renders zalo link with zalo.me href', () => {
    render(<ContactDeepLink value="0901234567" type="zalo" />)

    const link = screen.getByRole('link', { name: '0901234567' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', 'https://zalo.me/0901234567')
    expect(link).toHaveAttribute('target', '_blank')
  })

  test('renders plain text value for other contact type', () => {
    render(<ContactDeepLink value="Other Info" type="other" />)

    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Other Info')).toBeInTheDocument()
  })
})
