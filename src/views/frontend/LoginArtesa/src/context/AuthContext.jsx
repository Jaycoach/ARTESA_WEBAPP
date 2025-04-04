import React, { createContext, useState, useEffect } from "react";
import API from "../api/config";

// Crear el contexto de autenticación
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Efecto para verificar si hay sesión al cargar la app
  useEffect(() => {
    const checkAuthState = async () => {
      const token = localStorage.getItem("token");
      const storedUser = localStorage.getItem("user");
      const storedProfile = localStorage.getItem("clientProfile");

      if (token && storedUser) {
        try {
          // Parsear el usuario almacenado
          let userData = JSON.parse(storedUser);

          // Normalizar is_active como booleano
          if (userData.is_active !== undefined) {
            userData.is_active = typeof userData.is_active === 'string' ? 
              userData.is_active.toLowerCase() === 'true' : 
              Boolean(userData.is_active);
          } else {
            userData.is_active = true; // Valor predeterminado si no existe
          }

          console.log("Usuario recuperado del localStorage:", userData);
          
          // Asegurarnos de que el rol sea un número (manejar estructura anidada)
          if (userData.role) {
            // Si role es un objeto, extraer el id
            if (typeof userData.role === 'object' && userData.role !== null && userData.role.id) {
              console.log("Role es un objeto, extrayendo id:", userData.role);
              userData.role = parseInt(userData.role.id);
            } else if (typeof userData.role === 'string' || typeof userData.role === 'number') {
              // Si role ya es un string o número, intentar convertir a número
              userData.role = parseInt(userData.role);
            }
            console.log("Role convertido a número:", userData.role);
          }
          
          // Si existe un perfil guardado, combinar su información con userData
          if (storedProfile) {
            const profileData = JSON.parse(storedProfile);
            // Asegurarse de preservar el campo is_active
            const isActive = userData.is_active !== undefined ? userData.is_active : true;
            userData = { ...userData, ...profileData, is_active: isActive };
          }
          
          // Establecer el usuario combinado
          setUser(userData);
          setIsAuthenticated(true);
        } catch (error) {
          console.error("Error verificando sesión:", error);
          // Si hay un error, limpiar el localStorage
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          localStorage.removeItem("clientProfile");
          setError("Sesión inválida o expirada");
        }
      }
      
      setLoading(false);
    };

    checkAuthState();
  }, []);

  // Función para actualizar la información del usuario
  const updateUserInfo = (updatedUserData) => {
    if (!user) return;
    
    // Preservar el estado de activación del usuario
    const isActive = user.is_active !== undefined ? user.is_active : true;
    
    // Combinar datos existentes con los actualizados, preservando is_active
    const newUserData = { ...user, ...updatedUserData, is_active: isActive };
    
    // Actualizar el estado
    setUser(newUserData);
    
    // También actualizar en localStorage
    localStorage.setItem("user", JSON.stringify(newUserData));
    
    // Si hay información de perfil, actualizar clientProfile
    if (updatedUserData.nombre) {
      const profileData = { 
        nombre: updatedUserData.nombre, 
        email: updatedUserData.email || user.email || user.mail 
      };
      localStorage.setItem("clientProfile", JSON.stringify(profileData));
    }
  };

  // Función para iniciar sesión
  const login = async (credentials) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await API.post("/auth/login", credentials);
      // Asegurarnos de acceder a la estructura correcta
      const responseData = response.data;
      // Extraer userData que puede estar en data.data o en data directo
      const userData = responseData.data || responseData;
      
      console.log("Respuesta completa del login:", responseData);
      console.log("Datos de usuario extraídos:", userData);

      // Verificar si el usuario necesita verificar su correo
      if (responseData.needsVerification || userData.needsVerification) {
        console.log("El usuario necesita verificar su correo");
        throw {
            response: {
                data: {
                    needsVerification: true,
                    message: "Por favor verifica tu correo electrónico antes de acceder"
                }
            }
        };
    }
      
      // Verificar la estructura de los datos recibidos
      let userObject = userData.user || userData;
      
      // Asegurarnos de que el rol esté presente como un número
      // Manejar estructura de rol anidada
      if (userObject.role) {
        // Si role es un objeto, extraer el id
        if (typeof userObject.role === 'object' && userObject.role !== null && userObject.role.id) {
          console.log("Role es un objeto, extrayendo id:", userObject.role);
          userObject.role = parseInt(userObject.role.id);
        } else if (typeof userObject.role === 'string' || typeof userObject.role === 'number') {
          // Si role ya es un string o número, intentar convertir a número
          userObject.role = parseInt(userObject.role);
        }
        console.log("Role convertido a número durante login:", userObject.role);
      }
      
      console.log("Objeto de usuario final:", userObject);
      
      // Verificar si hay un perfil guardado previamente
      const storedProfile = localStorage.getItem("clientProfile");
      let userWithProfile = userObject;

      // Asegurarse de que is_active sea un booleano
      const isActive = userObject.is_active !== undefined ? 
      (typeof userObject.is_active === 'string' ? 
        userObject.is_active.toLowerCase() === 'true' : 
        Boolean(userObject.is_active)) : 
      true;
      userWithProfile.is_active = isActive;

      if (storedProfile) {
        // Combinar información del perfil con la del usuario
        const profileData = JSON.parse(storedProfile);
        if (profileData.nombre && profileData.email === (userObject.email || userObject.mail)) {
          userWithProfile = { ...userObject, ...profileData, is_active: isActive };
        }
      }
      
      // Guardar en localStorage
      localStorage.setItem("token", userData.token);
      localStorage.setItem("user", JSON.stringify(userWithProfile));
      
      // Actualizar estado
      setUser(userWithProfile);
      setIsAuthenticated(true);
      
      console.log("Login exitoso, datos de usuario guardados:", userWithProfile);
      
      return userData;
    } catch (error) {
      console.error("Error en login:", error);
      setError(error.response?.data?.message || "Error al iniciar sesión");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Función para el reenvío de verificación
  const resendVerificationEmail = async (email) => {
    setLoading(true);
    setError(null);
    
    try {
        const response = await API.post("/auth/resend-verification", { email });
        return response.data;
    } catch (error) {
        setError(error.response?.data?.message || "Error al reenviar verificación");
        throw error;
    } finally {
        setLoading(false);
    }
  };

  // Función para cerrar sesión
  const logout = () => {
    // Limpiar localStorage
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    // No eliminamos clientProfile para mantener preferencias entre sesiones
    
    // Actualizar estado
    setUser(null);
    setIsAuthenticated(false);
    
    console.log("Sesión cerrada correctamente");
  };

  // Funciones para registro y recuperación de contraseña
  const register = async (userData) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await API.post("/auth/register", userData);
      return response.data;
    } catch (error) {
      setError(error.response?.data?.message || "Error en el registro");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const requestPasswordReset = async (email) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await API.post("/password/request-reset", { mail: email });
      console.log("Respuesta del backend:", response.data);
      return response.data;
    } catch (error) {
      setError(error.response?.data?.message || "Error al solicitar recuperación");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (token, password) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await API.post("/password/reset", { token, password });
      return response.data;
    } catch (error) {
      setError(error.response?.data?.message || "Error al restablecer contraseña");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Verificar permisos de administrador
  const isAdmin = () => {
    if (!user) return false;
    
    // Verificar en múltiples propiedades donde podría estar el rol
    const role = user.role || user.rol;
    
    if (role === undefined || role === null) {
      console.log("No se encontró propiedad de rol en el usuario:", user);
      return false;
    }
    
    // Intentar convertir a número
    if (typeof role === 'string') {
      const roleNumber = parseInt(role);
      if (!isNaN(roleNumber)) {
        return roleNumber === 1 || roleNumber === 3;
      }
      // Si es string pero no se puede convertir, comparar directamente
      return role === "1" || role === "3";
    }
    
    // Si ya es número
    if (typeof role === 'number') {
      return role === 1 || role === 3;
    }
    
    return false;
  };

  // Valor que se proporciona al contexto
  const contextValue = {
    user,
    isAuthenticated,
    loading,
    error,
    login,
    logout,
    register,
    requestPasswordReset,
    resetPassword,
    updateUserInfo,
    isAdmin,
    resendVerificationEmail
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;