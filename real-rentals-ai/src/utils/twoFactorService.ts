// Utilidades para 2FA
export function generate2FACode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos
}
