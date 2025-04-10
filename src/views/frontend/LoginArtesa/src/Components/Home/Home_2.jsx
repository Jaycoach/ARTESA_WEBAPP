import React from "react";
import imgLogo1 from "../../HomeAssets/logo_artesa_alt.png";
import '../../App.scss';
import { FaUser, FaShoppingCart, FaStar } from 'react-icons/fa';
import imgBanner from "../../HomeAssets/Banner_.png";
import Footerico from '../../HomeAssets/Icolo_footer.png';
import { FaInstagram, FaTiktok, FaFacebook, FaLinkedin } from "react-icons/fa";
import backgroundImage from '../../HomeAssets/BG.png';




const Home = () => {
    return (
        <div style={{ backgroundImage: `url(${backgroundImage})` }} className=" bg-cover bg-center min-h-screen flex flex-col max-w-screen-2xl mx-auto  px-4 md:px-8 lg:px-12">
        {/* Header */}
        <header className="flex justify-between items-center p-4  shadow-md w-full">
          <div className="h-16 md:h-30">
            <img src={imgLogo1} alt="Panadería Logo" className="h-full" />
          </div>
      
        {/* Navegación */}
        <nav className="flex justify-center items-center gap-16 text-lg text-white font-semibold">
          <a href="#productos" className="hover:text-orange-500 transition-colors duration-300">Quienes somos</a>
          <a href="#blog" className="hover:text-orange-500 transition-colors duration-300">Cómo lo hacemos</a>
          <a href="#contacto" className="hover:text-orange-500 transition-colors duration-300">Contáctanos</a>
          <a href='/original-home' className="hover:text-orange-500 transition-colors duration-300">Iniciar sesión</a>
        </nav>
        </header>
  
        {/* Main Content */}
        <main className="relative flex flex-col items-center justify-center flex-grow w-full">
  <div className="relative w-full">
    <img
      src={imgBanner}
      alt="Imagen principal"
      className="w-full h-auto mb-8 rounded-lg shadow-md"
    />
    <div className="absolute bottom-16 right-0 w-full flex justify-center mt-4">
    <button className="bg-orange-500 text-white px-8 py-3 rounded-full hover:bg-primary transition mt-8">
            Comprar Aquí
          </button>
</div>

  </div>
</main>

<footer className="bg-gray-100 bg-opacity-80 text-gray-700 flex flex-col items-center w-full m-0 p-0 text-sm">
          <div className="flex flex-row justify-between items-start w-full max-w-7xl relative">

            {/* redes */}
            <div className="m-8 flex flex-col items-center w-1/4 mb-6">
              <p className="text-black text-center mb-3"> Encuéntranos en nuestras redes sociales. </p>
              <div className="flex gap-4 mt-2">
                <a href="https://www.instagram.com/artesapanaderia/" className="">
                  <FaInstagram size={25} className="text-orange-500 hover:text-primary" />
                </a>
                <a href="https://www.tiktok.com/@artesapanaderia" className="">
                  <FaTiktok size={25} className="text-orange-500 hover:text-primary" />
                </a>
                <a href="https://web.facebook.com/artesapanaderia" className="">
                  <FaFacebook size={25} className="text-orange-500 hover:text-primary" />
                </a>
                <a href="https://www.linkedin.com/company/artesa-panaderia/" className="">
                  <FaLinkedin size={25} className="text-orange-500 hover:text-primary" />
                </a>
              </div>
            </div>
  
            {/* Secciones de Enlaces */}
            <div className="flex flex-row justify-between w-[10] gap-10 text-sm">
              <div className="flex flex-col text-left hover:text-orange-500">
                <h3 className="font-bold uppercase mb-2 text-base">Escríbenos</h3>
                <ul className="space-y-1 text-gray-600">
                  <li><a href="#">Contacto</a></li>
                  <li><a href="#">Soporte</a></li>
                </ul>
              </div>
  
              <div className="flex flex-col text-left hover:text-orange-500">
                <h3 className="font-bold uppercase mb-2 text-base">Pedidos</h3>
                <ul className="space-y-1 text-gray-600">
                  <li><a href="#">Realizar un Pedido</a></li>
                  <li><a href="#">Seguimiento</a></li>
                </ul>
              </div>
  
              <div className="flex flex-col text-left relative hover:text-primary ">
                <h3 className="font-bold uppercase mb-2 text-base">Cliente</h3>
                <ul className="space-y-1 text-gray-600 ">
                  <li><a href="#">Preguntas Frecuentes</a></li>
                  <li><a href="#">Política de Privacidad</a></li>
                </ul>
              </div>
              <div className="object-right top-0">
                  <img alt="Logo Artesa" src={Footerico} width="70" className="" />
                </div>
            </div>
          </div>

          <div className=" py-2 text-center w-full mt-4">
            <p className="text-orange-500 text-xs">© 2025 Artesa - Todos los derechos reservados.</p>
          </div>
        </footer>
      </div>
    );
  };
  
  export default Home;
  