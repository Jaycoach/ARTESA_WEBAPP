import * as yup from 'yup';

// Validaciones personalizadas
const phoneRegex = /^[\+]?[\s\d\-\(\)]{7,15}$/;
const nitRegex = /^\d{8,12}$/;
const docRegex = /^\d{6,12}$/;

// Esquema de validación
export const clientProfileSchema = yup.object().shape({
  // Campos obligatorios
  razonSocial: yup
    .string()
    .required('La razón social es obligatoria')
    .min(3, 'Mínimo 3 caracteres')
    .max(100, 'Máximo 100 caracteres'),
  
  nombre: yup
    .string()
    .required('El nombre es obligatorio')
    .min(2, 'Mínimo 2 caracteres')
    .max(50, 'Máximo 50 caracteres'),
  
  telefono: yup
    .string()
    .required('El teléfono es obligatorio')
    .matches(phoneRegex, 'Formato de teléfono inválido'),
  
  email: yup
    .string()
    .required('El email es obligatorio')
    .email('Email inválido'),
  
  direccion: yup
    .string()
    .required('La dirección es obligatoria')
    .min(5, 'Mínimo 5 caracteres')
    .max(150, 'Máximo 150 caracteres'),
  
  ciudad: yup
    .string()
    .required('La ciudad es obligatoria')
    .min(2, 'Mínimo 2 caracteres')
    .max(50, 'Máximo 50 caracteres'),
  
  pais: yup
    .string()
    .required('El país es obligatorio')
    .min(2, 'Mínimo 2 caracteres')
    .max(50, 'Máximo 50 caracteres'),
  
  nit_number: yup
    .string()
    .required('El número de NIT es obligatorio')
    .matches(nitRegex, 'NIT debe contener entre 8 y 12 dígitos'),
  
  verification_digit: yup
    .string()
    .required('El dígito de verificación es obligatorio')
    .length(1, 'Debe ser un solo dígito'),
  
  // Campos opcionales
  tipoDocumento: yup
    .string()
    .oneOf(['CC', 'CE', 'PASAPORTE'], 'Tipo de documento inválido'),
  
  numeroDocumento: yup
    .string()
    .when('tipoDocumento', {
      is: (val) => val && val.length > 0,
      then: (schema) => schema
        .required('Número de documento es obligatorio')
        .matches(docRegex, 'Formato de documento inválido'),
      otherwise: (schema) => schema
    }),
  
  representanteLegal: yup
    .string()
    .max(100, 'Máximo 100 caracteres'),
  
  actividadComercial: yup
    .string()
    .max(100, 'Máximo 100 caracteres'),
  
  sectorEconomico: yup
    .string()
    .max(50, 'Máximo 50 caracteres'),
  
  tamanoEmpresa: yup
    .string()
    .oneOf(['Microempresa', 'Pequeña', 'Mediana', 'Grande'], 'Tamaño de empresa inválido'),
  
  ingresosMensuales: yup
    .string()
    .max(50, 'Máximo 50 caracteres'),
  
  patrimonio: yup
    .string()
    .max(50, 'Máximo 50 caracteres'),
  
  entidadBancaria: yup
    .string()
    .max(50, 'Máximo 50 caracteres'),
  
  tipoCuenta: yup
    .string()
    .oneOf(['Ahorros', 'Corriente'], 'Tipo de cuenta inválido'),
  
  numeroCuenta: yup
    .string()
    .max(20, 'Máximo 20 caracteres'),
  
  nombreContacto: yup
    .string()
    .max(100, 'Máximo 100 caracteres'),
  
  cargoContacto: yup
    .string()
    .max(50, 'Máximo 50 caracteres'),
  
  telefonoContacto: yup
    .string()
    .matches(phoneRegex, 'Formato de teléfono inválido'),
  
  emailContacto: yup
    .string()
    .email('Email inválido')
});

// Validación de archivos
export const validateFile = (file) => {
  const maxSize = 3 * 1024 * 1024; // 3MB
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ];
  
  if (!file) return null;
  
  if (file.size > maxSize) {
    return 'El archivo no debe superar 3MB';
  }
  
  if (!allowedTypes.includes(file.type)) {
    return 'Formato de archivo no permitido. Use PDF, JPG, PNG o DOCX';
  }
  
  return null;
};