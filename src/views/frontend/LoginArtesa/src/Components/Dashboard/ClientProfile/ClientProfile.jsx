import React, { useState, useEffect } from 'react';
import './ClientProfile.scss';
import API from '../../../api/config';
import { FaTimes, FaUpload, FaExclamationCircle } from 'react-icons/fa';
import { useAuth } from '../../../hooks/useAuth'; // Importar el hook de auth
import './ConfirmationModal.scss';
import ConfirmationModal from './ConfirmationModal';

const ClientProfile = ({ user, onClose, onProfileUpdate }) => {
  const { updateUserInfo } = useAuth(); // Obtener la función de actualización del contexto
  const [formData, setFormData] = useState({
    // Datos básicos
    nombre: '',
    tipoDocumento: 'CC',
    numeroDocumento: '',
    direccion: '',
    ciudad: '',
    pais: 'Colombia',
    telefono: '',
    email: user?.email || user?.mail || '',

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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [existingProfile, setExistingProfile] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationIsSuccess, setConfirmationIsSuccess] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');

  const [isFormLocked, setIsFormLocked] = useState(false);

  // Verificar que el backend está disponible cuando se monta el componente
useEffect(() => {
  const checkBackendConnection = async () => {
    try {
      console.log("Verificando conexión con el backend...");
      // Intenta obtener un recurso básico para verificar conectividad
      const response = await API.get('/health');
      console.log("Conexión con backend establecida:", response.data);
    } catch (error) {
      console.error("Error de conexión con el backend:", error);
      // Solo mostrar error si no es una ruta no encontrada (404)
      if (error.response && error.response.status !== 404) {
        setError("No se pudo establecer conexión con el servidor. Verifique su configuración.");
      }
    }
  };
  
  checkBackendConnection();
}, []);

  useEffect(() => {
    // Verificar si el usuario ya tiene un perfil
    const fetchProfile = async () => {
      try {
        if (!user || !user.id) {
          console.log("No hay ID de usuario para buscar perfil");
          return;
        }

        // Verificar token de autenticación
        const token = localStorage.getItem("token");
        if (!token) {
          console.warn("No hay token de autenticación disponible");
        }

        // Imprimir información completa para depuración
        console.log("Usuario actual:", user);
        console.log("Intentando obtener perfil para usuario ID:", user.id);
        const endpoint = `/client-profiles/user/${user.id}`;
        console.log("URL base de API:", API.defaults.baseURL);
        console.log("Endpoint completo:", API.defaults.baseURL + endpoint);

        const response = await API.get(endpoint);
        console.log("Respuesta completa de API:", response);
        console.log("Datos recibidos:", response.data);

        // Manejar respuesta
        if (!response.data) {
          console.error("Respuesta vacía de la API");
          return;
        }

        // Extraer los datos con manejo mejorado de estructura
        const profileData = response.data?.data || response.data;

        // Verificar bloqueo del formulario basado en campos específicos
        if (profileData?.nit_number && profileData?.verification_digit) {
          setIsFormLocked(true);
          console.log("Formulario bloqueado porque ya tiene NIT y dígito de verificación");
        }

        // Preparar datos para el formulario con mejor manejo de campos
        const formDataUpdate = {
          nombre: profileData.nombre || profileData.name || '',
          direccion: profileData.direccion || profileData.address || '',
          ciudad: profileData.ciudad || profileData.city || '',
          pais: profileData.pais || profileData.country || 'Colombia',
          telefono: profileData.telefono || profileData.phone || '',
          email: profileData.email || user?.email || user?.mail || '',
          razonSocial: profileData.razonSocial || profileData.companyName || '',
          nit: profileData.nit_number || profileData.nit || profileData.taxId || '',
        };

        // Procesar dígito de verificación
        if (profileData.verification_digit) {
          formDataUpdate.digitoVerificacion = profileData.verification_digit;
        }

        if (profileData) {
          console.log("Perfil encontrado, actualizando estado");
          setExistingProfile(profileData);

          // Procesamiento mejorado de datos adicionales
          if (profileData.notes) {
            try {
              const additionalData = JSON.parse(profileData.notes);
              console.log("Datos adicionales encontrados en notes:", additionalData);
              Object.assign(formDataUpdate, additionalData);
            } catch (e) {
              console.error("Error al parsear notes:", e);
            }
          }

          // Procesar campos específicos con mejor manejo de errores
          [
            'tipoDocumento', 'numeroDocumento', 'representanteLegal',
            'actividadComercial', 'sectorEconomico', 'tamanoEmpresa',
            'ingresosMensuales', 'patrimonio', 'entidadBancaria',
            'tipoCuenta', 'numeroCuenta', 'nombreContacto',
            'cargoContacto', 'telefonoContacto', 'emailContacto'
          ].forEach(field => {
            if (profileData[field] !== undefined && profileData[field] !== null) {
              formDataUpdate[field] = profileData[field];
            }
          });

          console.log("Actualizando formulario con datos procesados:", formDataUpdate);
          setFormData(prev => ({ ...prev, ...formDataUpdate }));
        }
      } catch (error) {
        console.error('Error al obtener perfil:', error);

        // Detalles específicos del error para mejor depuración
        if (error.response) {
          console.error('Respuesta de error:', error.response.status, error.response.data);
        } else if (error.request) {
          console.error('Error de solicitud (sin respuesta):', error.request);
        } else {
          console.error('Error:', error.message);
        }

        // Si no existe perfil, inicializar con datos básicos del usuario
        if (user) {
          setFormData(prev => ({
            ...prev,
            email: user.mail || user.email || '',
            nombre: user.nombre || user.name || ''
          }));
        }
      }
    };

    fetchProfile();
  }, [user]);

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

  const handleFileChange = (e) => {
    const { name, files } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: files[0]
    }));
  };

  const handleConfirmationClose = () => {
    setShowConfirmation(false);

    // Si la operación fue exitosa, cerrar el formulario y regresar al dashboard
    if (confirmationIsSuccess) {
      onClose(); // Cerrar el modal de perfil
    }
    // Si hubo un error, seguimos mostrando el formulario para corregir
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Validar que el NIT solo contenga números
    if (formData.nit && !/^\d+$/.test(formData.nit)) {
      setFieldErrors(prev => ({
        ...prev,
        nit: 'El NIT debe contener solo números enteros'
      }));
      setError('Hay errores en el formulario. Por favor verifique los campos marcados en rojo.');
      setLoading(false);
      return;
    }

    // Validar que digitoVerificacion sea un número entero de un solo dígito
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
      // Crear FormData para enviar archivos
      const formDataToSend = new FormData();

      // Agregar nit_number y verification_digit como campos separados
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

      // Agregar ID del usuario
      if (user && user.id) {
        formDataToSend.append('userId', user.id);
      }

      // Mantener el endpoint tal como está en la API
      const endpoint = existingProfile
        ? `/client-profiles/user/${user.id}`
        : '/client-profiles';

      const method = existingProfile ? 'put' : 'post';

      console.log(`Enviando datos al endpoint: ${endpoint} con método: ${method}`);

      // Realizar la solicitud a la API
      const response = await API({
        method,
        url: endpoint,
        data: formDataToSend,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log("Respuesta de guardado:", response.data);

      // Extraer los datos guardados
      const savedData = response.data?.data || response.data;

      // Crear objeto con la información relevante actualizada
      const updatedUserData = {
        nombre: formData.nombre,
        email: formData.email,
        telefono: formData.telefono,
        direccion: formData.direccion,
        ciudad: formData.ciudad
      };

      // Guardar perfil en localStorage para acceso rápido
      localStorage.setItem('clientProfile', JSON.stringify({
        nombre: formData.nombre,
        email: formData.email
      }));

      // Actualizar la información en el contexto de autenticación
      updateUserInfo(updatedUserData);

      // Notificar al Dashboard sobre el cambio de nombre si existe la función
      if (typeof onProfileUpdate === 'function') {
        onProfileUpdate(formData.nombre);
      }

      // En lugar de solo mostrar mensaje en el formulario, mostramos el modal de confirmación
      setSuccess('Perfil guardado correctamente');
      setExistingProfile(response.data);

      // Configurar y mostrar el modal de confirmación exitosa
      setConfirmationIsSuccess(true);
      setConfirmationMessage('Datos Almacenados Correctamente');
      setShowConfirmation(true);

    } catch (error) {
      console.error('Error al guardar perfil:', error);
      
      let errorMessage = 'Error al guardar el perfil';
      
      if (error.response) {
        console.error('Detalles del error:', error.response.status, error.response.data);
        errorMessage = error.response.data?.message || 'Error en la respuesta del servidor';
        
        // Manejar códigos de estado específicos
        if (error.response.status === 401) {
          errorMessage = 'Sesión expirada. Por favor, inicie sesión nuevamente.';
        } else if (error.response.status === 403) {
          errorMessage = 'No tiene permisos para realizar esta acción.';
        } else if (error.response.status === 422) {
          errorMessage = 'Datos de formulario inválidos. Por favor verifique los campos.';
        }
      } else if (error.request) {
        errorMessage = 'No se recibió respuesta del servidor. Verifique su conexión.';
      }
      
      setError(errorMessage);
      
      // Configurar y mostrar el modal de confirmación de error
      setConfirmationIsSuccess(false);
      setConfirmationMessage('Datos Incorrectos. Por favor verifique la información proporcionada.');
      setShowConfirmation(true);
    }
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
          <div className="bg-yellow-50 text-yellow-800 p-4 mb-6 rounded-md border border-yellow-200 flex items-center">
            <FaExclamationCircle className="mr-2" />
            <span>Este perfil ya ha sido sincronizado con SAP y no puede ser modificado.</span>
          </div>
        )}
        {loading && (
          <div className="flex justify-center items-center p-4 my-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="ml-2">Cargando datos del perfil...</p>
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