import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../../App.scss';
import imgLogo1 from "../../HomeAssets/logo_artesa_alt.png";
import { FaUser, FaShoppingCart, FaStar } from 'react-icons/fa';
import imgBanner from "../../HomeAssets/Banner_.png";
import imgBanBeneficios from "../../HomeAssets/Banner_Beneficios.png";
import imgVenta1 from "../../HomeAssets/Producto_1.png";
import imgVenta2 from "../../HomeAssets/Producto_2.png";
import imgVenta3 from "../../HomeAssets/Producto_3.png";
import imgVenta4 from "../../HomeAssets/Producto_4.png";
import imgFondoVenta from '../../HomeAssets/Venta_Online.gif';
import { FaMapMarkerAlt } from "react-icons/fa";
import Footerico from '../../HomeAssets/Icolo_footer.png';
import { FaInstagram, FaTiktok, FaFacebook, FaLinkedin } from "react-icons/fa";

const Home = () => {

  const navigate = useNavigate();

  // Array de productos con imágenes importadas
  const productos = [
    {
      titulo: "Panadería Gourmet",
      descripcion: "Pan artesanal con ingredientes frescos y naturales.",
      estrellas: 5,
      estrellasAzules: 3, // (5 - 3)
      img: imgVenta1
    },
    {
      titulo: "Repostería Fina",
      descripcion: "Recetas tradicionales.",
      estrellas: 5,
      estrellasAzules: 4, // 4 azules, 1 blanca
      img: imgVenta2
    },
    {
      titulo: "Pastelería Exclusiva",
      descripcion: "Deliciosos pasteles para cada ocasión especial.",
      estrellas: 5,
      estrellasAzules: 5,
      img: imgVenta3
    },
    {
      titulo: "Bollería Artesanal",
      descripcion: "Bollos y panes con recetas tradicionales de calidad.",
      estrellas: 5,
      estrellasAzules: 2, // 2 azules, 3 blancas
      img: imgVenta4
    }
  ];

  const Lugares = [
    {
      titulo: "Santa Paula",
      descripcion: "Dirección: Calle 109 # 14b - 16",
      img: '',
      url: "https://maps.app.goo.gl/GPi4CTEDgD9hzpcP9"
    },
    {
      titulo: "Cedritos",
      descripcion: "Dirección: Av cra 19 # 139 - 06",
      img: '',
      url: "https://maps.app.goo.gl/M9nDQ6KFkgYwSNki7",

    },
    {
      titulo: "Colina Campestre",
      descripcion: "Dirección:Calle 138 # 55 - 89 | Local 5589",
      img: '',
      url: "https://maps.app.goo.gl/jovFzU6d126DZsM79"
    },
    {
      titulo: "Punto de fabrica",
      descripcion: "Dirección: Cra 35 # 17ª – 61",
      img: '',
      url: "https://maps.app.goo.gl/po8sEgErwMWuRVcu7"
    }
  ];

  return (

    <div className="bg-gray-100 min-h-screen font-montserrat">

      {/* Botón flotante de WhatsApp */}
      <a 
        href="https://wa.me/573001234567" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 bg-green-500 text-white p-3 rounded-full shadow-lg hover:bg-green-600 transition-all flex items-center justify-center w-14 h-14"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16" width="28" height="28">
          <path d="M13.601 2.399A7.951 7.951 0 0 0 8 0C3.588 0 0 3.588 0 8c0 1.411.37 2.772 1.061 3.979L.05 16l4.16-1.011A7.948 7.948 0 0 0 8 16c4.412 0 8-3.588 8-8 0-2.139-.833-4.148-2.399-5.601ZM8 14.396a6.41 6.41 0 0 1-3.184-.826l-.229-.132-2.469.604.526-2.444-.15-.242A6.392 6.392 0 0 1 1.604 8c0-3.534 2.862-6.396 6.396-6.396 1.71 0 3.316.666 4.525 1.875a6.356 6.356 0 0 1 1.875 4.525c0 3.534-2.862 6.396-6.396 6.396Zm3.604-4.8c-.197-.099-1.171-.577-1.352-.643-.181-.066-.313-.099-.444.1-.132.198-.506.643-.62.777-.115.132-.23.149-.427.05-.197-.1-.833-.308-1.586-.983a5.974 5.974 0 0 1-1.103-1.334c-.116-.198-.013-.304.087-.4.09-.09.198-.23.297-.345a1.34 1.34 0 0 0 .198-.33c.066-.132.033-.248-.016-.346-.05-.099-.444-1.07-.608-1.464-.16-.387-.32-.335-.444-.34l-.377-.008a.72.72 0 0 0-.524.247c-.18.198-.687.67-.687 1.634 0 .964.703 1.895.802 2.023.1.132 1.381 2.107 3.35 2.956 1.969.85 1.969.566 2.325.533.356-.033 1.17-.477 1.334-.937.165-.46.165-.854.116-.937-.05-.082-.165-.132-.345-.23Z"/>
        </svg> </a>

{/* Header */}
      <div className="bg-orange-500 py-2 text-white text-center font-bold text-sm md:text-lg shadow-md">
        <span className="block">PIDE TU DOMICILIO ARTESA AQUÍ</span>
      </div>

<header className="bg-white py-6 px-12 md:px-24 text-black font-bold text-sm md:text-lg flex items-center justify-center shadow-md gap-2">

{/* Barra de búsqueda */}
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

        
        <div className="w-1/3 flex justify-center"> {/* Logo */}
          <img src={imgLogo1} alt="Panadería Logo" className="h-8 md:h-10" />
 </div>

        {/* Íconos de Usuario y Carrito de Compras */}
        <div className="w-1/3 flex justify-center space-x-4">
          <FaUser className="text-xl hover:text-orange-500" />
          <FaShoppingCart className="text-xl hover:text-orange-500" />
        </div>
 </header>


      <div className="bg-orange-100 p-6">
        {/* Navegación centrada en horizontal con más separación */}
        <nav className="flex justify-center items-center gap-16 text-lg text-white font-semibold">
          <a href="#productos" className="hover:text-orange-500 transition-colors duration-300">Productos</a>
          <a href="#blog" className="hover:text-orange-500 transition-colors duration-300">Quienes somos</a>
          <a href="#contacto" className="hover:text-orange-500 transition-colors duration-300">Contáctanos</a>
          <a href='/original-home' className="hover:text-orange-500 transition-colors duration-300">Iniciar sesión</a>
        </nav>
      </div>

      {/* Sección publicidad */}
      <section className="bg-orange-50 p-10 rounded-lg shadow-lg flex justify-center items-center">
        <img
          src={imgBanner} alt="Imagen destacada" className="max-w-full h-auto"/> </section>

      {/* Sección beneficios */}
      <section className="bg-homePrimary rounded-lg shadow-lg flex justify-center items-center">
        <img
          src={imgBanBeneficios} alt="Imagen destacada" className="max-w-full h-auto"/> </section>


      <main className="container mx-auto p-6">
        <section className="container mx-auto p-4 sm:p-6 flex flex-nowrap overflow-x-auto snap-x snap-mandatory gap-5 py-8 sm:py-6">
          {productos.map((producto, index) => (
            <div
              key={index}
              className="bg-secondaryHome shadow-lg rounded-[35px] overflow-hidden min-w-[28%] sm:min-w-[16%] md:min-w-[11%] transition transform hover:scale-105 flex-shrink-0 snap-center" >

              <div className="w-full h-48 bg-orange-500 bg-cover bg-center"style={{ backgroundImage: `url(${producto.img})` }}></div>
              {/* Contenido */}
              <div className="p-5 sm:p-7 text-center">
                <h3 className="text-xs sm:text-sm font-semibold text-gray-800"> {producto.titulo} </h3> <p className="text-gray-600 mt-2 text-xs line-clamp-2"> {producto.descripcion} </p>
                {/* Estrellas de valoración con dos colores */}
                <div className="flex items-center justify-center mt-3">
                  <span className="mr-2 text-xs text-gray-800">Valoraciones de clientes:</span>
                  {Array.from({ length: producto.estrellasAzules || 0 }, (_, i) => (
                    <FaStar key={`blue-${i}`} size={16} className="text-primary mx-1" />
                  ))}
                  {Array.from({ length: producto.estrellas - (producto.estrellasAzules || 0) }, (_, i) => (
                    <FaStar key={`white-${i}`} size={16} className="text-white mx-1" />
                  ))}
                </div>

                {/* Botones */}
                <div className="mt-6 flex justify-center gap-3">
                  <button className="bg-white border border-gray-300 text-gray-800 px-3 sm:px- py-2 text-xs sm:text-sm rounded-lg hover:bg-gray-200 transition">
                    Detalles
                  </button>
                  <button className="bg-primary text-white px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-lg hover:bg-orange-600 transition">
                    Añadir
                  </button>
                </div> </div> </div> ))}
        </section>


        {/* VENTA ONLINE Section */}
        <section
          className="bg-cover bg-center p-16 rounded-lg shadow-lg text-center flex flex-col items-center"
          style={{ backgroundImage: `url(${imgFondoVenta})` }}>
          <h2 className="text-2xl font-semibold text-white">Productos pasteleros de alta calidad</h2>
          <p className="mt-2 text-white">Programa tu pedido en línea con pago y transporte seguro.</p>
          <button
            onClick={() => navigate('/original-home')}
            className="mt-4 bg-orange-500 text-white px-6 py-3 rounded-lg shadow-md hover:bg-orange-600 transition"
          >
            Realizar Pedido
          </button>
        </section>


        {/* SECCIÓN LUGARES */}
        <section className="container mx-auto p-2 sm:p-4 flex flex-col items-center pt-6 sm:pt-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 text-center mb-2">
            Visítanos y disfruta un festín de sabor.
          </h2>
          <p className="text-center text-gray-600 mb-6">
            Cuatro sedes, una sola pasión: brindarte la mejor experiencia.
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            {Lugares.map((lugar, index) => (
              <div
                key={index}
                className="group relative shadow-lg rounded-lg overflow-hidden w-80 h-52 transition-colors duration-300"
                style={{
                  backgroundImage: `url(${lugar.img})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'}}>
                <div className="absolute inset-0 bg-primary group-hover:bg-bottonlugar transition-colors duration-300"></div>
                <div className="relative flex flex-col items-center justify-center h-full p-2 text-center">
                  <FaMapMarkerAlt className="text-gray-300 text-2xl mb-2 transition-colors duration-300 group-hover:text-orange-500" />
                  <h3 className="text-lg font-bold text-white text-center group-hover:hidden">
                    {lugar.titulo}
                  </h3>
                  <p className="hidden group-hover:block text-white text-sm mt-2">
                    {lugar.descripcion}
                  </p>
                  <div className="mt-3">
                    <button
                      className="bg-secondaryHome text-white px-4 py-2 text-base rounded-md transition hover:bg-orange-500"
                      onClick={() => window.open(lugar.url, "_blank")}>
                      Ver Ubicación </button>
                  </div> </div> </div>
            ))}
          </div>
        </section>
      </main>



    <footer className=" text-gray-700">
      <div className=" w-full bg-footer flex justify-center items-center">
  
    <div className="flex flex-col items-center">
      <img alt="Logo Artesa" src={Footerico} width="80" className="mb-3"/>
      <p className="text-black text-center mb-3"> Encuéntranos en nuestras redes sociales. </p>
      <div className="flex gap-6 mt-2 pb-4">
        <a href="https://www.instagram.com/artesapanaderia/" className="bg-white p-3 rounded-full shadow hover:bg-gray-200">
          <FaInstagram size={24} className="text-orange-500 hover:text-primary" />
        </a>
        <a href="https://www.tiktok.com/@artesapanaderia" className="bg-white p-3 rounded-full shadow hover:bg-gray-200">
          <FaTiktok size={24} className="text-orange-500 hover:text-primary" />
        </a>
        <a href="https://web.facebook.com/artesapanaderia" className="bg-white p-3 rounded-full shadow hover:bg-gray-200">
          <FaFacebook size={24} className="text-orange-500 hover:text-primary  " />
        </a>
        <a href="https://www.linkedin.com/company/artesa-panaderia/" className="bg-white p-3 rounded-full shadow hover:bg-gray-200">
          <FaLinkedin size={24} className="text-orange-500 hover:text-primary" />
        </a>
      </div>
    </div>
  </div>

  <div className="max-w-7xl mx-auto py-4 px-6 flex flex-col md:flex-row justify-between items-center">
    <div className="flex flex-row justify-between w-full md:w-2/3 mt-6 md:mt-0">
      <div className="flex flex-col items-center text-center">
        <h3 className="font-bold uppercase mb-3">Escríbenos</h3>
        <ul className="space-y-2 text-gray-600">
          <li><a href="#">Contacto</a></li>
          <li><a href="#">Soporte</a></li>
        </ul>
      </div>

      <div className="flex flex-col items-center text-center">
        <h3 className="font-bold uppercase mb-3">Pedidos</h3>
        <ul className="space-y-2 text-gray-600">
          <li><a href="#">Realizar un Pedido</a></li>
          <li><a href="#">Seguimiento</a></li>
        </ul>
      </div>

      <div className="flex flex-col items-center text-center">
        <h3 className="font-bold uppercase mb-3">Cliente</h3>
        <ul className="space-y-2 text-gray-600">
          <li><a href="#">Preguntas Frecuentes</a></li>
          <li><a href="#">Política de Privacidad</a></li>
        </ul>
      </div> </div> </div>
  <div className="bg-white py-4 text-center mt-6">
    <p className="text-orange-500">© 2025 Artesa - Todos los derechos reservados.</p> </div>
</footer>


    </div>
  );
};

export default Home;

