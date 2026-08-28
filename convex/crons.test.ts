import { describe, expect, test } from 'vitest'
import crons from './crons'

describe('crons', () => {
  test('registers reset demo data cron with 7-day schedule', () => {
    expect(crons).toBeDefined()
    expect(crons.isCrons).toBe(true)

    const job = crons.crons['reset demo data every 7 days']
    expect(job).toBeDefined()
    expect(job.name).toBe('seed:resetDemoData')
    expect(job.schedule).toEqual({
      type: 'cron',
      cron: '0 0 */7 * *',
    })
    expect(job.args).toEqual([{}])
  })
})
