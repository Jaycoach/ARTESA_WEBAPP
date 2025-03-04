Proyecto: Dashboard Artesa - Integración SAP
 Descripción del Proyecto
Este proyecto consiste en el desarrollo del Dashboard de gestión de pedidos para Artesa, una panadería que busca mejorar la administración de sus productos, pedidos y clientes mediante una interfaz web intuitiva. La aplicación se integra con SAP para la gestión de inventarios y pedidos en tiempo real.

## 📜 **Índice**
1. [Tecnologías Utilizadas](#tecnologías-utilizadas)
2. [Instalación](#instalación)
3. [Estructura del Proyecto](#estructura-del-proyecto)
4. [Variables de Estilo](#variables-de-estilo)
5. [Desarrollo y Convenciones](#desarrollo-y-convenciones)
6. [Autenticación y Seguridad](#autenticación-y-seguridad)
7. [Modo Oscuro](#modo-oscuro)
8. [Contribuciones](#contribuciones)
   
 Arquitectura del Proyecto
•	Frontend: React.js + Vite
•	Backend: Node.js + Express (con integración a SAP)
•	Base de Datos: PostgreSQL
•	Autenticación: JWT (JSON Web Tokens)
•	Estilos: SCSS + Diseño basado en la identidad visual de Artesa
•	Estado Global: Context API

 Funcionalidades Clave
✅ Autenticación de usuarios con JWT
✅ Dashboard interactivo con datos en tiempo real
✅ Gestión de pedidos y facturas
✅ Integración con SAP para la sincronización de inventarios
✅ Sidebar dinámico con colapso automático
✅ Configuración de perfil y actualización de datos de cliente registrado.

Identidad Visual

La paleta de colores está basada en los valores institucionales de Artesa:
•	Azul grisáceo: #687e8d (80%)
•	Amarillo pastel: #f6db8e (3%)
•	Naranja cálido: #f6754e (7%)
•	Blanco: #ffffff (10%)

Instalación y Configuración

🔹 1. Clonar el Repositorio
git clone https://github.com/Jaycoach/ARTESA_WEBAPP
cd ../ARTESA_WEBAPP/src/views/frontend/LoginArtesa

🔹 2. Instalar Dependencias
npm install

🔹 3. Configurar Variables de Entorno
Crear un archivo .env en la raíz del proyecto y añadir:

REACT_APP_API_URL=http://localhost:5000
REACT_APP_SAP_API=http://sap-endpoint.com
REACT_APP_JWT_SECRET=supersecretkey

🔹 4. Iniciar el Proyecto
npm run dev

---
---
