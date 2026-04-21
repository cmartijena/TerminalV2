import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Solicitudes from './pages/Solicitudes'
import Agencias    from './pages/Agencias'

const Placeholder = ({ title }: { title: string }) => (
  <div className="p-5">
    <h1 className="text-lg font-semibold text-tx mb-1">{title}</h1>
    <p className="text-xs text-tx3 font-mono">Módulo en migración...</p>
  </div>
)

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/dashboard"   element={<Dashboard />} />
          <Route path="/terminales"  element={<Placeholder title="Terminales" />} />
          <Route path="/agencias"    element={<Agencias />} />
          <Route path="/empresas"    element={<ProtectedRoute roles={['ADMINISTRADOR','DIRECTIVO']}><Placeholder title="Empresas" /></ProtectedRoute>} />
          <Route path="/wam"         element={<ProtectedRoute roles={['ADMINISTRADOR','DIRECTIVO']}><Placeholder title="Reportería WAM" /></ProtectedRoute>} />
          <Route path="/egm"         element={<Placeholder title="Usuarios EGM" />} />
          <Route path="/usuarios"    element={<ProtectedRoute roles={['ADMINISTRADOR','DIRECTIVO']}><Placeholder title="Usuarios" /></ProtectedRoute>} />
          <Route path="/historial"   element={<ProtectedRoute roles={['ADMINISTRADOR','DIRECTIVO']}><Placeholder title="Historial" /></ProtectedRoute>} />
          <Route path="/solicitudes" element={<Solicitudes />} />
          <Route path="*"            element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}