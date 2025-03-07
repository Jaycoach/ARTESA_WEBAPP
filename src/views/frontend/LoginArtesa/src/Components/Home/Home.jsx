import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.scss';
import '../../App.css'; // Ruta correcta a App.css

const Home = () => {
  const navigate = useNavigate();
  const user = null;
  
  const handleNavigation = (path) => {
    navigate(path);
  };
  
  return (
    <div className="home-container">
      <header className="hero-section">
        <div className="hero-content">
          <h1>Bienvenido a ARTESA</h1>
          <p>Portal de gestión y compras</p>
        </div>
      </header>

      <main className="main-content">
        <section className="user-selection">
          <div className="selection-card">
            <h2>¿Eres Cliente?</h2>
            <p>Ingresa a nuestra página web</p>
            <button 
              className="artesa-btn primary"
              onClick={() => window.open('https://www.artesa.com', '_blank')}
            >
              {user ? 'Ir al Home' : 'Acceder como Cliente'}
            </button>
          </div>

          <div className="selection-card">
            <h2>¿Eres Empresa?</h2>
            <p>Compras empresariales, portal transaccional</p>
            <button 
              className="artesa-btn primary"
              onClick={() => handleNavigation('/login')}
            >
              {user ? 'Ir al Dashboard' : 'Acceder como Empresa'}
            </button>
          </div>
        </section>

        <div className="legal-notice">
          <p>© LA ARTESA 2025 - Todos los derechos reservados</p>
        </div>
      </main>
    </div>
  );
};

export default Home;