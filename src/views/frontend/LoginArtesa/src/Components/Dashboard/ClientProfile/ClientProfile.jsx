import React, { useState, useEffect } from 'react';
import './ClientProfile.scss';
import API from '../../../api/config';
import { FaTimes, FaUpload, FaCheck, FaChevronRight, FaChevronLeft, 
  FaExclamationCircle, FaCheckCircle, FaFileAlt, FaChevronDown } from 'react-icons/fa';
import { useAuth } from '../../../hooks/useAuth';
import './ConfirmationModal.scss';
import FieldValidation from './FieldValidation';
import ConfirmationModal from './ConfirmationModal';

const ClientProfile = ({ onClose, onProfileUpdate }) => {
  // ✅ USAR LA LÓGICA SIMPLE DEL COMPONENTE FUNCIONAL
  const { user, updateUserInfo } = useAuth(); // Obtener directamente del hook

  // Estados para manejar los pasos del formulario (mantener UX del complejo)
  const steps = ["Información de contacto", "Información Empresarial", "Información Financiera", "Información Bancaria", "Documentos"];
  const [currentStep, setCurrentStep] = useState(0);
  
  // ✅ ESTADO INICIAL IGUAL AL COMPONENTE FUNCIONAL
  const [formData, setFormData] = useState({
    // Datos básicos
    nombre: '',
    tipoDocumento: 'CC',
    numeroDocumento: '',
    direccion: '',
    ciudad: '',
    pais: 'Colombia',
    telefono: '',
    email: user?.email || user?.mail || '', // ✅ Simplificado como en paste-3.txt
    
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

  // Estados para UI y control (mantener del complejo)
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

  // ✅ USAR LA LÓGICA SIMPLE Y FUNCIONAL DEL PASTE-3.TXT
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // ✅ Verificación simple como en paste-3.txt
        if (!user || !user.id) {
          console.log("No hay ID de usuario para buscar perfil");
          return;
        }

        console.log("Intentando obtener perfil para usuario ID:", user.id);

        // 
        const response = await API.get(`/client-profiles/user/${user.id}`);
        console.log("Respuesta de API:", response.data);

       
        const profileData = response.data?.data || response.data;

        // ✅ Bloqueo de formulario
        if (profileData?.nit_number && profileData?.verification_digit) {
          setIsFormLocked(true);
        }

        // ✅ PREPARAR DATOS
        const formDataUpdate = {
          nombre: profileData.nombre || '',
          direccion: profileData.direccion || '',
          ciudad: profileData.ciudad || '',
          pais: profileData.pais || 'Colombia',
          telefono: profileData.telefono || '',
          email: profileData.email || user?.email || user?.mail || '',
          razonSocial: profileData.razonSocial || '',
          nit: profileData.nit_number || profileData.nit || '',
        };

        // ✅ Manejo del dígito de verificación
        if (profileData.verification_digit) {
          formDataUpdate.digitoVerificacion = profileData.verification_digit;
        }

        if (profileData) {
          console.log("Perfil encontrado:", profileData);
          setExistingProfile(profileData);

          // ✅ PROCESAMIENTO DEL CAMPO NOTES
          if (profileData.notes) {
            try {
              const additionalData = JSON.parse(profileData.notes);
              console.log("Datos adicionales encontrados en notes:", additionalData);
              // Combinar con formDataUpdate
              Object.assign(formDataUpdate, additionalData);
            } catch (e) {
              console.error("Error al parsear notes:", e);
            }
          }

          // ✅ Procesar campos específicos igual que en paste-3.txt
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

          console.log('Perfil cargado desde la API');
        }
      } catch (error) {
        console.error('Error al obtener perfil:', error);

        // ✅ Fallback igual que en paste-3.txt
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
  }, [user]); // ✅ Dependencia simple como en paste-3.txt

  // Funciones para navegación entre pasos (mantener del complejo)
  const nextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
      
      // Expandir la sección correspondiente
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
    
    // Expandir la sección correspondiente
    const sectionNames = ['basic', 'business', 'financial', 'banking', 'documents'];
    if (currentStep > 0) {
      setExpandedSections({
        ...Object.fromEntries(sectionNames.map(name => [name, false])),
        [sectionNames[currentStep - 1]]: true
      });
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ✅ FUNCIÓN DE VALIDACIÓN SIMPLIFICADA (basada en paste-3.txt)
  const validateCurrentStep = () => {
    const errors = {};
    
    if (currentStep === 0) {
      // Validar Información Básica (igual que paste-3.txt pero adaptado)
      if (!formData.nombre) errors.nombre = "El nombre es requerido";
      if (!formData.numeroDocumento) errors.numeroDocumento = "El número de documento es requerido";
      if (!formData.direccion) errors.direccion = "La dirección es requerida";
      if (!formData.ciudad) errors.ciudad = "La ciudad es requerida";
      if (!formData.pais) errors.pais = "El país es requerido";
      if (!formData.telefono) errors.telefono = "El teléfono es requerido";
      if (!formData.email) errors.email = "El correo electrónico es requerido";
      else if (!/^\S+@\S+\.\S+$/.test(formData.email)) errors.email = "El correo electrónico no es válido";
    } else if (currentStep === 1) {
      // ✅ Validar NIT igual que en paste-3.txt
      if (formData.nit && !/^\d{8,12}$/.test(formData.nit)) {
        errors.nit = "El NIT debe contener entre 8 y 12 dígitos numéricos";
      }
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Función para expandir/contraer secciones
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // ✅ MANEJAR CAMBIOS EXACTAMENTE COMO EN PASTE-3.TXT
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

    // ✅ Validación específica para NIT igual que en paste-3.txt
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

  // ✅ MANEJAR ARCHIVOS IGUAL QUE EN PASTE-3.TXT
  const handleFileChange = (e) => {
    const { name, files } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: files[0]
    }));
  };

  // ✅ MANEJAR CONFIRMACIÓN IGUAL QUE EN PASTE-3.TXT
  const handleConfirmationClose = () => {
    setShowConfirmation(false);

    // Si la operación fue exitosa, cerrar el formulario
    if (confirmationIsSuccess) {
      onClose();
    }
  };

  // ✅ FUNCIÓN DE ENVÍO EXACTAMENTE COMO EN PASTE-3.TXT (LA QUE FUNCIONA)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // ✅ Validaciones igual que en paste-3.txt
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

    // ✅ Crear tax_id igual que en paste-3.txt
    let taxId = '';
    if (formData.nit) {
      taxId = formData.nit;
      if (formData.digitoVerificacion) {
        taxId += '-' + formData.digitoVerificacion;
      }
    }

    try {
      // ✅ CREAR FORMDATA EXACTAMENTE COMO EN PASTE-3.TXT
      const formDataToSend = new FormData();

      // ✅ Agregar campos específicos para SAP igual que en paste-3.txt
      formDataToSend.append('nit_number', formData.nit || '');
      formDataToSend.append('verification_digit', formData.digitoVerificacion || '');
      formDataToSend.append('tax_id', taxId);

      // ✅ Agregar todos los campos igual que en paste-3.txt
      Object.keys(formData).forEach(key => {
        if (key === 'fotocopiaCedula' || key === 'fotocopiaRut' || key === 'anexosAdicionales') {
          if (formData[key]) {
            formDataToSend.append(key, formData[key]);
          }
        } else {
          formDataToSend.append(key, formData[key]);
        }
      });

      // ✅ Agregar userId igual que en paste-3.txt
      if (user && user.id) {
        formDataToSend.append('userId', user.id);
      }

      // ✅ Endpoint igual que en paste-3.txt
      const endpoint = existingProfile
        ? `/client-profiles/user/${user.id}`
        : '/client-profiles';
      const method = existingProfile ? 'put' : 'post';

      console.log(`Enviando datos al endpoint: ${endpoint} con método: ${method}`);

      // ✅ Solicitud igual que en paste-3.txt
      const response = await API({
        method,
        url: endpoint,
        data: formDataToSend,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log("Respuesta de guardado:", response.data);

      // ✅ Procesar respuesta igual que en paste-3.txt
      const savedData = response.data?.data || response.data;

      const updatedUserData = {
        nombre: formData.nombre,
        email: formData.email,
        telefono: formData.telefono,
        direccion: formData.direccion,
        ciudad: formData.ciudad
      };

      // ✅ LocalStorage igual que en paste-3.txt
      localStorage.setItem('clientProfile', JSON.stringify({
        nombre: formData.nombre,
        email: formData.email
      }));

      // ✅ Actualizar contexto igual que en paste-3.txt
      updateUserInfo(updatedUserData);

      // ✅ Callback igual que en paste-3.txt
      if (typeof onProfileUpdate === 'function') {
        onProfileUpdate(formData.nombre);
      }

      // ✅ Mostrar confirmación igual que en paste-3.txt
      setSuccess('Perfil guardado correctamente');
      setExistingProfile(savedData);
      setConfirmationIsSuccess(true);
      setConfirmationMessage('Datos Almacenados Correctamente');
      setShowConfirmation(true);

    } catch (error) {
      // ✅ Manejar errores igual que en paste-3.txt
      setError(error.response?.data?.message || 'Error al guardar el perfil');
      console.error('Error al guardar perfil:', error);

      setConfirmationIsSuccess(false);
      setConfirmationMessage('Datos Incorrectos. Por favor verifique la información proporcionada.');
      setShowConfirmation(true);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-gray-800 bg-opacity-70 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-auto overflow-hidden transform transition-all animate-fadeIn">
        <div className="relative">
           {/* Cabecera con degradado */}
           <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-6 py-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-white">Perfil de Cliente</h2>
            <button 
              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-full transition-all" 
              onClick={onClose}
            >
              <FaTimes />
            </button>
          </div>

          {/* Contenido del formulario */}
          <div className="p-6">
            {/* Mensajes de error y éxito */}
            {error && (
              <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded animate-fadeIn">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <FaExclamationCircle className="h-5 w-5 text-red-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            {success && (
              <div className="mb-4 bg-green-50 border-l-4 border-green-500 p-4 rounded animate-fadeIn">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <FaCheckCircle className="h-5 w-5 text-green-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-700">{success}</p>
                  </div>
                </div>
              </div>
            )}
            
            {isFormLocked && (
              <div className="mb-4 bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded animate-fadeIn">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <FaExclamationCircle className="h-5 w-5 text-yellow-500" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      Este perfil ya ha sido sincronizado con SAP y no puede ser modificado.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Barra de progreso */}
            <div className="w-full mb-8">
              <div className="hidden sm:flex justify-between mb-2">
                {steps.map((step, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <div 
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        currentStep === index 
                          ? 'bg-accent text-white' 
                          : currentStep > index
                            ? 'bg-slate-500 text-white'
                            : 'bg-gray-200 text-gray-600'
                      } transition-all duration-300`}
                    >
                      {currentStep > index ? <FaCheck /> : index + 1}
                    </div>
                    <span className={`text-xs mt-1 ${
                      currentStep === index 
                        ? 'text-slate-600 font-medium' 
                        : currentStep > index
                          ? 'text-slate-500 font-medium'
                          : 'text-gray-500'
                    }`}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
              <div className="sm:hidden flex justify-between mb-2">
                <span className="text-sm font-medium text-slate-600">
                  Paso {currentStep + 1} de {steps.length}: {steps[currentStep]}
                </span>
                <span className="text-sm text-gray-500">
                  {Math.round((currentStep / (steps.length - 1)) * 100)}%
                </span>
              </div>
              <div className="relative w-full h-2 bg-gray-200 rounded-full">
                <div 
                  className="absolute top-0 left-0 h-2 bg-slate-600 rounded-full transition-all duration-300"
                  style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                ></div>
              </div>
            </div>
            
            {/* Formulario principal */}
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Paso 1: Información Básica */}
              {currentStep === 0 && (
                <div className="form-section animate-fadeIn">
                  <div className="mb-6 border rounded-lg overflow-hidden shadow-sm">
                    <div 
                      className="bg-sky-50 px-4 py-3 flex justify-between items-center cursor-pointer"
                      onClick={() => toggleSection('basic')}
                    >
                      <h3 className="font-medium text-slate-700">Información de contacto</h3>
                      <div className={`transform transition-transform ${expandedSections.basic ? 'rotate-180' : ''}`}>
                        <FaChevronDown className="text-slate-700" />
                      </div>
                    </div>
                    
                    <div className={`transition-all duration-300 overflow-hidden ${
                      expandedSections.basic ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
                    }`}>
                      <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="space-y-2">
                            <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">
                              Nombre Completo*
                            </label>
                            <input
                              type="text"
                              id="nombre"
                              name="nombre"
                              value={formData.nombre}
                              onChange={handleChange}
                              onFocus={() => setFocusedField('nombre')}
                              onBlur={() => setFocusedField(null)}
                              required
                              disabled={isFormLocked}
                              className={`w-full px-4 py-2 border rounded-lg transition-all duration-300 outline-none text-gray-900
                                ${focusedField === 'nombre' ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-gray-400'}
                                ${fieldErrors.nombre ? 'border-red-500 bg-red-50' : 'border-gray-300'}
                                ${isFormLocked ? 'bg-gray-100 text-gray-500' : 'bg-white'}
                              `}
                              placeholder="Ingrese su nombre completo"
                            />
                            {fieldErrors.nombre && (
                              <p className="text-red-500 text-xs mt-1">{fieldErrors.nombre}</p>
                            )}
                          </div>
                        
                          <div className="space-y-2">
                            <label htmlFor="tipoDocumento" className="block text-sm font-medium text-gray-700">
                              Tipo de Documento*
                            </label>
                            <select
                              id="tipoDocumento"
                              name="tipoDocumento"
                              value={formData.tipoDocumento}
                              onChange={handleChange}
                              onFocus={() => setFocusedField('tipoDocumento')}
                              onBlur={() => setFocusedField(null)}
                              required
                              disabled={isFormLocked}
                              className={`w-full px-4 py-2 border rounded-lg transition-all duration-200 outline-none appearance-none bg-white text-gray-900
                                ${focusedField === 'tipoDocumento' ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-gray-400'}
                                ${fieldErrors.tipoDocumento ? 'border-red-500 bg-red-50' : 'border-gray-300'}
                                ${isFormLocked ? 'bg-gray-100 text-gray-500' : 'bg-white'}
                              `}
                            >
                              <option value="CC">Cédula de Ciudadanía</option>
                              <option value="CE">Cédula de Extranjería</option>
                              <option value="PASAPORTE">Pasaporte</option>
                            </select>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="space-y-2">
                            <label htmlFor="numeroDocumento" className="block text-sm font-medium text-gray-700">
                              Número de Documento*
                            </label>
                            <input
                              type="text"
                              id="numeroDocumento"
                              name="numeroDocumento"
                              value={formData.numeroDocumento}
                              onChange={handleChange}
                              onFocus={() => setFocusedField('numeroDocumento')}
                              onBlur={() => setFocusedField(null)}
                              required
                              disabled={isFormLocked}
                              className={`w-full px-4 py-2 border rounded-lg transition-all duration-200 outline-none text-gray-900
                                ${focusedField === 'numeroDocumento' ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-gray-400'}
                                ${fieldErrors.numeroDocumento ? 'border-red-500 bg-red-50' : 'border-gray-300'}
                                ${isFormLocked ? 'bg-gray-100 text-gray-500' : 'bg-white'}
                              `}
                              placeholder="Ingrese su número de documento"
                            />
                            {fieldErrors.numeroDocumento && (
                              <p className="text-red-500 text-xs mt-1">{fieldErrors.numeroDocumento}</p>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <label htmlFor="telefono" className="block text-sm font-medium text-gray-700">
                              Teléfono*
                            </label>
                            <input
                              type="tel"
                              id="telefono"
                              name="telefono"
                              value={formData.telefono}
                              onChange={handleChange}
                              onFocus={() => setFocusedField('telefono')}
                              onBlur={() => setFocusedField(null)}
                              required
                              disabled={isFormLocked}
                              className={`w-full px-4 py-2 border rounded-lg transition-all duration-200 outline-none text-gray-900
                                ${focusedField === 'telefono' ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-gray-400'}
                                ${fieldErrors.telefono ? 'border-red-500 bg-red-50' : 'border-gray-300'}
                                ${isFormLocked ? 'bg-gray-100 text-gray-500' : 'bg-white'}
                              `}
                              placeholder="Ingrese su teléfono"
                            />
                            {fieldErrors.telefono && (
                              <p className="text-red-500 text-xs mt-1">{fieldErrors.telefono}</p>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                              Correo Electrónico*
                            </label>
                            <input
                              type="email"
                              id="email"
                              name="email"
                              value={formData.email}
                              onChange={handleChange}
                              onFocus={() => setFocusedField('email')}
                              onBlur={() => setFocusedField(null)}
                              required
                              readOnly
                              className={`w-full px-4 py-2 border rounded-lg transition-all duration-200 outline-none bg-gray-100 text-gray-900
                                ${fieldErrors.email ? 'border-red-500 bg-red-50' : 'border-gray-300'}
                              `}
                              placeholder="correo@ejemplo.com"
                            />
                            {fieldErrors.email && (
                              <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <label htmlFor="direccion" className="block text-sm font-medium text-gray-700">
                              Dirección*
                            </label>
                            <input
                              type="text"
                              id="direccion"
                              name="direccion"
                              value={formData.direccion}
                              onChange={handleChange}
                              onFocus={() => setFocusedField('direccion')}
                              onBlur={() => setFocusedField(null)}
                              required
                              disabled={isFormLocked}
                              className={`w-full px-4 py-2 border rounded-lg transition-all duration-200 outline-none text-gray-900
                                ${focusedField === 'direccion' ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-gray-400'}
                                ${fieldErrors.direccion ? 'border-red-500 bg-red-50' : 'border-gray-300'}
                                ${isFormLocked ? 'bg-gray-100 text-gray-500' : 'bg-white'}
                              `}
                              placeholder="Ingrese su dirección"
                            />
                            {fieldErrors.direccion && (
                              <p className="text-red-500 text-xs mt-1">{fieldErrors.direccion}</p>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <label htmlFor="ciudad" className="block text-sm font-medium text-gray-700">
                              Ciudad*
                            </label>
                            <input
                              type="text"
                              id="ciudad"
                              name="ciudad"
                              value={formData.ciudad}
                              onChange={handleChange}
                              onFocus={() => setFocusedField('ciudad')}
                              onBlur={() => setFocusedField(null)}
                              required
                              disabled={isFormLocked}
                              className={`w-full px-4 py-2 border rounded-lg transition-all duration-200 outline-none text-gray-900
                                ${focusedField === 'ciudad' ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-gray-400'}
                                ${fieldErrors.ciudad ? 'border-red-500 bg-red-50' : 'border-gray-300'}
                                ${isFormLocked ? 'bg-gray-100 text-gray-500' : 'bg-white'}
                              `}
                              placeholder="Ingrese su ciudad"
                            />
                            {fieldErrors.ciudad && (
                              <p className="text-red-500 text-xs mt-1">{fieldErrors.ciudad}</p>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <label htmlFor="pais" className="block text-sm font-medium text-gray-700">
                              País*
                            </label>
                            <input
                              type="text"
                              id="pais"
                              name="pais"
                              value={formData.pais}
                              onChange={handleChange}
                              onFocus={() => setFocusedField('pais')}
                              onBlur={() => setFocusedField(null)}
                              required
                              disabled={isFormLocked}
                              className={`w-full px-4 py-2 border rounded-lg transition-all duration-200 outline-none text-gray-900
                                ${focusedField === 'pais' ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-gray-400'}
                                ${fieldErrors.pais ? 'border-red-500 bg-red-50' : 'border-gray-300'}
                                ${isFormLocked ? 'bg-gray-100 text-gray-500' : 'bg-white'}
                              `}
                              placeholder="Ingrese su país"
                            />
                            {fieldErrors.pais && (
                              <p className="text-red-500 text-xs mt-1">{fieldErrors.pais}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Continúo con los demás pasos igual que en version-anterior.docx pero con los estilos corregidos... */}
              
              {/* Paso 2: Información Empresarial */}
              {currentStep === 1 && (
                <div className="form-section animate-fadeIn">
                  <div className="mb-6 border rounded-lg overflow-hidden shadow-sm">
                    <div 
                      className="bg-amber-50 px-4 py-3 flex justify-between items-center cursor-pointer"
                      onClick={() => toggleSection('business')}
                    >
                      <h3 className="font-medium text-slate-700">Información Empresarial</h3>
                      <div className={`transform transition-transform ${expandedSections.business ? 'rotate-180' : ''}`}>
                        <FaChevronDown />
                      </div>
                    </div>
                    
                    <div className={`transition-all duration-300 overflow-hidden ${
                      expandedSections.business ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
                    }`}>
                      <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="space-y-2">
                            <label htmlFor="razonSocial" className="block text-sm font-medium text-gray-700">
                              Razón Social
                            </label>
                            <input
                              type="text"
                              id="razonSocial"
                              name="razonSocial"
                              value={formData.razonSocial}
                              onChange={handleChange}
                              onFocus={() => setFocusedField('razonSocial')}
                              onBlur={() => setFocusedField(null)}
                              disabled={isFormLocked}
                              className={`w-full px-4 py-2 border rounded-lg transition-all duration-200 outline-none text-gray-900
                                ${focusedField === 'razonSocial' ? 'ring-2 ring-indigo-500 border-indigo-500' : 'hover:border-gray-400'}
                                ${fieldErrors.razonSocial ? 'border-red-500 bg-red-50' : 'border-gray-300'}
                                ${isFormLocked ? 'bg-gray-100 text-gray-500' : 'bg-white'}
                              `}
                              placeholder="Nombre de la empresa"
                            />
                          </div>
                        
                          <div className="space-y-2">
                            <label htmlFor="nit" className="block text-sm font-medium text-gray-700">
                              NIT (Sin dígito de verificación)
                            </label>
                            <input
                              type="text"
                              id="nit"
                              name="nit"
                              value={formData.nit}
                              onChange={handleChange}
                              onFocus={() => setFocusedField('nit')}
                              onBlur={() => setFocusedField(null)}
                              disabled={isFormLocked}
                              className={`w-full px-4 py-2 border rounded-lg transition-all duration-200 outline-none text-gray-900
                                ${focusedField === 'nit' ? 'ring-2 ring-indigo-500 border-indigo-500' : 'hover:border-gray-400'}
                                ${fieldErrors.nit ? 'border-red-500 bg-red-50' : 'border-gray-300'}
                                ${isFormLocked ? 'bg-gray-100 text-gray-500' : 'bg-white'}
                              `}
                              placeholder="Ej: 900123456"
                            />
                            {fieldErrors.nit ? (
                              <p className="text-red-500 text-xs mt-1">{fieldErrors.nit}</p>
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
                          
                          <div className="space-y-2">
                            <label htmlFor="digitoVerificacion" className="block text-sm font-medium text-gray-700">
                              Dígito de Verificación
                            </label>
                            <input
                              type="text"
                              id="digitoVerificacion"
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
                              className={`w-full px-4 py-2 border rounded-lg transition-all duration-200 outline-none text-gray-900
                                ${focusedField === 'digitoVerificacion' ? 'ring-2 ring-indigo-500 border-indigo-500' : 'hover:border-gray-400'}
                                ${fieldErrors.digitoVerificacion ? 'border-red-500 bg-red-50' : 'border-gray-300'}
                                ${isFormLocked ? 'bg-gray-100 text-gray-500' : 'bg-white'}
                              `}
                              placeholder="Ej: 7"
                            />
                          </div>
                        </div>
                        
                        {/* Resto de campos empresariales... */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div className="space-y-2">
                            <label htmlFor="representanteLegal" className="block text-sm font-medium text-gray-700">
                              Representante Legal
                            </label>
                            <input
                              type="text"
                              id="representanteLegal"
                              name="representanteLegal"
                              value={formData.representanteLegal}
                              onChange={handleChange}
                              disabled={isFormLocked}
                              className="w-full px-4 py-2 border rounded-lg text-gray-900 bg-white border-gray-300"
                              placeholder="Nombre del representante legal"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label htmlFor="actividadComercial" className="block text-sm font-medium text-gray-700">
                              Actividad Comercial
                            </label>
                            <input
                              type="text"
                              id="actividadComercial"
                              name="actividadComercial"
                              value={formData.actividadComercial}
                              onChange={handleChange}
                              disabled={isFormLocked}
                              className="w-full px-4 py-2 border rounded-lg text-gray-900 bg-white border-gray-300"
                              placeholder="Describa la actividad comercial"
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label htmlFor="sectorEconomico" className="block text-sm font-medium text-gray-700">
                              Sector Económico
                            </label>
                            <input
                              type="text"
                              id="sectorEconomico"
                              name="sectorEconomico"
                              value={formData.sectorEconomico}
                              onChange={handleChange}
                              disabled={isFormLocked}
                              className="w-full px-4 py-2 border rounded-lg text-gray-900 bg-white border-gray-300"
                              placeholder="Ej: Comercio, Servicios, etc."
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label htmlFor="tamanoEmpresa" className="block text-sm font-medium text-gray-700">
                              Tamaño de Empresa
                            </label>
                            <select
                              id="tamanoEmpresa"
                              name="tamanoEmpresa"
                              value={formData.tamanoEmpresa}
                              onChange={handleChange}
                              disabled={isFormLocked}
                              className="w-full px-4 py-2 border rounded-lg text-gray-900 bg-white border-gray-300"
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
                <div className="form-section animate-fadeIn">
                  <div className="mb-6 border rounded-lg overflow-hidden shadow-sm">
                    <div 
                      className="bg-lime-50 px-4 py-3 flex justify-between items-center cursor-pointer"
                      onClick={() => toggleSection('financial')}
                    >
                      <h3 className="font-medium text-slate-700">Información Financiera</h3>
                      <div className={`transform transition-transform ${expandedSections.financial ? 'rotate-180' : ''}`}>
                        <FaChevronDown />
                      </div>
                    </div>
                    
                    <div className={`transition-all duration-300 overflow-hidden ${
                      expandedSections.financial ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
                    }`}>
                      <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label htmlFor="ingresosMensuales" className="block text-sm font-medium text-gray-700">
                              Ingresos Mensuales Promedio
                            </label>
                            <input
                              type="number"
                              id="ingresosMensuales"
                              name="ingresosMensuales"
                              value={formData.ingresosMensuales}
                              onChange={handleChange}
                              disabled={isFormLocked}
                              className="w-full px-4 py-2 border rounded-lg text-gray-900 bg-white border-gray-300"
                              placeholder="0"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label htmlFor="patrimonio" className="block text-sm font-medium text-gray-700">
                              Patrimonio
                            </label>
                            <input
                              type="number"
                              id="patrimonio"
                              name="patrimonio"
                              value={formData.patrimonio}
                              onChange={handleChange}
                              disabled={isFormLocked}
                              className="w-full px-4 py-2 border rounded-lg text-gray-900 bg-white border-gray-300"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Paso 4: Información Bancaria */}
              {currentStep === 3 && (
                <div className="form-section animate-fadeIn">
                  <div className="mb-6 border rounded-lg overflow-hidden shadow-sm">
                    <div 
                      className="bg-violet-50 px-4 py-3 flex justify-between items-center cursor-pointer"
                      onClick={() => toggleSection('banking')}
                    >
                      <h3 className="font-medium text-slate-700">Información Bancaria</h3>
                      <div className={`transform transition-transform ${expandedSections.banking ? 'rotate-180' : ''}`}>
                        <FaChevronDown className="text-slate-500"/>
                      </div>
                    </div>
                    
                    <div className={`transition-all duration-300 overflow-hidden ${
                      expandedSections.banking ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
                    }`}>
                      <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <label htmlFor="entidadBancaria" className="block text-sm font-medium text-gray-700">
                              Entidad Bancaria
                            </label>
                            <input
                              type="text"
                              id="entidadBancaria"
                              name="entidadBancaria"
                              value={formData.entidadBancaria}
                              onChange={handleChange}
                              disabled={isFormLocked}
                              className="w-full px-4 py-2 border rounded-lg text-gray-900 bg-white border-gray-300"
                              placeholder="Nombre del banco"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label htmlFor="tipoCuenta" className="block text-sm font-medium text-gray-700">
                              Tipo de Cuenta
                            </label>
                            <select
                              id="tipoCuenta"
                              name="tipoCuenta"
                              value={formData.tipoCuenta}
                              onChange={handleChange}
                              disabled={isFormLocked}
                              className="w-full px-4 py-2 border rounded-lg text-gray-900 bg-white border-gray-300"
                            >
                              <option value="Ahorros">Ahorros</option>
                              <option value="Corriente">Corriente</option>
                            </select>
                          </div>
                          
                          <div className="space-y-2">
                            <label htmlFor="numeroCuenta" className="block text-sm font-medium text-gray-700">
                              Número de Cuenta
                            </label>
                            <input
                              type="text"
                              id="numeroCuenta"
                              name="numeroCuenta"
                              value={formData.numeroCuenta}
                              onChange={handleChange}
                              disabled={isFormLocked}
                              className="w-full px-4 py-2 border rounded-lg text-gray-900 bg-white border-gray-300"
                              placeholder="Número de cuenta bancaria"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Paso 5: Documentos Requeridos */}
              {currentStep === 4 && (
                <div className="form-section animate-fadeIn">
                  <div className="mb-6 border rounded-lg overflow-hidden shadow-sm">
                    <div 
                      className="bg-rose-50 px-4 py-3 flex justify-between items-center cursor-pointer"
                      onClick={() => toggleSection('documents')}
                    >
                      <h3 className="font-medium text-slate-700">Documentos Requeridos</h3>
                      <div className={`transform transition-transform ${expandedSections.documents ? 'rotate-180' : ''}`}>
                        <FaChevronDown />
                      </div>
                    </div>
                    
                    <div className={`transition-all duration-300 overflow-hidden ${
                      expandedSections.documents ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
                    }`}>
                      <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label htmlFor="fotocopiaCedula" className="block text-sm font-medium text-gray-700 mb-1">
                              Fotocopia Cédula*
                            </label>
                            <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-all ${
                              formData.fotocopiaCedula ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-blue-400'
                            }`}>
                              <input
                                type="file"
                                id="fotocopiaCedula"
                                name="fotocopiaCedula"
                                onChange={handleFileChange}
                                className="hidden"
                                required={!existingProfile?.fotocopiaCedula}
                                disabled={isFormLocked}
                              />
                              
                              {formData.fotocopiaCedula ? (
                                <div className="py-2">
                                  <FaFileAlt className="mx-auto h-8 w-8 text-green-500 mb-2" />
                                  <p className="text-sm text-gray-600 truncate">
                                    {formData.fotocopiaCedula.name}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newFormData = {...formData};
                                      newFormData.fotocopiaCedula = null;
                                      setFormData(newFormData);
                                    }}
                                    className="mt-2 text-xs text-red-600 hover:text-red-800"
                                    disabled={isFormLocked}
                                  >
                                    Eliminar archivo
                                  </button>
                                </div>
                              ) : (
                                <label htmlFor="fotocopiaCedula" className="cursor-pointer py-6 block">
                                  <FaUpload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                                  <p className="text-sm text-gray-500">
                                    {existingProfile?.fotocopiaCedula ? 'Archivo ya cargado. Haz clic para reemplazar' : 'Haz clic para seleccionar archivo'}
                                  </p>
                                </label>
                              )}
                            </div>
                            {fieldErrors.fotocopiaCedula && (
                              <p className="text-red-500 text-xs mt-1">{fieldErrors.fotocopiaCedula}</p>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <label htmlFor="fotocopiaRut" className="block text-sm font-medium text-gray-700 mb-1">
                              Fotocopia RUT*
                            </label>
                            <div className={`border-2 border-dashed rounded-lg p-4 text-center transition-all ${
                              formData.fotocopiaRut ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-blue-400'
                            }`}>
                              <input
                                type="file"
                                id="fotocopiaRut"
                                name="fotocopiaRut"
                                onChange={handleFileChange}
                                className="hidden"
                                required={!existingProfile?.fotocopiaRut}
                                disabled={isFormLocked}
                              />
                              
                              {formData.fotocopiaRut ? (
                                <div className="py-2">
                                  <FaFileAlt className="mx-auto h-8 w-8 text-green-500 mb-2" />
                                  <p className="text-sm text-gray-600 truncate">
                                    {formData.fotocopiaRut.name}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newFormData = {...formData};
                                      newFormData.fotocopiaRut = null;
                                      setFormData(newFormData);
                                    }}
                                    className="mt-2 text-xs text-red-600 hover:text-red-800"
                                    disabled={isFormLocked}
                                  >
                                    Eliminar archivo
                                  </button>
                                </div>
                              ) : (
                                <label htmlFor="fotocopiaRut" className="cursor-pointer py-6 block">
                                  <FaUpload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                                  <p className="text-sm text-gray-500">
                                    {existingProfile?.fotocopiaRut ? 'Archivo ya cargado. Haz clic para reemplazar' : 'Haz clic para seleccionar archivo'}
                                  </p>
                                </label>
                              )}
                            </div>
                            {fieldErrors.fotocopiaRut && (
                              <p className="text-red-500 text-xs mt-1">{fieldErrors.fotocopiaRut}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Botones de navegación */}
              <div className="flex justify-between pt-6 mt-6 border-t">
                {currentStep > 0 && (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors flex items-center"
                  >
                    <FaChevronLeft className="mr-2" /> Anterior
                  </button>
                )}
                
                <div className="ml-auto flex space-x-3">
                  <button
                    type="button"
                    className="px-6 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
                    onClick={onClose}
                  >
                    Cancelar
                  </button>
                  
                  {currentStep < steps.length - 1 ? (
                    <button
                      type="button"
                      onClick={nextStep}
                      className="px-6 py-2 bg-blue-600 rounded-lg text-white hover:bg-blue-700 transition-colors flex items-center"
                    >
                      Siguiente <FaChevronRight className="ml-2" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={loading || isFormLocked}
                      className={`px-6 py-2 rounded-lg text-white flex items-center ${
                        loading || isFormLocked ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'
                      } transition-colors`}
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                          Guardando...
                        </>
                      ) : (
                        <>
                          {existingProfile ? 'Actualizar Perfil' : 'Guardar Perfil'} <FaCheck className="ml-2" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
      
      {/* Modal de confirmación */}
      {showConfirmation && (
        <ConfirmationModal
          isSuccess={confirmationIsSuccess}
          message={confirmationMessage}
          onClose={handleConfirmationClose}
        />
      )}
      
      {/* Indicador de carga */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl flex items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mr-3"></div>
            <p className="text-slate-700">Guardando información...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientProfile;