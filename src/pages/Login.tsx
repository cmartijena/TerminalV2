import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useDB } from '../store/db'

export default function Login() {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const login = useAuth(s => s.login)
  const loadAll = useDB(s => s.loadAll)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !pass) { setError('Completa usuario y contraseña'); return }
    setError(''); setLoading(true)
    const res = await login(user, pass)
    if (res.ok) {
      await loadAll()
      navigate('/dashboard')
    } else {
      setError(res.error || 'Error de autenticación')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-ac/10 border border-ac/30 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00e5a0" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <span className="text-lg font-semibold text-tx tracking-wide">TerminalOS</span>
          </div>
          <p className="text-xs text-tx3 font-mono tracking-widest">ELECTRIC LINE PERU S.A.C.</p>
        </div>

        <div className="card border-border/60">
          <h2 className="text-sm font-semibold text-tx mb-1">Iniciar sesión</h2>
          <p className="text-xs text-tx2 mb-5">Ingresa tus credenciales de acceso</p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-tx2 block mb-1.5 font-mono tracking-wide">USUARIO</label>
              <input
                className="input"
                placeholder="nombre_usuario"
                value={user}
                onChange={e => setUser(e.target.value.toLowerCase())}
                autoComplete="username"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-tx2 block mb-1.5 font-mono tracking-wide">CONTRASEÑA</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={pass}
                  onChange={e => setPass(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-tx3 hover:text-tx2 transition-colors"
                >
                  {showPass ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#f85149" strokeWidth="2" className="flex-shrink-0">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span className="text-xs text-danger">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-1"
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Verificando...
                </>
              ) : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-tx3 mt-6">
          TerminalOS v2.0 · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}