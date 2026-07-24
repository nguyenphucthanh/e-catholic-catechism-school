import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { ExtracurricularProgramForm } from './program-form'
import type { Id } from '../../../convex/_generated/dataModel'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('~/components/custom/richtext-editor', () => ({
  RichTextEditor: ({
    value,
    onChange,
  }: {
    value: string
    onChange: (v: string) => void
  }) => <textarea value={value} onChange={(e) => onChange(e.target.value)} />,
}))

vi.mock('~/components/ui/select', () => {
  return {
    Select: ({ value, onValueChange, children }: any) => (
      <select
        data-testid="mock-select"
        value={value || ''}
        onChange={(e) => onValueChange(e.target.value)}
      >
        {children}
      </select>
    ),
    SelectTrigger: ({ children }: any) => <>{children}</>,
    SelectValue: () => null,
    SelectContent: ({ children }: any) => <>{children}</>,
    SelectItem: ({ value, children }: any) => (
      <option value={value}>{children}</option>
    ),
  }
})

const branches: Array<any> = []

describe('ExtracurricularProgramForm — program info fields', () => {
  test('fills details, target, a branch, dates, fee and capacity, and submits them', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const oneBranch = [{ _id: 'branch1', name: 'Branch One' }] as Array<any>
    render(
      <ExtracurricularProgramForm onSubmit={onSubmit} branches={oneBranch} />,
    )

    fireEvent.change(screen.getByLabelText('extracurricular.title'), {
      target: { value: 'Camp' },
    })
    fireEvent.change(screen.getByDisplayValue('{"type":"doc","content":[]}'), {
      target: { value: '{"type":"doc","content":[1]}' },
    })

    const targetSelect = screen.getAllByTestId('mock-select')[0]
    fireEvent.change(targetSelect, { target: { value: 'student' } })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Branch One' }))

    fireEvent.change(screen.getByLabelText('extracurricular.dateStart'), {
      target: { value: '2026-01-01' },
    })
    fireEvent.change(screen.getByLabelText('extracurricular.dateEnd'), {
      target: { value: '2026-01-05' },
    })
    fireEvent.change(
      screen.getByLabelText('extracurricular.enrollmentExpireDate'),
      { target: { value: '2025-12-31' } },
    )

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'extracurricular.feeRequired' }),
    )
    fireEvent.change(screen.getByLabelText('extracurricular.feeAmount'), {
      target: { value: '50' },
    })

    fireEvent.change(screen.getByLabelText('extracurricular.maxCapacity'), {
      target: { value: '20' },
    })

    fireEvent.click(screen.getByText('common.save'))

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled())
    const payload = onSubmit.mock.calls[0][0]
    expect(payload).toMatchObject({
      title: 'Camp',
      details: '{"type":"doc","content":[1]}',
      target: 'student',
      branches: ['branch1'],
      dateStart: '2026-01-01',
      dateEnd: '2026-01-05',
      enrollmentExpireDate: '2025-12-31',
      feeRequired: true,
      feeAmount: 50,
      maxCapacity: 20,
    })
  })
})

describe('ExtracurricularProgramForm — links section', () => {
  test('starts with no link rows and adds a row on "Add link"', () => {
    render(
      <ExtracurricularProgramForm onSubmit={vi.fn()} branches={branches} />,
    )

    expect(screen.getByText('extracurricular.noLinksYet')).toBeInTheDocument()

    fireEvent.click(screen.getByText('extracurricular.addLink'))

    expect(
      screen.queryByText('extracurricular.noLinksYet'),
    ).not.toBeInTheDocument()
    expect(screen.getByLabelText('extracurricular.linkLabel')).toHaveValue('')
  })

  test('fills a link row and submits it with the rest of the form data', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <ExtracurricularProgramForm onSubmit={onSubmit} branches={branches} />,
    )

    fireEvent.change(screen.getByLabelText('extracurricular.title'), {
      target: { value: 'Camp' },
    })

    fireEvent.click(screen.getByText('extracurricular.addLink'))
    fireEvent.change(screen.getByLabelText('extracurricular.linkLabel'), {
      target: { value: 'Zalo Group' },
    })
    fireEvent.change(screen.getByLabelText('extracurricular.linkUrl'), {
      target: { value: 'https://zalo.me/g/abc' },
    })
    fireEvent.click(screen.getByLabelText('extracurricular.forEnrolledOnly'))

    fireEvent.click(screen.getByText('common.save'))

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled())
    const payload = onSubmit.mock.calls[0][0]
    expect(payload.links).toEqual([
      {
        type: 'social',
        label: 'Zalo Group',
        url: 'https://zalo.me/g/abc',
        forEnrolledOnly: true,
      },
    ])
  })

  test('changes a link row type and submits it with the new type', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <ExtracurricularProgramForm onSubmit={onSubmit} branches={branches} />,
    )

    fireEvent.click(screen.getByText('extracurricular.addLink'))
    fireEvent.change(screen.getByLabelText('extracurricular.linkLabel'), {
      target: { value: 'Zalo Group' },
    })
    fireEvent.change(screen.getByLabelText('extracurricular.linkUrl'), {
      target: { value: 'https://zalo.me/g/abc' },
    })

    const linkTypeSelect = screen.getAllByTestId('mock-select')[1]
    fireEvent.change(linkTypeSelect, { target: { value: 'im' } })

    fireEvent.click(screen.getByText('common.save'))

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled())
    const payload = onSubmit.mock.calls[0][0]
    expect(payload.links).toEqual([
      {
        type: 'im',
        label: 'Zalo Group',
        url: 'https://zalo.me/g/abc',
        forEnrolledOnly: false,
      },
    ])
  })

  test('removes a link row', () => {
    render(
      <ExtracurricularProgramForm onSubmit={vi.fn()} branches={branches} />,
    )

    fireEvent.click(screen.getByText('extracurricular.addLink'))
    expect(
      screen.getByLabelText('extracurricular.linkLabel'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('extracurricular.removeLink'))

    expect(screen.getByText('extracurricular.noLinksYet')).toBeInTheDocument()
  })

  test('pre-fills link rows from initialData', () => {
    render(
      <ExtracurricularProgramForm
        onSubmit={vi.fn()}
        branches={branches}
        initialData={{
          title: 'Existing',
          details: '{"type":"doc","content":[]}',
          target: 'all',
          branches: [] as Array<Id<'branches'>>,
          dateStart: '2099-01-01',
          dateEnd: '2099-01-02',
          enrollmentExpireDate: '2099-01-01',
          feeRequired: false,
          links: [
            {
              type: 'im',
              label: 'Existing Zalo',
              url: 'https://zalo.me/g/existing',
              forEnrolledOnly: false,
            },
          ],
        }}
      />,
    )

    expect(screen.getByDisplayValue('Existing Zalo')).toBeInTheDocument()
    expect(
      screen.getByDisplayValue('https://zalo.me/g/existing'),
    ).toBeInTheDocument()
  })
})
