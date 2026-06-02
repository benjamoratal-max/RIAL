import { test, expect } from '@playwright/test'
import { mockApi } from './support/mockApi'

test.describe('Autenticación', () => {
  test('registro de un nuevo usuario inicia sesión', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')

    await page.getByRole('button', { name: 'Registro', exact: true }).click()

    await page.getByPlaceholder('Nombre').fill('Test Usuario')
    await page.getByPlaceholder('Email').fill('nuevo@rial.app')
    await page.getByPlaceholder('Password').fill('Password123')
    await page.getByRole('button', { name: 'Crear cuenta' }).click()

    // Tras registrarse, el auto-login deja la sesión iniciada (panel de usuario).
    await expect(page.getByText('Test Usuario')).toBeVisible()
    await expect(page.getByRole('button', { name: /Cerrar sesión|Salir|Logout/i })).toBeVisible()
  })

  test('login con credenciales válidas', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')

    // Tab login es el default.
    await page.getByPlaceholder('Email').fill('test@rial.app')
    await page.getByPlaceholder('Password').fill('Password123')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()

    await expect(page.getByText('Test Usuario')).toBeVisible()
  })

  test('login muestra error con email inválido (validación cliente)', async ({ page }) => {
    await mockApi(page)
    await page.goto('/')

    await page.getByPlaceholder('Email').fill('no-es-email')
    await page.getByPlaceholder('Password').fill('x')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()

    // No debe iniciar sesión: el botón Entrar sigue visible.
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible()
  })
})
