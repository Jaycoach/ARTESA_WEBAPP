import { createContext, useState, useEffect } from "react";

const AuthContext = createContext(); // Crear contexto

export const AuthProvider = ({ children }) => { 
  const defaultUser = { name: "Usuario de Prueba" };
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Recuperar usuario de localStorage si existe
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (storedUser) {
      setUser(storedUser);
    }else {
      setUser(defaultUser);
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

export default AuthContext; // Exportar el contexto por defecto