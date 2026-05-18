import { describe, it, expect } from 'vitest'
import { formatLocalToday, isTodayOrFutureDate, minRentalStartDate } from '../serverDate'

describe('serverDate', () => {
  it('formatLocalToday returns YYYY-MM-DD', () => {
    expect(formatLocalToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('minRentalStartDate matches formatLocalToday', () => {
    expect(minRentalStartDate()).toBe(formatLocalToday())
  })

  it('isTodayOrFutureDate accepts today and future dates', () => {
    const today = '2026-05-18'
    expect(isTodayOrFutureDate('2026-05-18', today)).toBe(true)
    expect(isTodayOrFutureDate('2026-06-01', today)).toBe(true)
    expect(isTodayOrFutureDate('2026-05-17', today)).toBe(false)
    expect(isTodayOrFutureDate('', today)).toBe(false)
  })
})
