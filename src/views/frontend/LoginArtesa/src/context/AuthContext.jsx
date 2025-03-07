// src/context/AuthContext.jsx
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
          
          // Si existe un perfil guardado, combinar su información con userData
          if (storedProfile) {
            const profileData = JSON.parse(storedProfile);
            userData = { ...userData, ...profileData };
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
    
    // Combinar datos existentes con los actualizados
    const newUserData = { ...user, ...updatedUserData };
    
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
      
      // Verificar si hay un perfil guardado previamente
      const storedProfile = localStorage.getItem("clientProfile");
      let userWithProfile = userData.user;
      
      if (storedProfile) {
        // Combinar información del perfil con la del usuario
        const profileData = JSON.parse(storedProfile);
        if (profileData.nombre && profileData.email === (userData.user.email || userData.user.mail)) {
          userWithProfile = { ...userData.user, ...profileData };
        }
      }
      
      // Guardar en localStorage
      localStorage.setItem("token", userData.token);
      localStorage.setItem("user", JSON.stringify(userWithProfile));
      
      // Actualizar estado
      setUser(userWithProfile);
      setIsAuthenticated(true);
      
      console.log("Login exitoso, datos de usuario:", userWithProfile);
      
      return userData;
    } catch (error) {
      console.error("Error en login:", error);
      setError(error.response?.data?.message || "Error al iniciar sesión");
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
      const response = await API.post("/password/request-reset", { email });
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
    updateUserInfo
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;