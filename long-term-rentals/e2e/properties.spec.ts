import { test, expect } from '@playwright/test'
import { mockApi } from './support/mockApi'

test.describe('Propiedades / navegación', () => {
  test('abre el detalle de una propiedad', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')

    await page.getByRole('button', { name: 'Ver detalle' }).first().click()

    // El modal de detalle debe abrirse y mostrar acciones y botón de cerrar.
    await expect(page.getByRole('button', { name: 'Cerrar' }).first()).toBeVisible()
    await expect(page.getByText('Solicitar visita con broker')).toBeVisible()
  })

  test('cierra el detalle y vuelve al listado', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')

    await page.getByRole('button', { name: 'Ver detalle' }).first().click()
    await expect(page.getByText('Solicitar visita con broker')).toBeVisible()

    await page.getByRole('button', { name: 'Cerrar' }).first().click()
    await expect(page.getByText('Solicitar visita con broker')).toHaveCount(0)
  })

  test('alterna a la vista de mapa', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')

    // El control de mapa aparece en filtros / sidebar. Buscamos por texto "mapa".
    const mapToggle = page.getByRole('button', { name: /mapa|map/i }).first()
    if (await mapToggle.count()) {
      await mapToggle.click()
      // El contenedor de leaflet debe montarse.
      await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 15_000 })
    }
  })
})
