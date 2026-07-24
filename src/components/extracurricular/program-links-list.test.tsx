import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgramLinksList } from './program-links-list'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('ProgramLinksList', () => {
  test('renders nothing when links is undefined', () => {
    const { container } = render(
      <ProgramLinksList links={undefined} userEnrolled={false} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  test('renders nothing when links is empty', () => {
    const { container } = render(
      <ProgramLinksList links={[]} userEnrolled={false} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  test('hides forEnrolledOnly links when userEnrolled is false', () => {
    render(
      <ProgramLinksList
        links={[
          {
            type: 'social',
            label: 'Public Page',
            url: 'https://facebook.com/pub',
            forEnrolledOnly: false,
          },
          {
            type: 'im',
            label: 'Members Zalo',
            url: 'https://zalo.me/g/members',
            forEnrolledOnly: true,
          },
        ]}
        userEnrolled={false}
      />,
    )

    expect(screen.getByText('Public Page')).toBeInTheDocument()
    expect(screen.queryByText('Members Zalo')).not.toBeInTheDocument()
  })

  test('shows forEnrolledOnly links when userEnrolled is true', () => {
    render(
      <ProgramLinksList
        links={[
          {
            type: 'im',
            label: 'Members Zalo',
            url: 'https://zalo.me/g/members',
            forEnrolledOnly: true,
          },
        ]}
        userEnrolled={true}
      />,
    )

    expect(screen.getByText('Members Zalo')).toBeInTheDocument()
  })

  test('renders each link as an external link with the correct href and target', () => {
    render(
      <ProgramLinksList
        links={[
          {
            type: 'social',
            label: 'Public Page',
            url: 'https://facebook.com/pub',
            forEnrolledOnly: false,
          },
        ]}
        userEnrolled={false}
      />,
    )

    const link = screen.getByRole('button', { name: /Public Page/ })
    expect(link).toHaveAttribute('href', 'https://facebook.com/pub')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noreferrer')
  })
})
