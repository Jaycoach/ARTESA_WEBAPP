import React from 'react';

const Home = () => {
  return (
    <div className="bg-gray-100 min-h-screen">
      {/* Header */}
      <header className="bg-yellow-500 p-4 text-white text-center font-bold text-xl">
        Un mundo de PAN por descubrir
      </header>
      
      {/* Main Content */}
      <main className="container mx-auto p-4">
        {/* Hero Section */}
        <section className="bg-white p-6 rounded-lg shadow-md text-center">
          <h2 className="text-2xl font-semibold">Productos pasteleros de alta calidad</h2>
          <p className="mt-2">Programa tu pedido en línea con transporte seguro y pago confiable.</p>
        </section>

        {/* Product Categories */}
        <section className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h3 className="font-semibold">Categoría 2</h3>
            <p>$0.00</p>
            <p>Producto descripción</p>
            <button className="mt-2 bg-yellow-500 text-white px-4 py-2 rounded">Detalles</button>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h3 className="font-semibold">Categoría 3</h3>
            <p>$0.00</p>
            <p>Producto descripción</p>
            <button className="mt-2 bg-yellow-500 text-white px-4 py-2 rounded">Detalles</button>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-md">
            <h3 className="font-semibold">PASTELES</h3>
            <p>$7,800</p>
            <p>Croissant Tradicional</p>
            <button className="mt-2 bg-yellow-500 text-white px-4 py-2 rounded">Detalles</button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white p-4 text-center mt-6">
        <p>Contacto: Carrera 35 # 17a - 61 Bogotá, Colombia</p>
        <p>Peticiones, Quejas y Reclamos | Política de envíos | Política de tratamiento de datos</p>
      </footer>
    </div>
  );
};

export default Home;