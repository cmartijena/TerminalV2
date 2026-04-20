// ── Roles ─────────────────────────────────────────────
export type Rol = 'ADMINISTRADOR' | 'DIRECTIVO' | 'FRANQUICIADO' | 'TECNICO'

// ── Auth / Users ──────────────────────────────────────
export interface Usuario {
  id: number
  _id?: string
  user: string
  pass: string
  rol: Rol
  nombre: string
  correo: string
  empresas: string[]
  activo: boolean
  tourSeen?: boolean
}

// ── Empresa ───────────────────────────────────────────
export interface Empresa {
  _id?: string
  id: number
  nombre: string
  ruc?: string
  activo: boolean
}

// ── Agencia ───────────────────────────────────────────
export type EstadoAgencia = 'PENDIENTE' | 'EN PRODUCCION' | 'DADA DE BAJA' | 'INACTIVA'

export interface Agencia {
  _id?: string
  id: number
  empresa: string
  sucursal: string
  subagencia: string
  id_sub: string
  estado: EstadoAgencia
  encargado?: string
  correo?: string
  sinCorreo?: boolean
  rol?: string
  pos?: string
  direccion?: string
  ubicacion?: string
  lat?: number
  lng?: number
  usuario?: string
  realPassword?: string
  fecha_inicio?: string
  fecha_baja?: string
  fotos?: string[]
}

// ── Terminal ──────────────────────────────────────────
export type EstadoTerminal = 'EN PRODUCCION' | 'DISPONIBLE' | 'EN REPARACION' | 'BAJA' | 'ACTIVO' | 'NO DISPONIBLE'

export interface Terminal {
  _id?: string
  id: number
  codigo: string
  modelo: string
  serie?: string
  estado: EstadoTerminal
  empresa: string
  sucursal: string
  agencia: string
  id_sub: string
  agencia_id?: string
  observacion?: string
  wam_online?: boolean
  wam_ultimo?: string
}

// ── Usuario EGM ───────────────────────────────────────
export interface UsuarioEGM {
  _agencia_id?: string
  empresa: string
  sucursal: string
  subagencia: string
  id_sub: string
  user: string
  realPassword?: string
  rol?: string
  activo: 'SI' | 'NO'
}

// ── Acceso WAM ────────────────────────────────────────
export interface AccesoWAM {
  _id?: string
  cliente: string
  correo: string
  empresa: string
  user: string
  pwd: string
  url: string
  notas: string
  estado: 'ACTIVO' | 'INACTIVO' | 'SUSPENDIDO'
  created_at?: string
}

// ── WAM Reporte ───────────────────────────────────────
export interface WamFila {
  punto: string
  local?: string
  empresa: string
  cash_in: number
  tickets: number
  balance: number
  gross_net?: number
  amount_played?: number
  amount_won?: number
  amount_held?: number
  spins?: number
}

export interface WamReporte {
  total_in: number
  total_out: number
  balance: number
  registros: number
  hora_peru?: string
  filas?: WamFila[]
  metodo?: string
  error?: string
}

// ── Notificación ──────────────────────────────────────
export type NotifTipo = 'danger' | 'warn' | 'info' | 'success'
export type NotifRoles = Rol[]

export interface Notificacion {
  id: string
  tipo: NotifTipo
  titulo: string
  descripcion: string
  roles: NotifRoles
  tiempo: string
  leida: boolean
  accion?: string
}

// ── Historial ─────────────────────────────────────────
export interface LogEntry {
  id: number
  mensaje: string
  tipo: 'info' | 'success' | 'warn' | 'error'
  tiempo: string
  usuario?: string
}

// ── DB global ─────────────────────────────────────────
export interface DB {
  empresas: Empresa[]
  agencias: Agencia[]
  terminales: Terminal[]
  usuarios: UsuarioEGM[]
  usuariosSistema: Usuario[]
  accesosWAM: AccesoWAM[]
}
// ── Solicitud ─────────────────────────────────────────
export type TipoSolicitud    = 'NUEVO_LOCAL' | 'NUEVA_TERMINAL'
export type EstadoSolicitud  = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO'
export type TipoMaquina      = 'BOX_SIMPLE' | 'BOX_DUAL' | 'WALL_PARED'

export interface Solicitud {
  id?: string
  _id?: string
  // Tipo y estado
  tipo: TipoSolicitud
  estado: EstadoSolicitud
  // Datos de la empresa franquiciada
  empresa: string
  empresa_id?: string
  // Datos del franquiciado
  franquiciado_nombre: string
  franquiciado_correo: string
  franquiciado_telefono: string
  franquiciado_cargo: string
  // Datos del nuevo local
  agencia_nombre: string
  direccion: string
  maps_link?: string
  lat?: number
  lng?: number
  // Equipamiento solicitado
  cant_terminales: number
  tipo_maquina: TipoMaquina
  notas?: string
  // Solicitante del sistema
  solicitante_id?: string
  solicitante_nombre?: string
  // Gestión
  motivo_rechazo?: string
  aprobado_por?: string
  created_at?: string
  updated_at?: string
}
