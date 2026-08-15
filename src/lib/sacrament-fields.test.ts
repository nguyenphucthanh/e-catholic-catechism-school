import { describe, expect, test } from 'vitest'
import { sacramentFields } from './sacrament-fields'

describe('sacramentFields', () => {
  test('has exactly 5 entries in the canonical render/export order', () => {
    expect(sacramentFields.map((field) => field.key)).toEqual([
      'receivedDate',
      'receivedPlace',
      'feastName',
      'sponsorName',
      'notes',
    ])
  })

  test('only receivedDate declares inputType "date"', () => {
    const dateFields = sacramentFields.filter(
      (field) => field.inputType === 'date',
    )
    expect(dateFields.map((field) => field.key)).toEqual(['receivedDate'])

    const nonDateFields = sacramentFields.filter(
      (field) => field.key !== 'receivedDate',
    )
    for (const field of nonDateFields) {
      expect(field.inputType === undefined || field.inputType === 'text').toBe(
        true,
      )
    }
  })

  test('only feastName and sponsorName declare a placeholderKey', () => {
    const withPlaceholder = sacramentFields.filter(
      (field) => field.placeholderKey !== undefined,
    )
    expect(withPlaceholder.map((field) => field.key)).toEqual([
      'feastName',
      'sponsorName',
    ])
  })

  test('all fields except notes default to export-selected', () => {
    const selected = sacramentFields.filter(
      (field) => field.defaultExportSelected === true,
    )
    expect(selected.map((field) => field.key)).toEqual([
      'receivedDate',
      'receivedPlace',
      'feastName',
      'sponsorName',
    ])

    const notes = sacramentFields.find((field) => field.key === 'notes')
    expect(notes?.defaultExportSelected).not.toBe(true)
  })

  test('every field has a non-empty labelKey', () => {
    for (const field of sacramentFields) {
      expect(typeof field.labelKey).toBe('string')
      expect(field.labelKey.length).toBeGreaterThan(0)
    }
  })
})
