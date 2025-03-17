import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../App.scss';
import imgLogo1 from "../../LoginsAssets/logo_artesa_alt.png";
import imgBanner from "../../LoginsAssets/Banner_.png";
import imgBanBeneficios from "../../LoginsAssets/Banner_Beneficios.png";
import imgVenta1 from "../../LoginsAssets/Compra_1.png";
import imgVenta2 from "../../LoginsAssets/Compra_2.png";
import imgVenta3 from "../../LoginsAssets/Compra_3.png";

const Home = () => {

  const navigate = useNavigate();

  return (
    <div className="bg-gray-100 min-h-screen font-montserrat">


{/* Header */}      
<div className="bg-sky-700 py-4 text-white text-center font-bold text-sm md:text-lg shadow-md">
  <span className="block">PIDE TU DOMICILIO ARTESA AQUÍ</span>
</div>

<header className="bg-white py-6 px-12 md:px-24 text-black font-bold text-sm md:text-lg flex items-center justify-center shadow-md gap-2">

  {/* Barra de búsqueda más compacta */}
  <div className="w-1/3 flex justify-center">
    <div className="flex items-center bg-white rounded-lg px-3 py-2 shadow-md w-full max-w-[300px]">
      <input 
        type="text" 
        placeholder="¿Tengo antojos de...?" 
        className="bg-transparent focus:outline-none text-gray-800 w-full text-xs"
      />
      <button className="ml-1 text-gray-600 hover:text-gray-800">
        🔍
      </button>
    </div>
  </div>

  {/* Logo más centrado y con padding ajustado */}
  <div className="w-1/3 flex justify-center">
    <img src={imgLogo1} alt="Panadería Logo" className="h-14 md:h-16" />
  </div>

  {/* Eslogan centrado con más padding lateral */}
  <div className="w-1/3 flex justify-center">
    <span className="text-xs md:text-sm text-center">Un mundo de PAN por descubrir</span>
  </div>

</header>





<div className="bg-sky-100 p-6">
  {/* Navegación centrada en horizontal con más separación */}
  <nav className="flex justify-center items-center gap-16 text-lg text-white font-semibold">
    <a href="#productos" className="hover:text-orange-500 transition-colors duration-300">Productos</a>
    <a href="#blog" className="hover:text-orange-500 transition-colors duration-300">Blog</a>
    <a href="#contacto" className="hover:text-orange-500 transition-colors duration-300">Contacto</a>
    <a href='/original-home' className="hover:text-orange-500 transition-colors duration-300">Iniciar sesión</a>
  </nav>
</div>


      
 {/* Sección publicidad */}
 <section className="bg-white p-10 rounded-lg shadow-lg flex justify-center items-center">
    <img 
      src={imgBanner}
      alt="Imagen destacada" 
      className="max-w-full h-auto"
    />
  </section>



 {/* Sección beneficios */}
 <section className="bg-white rounded-lg shadow-lg flex justify-center items-center">
    <img 
      src={imgBanBeneficios}
      alt="Imagen destacada" 
      className="max-w-full h-auto"
    />
  </section>
  

{/* Main Content */}
      <main className="container mx-auto p-6">
        

      <section className="container mx-auto p-4 sm:p-6 flex flex-nowrap overflow-x-auto snap-x snap-mandatory gap-5 py-8 sm:py-12">
    {[
      { 
        titulo: "Panadería Gourmet", 
        descripcion: "Pan artesanal con ingredientes frescos y naturales.",
        estrellas: 5,
        img: "https://source.unsplash.com/400x400/?bread"
      },
      { 
        titulo: "Repostería Fina", 
        descripcion: "Postres exquisitos con recetas tradicionales.",
        estrellas: 5,
        img: "https://source.unsplash.com/400x400/?cake"
      },
      { 
        titulo: "Pastelería Exclusiva", 
        descripcion: "Deliciosos pasteles para cada ocasión especial.",
        estrellas: 5,
        img: "https://source.unsplash.com/400x400/?pastry"
      },
      { 
        titulo: "Bollería Artesanal", 
        descripcion: "Bollos y panes con recetas tradicionales de calidad.",
        estrellas: 5,
        img: "https://source.unsplash.com/400x400/?bakery"
      }
    ].map((producto, index) => (
      <div 
        key={index} 
        className="bg-white shadow-lg rounded-lg overflow-hidden min-w-[28%] sm:min-w-[16%] md:min-w-[11%] transition transform hover:scale-105 flex-shrink-0 snap-center"
      >
        
        {/* Primera Fila: Imagen de Fondo (más alta) */}
        <div 
          className="w-full h-48 bg-orange-500 bg-cover bg-center" 
          style={{ backgroundImage: `url(${producto.img})` }}
        ></div>

        {/* Segunda Fila: Contenido con más Padding */}
        <div className="p-5 sm:p-7 text-center">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-800">{producto.titulo}</h3>
          <p className="text-gray-600 mt-2 text-xs line-clamp-2">{producto.descripcion}</p>

          {/* Estrellas de valoración */}
          <div className="flex justify-center mt-3">
            {[...Array(producto.estrellas)].map((_, i) => (
              <span key={i} className="text-yellow-500 text-xs sm:text-lg">⭐</span>
            ))}
          </div>

          {/* Botones alineados */}
          <div className="mt-6 flex justify-center gap-3">
            <button className="bg-white border border-gray-300 text-gray-800 px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-lg hover:bg-gray-200 transition">
              Detalles
            </button>
            <button className="bg-sky-700 text-white px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-lg hover:bg-blue-600 transition">
              Añadir
            </button>
          </div>
        </div>

      </div>
    ))}
  </section>
       

    
{/* VENTA ONLINE Section */}
<section className="bg-orange-300 p-8 rounded-lg shadow-lg text-center flex flex-col items-center">
          <h2 className="text-3xl font-semibold text-black">Productos pasteleros de alta calidad</h2>
          <p className="mt-2 text-black">Programa tu pedido en línea con transporte seguro y pago confiable.</p>
          <button
          onClick={() => navigate('/original-home')} 
          className="mt-4 bg-orange-500 text-white px-6 py-3 rounded-lg shadow-md hover:bg-orange-600 transition">
         Realizar Pedido
        </button>
        </section>

{/*SECCION LUGARES */}
    <section className="container mx-auto p-6 flex gap-6 overflow-x-auto md:justify-center flex-nowrap">
      {[
        { 
          titulo: "Lugar 1", 
          descripcion: "Artesa Panadería Cedritos",
          mapa: "https://maps.google.com/?q=Lugar+1"
        },
        { 
          titulo: "Lugar 2", 
          descripcion: "Artesa Panadería Colina",
          mapa: "https://maps.google.com/?q=Lugar+2"
        },
        { 
          titulo: "Lugar 3", 
          descripcion: "Artesa Panadería Santa Paula",
          mapa: "https://maps.google.com/?q=Lugar+3"
        }
      ].map((lugar, index) => (
        <div 
          key={index} 
          className="bg-sky-700 text-white shadow-lg rounded-lg w-64 h-64 flex flex-col justify-between p-6 flex-shrink-0"
        >
          {/* Título */}
          <h3 className="text-xl font-bold text-center">{lugar.titulo}</h3>

          {/* Descripción */}
          <p className="text-center text-sm">{lugar.descripcion}</p>

          {/* Botón de Ver Ubicación */}
          <div className="flex justify-center">
            <a 
              href={lugar.mapa} 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-white text-sky-600 px-4 py-2 text-lg font-semibold rounded-lg border border-white hover:bg-gray-200 transition"
            >
              Ver Ubicación
            </a>
          </div>
        </div>
      ))}
    </section>

  </main>

  <hr />
      



{/* Pie de Página */}
<footer id="contacto" className="bg-gray-800 text-white p-6 text-center mt-10">


{/* Footer */}

<section className="container mx-auto p-6 text-white">
  
  {/* Contenedor de la tabla sin encabezado */}
  <div className="overflow-x-auto">
    <table className="w-full border-collapse text-left">
      <tbody>
        <tr className="align-top">
          {/* Primera Columna - Color Morado SIN TEXTO */}
          <td className="p-4 w-1/6 "></td>

          {/* Segunda Columna - Color Gris */}
          <td className="p-4 w-1/6">
            <h3 className="text-xl font-semibold">Servicios</h3>
            <ul className="mt-2 space-y-1">
              <li>Envíos</li>
              <li>Pedidos Especiales</li>
              <li>Facturación</li>
              <li>Atención al Cliente</li>
            </ul>
          </td>

          {/* Columna 3 */}
          <td className="p-4 w-1/6">
            <h3 className="text-xl font-semibold">Nosotros</h3>
            <ul className="mt-2 space-y-1">
              <li>Historia</li>
              <li>Equipo</li>
              <li>Valores</li>
              <li>Ubicaciones</li>
            </ul>
          </td>

          {/* Columna 4 */}
          <td className="p-4 w-1/6">
            <h3 className="text-xl font-semibold">Contacto</h3>
            <ul className="mt-2 space-y-1">
              <li>Teléfono</li>
              <li>Email</li>
              <li>WhatsApp</li>
              <li>Soporte Técnico</li>
            </ul>
          </td>

  

          {/* Columna 5 */}
          <td className="p-4 w-1/6">
            <h3 className="text-xl font-semibold">Ubicación</h3>
            <ul className="mt-2 space-y-1">
              <li>Bogotá, Colombia</li>
              <li>Carrera 35 # 17a - 61</li>
              <li>Código Postal 11001</li>
              <li>Colombia</li>
            </ul>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

</section>
  



  
  <div className="flex flex-nowrap gap-4 mt-4">
  <p>Contacto: Carrera 35 # 17a - 61 Bogotá, Colombia</p>
    <a href="#" className="text-white hover:text-secondary-color">Facebook</a>
    <a href="#" className="text-white hover:text-secondary-color">Instagram</a>
    <a href="#" className="text-white hover:text-secondary-color">WhatsApp</a>
  </div>
</footer>
    </div>
  );
};

export default Home;
