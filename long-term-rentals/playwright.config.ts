import { defineConfig, devices } from '@playwright/test'

/**
 * Configuración de tests E2E para RIAL App.
 *
 * Arquitectura: los tests corren contra el frontend real (Vite dev server) pero
 * interceptan TODAS las llamadas a /api/** y devuelven respuestas simuladas
 * (ver e2e/support/mockApi.ts). Así no se necesita backend, base de datos ni
 * servicios externos (email, SMS, pagos, OCR), y los tests son rápidos y
 * determinísticos. Funciona igual en esta máquina y en CI.
 *
 * 1 solo worker / sin paralelismo: esta máquina tiene RAM justa.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'es-AR',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
