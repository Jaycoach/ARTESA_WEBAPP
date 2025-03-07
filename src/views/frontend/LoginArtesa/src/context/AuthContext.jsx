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

      if (token && storedUser) {
        try {
          // Opcionalmente, verificar el token con el backend
          // const response = await API.get("/auth/verify-token");
          
          // Si todo está bien, establecer el usuario
          setUser(JSON.parse(storedUser));
          setIsAuthenticated(true);
        } catch (error) {
          console.error("Error verificando sesión:", error);
          // Si hay un error, limpiar el localStorage
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setError("Sesión inválida o expirada");
        }
      }
      
      setLoading(false);
    };

    checkAuthState();
  }, []);

  // Función para iniciar sesión
  const login = async (credentials) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await API.post("/auth/login", credentials);
      const userData = response.data.data || response.data;
      
      // Guardar en localStorage
      localStorage.setItem("token", userData.token);
      localStorage.setItem("user", JSON.stringify(userData.user));
      
      // Actualizar estado
      setUser(userData.user);
      setIsAuthenticated(true);
      
      return userData;
    } catch (error) {
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
    localStorage.removeItem("clientProfile");
    
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
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;