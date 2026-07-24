import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useQuery } from 'convex/react'
import { ProfileAvatar } from './profile-avatar'

vi.mock('convex/react', () => ({
  useQuery: vi.fn(),
}))

describe('ProfileAvatar component', () => {
  it('renders catechist profile avatar with fallback initial', () => {
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'appConfig:get') return { nameFormat: 'firstName_lastName' } as any
      if (path === 'catechists:getProfilePhotoUrl') return 'https://example.com/photo.jpg'
      return undefined
    })

    render(
      <ProfileAvatar
        userType="catechist"
        userId="cat123"
        fullName="Nguyen Van A"
      />,
    )

    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('renders student profile avatar with lastName_firstName fallback name format', () => {
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'appConfig:get') return { nameFormat: 'lastName_firstName' } as any
      if (path === 'students:getProfilePhotoUrl') return null
      return undefined
    })

    render(
      <ProfileAvatar
        userType="student"
        userId="stud123"
        fullName="Tran Thi B"
      />,
    )

    expect(screen.getByText('T')).toBeInTheDocument()
  })

  it('handles empty full name correctly with fallback dash', () => {
    vi.mocked(useQuery).mockImplementation((queryRef: any, _args?: any) => {
      const path = queryRef?.[Symbol.for('functionName')]
      if (path === 'appConfig:get') return { nameFormat: 'lastName_firstName' } as any
      return null
    })

    render(
      <ProfileAvatar
        userType="student"
        userId="stud123"
        fullName=""
      />,
    )

    expect(screen.getByText('-')).toBeInTheDocument()
  })
})
