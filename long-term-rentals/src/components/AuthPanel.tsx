import React, { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import ReCAPTCHA from 'react-google-recaptcha'
import { Users, Settings, LogOut, Search, Shield, Mail, Phone, ShieldAlert } from 'lucide-react'
import { Button, Input } from './UI'
import { PasswordRequirementsHint } from './PasswordRequirementsHint'
import { validateRegisterForm, validateLoginForm, getFieldError } from '../utils/validation'
import { toast } from 'react-hot-toast'
import { api } from '../utils/api'
import { getErrorMessage } from '../utils/errorHandler'

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined

interface AuthPanelProps {
  user?: any
  token?: string
  requires2FA?: boolean
  twoFactorMethod?: string | null
  onLogin: (credentials: { email: string; password: string; twoFactorCode?: string; recaptchaToken?: string }) => void
  onVerify2FA?: (code: string) => void
  onLogout: () => void
  onRegister: (data: { name: string; email: string; password: string; role: string }) => void
}

export function AuthPanel({ 
  user, 
  token, 
  requires2FA = false, 
  twoFactorMethod,
  onLogin, 
  onVerify2FA,
  onLogout, 
  onRegister 
}: AuthPanelProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'tenant' })
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const recaptchaRef = useRef<ReCAPTCHA>(null)
  const [showAdminRequest, setShowAdminRequest] = useState(false)
  const [adminRequest, setAdminRequest] = useState({ email: '', reason: '' })
  const [adminRequestSending, setAdminRequestSending] = useState(false)

  if (user) {
    return (
      <motion.div 
        className="rounded-2xl border border-rial-cream-dark/50 bg-white p-4 shadow-md dark:border-slate-700 dark:bg-slate-900/95"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-rial-gold to-rial-navy ring-2 ring-rial-gold/30">
              <Users className="h-5 w-5 text-rial-cream" />
            </div>
            <div>
              <div className="text-sm text-rial-muted dark:text-slate-400">{t('auth.sessionStarted')}</div>
              <div className="font-semibold text-rial-navy dark:text-rial-cream">
                {user.name} · <span className="rounded-full bg-rial-cream-dark/50 px-2 py-0.5 text-xs uppercase text-rial-ink dark:bg-slate-800 dark:text-slate-200">{user.role}</span>
              </div>
              <div className="text-xs text-rial-muted dark:text-slate-400">{user.email}</div>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onLogout} icon={<LogOut className="w-4 h-4" />}>
            {t('auth.logout')}
          </Button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div 
      className="relative rounded-2xl border border-rial-cream-dark/50 bg-white p-4 shadow-md dark:border-slate-700 dark:bg-slate-900/95"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex gap-2 mb-4">
        <Button 
          variant={tab === 'login' ? 'primary' : 'ghost'} 
          size="sm"
          onClick={() => setTab('login')}
        >
          {t('auth.login')}
        </Button>
        <Button 
          variant={tab === 'register' ? 'primary' : 'ghost'} 
          size="sm"
          onClick={() => setTab('register')}
        >
          {t('auth.register')}
        </Button>
      </div>

      {tab === 'login' ? (
        requires2FA ? (
          <motion.div
            className="grid gap-3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="text-center mb-2">
              <Shield className="mx-auto mb-2 h-12 w-12 text-rial-navy dark:text-rial-gold" />
              <h3 className="mb-1 font-semibold text-rial-navy dark:text-rial-cream">
                {t('auth.twoFactorTitle')}
              </h3>
              <p className="text-sm text-rial-muted dark:text-slate-400">
                {t('auth.twoFactorDescription')}
              </p>
            </div>
            <Input
              placeholder={t('auth.verificationCode')}
              value={twoFactorCode}
              onChange={(value) => setTwoFactorCode(value)}
              icon={twoFactorMethod === 'email' ? <Mail className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
              maxLength={6}
            />
            <Button 
              className="w-full"
              onClick={() => {
                if (twoFactorCode.length !== 6) {
                  toast.error(t('auth.codeMustBe6Digits'))
                  return
                }
                if (onVerify2FA) {
                  onVerify2FA(twoFactorCode)
                } else {
                  onLogin({ email: form.email, password: form.password, twoFactorCode })
                }
              }}
            >
              {t('auth.verifyCode')}
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setTwoFactorCode('')
                onLogin({ email: form.email, password: form.password })
              }}
            >
              {t('auth.resendCode')}
            </Button>
          </motion.div>
        ) : (
          <motion.form 
            className="grid gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            onSubmit={e => { 
              e.preventDefault()
              const validation = validateLoginForm({ email: form.email, password: form.password })
              if (!validation.isValid) {
                const errorMap: { [key: string]: string } = {}
                validation.errors.forEach(err => {
                  errorMap[err.field] = err.message
                })
                setErrors(errorMap)
                toast.error(t('auth.fixFormErrors'))
                return
              }
              const recaptchaToken = RECAPTCHA_SITE_KEY ? recaptchaRef.current?.getValue() ?? undefined : undefined
              if (RECAPTCHA_SITE_KEY && !recaptchaToken) {
                toast.error(t('auth.captchaRequired') || 'Completa la verificación "No soy un robot" para continuar.')
                return
              }
              setErrors({})
              onLogin({ email: form.email, password: form.password, recaptchaToken })
              recaptchaRef.current?.reset()
            }}
          >
            <Input 
              placeholder={t('auth.email')} 
              value={form.email} 
              onChange={(value) => setForm({ ...form, email: value })}
              icon={<Search className="w-4 h-4" />}
            />
            <Input 
              placeholder={t('auth.password')} 
              type="password"
              value={form.password} 
              onChange={(value) => setForm({ ...form, password: value })}
              icon={<Settings className="w-4 h-4" />}
            />
            {RECAPTCHA_SITE_KEY && (
              <div className="flex justify-center [&_.grecaptcha-badge]:self-center">
                <ReCAPTCHA
                  ref={recaptchaRef}
                  sitekey={RECAPTCHA_SITE_KEY}
                  theme="light"
                  size="normal"
                />
              </div>
            )}
            <Button type="submit" className="w-full">
              {t('auth.enter')}
            </Button>
          </motion.form>
        )
      ) : (
        <motion.form 
          className="grid gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          onSubmit={e => { 
            e.preventDefault()
            const validation = validateRegisterForm(form)
            if (!validation.isValid) {
              const errorMap: { [key: string]: string } = {}
              validation.errors.forEach(err => {
                errorMap[err.field] = err.message
              })
              setErrors(errorMap)
              toast.error(t('auth.fixFormErrors'))
              return
            }
            setErrors({})
            onRegister(form)
          }}
        >
          <div>
            <Input 
              placeholder={t('auth.name')} 
              value={form.name} 
              onChange={(value) => {
                setForm({ ...form, name: value })
                if (errors.name) setErrors({ ...errors, name: '' })
              }}
              icon={<Users className="w-4 h-4" />}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>
          <div>
            <Input 
              placeholder={t('auth.email')} 
              value={form.email} 
              onChange={(value) => {
                setForm({ ...form, email: value })
                if (errors.email) setErrors({ ...errors, email: '' })
              }}
              icon={<Search className="w-4 h-4" />}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>
          <div>
            <Input 
              placeholder={t('auth.password')} 
              type="password"
              value={form.password} 
              onChange={(value) => {
                setForm({ ...form, password: value })
                if (errors.password) setErrors({ ...errors, password: '' })
              }}
              icon={<Settings className="w-4 h-4" />}
            />
            <PasswordRequirementsHint password={form.password} />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>
          <div>
            <select 
              className="w-full rounded-xl border border-rial-cream-dark/50 bg-white px-3 py-2 text-rial-ink focus:border-transparent focus:outline-none focus:ring-2 focus:ring-rial-gold dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              value={form.role} 
              onChange={e => {
                setForm({ ...form, role: e.target.value })
                if (errors.role) setErrors({ ...errors, role: '' })
              }}
            >
              {/* tenant = inquilino/prospecto; broker_applicant = postulante a broker */}
              <option value="tenant">{t('auth.roleTenant')}</option>
              <option value="broker_applicant">{t('auth.roleBrokerApplicant')}</option>
            </select>
            {errors.role && <p className="text-red-500 text-xs mt-1">{errors.role}</p>}
          </div>
          <p className="text-center text-xs text-rial-muted dark:text-slate-400">
            {t('auth.adminRequestHint')}
            <button
              type="button"
              onClick={() => setShowAdminRequest(true)}
              className="ml-1 font-medium text-rial-navy underline-offset-2 hover:underline dark:text-rial-gold"
            >
              {t('auth.requestAdminAccess')}
            </button>
          </p>
          <Button type="submit" className="w-full">
            {t('auth.createAccount')}
          </Button>
        </motion.form>
      )}

      {showAdminRequest && (
        <motion.div
          className="absolute inset-0 rounded-2xl border border-rial-cream-dark/50 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-rial-navy dark:text-rial-cream">{t('auth.adminRequestTitle')}</h3>
          </div>
          <p className="mb-4 text-sm text-rial-muted dark:text-slate-400">{t('auth.adminRequestDescription')}</p>
          <div className="grid gap-3">
            <Input
              placeholder={t('auth.email')}
              value={adminRequest.email}
              onChange={(v) => setAdminRequest((prev) => ({ ...prev, email: v }))}
              icon={<Mail className="w-4 h-4" />}
            />
            <textarea
              className="min-h-[80px] w-full resize-y rounded-xl border border-rial-cream-dark/50 bg-white px-3 py-2 text-rial-ink focus:outline-none focus:ring-2 focus:ring-rial-gold dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              placeholder={t('auth.adminRequestReasonPlaceholder')}
              value={adminRequest.reason}
              onChange={(e) => setAdminRequest((prev) => ({ ...prev, reason: e.target.value }))}
              maxLength={500}
            />
          </div>
          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowAdminRequest(false)
                setAdminRequest({ email: '', reason: '' })
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              className="flex-1"
              disabled={!adminRequest.email.trim() || adminRequestSending}
              onClick={async () => {
                setAdminRequestSending(true)
                try {
                  await api('/api/admin/request', {
                    method: 'POST',
                    body: { email: adminRequest.email.trim(), reason: adminRequest.reason.trim() },
                  })
                  toast.success(t('auth.adminRequestSent'))
                  setShowAdminRequest(false)
                  setAdminRequest({ email: '', reason: '' })
                } catch (err) {
                  toast.error(getErrorMessage(err))
                } finally {
                  setAdminRequestSending(false)
                }
              }}
            >
              {adminRequestSending ? t('auth.sending') : t('auth.sendAdminRequest')}
            </Button>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}

