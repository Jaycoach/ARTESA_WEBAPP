import { createContext, useState, useEffect } from "react";

const AuthContext = createContext(); // Crear contexto

export const AuthProvider = ({ children }) => { 
  
  const [user, setUser] = useState(() => {
    if (typeof window !== "undefined") {
      const storedUser = localStorage.getItem("user");
      if (storedUser && storedUser !== "undefined") {
        try {
          return JSON.parse(storedUser);
        } catch (error) {
          console.error("Error al parsear 'user' inicial:", error);
          return null;
        }
      }
    }
    return null;
  });
  useEffect(() => {
    // Recuperar usuario de localStorage si existe
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error("Error al parsear usuario del localStorage:", error);
      }
    }
  }, []);

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;