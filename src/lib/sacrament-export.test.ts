import { describe, expect, test } from 'vitest'
import { buildSacramentExportRows } from './sacrament-export'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import { formatPersonName } from '~/lib/name'

// Minimal mock: only the fields buildSacramentExportRows actually reads.
function mockStudent(overrides: {
  id: string
  saintName?: string | null
  fullName: string
  studentCode: number
}): Doc<'students'> {
  return {
    _id: overrides.id as Id<'students'>,
    saintName: overrides.saintName,
    fullName: overrides.fullName,
    studentCode: overrides.studentCode,
  } as unknown as Doc<'students'>
}

// Identity-ish stub: returns the key itself so expected headers/labels are
// derivable without depending on real i18n resources.
const t = (key: string) => key

describe('buildSacramentExportRows', () => {
  test('only includes columns for selected sacrament fields', () => {
    const student = mockStudent({
      id: 's1',
      saintName: 'Maria',
      fullName: 'Nguyen Van A',
      studentCode: 1,
    })

    const { headers, rows } = buildSacramentExportRows({
      students: [{ student, sacramentDates: {} }],
      sacramentByStudent: new Map(),
      editingState: new Map(),
      sacramentType: 'baptism',
      selectedFields: new Set(['receivedDate', 'notes']),
      t,
    })

    expect(headers).toEqual([
      'students.col.studentName',
      'students.col.studentCode',
      'students.detail.sacraments.receivedDate',
      'students.form.sacrament.notes',
    ])
    expect(Object.keys(rows[0])).toEqual(headers)
  })

  test('always includes studentName and studentCode even with empty selectedFields', () => {
    const student = mockStudent({
      id: 's1',
      saintName: null,
      fullName: 'Tran Thi B',
      studentCode: 2,
    })

    const { headers, rows } = buildSacramentExportRows({
      students: [{ student, sacramentDates: {} }],
      sacramentByStudent: new Map(),
      editingState: new Map(),
      sacramentType: 'baptism',
      selectedFields: new Set(),
      t,
    })

    expect(headers).toEqual([
      'students.col.studentName',
      'students.col.studentCode',
    ])
    expect(rows[0]).toEqual({
      'students.col.studentName': formatPersonName(null, 'Tran Thi B'),
      'students.col.studentCode': 2,
    })
  })

  test('editingState overrides saved sacramentByStudent value for the same field/student', () => {
    const student = mockStudent({
      id: 's1',
      saintName: 'Peter',
      fullName: 'Le Van C',
      studentCode: 3,
    })

    const sacramentByStudent = new Map([
      [student._id, { baptism: { receivedPlace: 'Saved Church' } }],
    ])
    const editingState = new Map([
      [student._id, { receivedPlace: 'Edited Church' }],
    ])

    const { rows } = buildSacramentExportRows({
      students: [{ student, sacramentDates: {} }],
      sacramentByStudent,
      editingState,
      sacramentType: 'baptism',
      selectedFields: new Set(['receivedPlace']),
      t,
    })

    expect(rows[0]['students.detail.sacraments.receivedPlace']).toBe(
      'Edited Church',
    )
  })

  test('falls back to empty string when neither editingState nor sacramentByStudent has a value', () => {
    const student = mockStudent({
      id: 's1',
      saintName: 'Anna',
      fullName: 'Pham Thi D',
      studentCode: 4,
    })

    const { rows } = buildSacramentExportRows({
      students: [{ student, sacramentDates: {} }],
      sacramentByStudent: new Map(),
      editingState: new Map(),
      sacramentType: 'baptism',
      selectedFields: new Set(['feastName']),
      t,
    })

    expect(rows[0]['students.form.sacrament.feastName']).toBe('')
  })

  test('falls back to saved sacramentByStudent value when no editingState entry exists', () => {
    const student = mockStudent({
      id: 's1',
      saintName: 'Anna',
      fullName: 'Pham Thi D',
      studentCode: 4,
    })

    const sacramentByStudent = new Map([
      [student._id, { baptism: { sponsorName: 'Saved Sponsor' } }],
    ])

    const { rows } = buildSacramentExportRows({
      students: [{ student, sacramentDates: {} }],
      sacramentByStudent,
      editingState: new Map(),
      sacramentType: 'baptism',
      selectedFields: new Set(['sponsorName']),
      t,
    })

    expect(rows[0]['students.form.sacrament.sponsorName']).toBe('Saved Sponsor')
  })

  test('produces rows in the same order as the input students array', () => {
    const studentA = mockStudent({
      id: 's1',
      fullName: 'Student A',
      studentCode: 1,
    })
    const studentB = mockStudent({
      id: 's2',
      fullName: 'Student B',
      studentCode: 2,
    })
    const studentC = mockStudent({
      id: 's3',
      fullName: 'Student C',
      studentCode: 3,
    })

    const { rows } = buildSacramentExportRows({
      students: [
        { student: studentA, sacramentDates: {} },
        { student: studentB, sacramentDates: {} },
        { student: studentC, sacramentDates: {} },
      ],
      sacramentByStudent: new Map(),
      editingState: new Map(),
      sacramentType: 'baptism',
      selectedFields: new Set(),
      t,
    })

    expect(rows.map((r) => r['students.col.studentCode'])).toEqual([1, 2, 3])
    expect(rows.map((r) => r['students.col.studentName'])).toEqual([
      'Student A',
      'Student B',
      'Student C',
    ])
  })

  test('header/row keys align with resolved labels, not raw field keys', () => {
    const student = mockStudent({
      id: 's1',
      saintName: 'Maria',
      fullName: 'Nguyen Van A',
      studentCode: 1,
    })

    const editingState = new Map([
      [student._id, { receivedDate: '2026-01-01' }],
    ])

    const { headers, rows } = buildSacramentExportRows({
      students: [{ student, sacramentDates: {} }],
      sacramentByStudent: new Map(),
      editingState,
      sacramentType: 'baptism',
      selectedFields: new Set(['receivedDate']),
      t,
    })

    // The raw field key must NOT appear as a row key - only the resolved label.
    expect(rows[0]).not.toHaveProperty('receivedDate')
    expect(rows[0]['students.detail.sacraments.receivedDate']).toBe(
      '2026-01-01',
    )
    expect(Object.keys(rows[0])).toEqual(headers)
  })
})
