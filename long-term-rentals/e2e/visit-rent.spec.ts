import { test, expect } from '@playwright/test'
import { mockApi, seedLoggedInSession } from './support/mockApi'

test.describe('Agendar visita y alquilar (usuario verificado)', () => {
  test('agenda una visita a una propiedad', async ({ page }) => {
    const requests: Array<{ method: string; url: string; postData: any }> = []
    await seedLoggedInSession(page)
    await mockApi(page, { verified: true, onRequest: (i) => requests.push(i) })
    await page.goto('/')

    await page.getByRole('button', { name: 'Ver detalle' }).first().click()
    await page.getByRole('button', { name: 'Solicitar visita con broker' }).click()

    // Completar el formulario de visita.
    await page.locator('input[type="date"]').fill('2026-07-15')
    await page.getByRole('button', { name: '10:00', exact: true }).click()
    await page.getByRole('button', { name: 'Agendar visita' }).click()

    // Debe haberse enviado el POST de la visita al backend.
    await expect
      .poll(() => requests.some((r) => r.method === 'POST' && /\/visits$/.test(r.url)))
      .toBe(true)
  })

  test('inicia el proceso de alquiler tras pasar la verificación', async ({ page }) => {
    await seedLoggedInSession(page)
    await mockApi(page, { verified: true })
    await page.goto('/')

    await page.getByRole('button', { name: 'Ver detalle' }).first().click()
    await page.getByRole('button', { name: 'Revisar elegibilidad de alquiler' }).click()

    // El proceso digital de alquiler debe abrirse (primer paso: encabezado).
    await expect(page.getByRole('heading', { name: 'Información Personal' })).toBeVisible({ timeout: 15_000 })
  })
})
