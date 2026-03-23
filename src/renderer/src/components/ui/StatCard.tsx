import { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  color?: 'blue' | 'gold' | 'green' | 'red'
  index?: number
}

const colorMap = {
  blue: 'bg-primary-50 text-primary',
  gold: 'bg-accent-50 text-accent',
  green: 'bg-emerald-50 text-emerald-600',
  red: 'bg-red-50 text-red-500'
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  color = 'blue',
  index = 0
}: StatCardProps): JSX.Element {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
      className="card-hover"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-primary-400 font-medium">{title}</p>
          <p className="mt-1 text-3xl font-bold text-primary">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-primary-300">{subtitle}</p>}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
    </motion.div>
  )
}
