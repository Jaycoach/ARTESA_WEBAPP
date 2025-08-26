export const AUTH_TYPES = {
  USER: 'user',
  BRANCH: 'branch'
};

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  AUTH_TYPE: 'authType',
  USER_DATA: 'userData',
  BRANCH_DATA: 'branchData'
};

export const ERROR_MESSAGES = {
  BRANCH_NOT_FOUND: 'Ha habido un error para encontrar la sucursal, por favor contacte al administrador',
  UNAUTHORIZED: 'Sin autorización para el acceso a este recurso, por favor contacte con el administrador',
  INVALID_CREDENTIALS: 'Credenciales incorrectas, por favor verifique y vuelva a intentarlo',
  NETWORK_ERROR: 'Error de conexión, por favor verifique su conexión a internet',
  UNKNOWN_ERROR: 'Ha ocurrido un error inesperado, por favor intente nuevamente'
};

export const API_ENDPOINTS = {
  BRANCH_LOGIN: '/api/branch-auth/login',
  BRANCH_LOGOUT: '/api/branch-auth/logout',
  BRANCH_PROFILE: '/api/branch-auth/profile',
  CLIENT_BRANCHES: '/api/client-branches/client',
  USER_BRANCHES: '/api/client-branches/user',
  ENABLE_BRANCH_LOGIN: '/api/admin/branches',
  DISABLE_BRANCH_LOGIN: '/api/admin/branches',
  BRANCH_VERIFY_EMAIL: '/api/branch-auth/verify-email',
  BRANCH_RESEND_VERIFICATION: '/api/branch-auth/resend-verification',
  BRANCH_PASSWORD_REQUEST_RESET: '/branch-password/request-reset',
  BRANCH_PASSWORD_RESET: '/branch-password/reset'
};