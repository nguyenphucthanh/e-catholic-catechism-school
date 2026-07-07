import { beforeEach, describe, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useAction } from 'convex/react'
import { toast } from 'sonner'
import { ImportStep6Import } from './ImportStep6Import'
import type { ContactType } from './csvFieldDefinitions'
import type { ValidatedRow } from './useImportParser'

function row(overrides: Partial<ValidatedRow>): ValidatedRow {
  return {
    rowIndex: 0,
    status: 'ok',
    coerced: { fullName: 'Alice' },
    issues: [],
    ...overrides,
  }
}

function setupMutations(
  studentsImpl: (...args: Array<any>) => any,
  catechistsImpl: (...args: Array<any>) => any = studentsImpl,
) {
  const studentsMock = vi.fn(studentsImpl)
  const catechistsMock = vi.fn(catechistsImpl)
  vi.mocked(useAction).mockImplementation(((fnRef: any) => {
    const path = fnRef?.[Symbol.for('functionName')]
    if (path === 'csvImport:bulkImportStudents') return studentsMock
    if (path === 'csvImport:bulkImportCatechists') return catechistsMock
    return vi.fn()
  }) as any)
  return { studentsMock, catechistsMock }
}

describe('ImportStep6Import', () => {
  beforeEach(() => {
    vi.mocked(toast.success).mockClear()
  })

  test('imports ok/partial rows in a batch, skips error rows, and calls onComplete with combined results', async () => {
    const { studentsMock } = setupMutations(({ records }: any) => {
      return records.map((_r: any, i: number) => ({
        status: 'ok',
        id: `id${i}`,
      }))
    })

    const onComplete = vi.fn()
    const rows = [
      row({ rowIndex: 0, status: 'ok', coerced: { fullName: 'Alice' } }),
      row({ rowIndex: 1, status: 'error', coerced: {} }),
      row({ rowIndex: 2, status: 'partial', coerced: { fullName: 'Bob' } }),
    ]

    render(
      <ImportStep6Import
        validatedRows={rows}
        target="students"
        relationshipBySlot={{}}
        contactTypeByField={{}}
        requesterId={'catechist1' as any}
        onComplete={onComplete}
      />,
    )

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))

    const results = onComplete.mock.calls[0][0]
    expect(results).toEqual(
      expect.arrayContaining([
        { index: 1, status: 'error', error: 'csvImport.importing.rowSkipped' },
        { index: 0, status: 'ok', id: 'id0' },
        { index: 2, status: 'ok', id: 'id1' },
      ]),
    )
    expect(studentsMock).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('csvImport.importing.success')
  })

  test('uses bulkImportCatechists mutation when target is catechists', async () => {
    const { catechistsMock, studentsMock } = setupMutations(() => [])
    catechistsMock.mockResolvedValue([{ status: 'ok', id: 'c1' }])

    const onComplete = vi.fn()
    const rows = [row({ rowIndex: 0, status: 'ok' })]

    render(
      <ImportStep6Import
        validatedRows={rows}
        target="catechists"
        relationshipBySlot={{}}
        contactTypeByField={{}}
        requesterId={'catechist1' as any}
        onComplete={onComplete}
      />,
    )

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(catechistsMock).toHaveBeenCalledTimes(1)
    expect(studentsMock).not.toHaveBeenCalled()
  })

  test('builds a full student record with 2 guardian slots (relationship, saintName, and mixed-type contacts)', async () => {
    const relationshipBySlot: Record<number, string> = {
      1: 'Mother',
      2: 'Father',
    }
    const contactTypeByField: Record<string, ContactType> = {
      guardian1_contact_1: 'phone',
      guardian1_contact_2: 'email',
      // guardian2_contact_1 intentionally omitted -> defaults to 'other'
    }

    const { studentsMock } = setupMutations(({ records }: any) => {
      expect(records[0]).toEqual({
        fullName: 'Alice',
        saintName: 'Maria',
        dateOfBirth: '2020-01-01',
        gender: 'female',
        previousParish: 'St. X',
        previousDiocese: 'Diocese Y',
        isActive: true,
        guardians: [
          {
            fullName: 'Parent A',
            saintName: 'Anna',
            relationship: 'Mother',
            contacts: [
              { type: 'phone', value: '+84987654321' },
              { type: 'email', value: 'parenta@example.com' },
            ],
          },
          {
            fullName: 'Parent B',
            relationship: 'Father',
            contacts: [{ type: 'other', value: 'zalo-id-123' }],
          },
        ],
      })
      return [{ status: 'ok', id: 's1' }]
    })

    const onComplete = vi.fn()
    const rows = [
      row({
        rowIndex: 0,
        status: 'ok',
        coerced: {
          fullName: 'Alice',
          saintName: 'Maria',
          dateOfBirth: '2020-01-01',
          gender: 'female',
          previousParish: 'St. X',
          previousDiocese: 'Diocese Y',
          isActive: 'true',
          guardian1_name: 'Parent A',
          guardian1_saint_name: 'Anna',
          guardian1_contact_1: '+84987654321',
          guardian1_contact_2: 'parenta@example.com',
          guardian2_name: 'Parent B',
          guardian2_contact_1: 'zalo-id-123',
        },
      }),
    ]

    render(
      <ImportStep6Import
        validatedRows={rows}
        target="students"
        relationshipBySlot={relationshipBySlot}
        contactTypeByField={contactTypeByField}
        requesterId={'catechist1' as any}
        onComplete={onComplete}
      />,
    )

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(studentsMock).toHaveBeenCalledTimes(1)
  })

  test('omits guardians entirely when no guardianN_name field is coerced', async () => {
    const { studentsMock } = setupMutations(({ records }: any) => {
      expect(records[0]).toEqual({ fullName: 'Alice' })
      expect(records[0].guardians).toBeUndefined()
      return [{ status: 'ok', id: 's1' }]
    })

    const onComplete = vi.fn()
    const rows = [
      row({ rowIndex: 0, status: 'ok', coerced: { fullName: 'Alice' } }),
    ]

    render(
      <ImportStep6Import
        validatedRows={rows}
        target="students"
        relationshipBySlot={{}}
        contactTypeByField={{}}
        requesterId={'catechist1' as any}
        onComplete={onComplete}
      />,
    )

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(studentsMock).toHaveBeenCalledTimes(1)
  })

  test('builds a full catechist record including gender and contact fields', async () => {
    const { catechistsMock } = setupMutations(({ records }: any) => {
      expect(records[0]).toEqual({
        fullName: 'GLV A',
        saintName: 'Peter',
        dateOfBirth: '1990-05-05',
        gender: 'male',
        joinedDate: '2015-01-01',
        title: 'Trưởng',
        community: 'Xóm 1',
        level: 'Cấp 1',
        notes: 'Some notes',
        phone: '+84912345678',
        email: 'glv@example.com',
      })
      return [{ status: 'ok', id: 'c1' }]
    })

    const onComplete = vi.fn()
    const rows = [
      row({
        rowIndex: 0,
        status: 'ok',
        coerced: {
          fullName: 'GLV A',
          saintName: 'Peter',
          dateOfBirth: '1990-05-05',
          gender: 'male',
          joinedDate: '2015-01-01',
          title: 'Trưởng',
          community: 'Xóm 1',
          level: 'Cấp 1',
          notes: 'Some notes',
          phone: '+84912345678',
          email: 'glv@example.com',
        },
      }),
    ]

    render(
      <ImportStep6Import
        validatedRows={rows}
        target="catechists"
        relationshipBySlot={{}}
        contactTypeByField={{}}
        requesterId={'catechist1' as any}
        onComplete={onComplete}
      />,
    )

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(catechistsMock).toHaveBeenCalledTimes(1)
  })

  test('a rejected batch mutation marks every row in that batch as failed', async () => {
    setupMutations(() => {
      throw new Error('network down')
    })

    const onComplete = vi.fn()
    const rows = [
      row({ rowIndex: 0, status: 'ok' }),
      row({ rowIndex: 1, status: 'ok' }),
    ]

    render(
      <ImportStep6Import
        validatedRows={rows}
        target="students"
        relationshipBySlot={{}}
        contactTypeByField={{}}
        requesterId={'catechist1' as any}
        onComplete={onComplete}
      />,
    )

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    const results = onComplete.mock.calls[0][0]
    expect(results).toEqual([
      { index: 0, status: 'error', error: 'Error: network down' },
      { index: 1, status: 'error', error: 'Error: network down' },
    ])
  })

  test('a batch result item with status other than ok is mapped to an error result', async () => {
    setupMutations(() => [{ status: 'error', error: 'DUPLICATE_PHONE' }])

    const onComplete = vi.fn()
    const rows = [row({ rowIndex: 0, status: 'ok' })]

    render(
      <ImportStep6Import
        validatedRows={rows}
        target="students"
        relationshipBySlot={{}}
        contactTypeByField={{}}
        requesterId={'catechist1' as any}
        onComplete={onComplete}
      />,
    )

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(onComplete.mock.calls[0][0]).toEqual([
      { index: 0, status: 'error', error: 'DUPLICATE_PHONE' },
    ])
  })

  test('shows skipped-rows note and progress text while rendering', () => {
    setupMutations(async () => new Promise(() => {}))

    const rows = [
      row({ rowIndex: 0, status: 'ok' }),
      row({ rowIndex: 1, status: 'error' }),
    ]

    render(
      <ImportStep6Import
        validatedRows={rows}
        target="students"
        relationshipBySlot={{}}
        contactTypeByField={{}}
        requesterId={'catechist1' as any}
        onComplete={vi.fn()}
      />,
    )

    expect(
      screen.getByText('csvImport.importing.skippedNote'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('csvImport.importing.inProgress'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'common.back' })).toBeDisabled()
  })

  test('renders 100% progress and no importable rows when all rows are errors', async () => {
    setupMutations(() => [])
    const onComplete = vi.fn()
    const rows = [row({ rowIndex: 0, status: 'error' })]

    render(
      <ImportStep6Import
        validatedRows={rows}
        target="students"
        relationshipBySlot={{}}
        contactTypeByField={{}}
        requesterId={'catechist1' as any}
        onComplete={onComplete}
      />,
    )

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(onComplete.mock.calls[0][0]).toEqual([
      { index: 0, status: 'error', error: 'csvImport.importing.rowSkipped' },
    ])
  })
})
