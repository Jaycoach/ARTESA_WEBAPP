import React, { useState, useEffect } from 'react';
import './ClientProfile.scss';
import API from '../../../api/config';
import { FaTimes, FaUpload, FaCheck, FaChevronRight, FaChevronLeft, 
  FaExclamationCircle, FaCheckCircle, FaFileAlt, FaCircle, FaChevronDown } from 'react-icons/fa';
import { useAuth } from '../../../hooks/useAuth';
import './ConfirmationModal.scss';
import FieldValidation from './FieldValidation';
import ConfirmationModal from './ConfirmationModal';

const ClientProfile = ({ onClose, onProfileUpdate }) => {
  // Estados para manejar los pasos del formulario
  const steps = ["Información de contacto", "Información Empresarial", "Información Financiera", "Información Bancaria", "Documentos"];
  const [currentStep, setCurrentStep] = useState(0);
  
  // Obtener contexto de autenticación
  const { user, updateUserInfo } = useAuth();
  
  // Estado inicial del formulario - MANTENER TODA LA LÓGICA ORIGINAL
  const [formData, setFormData] = useState({
    // Datos básicos
    nombre: '',
    tipoDocumento: 'CC',
    numeroDocumento: '',
    direccion: '',
    ciudad: '',
    pais: 'Colombia',
    telefono: '',
    contact_email: '',
    
    // Información empresarial
    razonSocial: '',
    nit: '',
    digitoVerificacion: '',
    representanteLegal: '',
    actividadComercial: '',
    sectorEconomico: '',
    tamanoEmpresa: 'Microempresa',
    
    // Información financiera
    ingresosMensuales: '',
    patrimonio: '',
    
    // Información bancaria
    entidadBancaria: '',
    tipoCuenta: 'Ahorros',
    numeroCuenta: '',
    
    // Información de contacto alternativo
    nombreContacto: '',
    cargoContacto: '',
    telefonoContacto: '',
    emailContacto: '',
    
    // Archivos
    fotocopiaCedula: null,
    fotocopiaRut: null,
    anexosAdicionales: null
  });

  // Estados para UI y control - MANTENER TODOS
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [existingProfile, setExistingProfile] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    basic: true,
    business: false,
    financial: false,
    banking: false,
    documents: false
  });
  const [confirmationIsSuccess, setConfirmationIsSuccess] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [isFormLocked, setIsFormLocked] = useState(false);
  const [debugInfo, setDebugInfo] = useState({});

  // ESTILOS VISUALES MEJORADOS
  const modalStyles = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    },
    container: {
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      maxWidth: '900px',
      width: '100%',
      maxHeight: '90vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative'
    },
    header: {
      padding: '24px 32px',
      borderBottom: '1px solid #e5e7eb',
      backgroundColor: '#f8fafc',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      flexShrink: 0
    },
    scrollContent: {
      flex: 1,
      overflowY: 'auto',
      padding: '32px',
      backgroundColor: '#ffffff'
    },
    footer: {
      padding: '20px 32px',
      borderTop: '1px solid #e5e7eb',
      backgroundColor: '#f8fafc',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexShrink: 0
    }
  };

  const labelStyles = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '8px'
  };

  const inputStyles = {
    width: '100%',
    padding: '12px 16px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '0.875rem',
    color: '#1f2937',
    backgroundColor: '#ffffff',
    transition: 'all 0.2s ease',
    outline: 'none'
  };

  // MANTENER TODAS LAS FUNCIONES ORIGINALES
  const getUserId = () => {
    // Debug information
    const userDebugInfo = {
      contextUser: user ? { ...user } : null,
      localStorage: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')) : null
    };
    setDebugInfo(userDebugInfo);
    console.log("DEBUG - getUserId - Estado actual user:", userDebugInfo);

    // 1. Intentar obtener del contexto
    if (user) {
      if (user.id) {
        console.log("DEBUG - ID encontrado en contexto user.id:", user.id);
        return user.id;
      }
      if (user._id) {
        console.log("DEBUG - ID encontrado en contexto user._id:", user._id);
        return user._id;
      }
    }
    
    // 2. Intentar obtener del localStorage (respaldo)
    try {
      const storedUserString = localStorage.getItem('user');
      if (storedUserString) {
        const storedUser = JSON.parse(storedUserString);
        console.log("DEBUG - Usuario recuperado de localStorage:", storedUser);
        
        if (storedUser.id) {
          console.log("DEBUG - ID encontrado en localStorage user.id:", storedUser.id);
          return storedUser.id;
        }
        if (storedUser._id) {
          console.log("DEBUG - ID encontrado en localStorage user._id:", storedUser._id);
          return storedUser._id;
        }
      }
    } catch (e) {
      console.error("Error al parsear usuario del localStorage:", e);
    }
    
    // 3. Intentar obtener del token JWT (última opción)
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const payload = token.split('.')[1];
        const decodedPayload = JSON.parse(atob(payload));
        console.log("DEBUG - Payload decodificado del token:", decodedPayload);
        
        if (decodedPayload && decodedPayload.id) {
          console.log("DEBUG - ID encontrado en token JWT:", decodedPayload.id);
          return decodedPayload.id;
        }
      }
    } catch (e) {
      console.error("Error al decodificar token:", e);
    }
    
    console.log("DEBUG - No se pudo encontrar ID de usuario en ninguna fuente");
    return null;
  };

  // Función para alternar secciones expandibles
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Efecto para cargar el perfil del usuario - MANTENER LÓGICA COMPLETA
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userId = getUserId();
        
        if (!userId) {
          console.log("No hay ID de usuario para buscar perfil");
          const userFromContext = user || JSON.parse(localStorage.getItem('user') || '{}');
          if (userFromContext) {
            setFormData(prev => ({
              ...prev,
              email: userFromContext.mail || userFromContext.email || '',
              nombre: userFromContext.nombre || userFromContext.name || ''
            }));
          }
          return;
        }

        console.log("Intentando obtener perfil para usuario ID:", userId);
        
        const response = await API.get(`/client-profiles/user/${userId}`);
        console.log("Respuesta completa de API:", response);
        
        if (response && response.data) {
          const profileData = response.data.data || response.data;
          console.log("Datos de perfil recibidos:", profileData);
          
          if (profileData?.nit_number && profileData?.verification_digit) {
            setIsFormLocked(true);
          }
          
          const formDataUpdate = {
            nombre: profileData.nombre || profileData.name || '',
            direccion: profileData.direccion || profileData.address || '',
            ciudad: profileData.ciudad || profileData.city || '',
            pais: profileData.pais || profileData.country || 'Colombia',
            telefono: profileData.telefono || profileData.phone || '',
            email: profileData.email || user?.email || user?.mail || '',
            razonSocial: profileData.razonSocial || profileData.business_name || '',
            nit: profileData.nit_number || profileData.nit || '',
            digitoVerificacion: profileData.verification_digit || profileData.digitoVerificacion || '',
          };
          
          if (profileData.notes) {
            try {
              const additionalData = JSON.parse(profileData.notes);
              console.log("Datos adicionales encontrados en notes:", additionalData);
              Object.assign(formDataUpdate, additionalData);
            } catch (e) {
              console.error("Error al parsear notes:", e);
            }
          }
          
          [
            'tipoDocumento', 'numeroDocumento', 'representanteLegal',
            'actividadComercial', 'sectorEconomico', 'tamanoEmpresa',
            'ingresosMensuales', 'patrimonio', 'entidadBancaria',
            'tipoCuenta', 'numeroCuenta', 'nombreContacto',
            'cargoContacto', 'telefonoContacto', 'emailContacto'
          ].forEach(field => {
            if (profileData[field]) {
              formDataUpdate[field] = profileData[field];
            }
          });
          
          console.log("Actualizando formulario con datos:", formDataUpdate);
          setFormData(prev => ({
            ...prev,
            ...formDataUpdate,
          }));
          
          setExistingProfile(profileData);
          console.log('Perfil cargado exitosamente desde la API');
        }
      } catch (error) {
        console.error('Error al obtener perfil:', error);
        
        if (error.response) {
          console.error('Respuesta de error:', error.response.status, error.response.data);
        } else if (error.request) {
          console.error('Error de solicitud (sin respuesta):', error.request);
        } else {
          console.error('Error:', error.message);
        }
        
        const userFromContext = user || JSON.parse(localStorage.getItem('user') || '{}');
        if (userFromContext) {
          setFormData(prev => ({
            ...prev,
            email: userFromContext.mail || userFromContext.email || '',
            nombre: userFromContext.nombre || userFromContext.name || ''
          }));
        }
      }
    };

    fetchProfile();
  }, [user]);

  // MANTENER TODAS LAS FUNCIONES DE NAVEGACIÓN Y VALIDACIÓN
  const nextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
      
      const sectionNames = ['basic', 'business', 'financial', 'banking', 'documents'];
      if (currentStep < steps.length - 1) {
        setExpandedSections({
          ...Object.fromEntries(sectionNames.map(name => [name, false])),
          [sectionNames[currentStep + 1]]: true
        });
      }
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  
  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
    
    const sectionNames = ['basic', 'business', 'financial', 'banking', 'documents'];
    if (currentStep > 0) {
      setExpandedSections({
        ...Object.fromEntries(sectionNames.map(name => [name, false])),
        [sectionNames[currentStep - 1]]: true
      });
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const validateCurrentStep = () => {
    const errors = {};
    
    if (currentStep === 0) {
      if (!formData.nombre) errors.nombre = "El nombre es requerido";
      if (!formData.numeroDocumento) errors.numeroDocumento = "El número de documento es requerido";
      if (!formData.direccion) errors.direccion = "La dirección es requerida";
      if (!formData.ciudad) errors.ciudad = "La ciudad es requerida";
      if (!formData.pais) errors.pais = "El país es requerido";
      if (!formData.telefono) errors.telefono = "El teléfono es requerido";
      if (!formData.email) errors.email = "El correo electrónico es requerido";
      else if (!/^\S+@\S+\.\S+$/.test(formData.email)) errors.email = "El correo electrónico no es válido";
    } else if (currentStep === 1) {
      if (formData.nit && !/^\d{8,12}$/.test(formData.nit)) {
        errors.nit = "El NIT debe contener entre 8 y 12 dígitos numéricos";
      }
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }

    if (name === 'nit') {
      if (value && !/^\d+$/.test(value)) {
        setFieldErrors(prev => ({
          ...prev,
          nit: 'El NIT debe contener solo números enteros'
        }));
      }
      setFormData(prev => ({
        ...prev,
        [name]: /^\d*$/.test(value) ? value : prev[name]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: files[0]
    }));
  };

  const handleConfirmationClose = () => {
    setShowConfirmation(false);
    if (confirmationIsSuccess) {
      onClose();
    }
  };

  // MANTENER TODA LA LÓGICA DE ENVÍO
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (formData.nit && !/^\d+$/.test(formData.nit)) {
      setFieldErrors(prev => ({
        ...prev,
        nit: 'El NIT debe contener solo números enteros'
      }));
      setError('Hay errores en el formulario. Por favor verifique los campos marcados en rojo.');
      setLoading(false);
      return;
    }

    if (formData.digitoVerificacion && (!/^[0-9]$/.test(formData.digitoVerificacion))) {
      setError('El dígito de verificación debe ser un número entre 0 y 9');
      setLoading(false);
      return;
    }

    let taxId = '';
    if (formData.nit) {
      taxId = formData.nit;
      if (formData.digitoVerificacion) {
        taxId += '-' + formData.digitoVerificacion;
      }
    }

    try {
      const formDataToSend = new FormData();
      
      formDataToSend.append('nit_number', formData.nit || '');
      formDataToSend.append('verification_digit', formData.digitoVerificacion || '');
      formDataToSend.append('tax_id', taxId);
      
      Object.keys(formData).forEach(key => {
        if (key === 'fotocopiaCedula' || key === 'fotocopiaRut' || key === 'anexosAdicionales') {
          if (formData[key]) {
            formDataToSend.append(key, formData[key]);
          }
        } else {
          formDataToSend.append(key, formData[key]);
        }
      });

      const userId = getUserId();
      if (!userId) {
        throw new Error("No se pudo determinar el ID del usuario");
      }
      
      formDataToSend.append('userId', userId);

      const endpoint = existingProfile
        ? `/client-profiles/user/${userId}`
        : '/client-profiles';
      const method = existingProfile ? 'put' : 'post';

      console.log(`Enviando datos al endpoint: ${endpoint} con método: ${method}`);

      const response = await API({
        method,
        url: endpoint,
        data: formDataToSend,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log("Respuesta de guardado:", response.data);

      const savedData = response.data?.data || response.data;

      const updatedUserData = {
        nombre: formData.nombre,
        email: formData.email,
        telefono: formData.telefono,
        direccion: formData.direccion,
        ciudad: formData.ciudad
      };

      localStorage.setItem('clientProfile', JSON.stringify({
        nombre: formData.nombre,
        email: formData.email
      }));

      if (typeof updateUserInfo === 'function') {
        updateUserInfo(updatedUserData);
      }

      if (typeof onProfileUpdate === 'function') {
        onProfileUpdate(formData.nombre);
      }

      setSuccess('Perfil guardado correctamente');
      setExistingProfile(savedData);
      setConfirmationIsSuccess(true);
      setConfirmationMessage('Datos Almacenados Correctamente');
      setShowConfirmation(true);

    } catch (error) {
      console.error('Error al guardar perfil:', error);
      
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Error al guardar el perfil';
      setError(errorMessage);
      setConfirmationIsSuccess(false);
      setConfirmationMessage('Datos Incorrectos. Por favor verifique la información proporcionada.');
      setShowConfirmation(true);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.container} onClick={(e) => e.stopPropagation()}>
        {/* Header con estilos mejorados */}
        <div style={modalStyles.header}>
          <div>
            <h2 style={{ color: '#1f2937', margin: 0, fontSize: '1.5rem', fontWeight: '700', marginBottom: '8px' }}>
              Perfil de Cliente
            </h2>
            <p style={{ color: '#6b7280', margin: 0, fontSize: '0.875rem' }}>
              Complete su información para continuar
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{ 
              color: '#6b7280', 
              background: 'none', 
              border: 'none', 
              fontSize: '1.5rem', 
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            <FaTimes />
          </button>
        </div>

        {/* Contenido scrollable */}
        <div style={modalStyles.scrollContent} className="modal-scroll-content">
          {/* Indicador de pasos mejorado */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '32px',
            padding: '0 8px',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            {/* Barra de progreso */}
            <div style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              right: '20px',
              height: '4px',
              backgroundColor: '#e5e7eb',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                backgroundColor: '#f59e0b',
                width: `${((currentStep + 1) / steps.length) * 100}%`,
                transition: 'width 0.3s ease',
                borderRadius: '2px'
              }} />
            </div>

            {steps.map((step, index) => (
              <div key={index} style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
                minWidth: '120px',
                position: 'relative',
                paddingTop: '24px'
              }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    backgroundColor: index < currentStep ? '#16a34a' : index === currentStep ? '#f59e0b' : '#e5e7eb',
                    color: index <= currentStep ? 'white' : '#6b7280',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: '600',
                    marginBottom: '8px',
                    transition: 'all 0.3s ease',
                    border: index === currentStep ? '3px solid #fde68a' : 'none'
                  }}
                >
                  {index < currentStep ? '✓' : index + 1}
                </div>
                <span style={{
                  fontSize: '0.75rem',
                  textAlign: 'center',
                  color: index <= currentStep ? '#f59e0b' : '#6b7280',
                  fontWeight: '500',
                  lineHeight: '1.3'
                }}>
                  {step}
                </span>
              </div>
            ))}
          </div>

          {/* Mensajes de estado */}
          {error && (
            <div style={{ 
              backgroundColor: '#fef2f2', 
              color: '#dc2626', 
              padding: '16px', 
              borderRadius: '8px', 
              marginBottom: '24px', 
              border: '1px solid #fecaca', 
              borderLeft: '4px solid #dc2626',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <FaExclamationCircle style={{ marginTop: '2px', flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div style={{ 
              backgroundColor: '#f0fdf4', 
              color: '#16a34a', 
              padding: '16px', 
              borderRadius: '8px', 
              marginBottom: '24px', 
              border: '1px solid #bbf7d0', 
              borderLeft: '4px solid #16a34a',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}>
              <FaCheckCircle style={{ marginTop: '2px', flexShrink: 0 }} />
              <span>{success}</span>
            </div>
          )}

          {isFormLocked && (
            <div style={{ 
              backgroundColor: '#fffbeb', 
              border: '1px solid #fde68a', 
              borderLeft: '4px solid #f59e0b', 
              borderRadius: '8px', 
              padding: '16px', 
              marginBottom: '24px' 
            }}>
              <h3 style={{ 
                color: '#92400e', 
                margin: '0 0 8px 0', 
                fontSize: '1rem', 
                fontWeight: '600' 
              }}>
                Perfil Sincronizado
              </h3>
              <p style={{ 
                color: '#b45309', 
                margin: 0, 
                fontSize: '0.875rem', 
                lineHeight: '1.5' 
              }}>
                Este perfil ya ha sido sincronizado con SAP y no puede ser modificado.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Paso 1: Información de contacto */}
            {currentStep === 0 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
                  <div 
                    style={{
                      backgroundColor: '#f0f9ff',
                      padding: '16px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer'
                    }}
                    onClick={() => toggleSection('basic')}
                  >
                    <h3 style={{ color: '#1f2937', margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>
                      Información de contacto
                    </h3>
                    <div style={{ 
                      transform: expandedSections.basic ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.3s ease'
                    }}>
                      <FaChevronDown style={{ color: '#6b7280' }} />
                    </div>
                  </div>
                  
                  <div style={{
                    transition: 'all 0.3s ease',
                    overflow: 'hidden',
                    maxHeight: expandedSections.basic ? '2000px' : '0',
                    opacity: expandedSections.basic ? 1 : 0
                  }}>
                    <div style={{ padding: '24px' }}>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                        gap: '20px', 
                        marginBottom: '20px' 
                      }}>
                        <div>
                          <label style={labelStyles}>Nombre Completo*</label>
                          <input
                            type="text"
                            name="nombre"
                            value={formData.nombre}
                            onChange={handleChange}
                            onFocus={() => setFocusedField('nombre')}
                            onBlur={() => setFocusedField(null)}
                            disabled={isFormLocked}
                            required
                            style={{
                              ...inputStyles,
                              border: fieldErrors.nombre ? '1px solid #dc2626' : focusedField === 'nombre' ? '2px solid #3b82f6' : '1px solid #d1d5db',
                              backgroundColor: isFormLocked ? '#f9fafb' : '#ffffff'
                            }}
                            placeholder="Ingrese su nombre completo"
                          />
                          {fieldErrors.nombre && (
                            <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                              {fieldErrors.nombre}
                            </span>
                          )}
                        </div>

                        <div>
                          <label style={labelStyles}>Tipo de Documento*</label>
                          <select
                            name="tipoDocumento"
                            value={formData.tipoDocumento}
                            onChange={handleChange}
                            onFocus={() => setFocusedField('tipoDocumento')}
                            onBlur={() => setFocusedField(null)}
                            disabled={isFormLocked}
                            required
                            style={{
                              ...inputStyles,
                              border: focusedField === 'tipoDocumento' ? '2px solid #3b82f6' : '1px solid #d1d5db',
                              backgroundColor: isFormLocked ? '#f9fafb' : '#ffffff',
                              cursor: isFormLocked ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <option value="CC">Cédula de Ciudadanía</option>
                            <option value="CE">Cédula de Extranjería</option>
                            <option value="PASAPORTE">Pasaporte</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                        gap: '20px', 
                        marginBottom: '20px' 
                      }}>
                        <div>
                          <label style={labelStyles}>Número de Documento*</label>
                          <input
                            type="text"
                            name="numeroDocumento"
                            value={formData.numeroDocumento}
                            onChange={handleChange}
                            onFocus={() => setFocusedField('numeroDocumento')}
                            onBlur={() => setFocusedField(null)}
                            disabled={isFormLocked}
                            required
                            style={{
                              ...inputStyles,
                              border: fieldErrors.numeroDocumento ? '1px solid #dc2626' : focusedField === 'numeroDocumento' ? '2px solid #3b82f6' : '1px solid #d1d5db',
                              backgroundColor: isFormLocked ? '#f9fafb' : '#ffffff'
                            }}
                            placeholder="Número de documento"
                          />
                          {fieldErrors.numeroDocumento && (
                            <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                              {fieldErrors.numeroDocumento}
                            </span>
                          )}
                        </div>

                        <div>
                          <label style={labelStyles}>Teléfono*</label>
                          <input
                            type="tel"
                            name="telefono"
                            value={formData.telefono}
                            onChange={handleChange}
                            onFocus={() => setFocusedField('telefono')}
                            onBlur={() => setFocusedField(null)}
                            disabled={isFormLocked}
                            required
                            style={{
                              ...inputStyles,
                              border: fieldErrors.telefono ? '1px solid #dc2626' : focusedField === 'telefono' ? '2px solid #3b82f6' : '1px solid #d1d5db',
                              backgroundColor: isFormLocked ? '#f9fafb' : '#ffffff'
                            }}
                            placeholder="Número de teléfono"
                          />
                          {fieldErrors.telefono && (
                            <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                              {fieldErrors.telefono}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ marginBottom: '20px' }}>
                        <label style={labelStyles}>Correo Electrónico*</label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          onFocus={() => setFocusedField('email')}
                          onBlur={() => setFocusedField(null)}
                          required
                          readOnly
                          style={{
                            ...inputStyles,
                            border: fieldErrors.email ? '1px solid #dc2626' : '1px solid #d1d5db',
                            backgroundColor: '#f9fafb',
                            color: '#1f2937'
                          }}
                          placeholder="correo@ejemplo.com"
                        />
                        {fieldErrors.email && (
                          <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                            {fieldErrors.email}
                          </span>
                        )}
                      </div>

                      <div style={{ marginBottom: '20px' }}>
                        <label style={labelStyles}>Dirección*</label>
                        <input
                          type="text"
                          name="direccion"
                          value={formData.direccion}
                          onChange={handleChange}
                          onFocus={() => setFocusedField('direccion')}
                          onBlur={() => setFocusedField(null)}
                          disabled={isFormLocked}
                          required
                          style={{
                            ...inputStyles,
                            border: fieldErrors.direccion ? '1px solid #dc2626' : focusedField === 'direccion' ? '2px solid #3b82f6' : '1px solid #d1d5db',
                            backgroundColor: isFormLocked ? '#f9fafb' : '#ffffff'
                          }}
                          placeholder="Dirección completa"
                        />
                        {fieldErrors.direccion && (
                          <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                            {fieldErrors.direccion}
                          </span>
                        )}
                      </div>

                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                        gap: '20px'
                      }}>
                        <div>
                          <label style={labelStyles}>Ciudad*</label>
                          <input
                            type="text"
                            name="ciudad"
                            value={formData.ciudad}
                            onChange={handleChange}
                            onFocus={() => setFocusedField('ciudad')}
                            onBlur={() => setFocusedField(null)}
                            disabled={isFormLocked}
                            required
                            style={{
                              ...inputStyles,
                              border: fieldErrors.ciudad ? '1px solid #dc2626' : focusedField === 'ciudad' ? '2px solid #3b82f6' : '1px solid #d1d5db',
                              backgroundColor: isFormLocked ? '#f9fafb' : '#ffffff'
                            }}
                            placeholder="Ciudad"
                          />
                          {fieldErrors.ciudad && (
                            <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                              {fieldErrors.ciudad}
                            </span>
                          )}
                        </div>

                        <div>
                          <label style={labelStyles}>País*</label>
                          <input
                            type="text"
                            name="pais"
                            value={formData.pais}
                            onChange={handleChange}
                            onFocus={() => setFocusedField('pais')}
                            onBlur={() => setFocusedField(null)}
                            disabled={isFormLocked}
                            required
                            style={{
                              ...inputStyles,
                              border: fieldErrors.pais ? '1px solid #dc2626' : focusedField === 'pais' ? '2px solid #3b82f6' : '1px solid #d1d5db',
                              backgroundColor: isFormLocked ? '#f9fafb' : '#ffffff'
                            }}
                            placeholder="País"
                          />
                          {fieldErrors.pais && (
                            <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                              {fieldErrors.pais}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Paso 2: Información Empresarial */}
            {currentStep === 1 && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)' }}>
                  <div
                    style={{
                      backgroundColor: '#fef3c7',
                      padding: '16px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer'
                    }}
                    onClick={() => toggleSection('business')}
                  >
                    <h3 style={{ color: '#1f2937', margin: 0, fontSize: '1.125rem', fontWeight: '600' }}>
                      Información Empresarial
                    </h3>
                    <div style={{
                      transform: expandedSections.business ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.3s ease'
                    }}>
                      <FaChevronDown style={{ color: '#6b7280' }} />
                    </div>
                  </div>

                  <div style={{
                    transition: 'all 0.3s ease',
                    overflow: 'hidden',
                    maxHeight: expandedSections.business ? '2000px' : '0',
                    opacity: expandedSections.business ? 1 : 0
                  }}>
                    <div style={{ padding: '24px' }}>
                      <div style={{ marginBottom: '20px' }}>
                        <label style={labelStyles}>Razón Social</label>
                        <input
                          type="text"
                          name="razonSocial"
                          value={formData.razonSocial}
                          onChange={handleChange}
                          onFocus={() => setFocusedField('razonSocial')}
                          onBlur={() => setFocusedField(null)}
                          disabled={isFormLocked}
                          style={{
                            ...inputStyles,
                            border: focusedField === 'razonSocial' ? '2px solid #6366f1' : '1px solid #d1d5db',
                            backgroundColor: isFormLocked ? '#f9fafb' : '#ffffff'
                          }}
                          placeholder="Nombre de la empresa o razón social"
                        />
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr',
                        gap: '20px',
                        marginBottom: '20px'
                      }}>
                        <div>
                          <label style={labelStyles}>NIT (Sin dígito de verificación)</label>
                          <input
                            type="text"
                            name="nit"
                            value={formData.nit}
                            onChange={handleChange}
                            onFocus={() => setFocusedField('nit')}
                            onBlur={() => setFocusedField(null)}
                            disabled={isFormLocked}
                            style={{
                              ...inputStyles,
                              border: fieldErrors.nit ? '1px solid #dc2626' : focusedField === 'nit' ? '2px solid #6366f1' : '1px solid #d1d5db',
                              backgroundColor: isFormLocked ? '#f9fafb' : '#ffffff'
                            }}
                            placeholder="Ej: 900123456"
                          />
                          {fieldErrors.nit ? (
                            <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                              {fieldErrors.nit}
                            </span>
                          ) : (
                            <FieldValidation
                              field="nit"
                              value={formData.nit}
                              rules={[
                                { text: "Solo dígitos numéricos", validate: val => !val || /^\d+$/.test(val) },
                                { text: "Entre 8 y 12 caracteres", validate: val => !val || (val.length >= 8 && val.length <= 12) }
                              ]}
                            />
                          )}
                        </div>

                        <div>
                          <label style={labelStyles}>Dígito de Verificación</label>
                          <input
                            type="text"
                            name="digitoVerificacion"
                            value={formData.digitoVerificacion}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '' || /^[0-9]$/.test(value)) {
                                handleChange(e);
                              }
                            }}
                            onFocus={() => setFocusedField('digitoVerificacion')}
                            onBlur={() => setFocusedField(null)}
                            maxLength="1"
                            pattern="[0-9]"
                            disabled={isFormLocked}
                            style={{
                              ...inputStyles,
                              border: focusedField === 'digitoVerificacion' ? '2px solid #6366f1' : '1px solid #d1d5db',
                              backgroundColor: isFormLocked ? '#f9fafb' : '#ffffff',
                              textAlign: 'center'
                            }}
                            placeholder="Ej: 7"
                          />
                        </div>
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: '20px',
                        marginBottom: '20px'
                      }}>
                        <div>
                          <label style={labelStyles}>Representante Legal</label>
                          <input
                            type="text"
                            name="representanteLegal"
                            value={formData.representanteLegal}
                            onChange={handleChange}
                            disabled={isFormLocked}
                            style={{
                              ...inputStyles,
                              backgroundColor: isFormLocked ? '#f9fafb' : '#ffffff'
                            }}
                            placeholder="Nombre del representante legal"
                          />
                        </div>

                        <div>
                          <label style={labelStyles}>Actividad Comercial</label>
                          <input
                            type="text"
                            name="actividadComercial"
                            value={formData.actividadComercial}
                            onChange={handleChange}
                            disabled={isFormLocked}
                            style={{
                              ...inputStyles,
                              backgroundColor: isFormLocked ? '#f9fafb' : '#ffffff'
                            }}
                            placeholder="Actividad principal de la empresa"
                          />
                        </div>
                      </div>

                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minWidth(280px, 1fr))',
                        gap: '20px'
                      }}>
                        <div>
                          <label style={labelStyles}>Sector Económico</label>
                          <input
                            type="text"
                            name="sectorEconomico"
                            value={formData.sectorEconomico}
                            onChange={handleChange}
                            disabled={isFormLocked}
                            style={{
                              ...inputStyles,
                              backgroundColor: isFormLocked ? '#f9fafb' : '#ffffff'
                            }}
                            placeholder="Ej: Comercial, Industrial, Servicios"
                          />
                        </div>

                        <div>
                          <label style={labelStyles}>Tamaño de Empresa</label>
                          <select
                            name="tamanoEmpresa"
                            value={formData.tamanoEmpresa}
                            onChange={handleChange}
                            disabled={isFormLocked}
                            style={{
                              ...inputStyles,
                              backgroundColor: isFormLocked ? '#f9fafb' : '#ffffff',
                              cursor: isFormLocked ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <option value="Microempresa">Microempresa</option>
                            <option value="Pequeña">Pequeña</option>
                            <option value="Mediana">Mediana</option>
                            <option value="Grande">Grande</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Paso 3: Información Financiera */}
            {currentStep === 2 && (
              <div style={{ 
                backgroundColor: '#f9fafb', 
                borderRadius: '12px', 
                padding: '24px', 
                border: '1px solid #e5e7eb' 
              }}>
                <h3 style={{ 
                  color: '#1f2937', 
                  marginTop: 0, 
                  marginBottom: '20px', 
                  fontSize: '1.25rem', 
                  fontWeight: '600', 
                  borderBottom: '2px solid #e5e7eb', 
                  paddingBottom: '12px' 
                }}>
                  Información Financiera
                </h3>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                  gap: '20px'
                }}>
                  <div>
                    <label style={labelStyles}>Ingresos Mensuales Aproximados</label>
                    <input
                      type="text"
                      name="ingresosMensuales"
                      value={formData.ingresosMensuales}
                      onChange={handleChange}
                      disabled={isFormLocked}
                      style={{
                        ...inputStyles,
                        backgroundColor: isFormLocked ? '#f9fafb' : '#ffffff'
                      }}
                      placeholder="Ej: $5,000,000"
                    />
                  </div>

                  <div>
                    <label style={labelStyles}>Patrimonio Aproximado</label>
                    <input
                      type="text"
                      name="patrimonio"
                      value={formData.patrimonio}
                      onChange={handleChange}
                      disabled={isFormLocked}
                      style={{
                        ...inputStyles,
                        backgroundColor: isFormLocked ? '#f9fafb' : '#ffffff'
                      }}
                      placeholder="Ej: $50,000,000"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Paso 4: Información Bancaria */}
            {currentStep === 3 && (
              <div style={{ 
                backgroundColor: '#f9fafb', 
                borderRadius: '12px', 
                padding: '24px', 
                border: '1px solid #e5e7eb' 
              }}>
                <h3 style={{ 
                  color: '#1f2937', 
                  marginTop: 0, 
                  marginBottom: '20px', 
                  fontSize: '1.25rem', 
                  fontWeight: '600', 
                  borderBottom: '2px solid #e5e7eb', 
                  paddingBottom: '12px' 
                }}>
                  Información Bancaria
                </h3>

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                  gap: '20px', 
                  marginBottom: '20px' 
                }}>
                  <div>
                    <label style={labelStyles}>Entidad Bancaria</label>
                    <input
                      type="text"
                      name="entidadBancaria"
                      value={formData.entidadBancaria}
                      onChange={handleChange}
                      disabled={isFormLocked}
                      style={{
                        ...inputStyles,
                        backgroundColor: isFormLocked ? '#f9fafb' : '#ffffff'
                      }}
                      placeholder="Nombre del banco"
                    />
                  </div>

                  <div>
                    <label style={labelStyles}>Tipo de Cuenta</label>
                    <select
                      name="tipoCuenta"
                      value={formData.tipoCuenta}
                      onChange={handleChange}
                      disabled={isFormLocked}
                      style={{
                        ...inputStyles,
                        backgroundColor: isFormLocked ? '#f9fafb' : '#ffffff',
                        cursor: isFormLocked ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <option value="Ahorros">Ahorros</option>
                      <option value="Corriente">Corriente</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={labelStyles}>Número de Cuenta</label>
                  <input
                    type="text"
                    name="numeroCuenta"
                    value={formData.numeroCuenta}
                    onChange={handleChange}
                    disabled={isFormLocked}
                    style={{
                      ...inputStyles,
                      backgroundColor: isFormLocked ? '#f9fafb' : '#ffffff'
                    }}
                    placeholder="Número de cuenta bancaria"
                  />
                </div>
              </div>
            )}

            {/* Paso 5: Documentos */}
            {currentStep === 4 && (
              <div style={{ 
                backgroundColor: '#f9fafb', 
                borderRadius: '12px', 
                padding: '24px', 
                border: '1px solid #e5e7eb' 
              }}>
                <h3 style={{ 
                  color: '#1f2937', 
                  marginTop: 0, 
                  marginBottom: '20px', 
                  fontSize: '1.25rem', 
                  fontWeight: '600', 
                  borderBottom: '2px solid #e5e7eb', 
                  paddingBottom: '12px' 
                }}>
                  Documentos Requeridos
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <label style={labelStyles}>Fotocopia de Cédula*</label>
                    <div style={{ position: 'relative', marginTop: '8px' }}>
                      <input
                        type="file"
                        name="fotocopiaCedula"
                        onChange={handleFileChange}
                        disabled={isFormLocked}
                        accept=".pdf,.jpg,.jpeg,.png"
                        required={!existingProfile?.fotocopiaCedula}
                        style={{ 
                          position: 'absolute', 
                          top: 0, 
                          left: 0, 
                          width: '100%', 
                          height: '100%', 
                          opacity: 0, 
                          cursor: 'pointer', 
                          zIndex: 2 
                        }}
                      />
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px', 
                        padding: '12px 16px', 
                        backgroundColor: '#f3f4f6', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '8px', 
                        fontSize: '0.875rem', 
                        cursor: 'pointer', 
                        transition: 'all 0.2s ease',
                        color: '#374151'
                      }}>
                        <FaUpload />
                        <span>{formData.fotocopiaCedula ? formData.fotocopiaCedula.name : 'Seleccionar archivo'}</span>
                      </div>
                    </div>
                    {formData.fotocopiaCedula && (
                      <span style={{ 
                        color: '#16a34a', 
                        fontSize: '0.75rem', 
                        marginTop: '8px', 
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <FaCheck /> Archivo seleccionado
                      </span>
                    )}
                  </div>

                  <div>
                    <label style={labelStyles}>Fotocopia de RUT*</label>
                    <div style={{ position: 'relative', marginTop: '8px' }}>
                      <input
                        type="file"
                        name="fotocopiaRut"
                        onChange={handleFileChange}
                        disabled={isFormLocked}
                        accept=".pdf,.jpg,.jpeg,.png"
                        required={!existingProfile?.fotocopiaRut}
                        style={{ 
                          position: 'absolute', 
                          top: 0, 
                          left: 0, 
                          width: '100%', 
                          height: '100%', 
                          opacity: 0, 
                          cursor: 'pointer', 
                          zIndex: 2 
                        }}
                      />
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px', 
                        padding: '12px 16px', 
                        backgroundColor: '#f3f4f6', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '8px', 
                        fontSize: '0.875rem', 
                        cursor: 'pointer', 
                        transition: 'all 0.2s ease',
                        color: '#374151'
                      }}>
                        <FaUpload />
                        <span>{formData.fotocopiaRut ? formData.fotocopiaRut.name : 'Seleccionar archivo'}</span>
                      </div>
                    </div>
                    {formData.fotocopiaRut && (
                      <span style={{ 
                        color: '#16a34a', 
                        fontSize: '0.75rem', 
                        marginTop: '8px', 
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <FaCheck /> Archivo seleccionado
                      </span>
                    )}
                  </div>

                  <div>
                    <label style={labelStyles}>Anexos Adicionales (Opcional)</label>
                    <div style={{ position: 'relative', marginTop: '8px' }}>
                      <input
                        type="file"
                        name="anexosAdicionales"
                        onChange={handleFileChange}
                        disabled={isFormLocked}
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        style={{ 
                          position: 'absolute', 
                          top: 0, 
                          left: 0, 
                          width: '100%', 
                          height: '100%', 
                          opacity: 0, 
                          cursor: 'pointer', 
                          zIndex: 2 
                        }}
                      />
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px', 
                        padding: '12px 16px', 
                        backgroundColor: '#f3f4f6', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '8px', 
                        fontSize: '0.875rem', 
                        cursor: 'pointer', 
                        transition: 'all 0.2s ease',
                        color: '#374151'
                      }}>
                        <FaUpload />
                        <span>{formData.anexosAdicionales ? formData.anexosAdicionales.name : 'Seleccionar archivo'}</span>
                      </div>
                    </div>
                    {formData.anexosAdicionales && (
                      <span style={{ 
                        color: '#16a34a', 
                        fontSize: '0.75rem', 
                        marginTop: '8px', 
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <FaCheck /> Archivo seleccionado
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer con botones */}
        <div style={modalStyles.footer}>
          <div style={{ display: 'flex', gap: '12px' }}>
            {currentStep > 0 && (
              <button
                type="button"
                onClick={prevStep}
                disabled={loading}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  fontWeight: '500',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: '1px solid #d1d5db',
                  outline: 'none',
                  backgroundColor: '#f9fafb',
                  color: '#374151',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <FaChevronLeft />
                Anterior
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '12px 20px',
                borderRadius: '8px',
                fontWeight: '500',
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                border: '1px solid #d1d5db',
                outline: 'none',
                backgroundColor: '#f9fafb',
                color: '#374151'
              }}
            >
              Cancelar
            </button>

            {currentStep < steps.length - 1 ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={loading || !validateCurrentStep()}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  fontWeight: '500',
                  fontSize: '0.875rem',
                  cursor: (loading || !validateCurrentStep()) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  border: 'none',
                  outline: 'none',
                  backgroundColor: (loading || !validateCurrentStep()) ? '#d1d5db' : '#f59e0b',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: (loading || !validateCurrentStep()) ? 0.6 : 1
                }}
              >
                Siguiente
                <FaChevronRight />
              </button>
            ) : (
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={loading || isFormLocked}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  fontWeight: '500',
                  fontSize: '0.875rem',
                  cursor: loading || isFormLocked ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  border: 'none',
                  outline: 'none',
                  backgroundColor: loading || isFormLocked ? '#d1d5db' : '#f59e0b',
                  color: '#ffffff',
                  opacity: loading || isFormLocked ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {loading ? (
                  <>
                    <div style={{ 
                      width: '16px', 
                      height: '16px', 
                      border: '2px solid #ffffff', 
                      borderTop: '2px solid transparent', 
                      borderRadius: '50%', 
                      animation: 'spin 1s linear infinite' 
                    }}></div>
                    Guardando...
                  </>
                ) : (
                  <>
                    <FaCheck />
                    {existingProfile ? 'Actualizar' : 'Guardar'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Overlay de carga */}
        {loading && (
          <div style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(255, 255, 255, 0.95)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 50,
            borderRadius: '12px'
          }}>
            <div style={{ textAlign: 'center', color: '#374151' }}>
              <div style={{ 
                width: '48px', 
                height: '48px', 
                border: '4px solid #e5e7eb', 
                borderTop: '4px solid #f59e0b', 
                borderRadius: '50%', 
                animation: 'spin 1s linear infinite', 
                margin: '0 auto 16px' 
              }}></div>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: '500' }}>
                Guardando información...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmación */}
      {showConfirmation && (
        <ConfirmationModal
          isSuccess={confirmationIsSuccess}
          message={confirmationMessage}
          onClose={handleConfirmationClose}
        />
      )}

      {/* Estilos de animación */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @media (max-width: 768px) {
          .modal-scroll-content {
            padding: 16px !important;
          }
        }
        
        .modal-scroll-content::-webkit-scrollbar {
          width: 6px;
        }
        
        .modal-scroll-content::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 3px;
        }
        
        .modal-scroll-content::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 3px;
        }
        
        .modal-scroll-content::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }
      `}</style>
    </div>
  );
};

export default ClientProfile;