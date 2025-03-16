import React from 'react';
import '../../App.scss';

const Home = () => {
  return (
    <div className="bg-gray-100 min-h-screen font-montserrat">
      {/* Header */}
      <header className="bg-yellow-500 p-4 text-white text-center font-bold text-xl flex items-center justify-between px-8 shadow-md">
        <img src="/logo.png" alt="Panadería Logo" className="h-14" />
        <span>Un mundo de PAN por descubrir</span>
        <nav className="hidden md:flex gap-6 text-lg">
          <a href="#productos" className="hover:underline">Productos</a>
          <a href="#blog" className="hover:underline">Blog</a>
          <a href="#contacto" className="hover:underline">Contacto</a>
          <a href="#login" className="hover:underline">Iniciar sesión</a>
        </nav>
      </header>
      
      {/* Main Content */}
      <main className="container mx-auto p-6">
        {/* Hero Section */}
        <section className="bg-white p-8 rounded-lg shadow-lg text-center flex flex-col items-center">
          <h2 className="text-3xl font-semibold text-gray-800">Productos pasteleros de alta calidad</h2>
          <p className="mt-2 text-gray-600">Programa tu pedido en línea con transporte seguro y pago confiable.</p>
          <button className="mt-4 bg-accent-color text-white px-6 py-3 rounded-lg shadow-md hover:bg-hover-color">Realizar Pedido</button>
        </section>

        {/* Product Categories */}
        <section id="productos" className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-lg flex flex-col items-center text-center">
            <h3 className="font-semibold text-xl">Categoría 2</h3>
            <p className="text-gray-600 mt-2">$0.00</p>
            <p className="text-gray-500">Producto descripción</p>
            <button className="mt-4 bg-yellow-500 text-white px-4 py-2 rounded hover:bg-hover-color">Detalles</button>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-lg flex flex-col items-center text-center">
            <h3 className="font-semibold text-xl">Categoría 3</h3>
            <p className="text-gray-600 mt-2">$0.00</p>
            <p className="text-gray-500">Producto descripción</p>
            <button className="mt-4 bg-yellow-500 text-white px-4 py-2 rounded hover:bg-hover-color">Detalles</button>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-lg flex flex-col items-center text-center">
            <h3 className="font-semibold text-xl">PASTELES</h3>
            <p className="text-gray-600 mt-2">$7,800</p>
            <p className="text-gray-500">Croissant Tradicional</p>
            <button className="mt-4 bg-yellow-500 text-white px-4 py-2 rounded hover:bg-hover-color">Detalles</button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer id="contacto" className="bg-gray-800 text-white p-6 text-center mt-10">
        <p>Contacto: Carrera 35 # 17a - 61 Bogotá, Colombia</p>
        <p>Peticiones, Quejas y Reclamos | Política de envíos | Política de tratamiento de datos</p>
        <div className="flex justify-center gap-4 mt-4">
          <a href="#" className="text-white hover:text-secondary-color">Facebook</a>
          <a href="#" className="text-white hover:text-secondary-color">Instagram</a>
          <a href="#" className="text-white hover:text-secondary-color">WhatsApp</a>
        </div>
      </footer>
    </div>
  );
};

export default Home;
