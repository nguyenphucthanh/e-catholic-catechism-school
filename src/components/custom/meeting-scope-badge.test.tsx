import { describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MeetingScopeBadge } from './meeting-scope-badge'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { name?: string }) =>
      opts?.name !== undefined ? `${key}:${opts.name}` : key,
  }),
}))

describe('MeetingScopeBadge', () => {
  test.each(['all', 'board'] as const)(
    'renders the %s scope label',
    (scope) => {
      render(<MeetingScopeBadge scope={scope} branchName={null} />)
      expect(screen.getByText(`meetings.scope.${scope}`)).toBeInTheDocument()
    },
  )

  test('renders the branch name for branch scope', () => {
    render(<MeetingScopeBadge scope="branch" branchName="Ấu Nhi" />)
    expect(
      screen.getByText('meetings.scope.branchNamed:Ấu Nhi'),
    ).toBeInTheDocument()
  })

  test('falls back to an empty name when the branch is unknown', () => {
    render(<MeetingScopeBadge scope="branch" branchName={null} />)
    expect(screen.getByText('meetings.scope.branchNamed:')).toBeInTheDocument()
  })
})
