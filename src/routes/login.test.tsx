import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Route } from './login'

describe('LoginPage route component', () => {
  test('renders login card and input fields successfully', () => {
    const LoginPageComponent = (Route as any).options.component
    render(<LoginPageComponent />)

    expect(screen.getByLabelText('auth.loginId')).toBeInTheDocument()
    expect(screen.getByLabelText('auth.password')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'auth.login' }),
    ).toBeInTheDocument()
  })
})
