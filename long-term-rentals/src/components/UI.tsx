import { type InputHTMLAttributes, type ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { 
  Bell, 
  MessageCircle, 
  CreditCard, 
  Sun, 
  Moon, 
  Search, 
  Filter, 
  MapPin, 
  DollarSign, 
  Star, 
  Heart, 
  Share2, 
  Calendar,
  Users,
  Home,
  Settings,
  LogOut,
  Plus,
  X,
  Check,
  AlertCircle,
  Info
} from 'lucide-react'

export function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ')
}

// Componente de loading animado
export function LoadingSpinner({ size = 'md', text = 'Cargando...' }: { size?: 'sm' | 'md' | 'lg', text?: string }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12'
  }

  return (
    <motion.div 
      className="flex items-center justify-center space-x-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className={`${sizeClasses[size]} border-2 border-gray-300 border-t-blue-600 rounded-full`}
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      />
      <span className="text-gray-600 dark:text-gray-400 font-medium">{text}</span>
    </motion.div>
  )
}

// Componente de botón mejorado
type ButtonProps = {
  children?: ReactNode
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  className?: string
} & HTMLMotionProps<'button'>

export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  icon,
  className = '',
  type = 'button',
  disabled = false,
  ...rest
}: ButtonProps) {
  const baseClasses = "inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
  
  const variants = {
    primary: "bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 focus:ring-blue-500 shadow-lg hover:shadow-xl",
    secondary: "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 focus:ring-gray-500",
    outline: "border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:ring-gray-500",
    ghost: "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-gray-500",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
  }

  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  }

  return (
    <motion.button
      type={type}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      {...rest}
    >
      {icon && (
        <span className={children ? 'mr-2' : ''} aria-hidden="true">
          {icon}
        </span>
      )}
      {children}
    </motion.button>
  )
}

// Componente de input mejorado
type InputProps = {
  placeholder: string
  value: string
  onChange: (value: string) => void
  type?: string
  icon?: ReactNode
  className?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>

export function Input({ 
  placeholder, 
  value, 
  onChange, 
  type = 'text',
  icon,
  className = '',
  ...rest
}: InputProps) {
  return (
    <motion.div 
      className={`relative ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {icon && (
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500">
          {icon}
        </div>
      )}
      <input
        type={type}
        className={`w-full px-3 py-2 rounded-xl border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${icon ? 'pl-10' : ''}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </motion.div>
  )
}

// Componente de tarjeta con animaciones
export function AnimatedCard({ children, className = '', delay = 0 }: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      whileHover={{ y: -5 }}
    >
      {children}
    </motion.div>
  )
}

// Componente de badge de estado
export function StatusBadge({ 
  status, 
  children 
}: { 
  status: 'success' | 'warning' | 'error' | 'info'
  children: ReactNode 
}) {
  const styles = {
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
    error: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
  }

  return (
    <span className={`inline-block text-xs px-2 py-1 rounded-full font-medium ${styles[status]}`}>
      {children}
    </span>
  )
}

// Componente de icono con animación
export function AnimatedIcon({ 
  icon: Icon, 
  className = '', 
  onClick,
  size = 20
}: {
  icon: any
  className?: string
  onClick?: () => void
  size?: number
}) {
  return (
    <motion.div
      className={className}
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
    >
      <Icon size={size} />
    </motion.div>
  )
}

// Componente de contador animado
export function AnimatedCounter({ count, className = '' }: {
  count: number
  className?: string
}) {
  return (
    <motion.span 
      className={`absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ${className}`}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      {count}
    </motion.span>
  )
}

// Componente de botón de acción flotante
export function FloatingActionButton({ 
  icon, 
  onClick, 
  className = '' 
}: {
  icon: ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <motion.button
      className={`fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center ${className}`}
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      {icon}
    </motion.button>
  )
}

// Componente de skeleton loading
export function Skeleton({ className = '', lines = 1 }: {
  className?: string
  lines?: number
}) {
  return (
    <div className={`animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div 
          key={i} 
          className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2"
          style={{ width: `${Math.random() * 40 + 60}%` }}
        />
      ))}
    </div>
  )
}

// Componente de modal con backdrop
export function Modal({ 
  isOpen, 
  onClose, 
  children, 
  className = '' 
}: {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
}) {
  if (!isOpen) return null

  return (
    <motion.div 
      className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center p-4 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div 
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-xl ${className}`}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

// Componente de tooltip
export function Tooltip({ 
  children, 
  content, 
  className = '' 
}: {
  children: React.ReactNode
  content: string
  className?: string
}) {
  return (
    <div className={`relative group ${className}`}>
      {children}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
        {content}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  )
}
