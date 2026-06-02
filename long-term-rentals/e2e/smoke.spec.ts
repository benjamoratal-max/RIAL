import { test, expect } from '@playwright/test'
import { mockApi } from './support/mockApi'

test.describe('Smoke / carga inicial', () => {
  test('la app carga y muestra propiedades', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')

    // El listado simulado debe renderizar al menos una propiedad.
    await expect(page.getByText('Skyline Residence').first()).toBeVisible()
    await expect(page.getByText('Bay Loft Moderno')).toBeVisible()
  })

  test('muestra el panel de autenticación (login/registro)', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')

    // Tabs de login y registro presentes.
    await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Registro', exact: true })).toBeVisible()
  })

  test('permite cambiar el idioma a inglés', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')

    // Hay dos selects de idioma (móvil oculto + desktop, ambos aria-label="Idioma").
    const langSelect = page.locator('select[aria-label="Idioma"]:visible').first()
    await langSelect.selectOption('en')

    // El bundle de inglés se carga async; el botón de login pasa a "Sign in".
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  })
})
