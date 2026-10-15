import { describe, expect, test } from 'vitest'
import {
  HARDCODED_CATECHIST_TITLES,
  buildCatechistFilterTitleOptions,
  buildCatechistTitleOptions,
} from './catechist-titles'

const t = (key: string) => `t:${key}`
const hardcoded = HARDCODED_CATECHIST_TITLES.map((h) => ({
  value: h.value,
  label: `t:${h.labelKey}`,
}))

describe('buildCatechistTitleOptions', () => {
  test('orders none, hardcoded, then custom', () => {
    expect(buildCatechistTitleOptions(t, ['Trợ tá'])).toEqual([
      { value: '', label: 't:profile.personal.title.none' },
      ...hardcoded,
      { value: 'Trợ tá', label: 'Trợ tá' },
    ])
  })

  test.each([undefined, []])('handles customTitles=%j', (custom) => {
    expect(buildCatechistTitleOptions(t, custom)).toHaveLength(
      hardcoded.length + 1,
    )
  })

  test('drops empty, whitespace, hardcoded-duplicate and repeated customs', () => {
    const opts = buildCatechistTitleOptions(t, [
      '',
      '   ',
      'cha',
      ' Giáo Lý Viên ',
      ' Trợ tá',
      'TRỢ TÁ',
    ])
    expect(opts.slice(hardcoded.length + 1)).toEqual([
      { value: 'Trợ tá', label: 'Trợ tá' },
    ])
  })
})

describe('buildCatechistFilterTitleOptions', () => {
  test('orders any, none, hardcoded, then custom', () => {
    expect(buildCatechistFilterTitleOptions(t, ['Trợ tá'])).toEqual([
      { value: '', label: 't:catechists.filters.anyTitle' },
      { value: 'none', label: 't:profile.personal.title.none' },
      ...hardcoded,
      { value: 'Trợ tá', label: 'Trợ tá' },
    ])
  })

  test('handles undefined customTitles', () => {
    expect(buildCatechistFilterTitleOptions(t)).toHaveLength(
      hardcoded.length + 2,
    )
  })
})
