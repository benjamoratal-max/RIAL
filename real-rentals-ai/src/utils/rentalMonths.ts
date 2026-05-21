export const ALLOWED_RENTAL_MONTHS = [3, 6, 12] as const
export type RentalMonthOption = (typeof ALLOWED_RENTAL_MONTHS)[number]

export function normalizeRentalMonths(input: unknown): RentalMonthOption[] {
  let values: number[] = []
  if (Array.isArray(input)) {
    values = input.map((v) => Number(v))
  } else if (typeof input === 'string' && input.trim()) {
    values = input.split(',').map((s) => parseInt(s.trim(), 10))
  }
  const unique = [...new Set(values.filter((m): m is RentalMonthOption => (ALLOWED_RENTAL_MONTHS as readonly number[]).includes(m)))]
  return unique.sort((a, b) => a - b)
}

export function rentalMonthsToString(months: RentalMonthOption[]): string {
  return normalizeRentalMonths(months).join(',')
}

export function parseRentalMonthsString(raw: string | null | undefined): RentalMonthOption[] {
  if (!raw) return [12]
  const parsed = normalizeRentalMonths(raw)
  return parsed.length > 0 ? parsed : [12]
}
