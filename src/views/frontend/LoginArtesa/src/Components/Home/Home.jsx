import React from 'react';
import { useNavigate } from 'react-router-dom';
import btn_home_1 from '../../HomeAssets/btn_home_1.png';
import btn_home_2 from '../../HomeAssets/btn_home_2.png';

const Home = () => {
  const navigate = useNavigate();
  const user = null;

  const handleNavigation = (path) => {
    navigate(path);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary to-yellow-100 p-4">
      <header className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg">
          Bienvenido a ARTESA
        </h1>
        <p className="text-xl text-gray-100 mt-2">
          Sistema de gestión de pedidos
        </p>
      </header>

      <main className="w-full max-w-4xl bg-white bg-opacity-20 backdrop-blur-lg rounded-xl shadow-xl p-6 md:p-10">
        <section className="flex md:flex-row gap-6 md:gap-10 justify-center">
          <div className="flex flex-col items-center bg-white rounded-lg shadow-lg p-6 transform transition-transform duration-300 hover:scale-105">
            <img
              src={btn_home_1}
              className="w-[250px] h-auto mb-4 rounded-md"
              alt="Cliente Artesa"
            />
            <h2 className="text-2xl font-semibold text-primary mb-2">¿Eres Persona?</h2>
            <p className="text-primary mb-4">Ingresa a nuestra página web!</p>
            <button
              className="w-full bg-homePrimary hover:bg-accent text-white hover:text-white font-semibold py-2 px-4 rounded"
              onClick={() => handleNavigation('/original-home')}
            >
              {user ? 'Ir al Home' : 'Acceder como Cliente'}
            </button>
          </div>

          <div className="flex flex-col items-center bg-white rounded-lg shadow-lg p-6 transform transition-transform duration-300 hover:scale-105">
            <img
              src={btn_home_2}
              className="w-[250px] h-auto mb-4 rounded-md"
              alt="Institución Artesa"
            />
            <h2 className="text-2xl font-semibold text-primary mb-2">¿Eres Empresa?</h2>
            <p className="text-primary mb-4">Portal Pedidos Institucional</p>
            <button
              className="w-full bg-secondaryHome hover:bg-accent text-white font-semibold py-2 px-4 rounded"
              onClick={() => handleNavigation('/login')}
            >
              {user ? 'Ir al Login' : 'Acceder como Empresa'}
            </button>
          </div>
        </section>

        <footer className="mt-8 text-center text-primary text-sm">
          Creado para LA ARTESA ®2025
        </footer>
      </main>
    </div>
  );
};

export default Home;