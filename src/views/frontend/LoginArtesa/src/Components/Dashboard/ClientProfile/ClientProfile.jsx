import React, { useState, useEffect } from 'react';
import './ClientProfile.scss';
import API from '../../../api/config';  // Usando la configuración centralizada de API
import { FaTimes, FaUpload } from 'react-icons/fa';
import { useAuth } from '../../../hooks/useAuth';
import './ConfirmationModal.scss';
import ConfirmationModal from './ConfirmationModal';

const ClientProfile = ({ onClose, onProfileUpdate }) => {
  // Obtener contexto de autenticación (no recibimos user como prop para evitar inconsistencias)
  const { user, updateUserInfo } = useAuth();
  
  // Estado inicial del formulario
  const [formData, setFormData] = useState({
    // Datos básicos
    nombre: '',
    tipoDocumento: 'CC',
    numeroDocumento: '',
    direccion: '',
    ciudad: '',
    pais: 'Colombia',
    telefono: '',
    email: '',
    
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

  // Estados para UI y control
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [existingProfile, setExistingProfile] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationIsSuccess, setConfirmationIsSuccess] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [isFormLocked, setIsFormLocked] = useState(false);
  const [debugInfo, setDebugInfo] = useState({});

  // Función mejorada para obtener el ID del usuario de múltiples fuentes
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
        // El token está en formato Base64, podemos decodificarlo
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

  // Efecto para cargar el perfil del usuario
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Obtener ID de usuario con la función mejorada
        const userId = getUserId();
        
        if (!userId) {
          console.log("No hay ID de usuario para buscar perfil");
          // Intento de inicialización con datos básicos si no hay perfil pero hay usuario
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
        
        // Hacer la solicitud a la API usando la configuración centralizada
        const response = await API.get(`/client-profiles/user/${userId}`);
        console.log("Respuesta completa de API:", response);
        
        // Procesar datos recibidos
        if (response && response.data) {
          const profileData = response.data.data || response.data;
          console.log("Datos de perfil recibidos:", profileData);
          
          // Bloquear formulario si ya tiene NIT registrado (sincronizado con SAP)
          if (profileData?.nit_number && profileData?.verification_digit) {
            setIsFormLocked(true);
          }
          
          // Preparar datos para el formulario
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
          
          // Procesar datos adicionales que podrían estar en el campo 'notes'
          if (profileData.notes) {
            try {
              const additionalData = JSON.parse(profileData.notes);
              console.log("Datos adicionales encontrados en notes:", additionalData);
              Object.assign(formDataUpdate, additionalData);
            } catch (e) {
              console.error("Error al parsear notes:", e);
            }
          }
          
          // Procesar campos específicos si están disponibles directamente
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
        
        // Mostrar detalles específicos del error para debugging
        if (error.response) {
          console.error('Respuesta de error:', error.response.status, error.response.data);
        } else if (error.request) {
          console.error('Error de solicitud (sin respuesta):', error.request);
        } else {
          console.error('Error:', error.message);
        }
        
        // Si no existe perfil, inicializar con el email del usuario logueado
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
  }, [user]); // Dependencia del useEffect

  // Manejar cambios en campos de formulario
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Eliminar el error específico del campo cuando cambia su valor
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }

    // Validación específica para NIT (solo números)
    if (name === 'nit') {
      // Si el valor no está vacío y no es un número, muestra un error
      if (value && !/^\d+$/.test(value)) {
        setFieldErrors(prev => ({
          ...prev,
          nit: 'El NIT debe contener solo números enteros'
        }));
      }
      // Almacena el valor solo si es un número o está vacío
      setFormData(prev => ({
        ...prev,
        [name]: /^\d*$/.test(value) ? value : prev[name]
      }));
    } else {
      // Comportamiento normal para otros campos
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Manejar cambios en archivos
  const handleFileChange = (e) => {
    const { name, files } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: files[0]
    }));
  };

  // Manejar cierre de modal de confirmación
  const handleConfirmationClose = () => {
    setShowConfirmation(false);

    // Si la operación fue exitosa, cerrar el formulario
    if (confirmationIsSuccess) {
      onClose();
    }
  };

  // Manejar envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Validar NIT y dígito de verificación
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

    // Crear el tax_id combinando NIT y dígito de verificación
    let taxId = '';
    if (formData.nit) {
      taxId = formData.nit;
      if (formData.digitoVerificacion) {
        taxId += '-' + formData.digitoVerificacion;
      }
    }

    try {
      // Preparar FormData para envío
      const formDataToSend = new FormData();
      
      // Agregar campos específicos para SAP
      formDataToSend.append('nit_number', formData.nit || '');
      formDataToSend.append('verification_digit', formData.digitoVerificacion || '');
      formDataToSend.append('tax_id', taxId);
      
      // Agregar todos los campos del formulario
      Object.keys(formData).forEach(key => {
        if (key === 'fotocopiaCedula' || key === 'fotocopiaRut' || key === 'anexosAdicionales') {
          if (formData[key]) {
            formDataToSend.append(key, formData[key]);
          }
        } else {
          formDataToSend.append(key, formData[key]);
        }
      });

      // Obtener el ID del usuario
      const userId = getUserId();
      if (!userId) {
        throw new Error("No se pudo determinar el ID del usuario");
      }
      
      formDataToSend.append('userId', userId);

      // Determinar endpoint y método según si estamos actualizando o creando
      const endpoint = existingProfile
        ? `/client-profiles/user/${userId}`
        : '/client-profiles';
      const method = existingProfile ? 'put' : 'post';

      console.log(`Enviando datos al endpoint: ${endpoint} con método: ${method}`);

      // Ejecutar la solicitud
      const response = await API({
        method,
        url: endpoint,
        data: formDataToSend,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log("Respuesta de guardado:", response.data);

      // Extraer datos guardados
      const savedData = response.data?.data || response.data;

      // Información de usuario actualizada para el contexto
      const updatedUserData = {
        nombre: formData.nombre,
        email: formData.email,
        telefono: formData.telefono,
        direccion: formData.direccion,
        ciudad: formData.ciudad
      };

      // Guardar en localStorage para acceso rápido
      localStorage.setItem('clientProfile', JSON.stringify({
        nombre: formData.nombre,
        email: formData.email
      }));

      // Actualizar contexto de autenticación
      if (typeof updateUserInfo === 'function') {
        updateUserInfo(updatedUserData);
      }

      // Notificar al Dashboard sobre el cambio
      if (typeof onProfileUpdate === 'function') {
        onProfileUpdate(formData.nombre);
      }

      // Mostrar confirmación de éxito
      setSuccess('Perfil guardado correctamente');
      setExistingProfile(savedData);
      setConfirmationIsSuccess(true);
      setConfirmationMessage('Datos Almacenados Correctamente');
      setShowConfirmation(true);

    } catch (error) {
      // Manejar errores
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

  // Componente de depuración (solo para desarrollo)
  const DebugPanel = () => {
    if (import.meta.env.MODE !== 'development') return null;
    
    return (
      <div className="bg-yellow-100 p-4 mb-4 text-xs rounded">
        <h4 className="font-bold mb-1">Debug Info</h4>
        <div>User ID: {getUserId() || 'No disponible'}</div>
        <div>Usuario en contexto: {user ? 'Disponible' : 'No disponible'}</div>
        <div>Usuario en localStorage: {localStorage.getItem('user') ? 'Disponible' : 'No disponible'}</div>
        <details>
          <summary>Ver datos completos</summary>
          <pre className="mt-2 overflow-auto max-h-40">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </details>
      </div>
    );
  };
  
  return (
    <div className="client-profile-overlay">
      <div className="client-profile-container">
        <div className="client-profile-header">
          <h2>Formulario de Perfil de Cliente</h2>
          <button className="close-button" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        {error && <div className="profile-error-message">{error}</div>}
        {success && <div className="profile-success-message">{success}</div>}
        {isFormLocked && (
          <div className="locked-message">
            <p className="text-sm text-gray-600 bg-yellow-100 border border-yellow-400 px-4 py-2 rounded mt-2">
              Este perfil ya ha sido sincronizado con SAP y no puede ser modificado.
            </p>
          </div>
        )}

        <div className="client-profile-content">
          <form onSubmit={handleSubmit} className="client-profile-form">
            {/* Sección 1: Información Básica */}
            <div className="form-section">
              <h3 className="section-title">Información Básica</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="nombre">Nombre Completo*</label>
                  <input
                    type="text"
                    id="nombre"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    required
                    disabled={isFormLocked}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="tipoDocumento">Tipo de Documento*</label>
                  <select
                    id="tipoDocumento"
                    name="tipoDocumento"
                    value={formData.tipoDocumento}
                    onChange={handleChange}
                    required
                    disabled={isFormLocked}
                  >
                    <option value="CC">Cédula de Ciudadanía</option>
                    <option value="CE">Cédula de Extranjería</option>
                    <option value="PASAPORTE">Pasaporte</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="numeroDocumento">Número de Documento*</label>
                  <input
                    type="text"
                    id="numeroDocumento"
                    name="numeroDocumento"
                    value={formData.numeroDocumento}
                    onChange={handleChange}
                    required
                    disabled={isFormLocked}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="direccion">Dirección*</label>
                  <input
                    type="text"
                    id="direccion"
                    name="direccion"
                    value={formData.direccion}
                    onChange={handleChange}
                    required
                    disabled={isFormLocked}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="ciudad">Ciudad*</label>
                  <input
                    type="text"
                    id="ciudad"
                    name="ciudad"
                    value={formData.ciudad}
                    onChange={handleChange}
                    required
                    disabled={isFormLocked}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="pais">País*</label>
                  <input
                    type="text"
                    id="pais"
                    name="pais"
                    value={formData.pais}
                    onChange={handleChange}
                    required
                    disabled={isFormLocked}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="telefono">Teléfono*</label>
                  <input
                    type="tel"
                    id="telefono"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleChange}
                    required
                    disabled={isFormLocked}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Correo Electrónico*</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    readOnly // El email viene del login
                  />
                </div>
              </div>
            </div>

            {/* Sección 2: Información Empresarial */}
            <div className="form-section">
              <h3 className="section-title">Información Empresarial</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="razonSocial">Razón Social</label>
                  <input
                    type="text"
                    id="razonSocial"
                    name="razonSocial"
                    value={formData.razonSocial}
                    onChange={handleChange}
                    disabled={isFormLocked}
                  />
                </div>

                <div className={`form-group ${fieldErrors.nit ? 'error' : ''}`}>
                  <label htmlFor="nit">NIT (Sin dígito de verificación)</label>
                  <input
                    type="text"
                    id="nit"
                    name="nit"
                    value={formData.nit}
                    onChange={handleChange}
                    className={fieldErrors.nit ? 'input-error' : ''}
                    disabled={isFormLocked}
                  />
                  {fieldErrors.nit && (
                    <div className="error-text">{fieldErrors.nit}</div>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="digitoVerificacion">Dígito de Verificación</label>
                  <input
                    type="text"
                    id="digitoVerificacion"
                    name="digitoVerificacion"
                    value={formData.digitoVerificacion}
                    onChange={(e) => {
                      // Solo permitir un dígito numérico
                      const value = e.target.value;
                      if (value === '' || /^[0-9]$/.test(value)) {
                        handleChange(e);
                      }
                    }}
                    maxLength="1"
                    pattern="[0-9]"
                    disabled={isFormLocked}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="representanteLegal">Representante Legal</label>
                  <input
                    type="text"
                    id="representanteLegal"
                    name="representanteLegal"
                    value={formData.representanteLegal}
                    onChange={handleChange}
                    disabled={isFormLocked}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="actividadComercial">Actividad Comercial</label>
                  <input
                    type="text"
                    id="actividadComercial"
                    name="actividadComercial"
                    value={formData.actividadComercial}
                    onChange={handleChange}
                    disabled={isFormLocked}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="sectorEconomico">Sector Económico</label>
                  <input
                    type="text"
                    id="sectorEconomico"
                    name="sectorEconomico"
                    value={formData.sectorEconomico}
                    onChange={handleChange}
                    disabled={isFormLocked}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="tamanoEmpresa">Tamaño de Empresa</label>
                  <select
                    id="tamanoEmpresa"
                    name="tamanoEmpresa"
                    value={formData.tamanoEmpresa}
                    onChange={handleChange}
                    disabled={isFormLocked}
                  >
                    <option value="Microempresa">Microempresa</option>
                    <option value="Pequeña">Pequeña</option>
                    <option value="Mediana">Mediana</option>
                    <option value="Grande">Grande</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Sección 3: Información Financiera */}
            <div className="form-section">
              <h3 className="section-title">Información Financiera</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="ingresosMensuales">Ingresos Mensuales Promedio</label>
                  <input
                    type="number"
                    id="ingresosMensuales"
                    name="ingresosMensuales"
                    value={formData.ingresosMensuales}
                    onChange={handleChange}
                    disabled={isFormLocked}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="patrimonio">Patrimonio</label>
                  <input
                    type="number"
                    id="patrimonio"
                    name="patrimonio"
                    value={formData.patrimonio}
                    onChange={handleChange}
                    disabled={isFormLocked}
                  />
                </div>
              </div>
            </div>

            {/* Sección 4: Información Bancaria */}
            <div className="form-section">
              <h3 className="section-title">Información Bancaria</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="entidadBancaria">Entidad Bancaria</label>
                  <input
                    type="text"
                    id="entidadBancaria"
                    name="entidadBancaria"
                    value={formData.entidadBancaria}
                    onChange={handleChange}
                    disabled={isFormLocked}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="tipoCuenta">Tipo de Cuenta</label>
                  <select
                    id="tipoCuenta"
                    name="tipoCuenta"
                    value={formData.tipoCuenta}
                    onChange={handleChange}
                    disabled={isFormLocked}
                  >
                    <option value="Ahorros">Ahorros</option>
                    <option value="Corriente">Corriente</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="numeroCuenta">Número de Cuenta</label>
                  <input
                    type="text"
                    id="numeroCuenta"
                    name="numeroCuenta"
                    value={formData.numeroCuenta}
                    onChange={handleChange}
                    disabled={isFormLocked}
                  />
                </div>
              </div>
            </div>

            {/* Sección 5: Documentos Requeridos */}
            <div className="form-section">
              <h3 className="section-title">Documentos Requeridos</h3>
              <div className="form-row">
                <div className="form-group file-upload">
                  <label htmlFor="fotocopiaCedula">
                    Fotocopia Cédula*
                    {formData.fotocopiaCedula && (
                      <span className="file-selected"> (Archivo seleccionado)</span>
                    )}
                    {existingProfile?.fotocopiaCedula && !formData.fotocopiaCedula && (
                      <span className="file-selected"> (Archivo ya cargado)</span>
                    )}
                  </label>
                  <div className="file-input-container">
                    <input
                      type="file"
                      id="fotocopiaCedula"
                      name="fotocopiaCedula"
                      onChange={handleFileChange}
                      className="file-input"
                      required={!existingProfile?.fotocopiaCedula}
                      disabled={isFormLocked}
                    />
                    <label htmlFor="fotocopiaCedula" className="file-label">
                      <FaUpload /> Seleccionar Archivo
                    </label>
                  </div>
                </div>

                <div className="form-group file-upload">
                  <label htmlFor="fotocopiaRut">
                    Fotocopia RUT*
                    {formData.fotocopiaRut && (
                      <span className="file-selected"> (Archivo seleccionado)</span>
                    )}
                    {existingProfile?.fotocopiaRut && !formData.fotocopiaRut && (
                      <span className="file-selected"> (Archivo ya cargado)</span>
                    )}
                  </label>
                  <div className="file-input-container">
                    <input
                      type="file"
                      id="fotocopiaRut"
                      name="fotocopiaRut"
                      onChange={handleFileChange}
                      className="file-input"
                      required={!existingProfile?.fotocopiaRut}
                      disabled={isFormLocked}
                    />
                    <label htmlFor="fotocopiaRut" className="file-label">
                      <FaUpload /> Seleccionar Archivo
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* Mostrar resumen de errores si existen */}
            {Object.keys(fieldErrors).length > 0 && (
              <div className="form-section error-summary">
                <h3 className="section-title">Errores en el formulario</h3>
                <ul>
                  {Object.entries(fieldErrors).map(([field, message]) => (
                    <li key={field}>{message}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="form-actions">
              <button type="button" className="cancel-btn" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="submit"
                className="submit-btn"
                disabled={loading || isFormLocked}
              >
                {loading ? 'Guardando...' : existingProfile ? 'Actualizar Perfil' : 'Guardar Perfil'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal de Confirmación */}
      {showConfirmation && (
        <ConfirmationModal
          isSuccess={confirmationIsSuccess}
          message={confirmationMessage}
          onClose={handleConfirmationClose}
        />
      )}

    </div>
  );
};

export default ClientProfile;