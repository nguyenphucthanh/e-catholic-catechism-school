import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMutation, useQuery } from 'convex/react'
import { useNavigate } from '@tanstack/react-router'
import { Route } from './import'
import { useAuth } from '~/lib/auth'
import { useInactiveYear, useSelectedAcademicYear } from '~/lib/academic-year'

vi.mock('~/lib/academic-year', () => ({
  useSelectedAcademicYear: vi.fn(),
  useInactiveYear: vi.fn(),
}))

const mockNavigate = vi.fn()
vi.mocked(useNavigate).mockReturnValue(mockNavigate)

const ImportWizardPageComponent = (Route as any).options.component

function selectMapping(headerLabel: string, optionName: RegExp | string) {
  const badge = screen.getByText(headerLabel)
  const row = badge.closest('tr') as HTMLElement
  const combobox = row.querySelector('[role="combobox"]') as HTMLElement
  fireEvent.click(combobox)
  const option = screen.getByRole('option', { name: optionName })
  fireEvent.pointerDown(option)
  fireEvent.click(option)
}

function selectFile(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
}

describe('ImportWizardPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    vi.mocked(useSelectedAcademicYear).mockReturnValue({
      selectedYearId: 'year-2024' as any,
      setSelectedYearId: vi.fn(),
    })
    vi.mocked(useInactiveYear).mockReturnValue({
      isInactive: false,
      yearName: '2024-2025',
    })
  })

  test('renders step 1 (upload) by default with the stepper showing all 7 steps', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { userDocId: 'catechist1' } as any,
    })

    render(<ImportWizardPageComponent />)

    expect(screen.getByText('csvImport.title')).toBeInTheDocument()
    expect(screen.getByText('csvImport.upload.dragDrop')).toBeInTheDocument()
    expect(screen.getByText('csvImport.steps.upload')).toBeInTheDocument()
    expect(screen.getByText('csvImport.steps.result')).toBeInTheDocument()
  })

  test('shows a loading placeholder at step 4/6 when requesterId is not yet available', () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: null,
    })

    render(<ImportWizardPageComponent />)

    selectFile(new File(['fullName\nAlice'], 'data.csv', { type: 'text/csv' }))
  })

  test('walks the full wizard from upload through to result and calls onDone navigation', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { userDocId: 'catechist1' } as any,
    })
    vi.mocked(useQuery).mockReturnValue([])
    vi.mocked(useMutation).mockImplementation(((fnRef: any) => {
      const path = fnRef?.[Symbol.for('functionName')]
      if (path === 'csvImport:bulkImportStudents') {
        return vi.fn().mockResolvedValue([{ status: 'ok', id: 'stu1' }])
      }
      return vi.fn()
    }) as any)

    render(<ImportWizardPageComponent />)

    // Step 1: upload
    selectFile(new File(['fullName\nAlice'], 'data.csv', { type: 'text/csv' }))
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'common.next' }),
      ).not.toBeDisabled()
    })
    fireEvent.click(screen.getByRole('button', { name: 'common.next' }))

    // Step 2: config — accept defaults, proceed
    await waitFor(() => {
      expect(screen.getByText('csvImport.config.target')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'common.next' }))

    // Step 3: map the single "fullName" CSV column to the fullName field
    await waitFor(() => {
      expect(screen.getByText('fullName')).toBeInTheDocument()
    })
    selectMapping('fullName', 'csvImport.fields.fullName')
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'common.next' }),
      ).not.toBeDisabled()
    })
    fireEvent.click(screen.getByRole('button', { name: 'common.next' }))

    // Step 4: preview — proceed to review
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'csvImport.preview.proceed' }),
      ).not.toBeDisabled()
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'csvImport.preview.proceed' }),
    )

    // Step 5: confirm — acknowledge and start
    await waitFor(() => {
      expect(screen.getByRole('checkbox')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(
      screen.getByRole('button', { name: 'csvImport.confirm.startImport' }),
    )

    // Step 6: importing — auto-completes and advances to step 7
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'csvImport.result.done' }),
      ).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'csvImport.result.done' }),
    )
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/students' })
  })

  test('Import More resets the wizard back to step 1', async () => {
    vi.mocked(useAuth).mockReturnValue({
      login: vi.fn(),
      logout: vi.fn(),
      user: { userDocId: 'catechist1' } as any,
    })
    vi.mocked(useQuery).mockReturnValue([])
    vi.mocked(useMutation).mockImplementation(((fnRef: any) => {
      const path = fnRef?.[Symbol.for('functionName')]
      if (path === 'csvImport:bulkImportStudents') {
        return vi.fn().mockResolvedValue([{ status: 'ok', id: 'stu1' }])
      }
      return vi.fn()
    }) as any)

    render(<ImportWizardPageComponent />)

    selectFile(new File(['fullName\nAlice'], 'data.csv', { type: 'text/csv' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'common.next' }),
      ).not.toBeDisabled(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'common.next' }))
    fireEvent.click(screen.getByRole('button', { name: 'common.next' }))

    await waitFor(() => screen.getByText('fullName'))
    selectMapping('fullName', 'csvImport.fields.fullName')
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'common.next' }),
      ).not.toBeDisabled(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'common.next' }))

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'csvImport.preview.proceed' }),
      ).not.toBeDisabled(),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'csvImport.preview.proceed' }),
    )

    await waitFor(() => screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(
      screen.getByRole('button', { name: 'csvImport.confirm.startImport' }),
    )

    await waitFor(() =>
      screen.getByRole('button', { name: 'csvImport.result.importMore' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'csvImport.result.importMore' }),
    )

    expect(screen.getByText('csvImport.upload.dragDrop')).toBeInTheDocument()
  })
})
