import { Navigate } from 'react-router-dom'
import { useAuth } from '../../store/auth'
import type { Rol } from '../../types'

interface Props {
  children: React.ReactNode
  roles?: Rol[]
}

export default function ProtectedRoute({ children, roles }: Props) {
  const user = useAuth(s => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.rol)) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}