import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react'; 
import btn_home_1 from '../../HomeAssets/btn_home_1.png';
import btn_home_2 from '../../HomeAssets/btn_home_2.png';
import btn_home_1_hover from '../../HomeAssets/btn_home_1_hover.png';
import btn_home_2_hover from '../../HomeAssets/btn_home_2_hover.png';
import Footerico from '../../HomeAssets/Icono_footer_new.png';
import { FaInstagram, FaTiktok, FaFacebook, FaLinkedin } from "react-icons/fa";
import imgFondoVenta from '../../HomeAssets/Venta_Online.gif';
import imgLogo1 from "../../HomeAssets/logo_artesa_new.png";
import iconPago from '../../HomeAssets/icon_pago.png';
import iconCasa from '../../HomeAssets/icon_casa.png';
import iconSeguro from '../../HomeAssets/icon_seguro.png';
import imgPareja from '../../HomeAssets/pareja-pagando.png';
import imgLugar from "../../HomeAssets/paga-lugar.png";
import imgSeguridad from "../../HomeAssets/seguridad-transacciones.png";

const Home = () => {
  const navigate = useNavigate();
  const user = null;

  const handleNavigation = (path) => {
    navigate(path);
  };

  const VentajasPago = () => {
    const [seleccionado, setSeleccionado] = useState(0);
  
    return (
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Columna izquierda */}
          <div>
            <h2 className="text-4xl font-bold text-sky-600 mb-8">
              Ventajas de pagar en línea
            </h2>
  
            <div className="flex gap-8 mb-6">
              {beneficios.map((item, index) => (
                <div key={item.id} className="flex flex-col items-center cursor-pointer" onClick={() => setSeleccionado(index)}>
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg mb-2 ${seleccionado === index ? 'bg-yellow-400' : 'bg-gray-100'}`}>
                    <img src={item.icon} alt={item.titulo} className="w-10" />
                  </div>
                  <p className="text-xs text-center">{item.titulo.split(' ').slice(0, 3).join(' ')}<br />{item.titulo.split(' ').slice(3).join(' ')}</p>
                </div>
              ))}
            </div>
  
            {/* Línea decorativa dinámica */}
            <div className="flex mb-6">
              <div className={`w-${24 + (seleccionado * 8)} h-0.5 bg-yellow-400 mr-1 transition-all duration-300`}></div>
              <div className="w-full h-0.5 bg-gray-300"></div>
            </div>
  
            <h3 className="text-lg font-bold text-blue-900 mb-2">
              {beneficios[seleccionado].titulo}
            </h3>
            <p className="text-sm text-blue-900">
              {beneficios[seleccionado].descripcion}
            </p>
          </div>
  
          {/* Columna derecha: Imagen */}
          <div>
            <img
              src={beneficios[seleccionado].image}
              alt={beneficios[seleccionado].titulo}
              className="rounded-xl shadow-lg w-full object-cover transition-all duration-500"
            />
          </div>
        </div>
      </section>
    );
  };

  const beneficios = [
    {
      id: 1,
      titulo: "Facilita tus pagos",
      descripcion: "No requieres contar con la factura física para realizar tus pagos.",
      icon: iconPago,
      image: imgPareja, // imagen 1
    },
    {
      id: 2,
      titulo: "Paga desde cualquier lugar",
      descripcion: "Ahorra tiempo en filas y trámites",
      icon: iconCasa,
      image: imgLugar, // imagen 2
    },
    {
      id: 3,
      titulo: "Seguridad en tus transacciones",
      descripcion: "Contamos con plataformas seguras para que realices tus pagos.",
      icon: iconSeguro,
      image: imgSeguridad, // imagen 3
    },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col justify-between">

  <header className="w-full bg-white py-4">
    <div className="max-w-7xl mx-auto px-4 flex justify-center items-center">
      <div className="h-20 md:h-30 p-2">
        <img src={imgLogo1} alt="Panadería Logo" className="h-24" />
     </div>
    </div>
  </header>

  <main className="flex flex-col md:flex-row justify-center gap-10 items-center px-4 py-8">
{/* Persona */}
<div className="hidden w-full md:w-1/3 bg-white rounded-3xl shadow-lg p-6 border border-orange-400 relative transition-all hover:shadow-[0_6px_20px_rgba(234,88,12,0.3)] group">
  <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-white rounded-full p-1 border-4 border-orange-500 w-32 h-32 overflow-hidden">
    <img
      src={btn_home_1}
      alt="Independiente"
      className="w-full h-full rounded-full object-cover transition-opacity duration-300 group-hover:opacity-0"
    />
    <img
      src={btn_home_1_hover}
      alt="Independiente Hover"
      className="w-full h-full rounded-full object-cover absolute top-0 left-0 transition-opacity duration-300 opacity-0 group-hover:opacity-100"
    />
  </div>
  <div className="mt-16 text-center">
    <h2 className="text-lg font-semibold text-orange-600">Acceso Persona</h2>
    <p className="text-gray-700 mt-2 text-sm">
      Calidad y sabor a un clic. Compra para ti o tu familia con entrega directa.
    </p>
    <button
      onClick={() => handleNavigation('/original-home')}
      className="mt-6 w-full border border-orange-500 text-orange-600 font-semibold py-2 rounded-full hover:bg-orange-500 hover:text-white transition"
    >
      Persona
    </button>
  </div>
</div>


{/* Empresa */}
<div className="w-full md:w-1/3 bg-white rounded-3xl shadow-lg p-6 border border-primary relative transition-all hover:shadow-[0_6px_20px_rgba(37,99,235,0.3)] group">
  <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-white rounded-full p-1 border-4 border-primary w-32 h-32 overflow-hidden">
    <img
      src={btn_home_2}
      alt="Empresa"
      className="w-full h-full rounded-full object-cover transition-opacity duration-300 group-hover:opacity-0"
    />
    <img
      src={btn_home_2_hover}
      alt="Empresa Hover"
      className="w-full h-full rounded-full object-cover absolute top-0 left-0 transition-opacity duration-300 opacity-0 group-hover:opacity-100"
    />
  </div>
  <div className="mt-16 text-center">
    <h2 className="text-lg font-semibold text-primary">Acceso Empresa</h2>
    <p className="text-gray-700 mt-2 text-sm">
      Con el mismo sabor artesanal, pedidos grandes, entregas puntuales, calidad garantizada.
    </p>
    <button
      onClick={() => handleNavigation('/login')}
      className="mt-6 w-full border border-primary-200 text-primary font-bold py-2 rounded-full hover:bg-secondary-500 hover:text-primary-500 transition"
    >
      Empresas
    </button>
  </div>
</div>



  <div className="hidden text-end text-orange-600 font-semibold text-sm">
    <p className="italic">Bienvenido, seleccione su tipo de usuario</p>
    <p className="text-gray-500">Y encuentre contenido afín a sus intereses</p>
  </div>
</main>

{/* FOOTER */}
<footer className="w-full bg-footer py-10 px-6">
  <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-10 items-start text-secondary-400 text-sm leading-relaxed">

    <div className="flex justify-center md:justify-center">
      <img
        alt="Logo Artesa" 
        src={Footerico}
        width="300"
        className="mt-2"/>
    </div>

    {/* Redes sociales */}
    <div className="flex flex-col items-center md:items-start">
      <p className="mb-4 text-center md:text-left font-semibold text-secondary-600">
        Síguenos en redes sociales:
      </p>
      <div className="flex gap-3">
        <a
          href="https://www.instagram.com/artesapanaderia/"
          className="bg-white p-2 rounded-full shadow hover:bg-gray-200">
          <FaInstagram size={20} className="text-secondary-800 hover:text-primary" />
        </a>
        <a
          href="https://www.tiktok.com/@artesapanaderia"
          className="bg-white p-2 rounded-full shadow hover:bg-gray-200" >
          <FaTiktok size={20} className="text-secondary-800 hover:text-primary" />
        </a>
        <a
          href="https://web.facebook.com/artesapanaderia"
          className="bg-white p-2 rounded-full shadow hover:bg-gray-200" >
          <FaFacebook size={20} className="text-secondary-800 hover:text-primary" />
        </a>
        <a
          href="https://www.linkedin.com/company/artesa-panaderia/"
          className="bg-white p-2 rounded-full shadow hover:bg-gray-200">
          <FaLinkedin size={20} className="text-secondary-800 hover:text-primary" />
        </a>
      </div>
    </div>

    {/* Contáctanos */}
  <div>
    <h4 className="font-bold mb-2 text-secondary-600">Contáctanos</h4>
      <p className="rounded px-2 transition duration-200 hover:bg-secondary-800 hover:bg-opacity-70 hover:text-secondary-500">
       Llámanos al <br />
        <span className="text-secondary-600 font-bold ">📞 321 355 33 51</span> </p>
      <p className="rounded px-2 transition duration-200 hover:bg-secondary-800 hover:bg-opacity-70 hover:text-secondary-500">
       Planta de producción: <br />
        <span className="text-secondary-600 font-bold">Cra 35 #17ª - 61 Bogotá D.C</span>
      </p>
</div>

{/* Horario */}
<div>
  <h4 className="font-bold mb-2 text-secondary-600">Horario de atención</h4>
  <p className="rounded px-2 transition duration-200 hover:bg-secondary-800 hover:bg-opacity-70 hover:text-secondary-500">
    🕖 Lunes a viernes de <br />
    <span className="text-secondary-600 font-bold">7:00 a.m. a 6:00 p.m.</span>
  </p>
  <p className="rounded px-2 transition duration-200 hover:bg-secondary-800 hover:bg-opacity-70 hover:text-secondary-500">
    🕗 Sábado de <br />
    <span className="text-secondary-600 font-bold">8:00 a.m. a 1:00 p.m.</span>
  </p>
</div>


{/* Preguntas frecuentes */}
<div>
  <h4 className="font-bold mb-2 text-secondary-600">Preguntas frecuentes</h4>

  <p className="group cursor-pointer">
    <span className="relative inline-block text-secondary-600 group-hover:text-orange-200 transition-colors duration-200">
      Quiénes somos
      <span className="absolute bottom-0 left-0 w-1/2 h-[1px] bg-secondary-800 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
    </span>
  </p>

  <p className="group cursor-pointer">
    <span className="relative inline-block text-secondary-600 group-hover:text-orange-200 transition-colors duration-200">
      Cómo lo hacemos
      <span className="absolute bottom-0 left-0 w-1/2 h-[1px] bg-secondary-800 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
    </span>
  </p>

     <p className="group cursor-pointer">
       <span className="relative inline-block text-secondary-600 group-hover:text-orange-200 transition-colors duration-200">
          Solicitar Cotización
          <span className="absolute bottom-0 left-0 w-1/2 h-[1px] bg-secondary-800 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
        </span>
      </p>

     <p className="group cursor-pointer">
        <span className="relative inline-block text-secondary-600 group-hover:text-orange-200 transition-colors duration-200">
      Nuestros productos
        <span className="absolute bottom-0 left-0 w-1/2 h-[1px] bg-secondary-800 scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
       </span>
     </p>
    </div>
  </div>
</footer>



    </div>
  );
};

export default Home;