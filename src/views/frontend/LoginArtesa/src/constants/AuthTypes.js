// constants/AuthTypes.js - VERSIÓN ACTUALIZADA
export const AUTH_TYPES = {
  USER: 'user',
  BRANCH: 'branch'
};

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  AUTH_TYPE: 'authType',
  USER_DATA: 'userData',
  BRANCH_DATA: 'branchData',
  // ✅ NUEVAS CLAVES AGREGADAS
  BRANCH_AUTH_TOKEN: 'branchAuthToken',
  USER_TOKEN: 'token',
  USER_INFO: 'user',
  CLIENT_PROFILE: 'clientProfile',
  PRICE_LIST_PROFILE: 'priceListProfile'
};

export const ERROR_MESSAGES = {
  BRANCH_NOT_FOUND: 'Ha habido un error para encontrar la sucursal, por favor contacte al administrador',
  UNAUTHORIZED: 'Sin autorización para el acceso a este recurso, por favor contacte con el administrador',
  INVALID_CREDENTIALS: 'Credenciales incorrectas, por favor verifique y vuelva a intentarlo',
  NETWORK_ERROR: 'Error de conexión, por favor verifique su conexión a internet',
  UNKNOWN_ERROR: 'Ha ocurrido un error inesperado, por favor intente nuevamente',
  // ✅ NUEVOS MENSAJES AGREGADOS
  EMAIL_NOT_VERIFIED: 'Debes verificar tu correo electrónico antes de continuar',
  EMAIL_VERIFICATION_EXPIRED: 'El enlace de verificación ha expirado. Solicita uno nuevo',
  BRANCH_REGISTRATION_INCOMPLETE: 'El registro de sucursal está incompleto. Completa todos los pasos requeridos',
  EMAIL_ALREADY_VERIFIED: 'El correo electrónico ya está verificado',
  TOKEN_INVALID: 'El token de verificación no es válido o ha expirado'
};

// ✅ ENDPOINTS CORREGIDOS Y ACTUALIZADOS
export const API_ENDPOINTS = {
  // Endpoints de autenticación de usuario
  USER_LOGIN: '/auth/login',
  USER_LOGOUT: '/auth/logout',
  USER_REGISTER: '/auth/register',
  USER_PROFILE: '/auth/profile',
  USER_RESEND_VERIFICATION: '/auth/resend-verification',
  
  // Endpoints de recuperación de contraseña (usuario)
  USER_PASSWORD_RESET_REQUEST: '/password/request-reset',
  USER_PASSWORD_RESET: '/password/reset',
  
  // Endpoints de autenticación de sucursal
  BRANCH_LOGIN: '/branch-auth/login',
  BRANCH_LOGOUT: '/branch-auth/logout',
  BRANCH_PROFILE: '/branch-auth/profile',
  
  // ✅ ENDPOINTS DE VERIFICACIÓN DE EMAIL (CORREGIDOS)
  BRANCH_CHECK_REGISTRATION: '/branch-auth/check-registration', // POST
  BRANCH_INITIATE_VERIFICATION: '/branch-auth/initiate-email-verification', // POST
  BRANCH_VERIFY_EMAIL: '/branch-auth/verify-email', // GET /{token}
  BRANCH_RESEND_VERIFICATION: '/branch-auth/resend-verification', // POST
  
  // Endpoints de registro de sucursal
  BRANCH_VALIDATE_EMAIL: '/branch-registration/check-email', // POST
  BRANCH_COMPLETE_REGISTRATION: '/branch-registration/register', // POST
  
  // Endpoints de contraseña de sucursal
  BRANCH_PASSWORD_RESET_REQUEST: '/branch-password/request-reset', // POST
  BRANCH_PASSWORD_RESET: '/branch-password/reset', // POST
  
  // Endpoints administrativos
  CLIENT_BRANCHES: '/client-branches/client',
  USER_BRANCHES: '/client-branches/user',
  ENABLE_BRANCH_LOGIN: '/admin/branches',
  DISABLE_BRANCH_LOGIN: '/admin/branches',
  
  // ✅ NUEVOS ENDPOINTS AGREGADOS
  CLIENT_PROFILES: '/client-profiles/user', // GET /{userId}
  BRANCH_MANAGEMENT: '/admin/branch-management'
};

// ✅ ESTADOS DE FLUJO DE SUCURSAL
export const BRANCH_FLOW_STATES = {
  EMAIL_VERIFICATION: 'email_verification',
  VERIFICATION_FLOW: 'verification_flow', 
  NEEDS_PASSWORD: 'needs_password',
  READY_FOR_LOGIN: 'ready_for_login',
  REGISTRATION_FORM: 'registration_form',
  EMAIL_VERIFIED: 'email_verified'
};

// ✅ ESTADOS DE VERIFICACIÓN DE EMAIL
export const EMAIL_VERIFICATION_STATES = {
  NOT_VERIFIED: 'not_verified',
  PENDING: 'pending',
  VERIFIED: 'verified',
  EXPIRED: 'expired',
  INVALID: 'invalid'
};

// ✅ CÓDIGOS DE ERROR HTTP COMUNES
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500
};

// ✅ CONFIGURACIÓN DE TIMEOUTS Y LÍMITES
export const CONFIG = {
  EMAIL_VERIFICATION_TOKEN_EXPIRY: 24 * 60 * 60 * 1000, // 24 horas en ms
  RESEND_COOLDOWN: 60 * 1000, // 1 minuto en ms
  MAX_RESEND_ATTEMPTS: 3,
  LOGIN_RETRY_LIMIT: 5,
  SESSION_TIMEOUT: 8 * 60 * 60 * 1000, // 8 horas en ms
  
  // Configuración de reCAPTCHA
  RECAPTCHA_ACTIONS: {
    LOGIN: 'login',
    BRANCH_LOGIN: 'branch_login',
    REGISTER: 'register',
    BRANCH_REGISTER: 'branch_register',
    PASSWORD_RESET: 'password_reset',
    BRANCH_PASSWORD_RESET: 'branch_password_reset',
    EMAIL_VERIFICATION: 'email_verification',
    BRANCH_INITIATE_VERIFICATION: 'branch_initiate_verification',
    BRANCH_RESEND_VERIFICATION: 'branch_resend_verification'
  }
};

// ✅ RUTAS DE NAVEGACIÓN
export const ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  DASHBOARD_BRANCH: '/dashboard-branch',
  PROFILE: '/profile',
  BRANCH_PROFILE: '/branch-profile',
  PASSWORD_RESET: '/reset-password',
  BRANCH_PASSWORD_RESET: '/reset-branch-password',
  EMAIL_VERIFICATION: '/verify-email',
  BRANCH_EMAIL_VERIFICATION: '/verify-branch-email',
  RESEND_VERIFICATION: '/resend-verification'
};

// ✅ MENSAJES DE ÉXITO
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Inicio de sesión exitoso',
  LOGOUT_SUCCESS: 'Sesión cerrada exitosamente',
  REGISTRATION_SUCCESS: 'Registro completado exitosamente',
  EMAIL_VERIFICATION_SENT: 'Correo de verificación enviado',
  EMAIL_VERIFIED: 'Correo electrónico verificado exitosamente',
  PASSWORD_RESET_SENT: 'Enlace de recuperación enviado',
  PASSWORD_RESET_SUCCESS: 'Contraseña actualizada exitosamente',
  BRANCH_REGISTRATION_SUCCESS: 'Registro de sucursal completado',
  BRANCH_EMAIL_VERIFIED: 'Email de sucursal verificado exitosamente'
};