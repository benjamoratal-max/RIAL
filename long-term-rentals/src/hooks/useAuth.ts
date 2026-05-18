import { useState, useCallback, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { api, normalizeBearerToken } from '../utils/api'
import { getErrorMessage, APIError } from '../utils/errorHandler'

export function useAuth() {
  const [token, setToken] = useState<string>(() => {
    try {
      const raw = localStorage.getItem('token')
      return raw ? normalizeBearerToken(raw) : ''
    } catch {
      return ''
    }
  })
  const [user, setUser] = useState<any>(() => {
    const raw = localStorage.getItem('user')
    try {
      return raw ? JSON.parse(raw) : null
    } catch (e) {
      console.error('Error parsing user from localStorage:', e)
      return null
    }
  })
  const [requires2FA, setRequires2FA] = useState(false)
  const [twoFactorMethod, setTwoFactorMethod] = useState<string | null>(null)
  const [pendingLogin, setPendingLogin] = useState<{ email: string; password: string } | null>(null)

  const onLogin = useCallback(({ email, password, twoFactorCode, recaptchaToken }: { email: string; password: string; twoFactorCode?: string; recaptchaToken?: string }) => {
    api('/api/auth/login', { method: 'POST', body: { email, password, twoFactorCode, recaptchaToken } })
      .then((res) => {
        if (res.requires2FA) {
          setRequires2FA(true)
          setTwoFactorMethod(res.method)
          setPendingLogin({ email, password })
          toast('Código 2FA enviado por email')
        } else {
          const cleanToken = normalizeBearerToken(String(res.token || ''))
          setToken(cleanToken)
          setUser(res.user)
          localStorage.setItem('token', cleanToken)
          localStorage.setItem('user', JSON.stringify(res.user))
          setRequires2FA(false)
          setPendingLogin(null)
          toast.success('Sesión iniciada exitosamente')
        }
      })
      .catch((err) => {
        toast.error(getErrorMessage(err))
        setRequires2FA(false)
        setPendingLogin(null)
      })
  }, [])

  const verify2FA = useCallback((code: string) => {
    if (!pendingLogin) return
    
    onLogin({ 
      email: pendingLogin.email, 
      password: pendingLogin.password, 
      twoFactorCode: code 
    })
  }, [pendingLogin, onLogin])

  const onRegister = useCallback(({ name, email, password, role }: { name: string; email: string; password: string; role: string }) => {
    api('/api/auth/register', { method: 'POST', body: { name, email, password, role } })
      .then((res) => {
        toast.success('Cuenta creada exitosamente. Puedes verificar tu email más tarde si lo deseas.')
        // Permitir login automático ya que la verificación es opcional
        onLogin({ email, password })
      })
      .catch((err) => toast.error(getErrorMessage(err)))
  }, [onLogin])

  const onLogout = useCallback((opts?: { quiet?: boolean }) => {
    setToken('')
    setUser(null)
    setRequires2FA(false)
    setPendingLogin(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    if (!opts?.quiet) {
      toast.success('Sesión cerrada')
    }
  }, [])

  // Validar token contra el backend al cargar (evita JWT inválido/expirado con UI "logueada").
  useEffect(() => {
    if (!token || !user?.id) return
    let cancelled = false
    void (async () => {
      try {
        const profile = await api(`/api/users/${user.id}`, { token })
        if (cancelled) return
        setUser((prev: any) => {
          if (!prev) return prev
          const next = {
            ...prev,
            verified: Boolean((profile as any).verified),
            emailVerified: Boolean((profile as any).emailVerified),
            name: (profile as any).name ?? prev.name,
            email: (profile as any).email ?? prev.email,
            role: (profile as any).role ?? prev.role,
          }
          try {
            localStorage.setItem('user', JSON.stringify(next))
          } catch {
            /* ignore */
          }
          return next
        })
      } catch (err) {
        if (cancelled) return
        const status = err instanceof APIError ? err.status : undefined
        if (status === 401) {
          onLogout({ quiet: true })
          toast.error('Tu sesión no es válida o expiró. Vuelve a iniciar sesión.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, user?.id, onLogout])

  const updateUser = useCallback((userData: any) => {
    setUser((prev: any) => {
      const next = prev ? { ...prev, ...userData } : userData
      try {
        localStorage.setItem('user', JSON.stringify(next))
      } catch (_) {
        // Ignore localStorage write failures (private mode/quota exceeded).
      }
      return next
    })
  }, [])

  return {
    token,
    user,
    requires2FA,
    twoFactorMethod,
    onLogin,
    verify2FA,
    onRegister,
    onLogout,
    updateUser,
  }
}

