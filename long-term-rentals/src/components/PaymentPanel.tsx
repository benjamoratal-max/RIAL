import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Plus, X, Check, DollarSign, Home, Info } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Button, Input, classNames } from './UI'
import { api } from '../utils/api'
import { getErrorMessage } from '../utils/errorHandler'

export interface PaymentPanelProps {
  token: string | null
  user: any
  onClose: () => void
}

export function PaymentPanel({ token, user, onClose }: PaymentPanelProps) {
  const { t } = useTranslation()
  const [payments, setPayments] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [paymentForm, setPaymentForm] = useState({
    propertyId: '',
    amount: '',
    paymentMethod: 'stripe',
    description: ''
  })

  useEffect(() => {
    if (token) {
      loadPayments()
      loadStats()
    }
  }, [token])

  async function loadPayments() {
    try {
      const data = await api('/api/payments', { token })
      setPayments(data)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  async function loadStats() {
    try {
      const data = await api('/api/payments/stats/summary', { token })
      setStats(data)
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  async function createPayment() {
    try {
      await api('/api/payments', {
        method: 'POST',
        token,
        body: paymentForm
      })
      setPaymentForm({ propertyId: '', amount: '', paymentMethod: 'stripe', description: '' })
      setShowPaymentForm(false)
      loadPayments()
      loadStats()
      toast.success(t('payments.paymentProcessed'))
    } catch (error: any) {
      toast.error(getErrorMessage(error))
    }
  }

  if (!user) return null

  return (
    <motion.div 
      className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center p-4 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div 
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-4xl max-h-[80vh] overflow-hidden"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="font-semibold text-lg text-gray-900 dark:text-white">
              {t('payments.title')}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-1">
              <Info className="w-3 h-3" />
              {t('payments.subtitle')}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} icon={<X className="w-4 h-4" />}>
              {t('payments.close')}
            </Button>
          </div>
        </div>

        {stats && (
          <motion.div 
            className="grid grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalPayments}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t('payments.totalPayments')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">${stats.totalAmount.toFixed(2)}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t('payments.totalPaid')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">${stats.pendingAmount.toFixed(2)}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t('payments.pending')}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.successRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{t('payments.successRate')}</div>
            </div>
          </motion.div>
        )}

        {showPaymentForm && (
          <motion.div 
            className="mb-6 p-4 border rounded-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="font-medium mb-3 text-gray-900 dark:text-white">{t('payments.newPaymentTitle')}</div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                placeholder={t('payments.propertyId')}
                value={paymentForm.propertyId}
                onChange={(value) => setPaymentForm({ ...paymentForm, propertyId: value })}
                icon={<Home className="w-4 h-4" />}
              />
              <Input
                type="number"
                placeholder={t('payments.amount')}
                value={paymentForm.amount}
                onChange={(value) => setPaymentForm({ ...paymentForm, amount: value })}
                icon={<DollarSign className="w-4 h-4" />}
              />
              <select
                className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                value={paymentForm.paymentMethod}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
              >
                <option value="stripe">Stripe</option>
                <option value="paypal">PayPal</option>
                <option value="bank_transfer">Transferencia Bancaria</option>
              </select>
              <Input
                type="text"
                placeholder={t('payments.description')}
                value={paymentForm.description}
                onChange={(value) => setPaymentForm({ ...paymentForm, description: value })}
                icon={<Info className="w-4 h-4" />}
              />
            </div>
            <div className="flex gap-2 mt-3">
              <Button variant="outline" onClick={() => setShowPaymentForm(false)} icon={<X className="w-4 h-4" />}>
                {t('payments.cancel')}
              </Button>
              <Button onClick={createPayment} icon={<Check className="w-4 h-4" />}>
                {t('payments.processPayment')}
              </Button>
            </div>
          </motion.div>
        )}

        <motion.div 
          className="overflow-y-auto max-h-[40vh]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {loading ? (
            <div className="text-center text-gray-500 dark:text-gray-400">{t('payments.loading')}</div>
          ) : payments.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400">{t('payments.none')}</div>
          ) : (
            <motion.div 
              className="space-y-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {payments.map((payment) => (
                <motion.div 
                  key={payment.id} 
                  className="p-3 border rounded-xl"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: payments.indexOf(payment) * 0.05 }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{payment.property.title}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{payment.description}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(payment.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900 dark:text-white">${payment.amount}</div>
                      <div className={classNames(
                        'text-xs px-2 py-1 rounded-full font-medium',
                        payment.status === 'completed' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' :
                        payment.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300' :
                        'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                      )}>
                        {payment.status}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
