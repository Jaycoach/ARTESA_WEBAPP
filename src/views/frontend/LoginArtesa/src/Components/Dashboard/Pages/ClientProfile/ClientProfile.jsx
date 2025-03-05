import React, { useState, useEffect } from 'react';
import '../../../../App.scss';
import API from '../../../../api/config';
import { FaTimes, FaUpload } from 'react-icons/fa';

const ClientProfile = ({ user, onClose, onProfileUpdate }) => {
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
  const [success, setSuccess] = useState('');
  const [existingProfile, setExistingProfile] = useState(null);
  
  useEffect(() => {
    // Verificar si el usuario ya tiene un perfil
    const fetchProfile = async () => {
      try {
        // Intentar obtener el perfil del usuario desde la API
        const response = await API.get(`/client-profile/${user.id}`);
        
        // Si existe un perfil, actualizar el estado
        if (response.data) {
          setExistingProfile(response.data);
          
          // Precargar los datos existentes (excepto los archivos)
          const profileData = { ...response.data };
          delete profileData.fotocopiaCedula;
          delete profileData.fotocopiaRut;
          delete profileData.anexosAdicionales;
          
          setFormData(prev => ({
            ...prev,
            ...profileData,
          }));
          
          console.log('Perfil cargado desde la API');
        }
      } catch (error) {
        console.log('No existe perfil previo o error al obtenerlo');
        
        // Si no existe perfil, inicializar con el email del usuario logueado
        if (user) {
          setFormData(prev => ({
            ...prev,
            email: user.mail || user.email || '', // Consideramos ambos campos por compatibilidad
            nombre: user.nombre || user.name || '' 
          }));
        }
      }
    };
    
    if (user && user.id) {
      fetchProfile();
    } else if (user) {
      // Si hay usuario pero no tiene ID, al menos usamos su email
      setFormData(prev => ({
        ...prev,
        email: user.mail || user.email || '',
        nombre: user.nombre || user.name || ''
      }));
    }
  }, [user]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleFileChange = (e) => {
    const { name, files } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: files[0]
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Crear FormData para enviar archivos
      const formDataToSend = new FormData();
      
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
      formDataToSend.append('userId', user.id);
      
      // Endpoint correcto dependiendo si es creación o actualización
      const endpoint = existingProfile 
        ? `/client-profile/${user.id}` 
        : '/client-profile';
      
      const method = existingProfile ? 'put' : 'post';
      
      // Realizar la solicitud a la API
      const response = await API({
        method,
        url: endpoint,
        data: formDataToSend,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      // Guardar perfil en localStorage para acceso rápido
    localStorage.setItem('clientProfile', JSON.stringify({
        nombre: formData.nombre,
        email: formData.email
      }));
      
      // Notificar al Dashboard sobre el cambio de nombre si existe la función
      if (typeof onProfileUpdate === 'function') {
        onProfileUpdate(formData.nombre);
      }
      
      setSuccess('Perfil guardado correctamente');
      setExistingProfile(response.data);
    } catch (error) {
      setError(error.response?.data?.message || 'Error al guardar el perfil');
    } finally {
      setLoading(false);
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
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="nit">NIT</label>
                  <input 
                    type="text" 
                    id="nit" 
                    name="nit" 
                    value={formData.nit} 
                    onChange={handleChange} 
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
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="tamanoEmpresa">Tamaño de Empresa</label>
                  <select 
                    id="tamanoEmpresa" 
                    name="tamanoEmpresa" 
                    value={formData.tamanoEmpresa} 
                    onChange={handleChange}
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
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="tipoCuenta">Tipo de Cuenta</label>
                  <select 
                    id="tipoCuenta" 
                    name="tipoCuenta" 
                    value={formData.tipoCuenta} 
                    onChange={handleChange}
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
                  />
                </div>
              </div>
            </div>
            
            {/* Sección 5: Contacto Alternativo */}
            <div className="form-section">
              <h3 className="section-title">Contacto Alternativo</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="nombreContacto">Nombre de Contacto</label>
                  <input 
                    type="text" 
                    id="nombreContacto" 
                    name="nombreContacto" 
                    value={formData.nombreContacto} 
                    onChange={handleChange} 
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="cargoContacto">Cargo</label>
                  <input 
                    type="text" 
                    id="cargoContacto" 
                    name="cargoContacto" 
                    value={formData.cargoContacto} 
                    onChange={handleChange} 
                  />
                </div>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="telefonoContacto">Teléfono de Contacto</label>
                  <input 
                    type="tel" 
                    id="telefonoContacto" 
                    name="telefonoContacto" 
                    value={formData.telefonoContacto} 
                    onChange={handleChange} 
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="emailContacto">Email de Contacto</label>
                  <input 
                    type="email" 
                    id="emailContacto" 
                    name="emailContacto" 
                    value={formData.emailContacto} 
                    onChange={handleChange} 
                  />
                </div>
              </div>
            </div>
            
            {/* Sección 6: Documentos Requeridos */}
            <div className="form-section">
              <h3 className="section-title">Documentos Requeridos</h3>
              <div className="form-row">
                <div className="form-group file-upload">
                  <label htmlFor="fotocopiaCedula">
                    Fotocopia Cédula*
                    {formData.fotocopiaCedula && (
                      <span className="file-selected"> (Archivo seleccionado)</span>
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
                  </label>
                  <div className="file-input-container">
                    <input 
                      type="file" 
                      id="fotocopiaRut" 
                      name="fotocopiaRut" 
                      onChange={handleFileChange} 
                      className="file-input"
                      required={!existingProfile?.fotocopiaRut}
                    />
                    <label htmlFor="fotocopiaRut" className="file-label">
                      <FaUpload /> Seleccionar Archivo
                    </label>
                  </div>
                </div>
                
                <div className="form-group file-upload">
                  <label htmlFor="anexosAdicionales">
                    Anexos Adicionales
                    {formData.anexosAdicionales && (
                      <span className="file-selected"> (Archivo seleccionado)</span>
                    )}
                  </label>
                  <div className="file-input-container">
                    <input 
                      type="file" 
                      id="anexosAdicionales" 
                      name="anexosAdicionales" 
                      onChange={handleFileChange} 
                      className="file-input"
                    />
                    <label htmlFor="anexosAdicionales" className="file-label">
                      <FaUpload /> Seleccionar Archivo
                    </label>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="form-actions">
              <button type="button" className="cancel-btn" onClick={onClose}>
                Cancelar
              </button>
              <button 
                type="submit" 
                className="submit-btn" 
                disabled={loading}
              >
                {loading ? 'Guardando...' : existingProfile ? 'Actualizar Perfil' : 'Guardar Perfil'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ClientProfile;