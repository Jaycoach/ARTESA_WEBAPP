# MANUAL FUNCIONAL - LA ARTESA WEB APP

**Versión:** 1.3.0  
**Fecha:** Octubre 2025  
**Documento:** Manual del Usuario

---

## TABLA DE CONTENIDOS

1. [Introducción](#1-introducción)
2. [Tipos de Usuarios y Roles](#2-tipos-de-usuarios-y-roles)
3. [Registro e Inicio de Sesión](#3-registro-e-inicio-de-sesión)
4. [Dashboard y Navegación](#4-dashboard-y-navegación)
5. [Gestión de Perfiles](#5-gestión-de-perfiles)
6. [Gestión de Sucursales](#6-gestión-de-sucursales)
7. [Catálogo de Productos](#7-catálogo-de-productos)
8. [Creación y Gestión de Órdenes](#8-creación-y-gestión-de-órdenes)
9. [Consulta de Facturas](#9-consulta-de-facturas)
10. [Funciones Administrativas](#10-funciones-administrativas)
11. [Sincronización con SAP](#11-sincronización-con-sap)
12. [Preguntas Frecuentes](#12-preguntas-frecuentes)
13. [Soporte y Contacto](#13-soporte-y-contacto)

---

## 1. INTRODUCCIÓN

### 1.1 ¿Qué es LA ARTESA Web App?

LA ARTESA Web App es una plataforma web diseñada para facilitar la gestión de pedidos y órdenes de productos de panadería y pastelería. La aplicación integra información directamente con el sistema SAP Business One para garantizar la consistencia de datos y la sincronización en tiempo real.

### 1.2 Características Principales

- **Gestión de Usuarios:** Sistema de registro, autenticación y administración de perfiles
- **Catálogo de Productos:** Visualización de productos sincronizados con SAP
- **Gestión de Órdenes:** Creación, seguimiento y actualización de pedidos
- **Múltiples Sucursales:** Soporte para clientes institucionales con varias ubicaciones
- **Facturación Integrada:** Consulta de facturas generadas desde SAP
- **Sincronización Automática:** Actualización periódica de productos, clientes y órdenes
- **Gestión Documental:** Carga y almacenamiento de documentos fiscales

### 1.3 Requisitos del Sistema

- **Navegador:** Chrome (v90+), Firefox (v88+), Safari (v14+), Edge (v90+)
- **Conexión a Internet:** Requerida para todas las funcionalidades
- **Resolución:** Mínimo 1366x768 (diseño responsivo para tablets y móviles)

---

## 2. TIPOS DE USUARIOS Y ROLES

### 2.1 Roles en el Sistema

La aplicación maneja tres tipos de roles principales:

#### **ROL 1: ADMINISTRADOR (ADMIN)**
- **ID del Rol:** 1
- **Nombre:** Administrador de Plataforma
- **Descripción:** Acceso completo a todas las funcionalidades del sistema

**Permisos:**
- ✅ Gestionar todos los usuarios
- ✅ Aprobar y gestionar perfiles de clientes
- ✅ Crear, editar y eliminar productos
- ✅ Ver todas las órdenes del sistema
- ✅ Sincronizar manualmente con SAP
- ✅ Acceder a configuraciones del portal
- ✅ Ver estadísticas globales del sistema
- ✅ Gestionar sucursales de clientes
- ✅ Administrar tokens de recuperación
- ✅ Acceder a logs y auditoría del sistema

#### **ROL 2: USUARIO (USER)**
- **ID del Rol:** 2
- **Nombre:** Usuario / Cliente
- **Descripción:** Usuario estándar con acceso limitado a sus propios datos

**Permisos:**
- ✅ Ver catálogo de productos
- ✅ Crear órdenes para su empresa
- ✅ Ver sus propias órdenes
- ✅ Consultar sus facturas
- ✅ Actualizar su perfil de cliente
- ✅ Cargar documentos fiscales
- ❌ No puede ver datos de otros usuarios
- ❌ No puede modificar productos
- ❌ No puede acceder a configuraciones del sistema

#### **ROL 3: ADMINISTRADOR FUNCIONAL (FUNCTIONAL_ADMIN)**
- **ID del Rol:** 3
- **Nombre:** Cliente con Permisos Especiales
- **Descripción:** Usuario con permisos extendidos para gestionar su empresa

**Permisos:**
- ✅ Todos los permisos de USUARIO (Rol 2)
- ✅ Gestionar sucursales de su empresa
- ✅ Ver órdenes de todas sus sucursales
- ✅ Configurar ajustes de su portal
- ✅ Actualizar información del banner principal
- ✅ Modificar hora límite de pedidos
- ❌ No puede ver datos de otras empresas
- ❌ No puede sincronizar con SAP manualmente

### 2.2 Tipos de Acceso

#### **Usuario Principal**
- Representa la empresa o razón social
- Puede tener múltiples sucursales asociadas
- Accede con email y contraseña tradicional
- Se vincula con un CardCode en SAP (ejemplo: CI800230447)

#### **Usuario Sucursal**
- Representa una ubicación específica de una empresa
- Accede con un token único generado para la sucursal
- Hereda productos y precios del cliente principal
- Puede crear órdenes independientes

---

## 3. REGISTRO E INICIO DE SESIÓN

### 3.1 Registro de Nuevo Usuario

#### **Paso 1: Acceder al Formulario de Registro**

1. Navega a la URL de la aplicación
2. En la página de inicio de sesión, haz clic en **"Registrarse"** o **"Crear cuenta"**
3. Serás redirigido al formulario de registro

#### **Paso 2: Completar Información Básica**

El formulario solicitará los siguientes datos obligatorios:

- **Nombre Completo:** Tu nombre y apellidos
- **Correo Electrónico:** Debe ser válido y único en el sistema
- **Contraseña:** Debe cumplir los siguientes requisitos:
  - Mínimo 8 caracteres
  - Al menos una letra mayúscula
  - Al menos una letra minúscula
  - Al menos un número
  - Al menos un carácter especial (!@#$%^&*)

**Ejemplo de contraseña válida:** `Artesa2025!`

#### **Paso 3: Envío del Formulario**

1. Revisa que todos los datos sean correctos
2. Haz clic en **"Registrarse"**
3. El sistema validará la información automáticamente

#### **Paso 4: Confirmación de Registro**

Si el registro es exitoso:
- Recibirás un mensaje de confirmación
- Se creará automáticamente tu usuario con ROL 2 (Usuario)
- Recibirás un token JWT para autenticación automática
- Serás redirigido al dashboard

**Nota Importante:** En este punto, tu cuenta está creada pero **NO podrás crear órdenes** hasta que:
1. Completes tu perfil de cliente
2. Tu perfil sea sincronizado con SAP
3. Obtengas un CardCode SAP válido

### 3.2 Inicio de Sesión (Login)

#### **Para Usuarios Principales:**

1. **Acceder a la Pantalla de Login**
   - Ingresa a la URL de la aplicación
   - Verás dos opciones: Login Principal y Login Sucursal

2. **Seleccionar "Login Principal"**
   - Este es el acceso estándar para empresas y usuarios individuales

3. **Ingresar Credenciales**
   - **Email:** El correo electrónico registrado
   - **Contraseña:** Tu contraseña personal

4. **Hacer clic en "Iniciar Sesión"**
   - El sistema validará tus credenciales
   - Si son correctas, serás redirigido al dashboard

**Seguridad:**
- El sistema tiene límite de intentos fallidos
- Después de 5 intentos fallidos, la cuenta se bloqueará temporalmente
- Cada inicio de sesión queda registrado en el historial de auditoría

#### **Para Sucursales:**

1. **Acceder a la Pantalla de Login**
   - Ingresa a la URL de la aplicación

2. **Seleccionar "Login Sucursal"**
   - Este acceso es exclusivo para ubicaciones específicas

3. **Ingresar Token de Sucursal**
   - Introduce el token único proporcionado por el administrador
   - El formato del token es: `BRANCH-XXXX-XXXX-XXXX` (32 caracteres)

4. **Hacer clic en "Acceder"**
   - El token será validado
   - Serás redirigido al dashboard de la sucursal

**Información del Token:**
- Cada sucursal tiene un token único e irrepetible
- Los tokens expiran después de 90 días
- Puedes solicitar renovación al administrador antes del vencimiento

### 3.3 Recuperación de Contraseña

Si olvidaste tu contraseña:

#### **Paso 1: Solicitar Recuperación**

1. En la pantalla de login, haz clic en **"¿Olvidaste tu contraseña?"**
2. Ingresa tu correo electrónico registrado
3. Haz clic en **"Enviar enlace de recuperación"**

#### **Paso 2: Revisar Correo Electrónico**

1. Revisa tu bandeja de entrada (y spam)
2. Busca un correo de LA ARTESA con asunto "Recuperación de Contraseña"
3. El correo contendrá un enlace único de recuperación
4. **Importante:** El enlace expira en 1 hora

#### **Paso 3: Establecer Nueva Contraseña**

1. Haz clic en el enlace del correo
2. Serás redirigido a un formulario para nueva contraseña
3. Ingresa tu nueva contraseña (debe cumplir requisitos de seguridad)
4. Confirma la nueva contraseña
5. Haz clic en **"Restablecer Contraseña"**

#### **Paso 4: Confirmación**

- Recibirás un mensaje de éxito
- Podrás iniciar sesión inmediatamente con la nueva contraseña
- El token de recuperación quedará invalidado automáticamente

---

## 4. DASHBOARD Y NAVEGACIÓN

### 4.1 Elementos del Dashboard

Al iniciar sesión, llegarás al dashboard principal que muestra:

#### **Sección de Estadísticas (Cards Superiores)**

Muestra métricas importantes en tiempo real:

1. **Total de Órdenes**
   - Cantidad de órdenes creadas por tu usuario/sucursal
   - Para usuarios principales: suma de todas las órdenes propias
   - Para sucursales: solo órdenes de esa ubicación

2. **Total de Productos**
   - Para usuarios principales: catálogo completo disponible
   - Para sucursales: productos heredados del cliente principal

3. **Total de Facturas**
   - Número de facturas emitidas
   - Sincronizadas automáticamente desde SAP

4. **Usuarios** (solo visible para administradores)
   - Total de usuarios registrados en el sistema

#### **Gráficos y Visualizaciones**

**Productos Más Vendidos:**
- Gráfico de barras horizontal
- Muestra los 5 productos con más unidades vendidas
- Filtrable por período de tiempo

**Estadísticas Mensuales:**
- Gráfico de líneas
- Muestra la evolución de órdenes por mes
- Últimos 6 meses por defecto

**Órdenes por Estado:**
- Gráfico de dona
- Distribución de órdenes según su estado:
  - Pendiente
  - Aprobada
  - En Producción
  - Entregada
  - Facturada
  - Cancelada

### 4.2 Menú de Navegación (Sidebar)

El menú lateral contiene las siguientes opciones:

#### **Para TODOS los usuarios:**

- **🏠 Inicio:** Dashboard principal
- **📋 Órdenes:** Gestión de pedidos
- **🧾 Facturas:** Consulta de facturas emitidas
- **📦 Productos:** Catálogo de productos disponibles

#### **Para ADMINISTRADORES (Rol 1):**

Además de las opciones anteriores:

- **👥 Usuarios:** Gestión de usuarios del sistema
- **⚙️ Configuración:** Ajustes del portal
- **🔄 Sincronización SAP:** Sincronización manual de datos
- **📊 Reportes:** Estadísticas globales del sistema

#### **Para ADMINISTRADORES FUNCIONALES (Rol 3):**

Además de las opciones de usuario regular:

- **🏢 Sucursales:** Gestión de ubicaciones de la empresa
- **⚙️ Configuración:** Ajustes de su portal

### 4.3 Barra Superior (Header)

Elementos de la barra superior:

1. **Logo de LA ARTESA:** Hace clic para volver al dashboard
2. **Nombre del Usuario/Sucursal:** Muestra quién está conectado
3. **Menú de Perfil:** Desplegable con opciones:
   - Ver Perfil
   - Configuración de Cuenta
   - Cambiar Contraseña
   - Cerrar Sesión

4. **Botón de Notificaciones:** (si hay notificaciones pendientes)
5. **Toggle de Sidebar:** Colapsa o expande el menú lateral

---

## 5. GESTIÓN DE PERFILES

### 5.1 Completar Perfil de Cliente

**¿Por qué es importante?**
- Es obligatorio para poder crear órdenes
- Permite la sincronización con SAP
- Facilita la facturación electrónica
- Almacena documentos fiscales requeridos

#### **Paso 1: Acceder al Perfil**

1. Desde el dashboard, haz clic en tu nombre de usuario (esquina superior derecha)
2. Selecciona **"Ver Perfil"** o **"Mi Perfil"**
3. También puedes acceder desde el menú: **Perfil > Información de Cliente**

#### **Paso 2: Información de la Empresa**

Completa los siguientes campos obligatorios:

**Datos Básicos:**
- **Razón Social:** Nombre legal de la empresa
- **NIT:** Número de identificación tributaria
- **Dígito de Verificación:** Dígito verificador del NIT (1 dígito)
- **Dirección:** Dirección física de la empresa
- **Ciudad:** Ciudad donde se encuentra la empresa
- **Departamento:** Departamento o estado
- **País:** Colombia (por defecto)
- **Código Postal:** Código postal de la ubicación
- **Teléfono:** Número de contacto principal

**Información Fiscal:**
- **Tipo de Persona:** Jurídica o Natural
- **Tipo de Régimen:** Común o Simplificado
- **Responsabilidades Fiscales:** Seleccionar todas las que apliquen

#### **Paso 3: Información de Contacto**

- **Nombre del Contacto Principal:** Persona responsable
- **Cargo:** Posición en la empresa
- **Teléfono de Contacto:** Número directo
- **Email de Contacto:** Correo electrónico del contacto

#### **Paso 4: Información Bancaria**

Para facilitar procesos de pago:

- **Entidad Bancaria:** Nombre del banco
- **Tipo de Cuenta:** Ahorros o Corriente
- **Número de Cuenta:** Número completo de la cuenta

#### **Paso 5: Documentos Requeridos**

Debes cargar los siguientes documentos en formato PDF o imagen:

1. **Fotocopia de Cédula del Representante Legal**
   - Formato: PDF, JPG, PNG
   - Tamaño máximo: 5 MB
   - Debe estar legible

2. **Fotocopia del RUT**
   - RUT actualizado (no mayor a 6 meses)
   - Formato: PDF
   - Tamaño máximo: 5 MB

3. **Anexos Adicionales** (opcional)
   - Cámara de comercio
   - Estados financieros
   - Referencias comerciales

**Cómo cargar documentos:**
1. Haz clic en el botón **"Seleccionar archivo"** de cada documento
2. Navega y selecciona el archivo en tu computador
3. Verás una vista previa o confirmación de carga
4. Puedes reemplazar el documento haciendo clic en **"Cambiar"**

#### **Paso 6: Guardar Información**

1. Revisa que todos los campos estén completos
2. Haz clic en **"Guardar Cambios"** o **"Actualizar Perfil"**
3. El sistema validará la información
4. Recibirás una confirmación de éxito

### 5.2 Estados del Perfil

Tu perfil puede estar en uno de los siguientes estados:

#### **1. Perfil Incompleto**
- **Descripción:** Faltan datos obligatorios o documentos
- **Indicador:** Badge rojo con "Incompleto"
- **Acciones disponibles:** Editar perfil
- **Restricciones:** No puedes crear órdenes

#### **2. Perfil Completo - Pendiente de Sincronización**
- **Descripción:** Perfil completo, esperando sincronización con SAP
- **Indicador:** Badge amarillo con "Pendiente Sync"
- **Acciones disponibles:** Ver perfil (no editar datos críticos)
- **Restricciones:** No puedes crear órdenes aún
- **Tiempo estimado:** La sincronización automática ocurre a las 3:00 AM diariamente

#### **3. Perfil Sincronizado - Activo**
- **Descripción:** Perfil sincronizado exitosamente con SAP
- **Indicador:** Badge verde con "Activo"
- **CardCode SAP:** Visible en el perfil (ej: CI800230447)
- **Acciones disponibles:** Crear órdenes, actualizar información
- **Restricciones:** Ninguna

#### **4. Perfil Inactivo**
- **Descripción:** Cuenta desactivada por el administrador
- **Indicador:** Badge gris con "Inactivo"
- **Acciones disponibles:** Ver perfil
- **Restricciones:** No puedes crear órdenes ni acceder a ciertas funcionalidades
- **Solución:** Contactar al administrador

### 5.3 Actualizar Información del Perfil

#### **Información que puedes actualizar en cualquier momento:**
- Dirección de facturación
- Teléfonos de contacto
- Información bancaria
- Documentos adjuntos
- Contactos adicionales

#### **Información que requiere aprobación administrativa:**
- Razón social
- NIT
- Tipo de régimen fiscal

**Nota:** Cualquier cambio en información fiscal puede requerir re-sincronización con SAP.

### 5.4 Verificación de Perfil

Para verificar el estado actual de tu perfil:

1. Ve a **Mi Perfil**
2. Revisa el indicador de estado en la parte superior
3. Si ves "Pendiente de Sincronización":
   - Verifica que todos los campos estén completos
   - Espera a la sincronización automática (3:00 AM)
   - O contacta al administrador para sincronización manual

4. Si puedes crear órdenes, tu perfil está activo

---

## 6. GESTIÓN DE SUCURSALES

### 6.1 ¿Qué son las Sucursales?

Las sucursales representan ubicaciones físicas diferentes de una misma empresa cliente. Cada sucursal puede:

- Crear sus propias órdenes independientes
- Tener su propia dirección de entrega
- Acceder al catálogo completo del cliente principal
- Ver únicamente sus propias órdenes (no las de otras sucursales)

### 6.2 Creación de Sucursales (Solo para Clientes Institucionales)

**Nota:** La gestión de sucursales está disponible principalmente para clientes del **Grupo 103 (Institucional)** en SAP.

#### **Sincronización Automática desde SAP:**

1. **Origen de Datos:**
   - Las sucursales se sincronizan automáticamente desde SAP B1
   - Se obtienen desde las direcciones de entrega registradas en SAP (tabla CRD1)
   - La sincronización ocurre diariamente a las 3:00 AM

2. **Información Sincronizada:**
   - Nombre de la sucursal (AddressName)
   - Dirección completa (Street, City, State)
   - Código de municipio (U_HBT_MunMed)
   - Email del encargado (U_HBT_CORREO)
   - Nombre del encargado (U_HBT_ENCARGADO)

3. **Proceso Automático:**
   - Las sucursales nuevas se crean automáticamente
   - Las existentes se actualizan con información de SAP
   - Se genera un token de acceso para cada sucursal

#### **Creación Manual (Solo Administradores):**

Si necesitas crear una sucursal manualmente:

1. **Acceder al Módulo de Sucursales:**
   - Menú: **Sucursales > Gestionar Sucursales**

2. **Hacer clic en "Nueva Sucursal"**

3. **Completar Información:**
   - **Cliente Asociado:** Seleccionar el cliente principal
   - **Nombre de Sucursal:** Identificador único
   - **Ship-To Code:** Código de dirección de envío (debe coincidir con SAP)
   - **Dirección Completa:** Calle, número, complemento
   - **Ciudad, Departamento, País**
   - **Código Postal**
   - **Email del Encargado:** Para notificaciones
   - **Nombre del Encargado:** Responsable de la sucursal
   - **Teléfono de Contacto**

4. **Marcar como Sucursal Predeterminada** (opcional)
   - Solo una sucursal puede ser la predeterminada
   - Se usará por defecto en órdenes del cliente principal

5. **Guardar Sucursal**
   - Se generará automáticamente un token de acceso
   - El token se enviará por email al encargado

### 6.3 Gestión de Tokens de Sucursal

#### **Generación de Token:**

Cada sucursal tiene un token único de 32 caracteres para acceso:

**Formato:** `BRANCH-XXXX-XXXX-XXXX-XXXX`

**Características del Token:**
- Único e irrepetible
- Validez: 90 días
- No requiere contraseña adicional
- Se puede renovar antes del vencimiento

#### **Envío de Token:**

1. **Email Automático:**
   - Al crear la sucursal, se envía un email al encargado
   - Contiene el token y las instrucciones de acceso

2. **Reenvío Manual:**
   - Desde **Sucursales > Ver Detalles**
   - Botón **"Reenviar Token"**
   - Se enviará nuevo email con el token

#### **Verificación de Email del Encargado:**

Para mejorar la seguridad, el sistema requiere verificación de email:

1. **Proceso de Verificación:**
   - Al registrar el email del encargado, se envía un link de verificación
   - El encargado debe hacer clic en el link
   - El email queda verificado

2. **Sin Verificación:**
   - La sucursal no puede acceder al sistema
   - El token no funcionará hasta que se verifique el email

3. **Re-verificación:**
   - Si se cambia el email del encargado, se requiere nueva verificación
   - El acceso se suspende hasta completar la verificación

### 6.4 Acceso y Funcionalidades para Sucursales

#### **Login de Sucursal:**

1. Ir a la página principal de LA ARTESA
2. Seleccionar **"Login Sucursal"**
3. Ingresar el token proporcionado
4. Hacer clic en **"Acceder"**

#### **Dashboard de Sucursal:**

Al ingresar, la sucursal verá:

- **Nombre de la Sucursal** en la barra superior
- **Nombre del Cliente Principal** (empresa matriz)
- **Estadísticas Específicas:**
  - Órdenes creadas por esta sucursal
  - Productos disponibles (heredados del cliente)
  - Facturas de esta sucursal

#### **Funcionalidades Disponibles:**

✅ **Puede:**
- Ver el catálogo completo de productos
- Crear órdenes independientes
- Ver el historial de sus propias órdenes
- Consultar sus facturas
- Descargar facturas en PDF

❌ **No puede:**
- Ver órdenes de otras sucursales
- Modificar el perfil del cliente principal
- Crear o gestionar otras sucursales
- Acceder a configuraciones administrativas
- Ver facturas de otras sucursales

### 6.5 Actualización de Información de Sucursales

#### **Cambios Permitidos:**

Los siguientes datos se pueden actualizar:

- Dirección de la sucursal
- Teléfono de contacto
- Email del encargado (requiere nueva verificación)
- Nombre del encargado

#### **Procedimiento:**

1. **Para Administradores:**
   - Menú: **Sucursales > Gestionar Sucursales**
   - Seleccionar la sucursal a editar
   - Botón **"Editar"**
   - Modificar los campos necesarios
   - **Guardar Cambios**

2. **Para Clientes con Rol 3 (Administrador Funcional):**
   - Mismo procedimiento, pero solo para sucursales de su empresa

**Importante:** Si cambias el email del encargado:
- Se envía automáticamente un link de verificación al nuevo email
- El acceso de la sucursal se suspende temporalmente
- Se deben eliminar los tokens activos de la sucursal
- Una vez verificado, se puede generar un nuevo token

### 6.6 Desactivación de Sucursales

Para desactivar una sucursal (solo administradores):

1. Ir a **Sucursales > Gestionar Sucursales**
2. Seleccionar la sucursal
3. Botón **"Desactivar"**
4. Confirmar la acción

**Efectos de la desactivación:**
- La sucursal no podrá acceder con su token
- Las órdenes históricas permanecen visibles
- Se pueden reactivar en cualquier momento
- Los tokens existentes quedan invalidados

### 6.7 Reportes de Sucursales

Los administradores pueden generar reportes consolidados:

- **Órdenes por Sucursal:** Comparativa entre ubicaciones
- **Productos Más Vendidos por Sucursal**
- **Rendimiento Mensual de cada Sucursal**
- **Sucursales Activas vs Inactivas**

---

## 7. CATÁLOGO DE PRODUCTOS

### 7.1 Visualización del Catálogo

#### **Acceso al Catálogo:**

1. Desde el menú lateral, haz clic en **📦 Productos**
2. Verás el catálogo completo de productos disponibles

#### **Elementos de la Vista:**

Cada producto muestra:

1. **Imagen del Producto:**
   - Foto principal del producto
   - Si no tiene imagen: ícono de placeholder
   - Haz clic para ver imagen ampliada

2. **Información Básica:**
   - **Nombre del Producto**
   - **Código SAP** (ItemCode)
   - **Descripción:** Detalles del producto

3. **Información de Precios:**
   - **Precio Unitario:** Precio base por unidad
   - **Precio de Lista:** (si aplica lista de precios especial)
   - **Impuestos:** Porcentaje de IVA u otros impuestos
   - **Moneda:** COP (Pesos colombianos)

4. **Información de Inventario:**
   - **Stock Disponible:** Cantidad en inventario
   - **Estado:** Disponible / Agotado / Descontinuado

5. **Botones de Acción:**
   - **"Agregar a Orden":** Añade el producto al carrito
   - **"Ver Detalles":** Abre información completa del producto

### 7.2 Búsqueda y Filtros

#### **Barra de Búsqueda:**

- Ubicada en la parte superior del catálogo
- Busca por: Nombre, Código SAP, Descripción
- La búsqueda es en tiempo real (mientras escribes)

**Ejemplo:**
- Escribir "pan" mostrará todos los productos con "pan" en su nombre
- Escribir "1001" mostrará productos con ese código

#### **Filtros Disponibles:**

1. **Por Grupo de Productos:**
   - Filtrar por categoría SAP
   - Ejemplos: Panes, Pasteles, Galletas, etc.

2. **Por Rango de Precios:**
   - Deslizador para seleccionar rango
   - Mínimo y máximo

3. **Por Disponibilidad:**
   - ☑️ Solo productos en stock
   - ☑️ Incluir productos agotados
   - ☑️ Mostrar descontinuados

4. **Por Lista de Precios:**
   - Si tu cliente tiene lista especial
   - Filtrar por lista aplicable

#### **Ordenamiento:**

Puedes ordenar los productos por:
- **Nombre (A-Z / Z-A)**
- **Precio (Menor a Mayor / Mayor a Menor)**
- **Stock (Disponibilidad)**
- **Código SAP**

### 7.3 Detalles del Producto

Al hacer clic en **"Ver Detalles"**:

#### **Vista Completa del Producto:**

1. **Galería de Imágenes:**
   - Imagen principal grande
   - Miniaturas de imágenes adicionales (si existen)
   - Zoom al pasar el cursor

2. **Información Técnica:**
   - **ItemCode:** Código único en SAP
   - **ItemName:** Nombre completo
   - **Grupo:** Categoría del producto (GroupCode)
   - **Unidad de Medida:** kg, unidad, caja, etc.
   - **Peso Neto / Peso Bruto**
   - **Dimensiones** (si aplica)

3. **Información Fiscal:**
   - **Código de Impuesto:** (TaxCode)
   - **Porcentaje de IVA:** Ejemplo: 19%
   - **Base Gravable**

4. **Información de Precios:**
   - **Precio Base**
   - **Descuentos aplicables** (si existen)
   - **Precio Final Calculado**

5. **Descripción Extendida:**
   - Descripción completa del producto
   - Ingredientes (si aplica)
   - Información nutricional (si aplica)
   - Modo de conservación

6. **Historial de Compras:**
   - Última vez que compraste este producto
   - Cantidad promedio en tus órdenes
   - Frecuencia de compra

### 7.4 Sincronización de Productos con SAP

#### **Sincronización Automática:**

**Frecuencia:** Diaria
**Hora:** 00:00 (medianoche)
**Qué se sincroniza:**
- Nuevos productos añadidos en SAP
- Actualizaciones de precios
- Cambios en stock
- Modificaciones en descripciones
- Nuevas imágenes

**Grupos Priorizados:**
- **Grupo 127:** Sincronización cada 6 horas
- Productos de este grupo se actualizan con mayor frecuencia

#### **Sincronización Manual (Solo Administradores):**

Si eres administrador, puedes forzar una sincronización:

1. Ir a **Menú > Sincronización SAP > Productos**
2. Seleccionar tipo de sincronización:
   - **Completa:** Todos los productos
   - **Por Grupo:** Solo un grupo específico
   - **Incremental:** Solo cambios recientes

3. Hacer clic en **"Sincronizar Ahora"**
4. Monitorear el progreso en tiempo real
5. Ver resumen al finalizar:
   - Productos nuevos creados
   - Productos actualizados
   - Errores (si los hay)

### 7.5 Gestión de Productos (Solo Administradores)

#### **Crear Nuevo Producto:**

1. **Ir a Productos > Nuevo Producto**

2. **Información Obligatoria:**
   - ItemCode (único)
   - ItemName
   - GroupCode (Grupo)
   - Precio base
   - TaxCode

3. **Información Opcional:**
   - Descripción extendida
   - Imagen del producto
   - Peso y dimensiones
   - Stock inicial
   - Lista de precios especial

4. **Guardar Producto**

**Nota:** Los productos creados localmente se pueden sincronizar con SAP si se requiere.

#### **Editar Producto Existente:**

1. Buscar el producto en el catálogo
2. Hacer clic en **"Editar"** (solo visible para admins)
3. Modificar los campos necesarios
4. **Importante:** Algunos campos pueden requerir sincronización con SAP
5. Guardar cambios

**Campos que disparan sincronización con SAP:**
- Precio base
- TaxCode
- ItemName
- GroupCode

#### **Gestión de Imágenes:**

**Cargar Nueva Imagen:**
1. En la edición del producto
2. Sección **"Imágenes"**
3. Hacer clic en **"Subir Imagen"**
4. Seleccionar archivo (JPG, PNG máximo 5 MB)
5. Recortar o ajustar si es necesario
6. Guardar

**Eliminar Imagen:**
- Hacer clic en el ícono de papelera sobre la imagen
- Confirmar eliminación

**Múltiples Imágenes:**
- Se pueden añadir hasta 5 imágenes por producto
- Arrastrar para reordenar
- La primera es la imagen principal

#### **Desactivar Producto:**

Si un producto ya no se vende:

1. Editar el producto
2. Cambiar estado a **"Inactivo"** o **"Descontinuado"**
3. Guardar

**Efectos:**
- No aparece en nuevas órdenes
- Permanece visible en órdenes históricas
- Se puede reactivar en cualquier momento

---

## 8. CREACIÓN Y GESTIÓN DE ÓRDENES

### 8.1 Requisitos Previos para Crear Órdenes

Antes de crear una orden, asegúrate de:

✅ **Tu perfil esté completo** (todos los campos obligatorios)
✅ **Tu perfil esté sincronizado con SAP** (tienes CardCode asignado)
✅ **Tu cuenta esté activa** (estado "Activo")
✅ **Estés dentro del horario permitido** (antes de la hora límite configurada)

**Verificar si puedes crear órdenes:**
- En el dashboard verás un indicador de estado
- Si dice "Pendiente de Sincronización", debes esperar
- Si dice "Activo", puedes crear órdenes

### 8.2 Proceso de Creación de Orden

#### **Paso 1: Iniciar Nueva Orden**

1. Desde el menú lateral, haz clic en **📋 Órdenes**
2. Haz clic en el botón **"+ Nueva Orden"** o **"Crear Orden"**
3. Serás redirigido al formulario de creación

#### **Paso 2: Información General de la Orden**

**Campos Obligatorios:**

1. **Fecha de Entrega Deseada:**
   - Selecciona la fecha en el calendario
   - **Restricción:** Mínimo 2 días de anticipación
   - Ejemplo: Si hoy es 15 de octubre, fecha mínima es 17 de octubre

2. **Sucursal de Entrega:**
   - Selecciona de la lista desplegable
   - Muestra todas tus sucursales registradas
   - Si eres una sucursal, este campo está pre-seleccionado

3. **Comentarios de la Orden** (opcional):
   - Instrucciones especiales de entrega
   - Preferencias de empaque
   - Cualquier nota relevante

#### **Paso 3: Agregar Productos**

**Método 1: Desde el Catálogo Integrado**

1. En la misma pantalla de creación de orden, verás el catálogo
2. Busca o filtra los productos que necesitas
3. Haz clic en **"Agregar"** en cada producto
4. Especifica la cantidad deseada
5. El producto se añade automáticamente a tu orden

**Método 2: Búsqueda Rápida**

1. Usa el campo de búsqueda rápida
2. Escribe el nombre o código del producto
3. Selecciona de los resultados
4. Ingresa cantidad
5. Haz clic en **"Agregar a Orden"**

**Método 3: Desde Productos Frecuentes**

1. Si has comprado antes, verás "Productos Frecuentes"
2. Muestra tus productos más pedidos
3. Clic rápido para agregar con cantidad sugerida

#### **Paso 4: Configurar Detalles de Cada Producto**

Para cada producto en tu orden:

1. **Cantidad:**
   - Ingresa el número de unidades
   - Respeta la unidad de medida (kg, unidades, cajas)

2. **Precio Unitario:**
   - Se muestra automáticamente según tu lista de precios
   - No editable (viene de SAP)

3. **Descuento (si aplica):**
   - Si tienes descuentos especiales, se aplicarán automáticamente

4. **Subtotal del Ítem:**
   - Se calcula automáticamente: Cantidad × Precio

5. **Botones de Acción:**
   - **Editar Cantidad:** Modificar unidades
   - **Eliminar:** Quitar producto de la orden

#### **Paso 5: Resumen de la Orden**

En el panel derecho verás:

1. **Resumen de Productos:**
   - Lista de todos los productos añadidos
   - Cantidades
   - Subtotales

2. **Cálculo de Totales:**
   - **Subtotal:** Suma de todos los productos sin impuestos
   - **IVA:** Impuesto calculado automáticamente
   - **Otros Impuestos:** Si aplican impuestos adicionales
   - **Total:** Monto final de la orden

3. **Información de Entrega:**
   - Fecha de entrega seleccionada
   - Dirección de la sucursal
   - Tiempo estimado de entrega

#### **Paso 6: Validaciones Automáticas**

Antes de confirmar, el sistema verifica:

✅ **Fecha de Entrega Válida:**
- No sea anterior a hoy + 2 días
- No sea un día no laborable (si aplica)

✅ **Hora Límite:**
- Si la orden se crea después de la hora configurada (ej: 18:00)
- La fecha de entrega debe ser mayor

**Ejemplo:**
- Hora límite: 18:00
- Hoy: 15 octubre a las 19:00 (después de límite)
- Fecha mínima de entrega: 18 octubre (3 días)

✅ **Productos Disponibles:**
- Verifica stock en SAP
- Alerta si algún producto no está disponible

✅ **Monto Mínimo:**
- Si existe monto mínimo de orden, lo valida

#### **Paso 7: Confirmar Orden**

1. Revisa todos los detalles cuidadosamente
2. Lee los términos y condiciones (si es primera orden)
3. Haz clic en **"Confirmar Orden"** o **"Crear Orden"**

#### **Paso 8: Confirmación Exitosa**

Al confirmar:
- Verás un mensaje de éxito
- Se asigna un **Order ID** único
- El estado inicial es **"Pendiente"** (Estado ID: 1)
- Recibes un email de confirmación con los detalles
- Puedes descargar un PDF de la orden

### 8.3 Estados de las Órdenes

Una orden pasa por varios estados a lo largo de su ciclo de vida:

#### **Estado 1: Pendiente**
- **Descripción:** Orden recién creada, esperando aprobación
- **Color:** Amarillo
- **Acciones disponibles:** 
  - Editar orden
  - Cancelar orden
  - Ver detalles

#### **Estado 2: Aprobada**
- **Descripción:** Orden aprobada por el administrador o sistema
- **Color:** Verde claro
- **Acciones disponibles:**
  - Ver detalles
  - Cancelar (con justificación)

#### **Estado 3: En Producción**
- **Descripción:** Orden enviada a SAP y en proceso de preparación
- **Color:** Azul
- **Sincronización:** En este estado la orden se sincroniza con SAP
- **Timing:** Se sincroniza 2 días antes de la fecha de entrega a las 18:30
- **Acciones disponibles:**
  - Ver detalles
  - No se puede modificar ni cancelar

#### **Estado 4: Entregada**
- **Descripción:** Productos entregados al cliente
- **Color:** Verde
- **Actualización:** Se actualiza automáticamente cuando SAP registra la entrega
- **Acciones disponibles:**
  - Ver detalles
  - Ver remisión
  - Descargar PDF

#### **Estado 5: Facturada**
- **Descripción:** Se generó factura electrónica en SAP
- **Color:** Verde oscuro
- **Información adicional:** 
  - Número de factura SAP
  - Fecha de facturación
  - Monto facturado
- **Acciones disponibles:**
  - Ver detalles
  - Descargar factura
  - Ver remisión

#### **Estado 6: Cancelada**
- **Descripción:** Orden cancelada por el usuario o sistema
- **Color:** Rojo
- **Motivos posibles:**
  - Cancelación por el usuario
  - Productos no disponibles
  - Cambios en inventario
  - Problemas en sincronización SAP
- **Acciones disponibles:**
  - Ver detalles
  - Ver motivo de cancelación

### 8.4 Gestión de Órdenes Existentes

#### **Ver Listado de Órdenes:**

1. Menú: **📋 Órdenes > Mis Órdenes**
2. Verás tabla con todas tus órdenes

**Columnas del Listado:**
- **Order ID:** Identificador único
- **Fecha de Creación**
- **Fecha de Entrega**
- **Sucursal:** Ubicación de entrega
- **Estado:** Badge con color según estado
- **Total:** Monto de la orden
- **Acciones:** Botones de acción rápida

#### **Filtros en el Listado:**

Puedes filtrar órdenes por:

1. **Estado:**
   - Pendiente, Aprobada, En Producción, etc.

2. **Rango de Fechas:**
   - Fecha de creación
   - Fecha de entrega

3. **Sucursal:**
   - Si tienes múltiples sucursales

4. **Búsqueda:**
   - Por Order ID
   - Por número de orden SAP (DocEntry)

#### **Ver Detalles de una Orden:**

1. Haz clic en el **Order ID** o botón **"Ver"**
2. Se abre vista detallada con:

**Información General:**
- Número de orden
- Estado actual
- Fecha de creación
- Fecha de entrega
- Sucursal de entrega
- Usuario que creó la orden

**Productos de la Orden:**
- Tabla con todos los productos
- Cantidades
- Precios unitarios
- Subtotales
- Total de la orden

**Historial de Estados:**
- Línea de tiempo con cambios de estado
- Fecha y hora de cada cambio
- Usuario que realizó el cambio (si aplica)

**Información de SAP:**
- DocEntry (número de orden en SAP)
- CardCode del cliente
- Estado en SAP
- Número de entrega (DeliveryNum)
- Número de factura (InvoiceNum)

**Comentarios y Notas:**
- Comentarios iniciales de la orden
- Notas añadidas por administradores

#### **Editar una Orden:**

**Solo puedes editar órdenes en estado "Pendiente" (Estado 1)**

1. Abrir la orden
2. Clic en **"Editar Orden"**
3. Puedes modificar:
   - Fecha de entrega
   - Productos (agregar, quitar, cambiar cantidades)
   - Sucursal de entrega
   - Comentarios

4. **No puedes modificar:**
   - Cliente asociado
   - Precios unitarios

5. Guardar cambios

**Validaciones al editar:**
- Se vuelven a aplicar todas las validaciones de fecha
- Se recalculan totales
- Se verifica disponibilidad de productos

#### **Cancelar una Orden:**

**Puedes cancelar órdenes en estado:**
- Pendiente (Estado 1)
- Aprobada (Estado 2)

**No puedes cancelar órdenes:**
- En Producción (Estado 3) - ya está en SAP
- Entregada (Estado 4)
- Facturada (Estado 5)

**Procedimiento:**

1. Abrir la orden
2. Clic en **"Cancelar Orden"**
3. Se solicita **motivo de cancelación** (obligatorio)
4. Confirmar la cancelación
5. La orden cambia a estado "Cancelada" (Estado 6)

**Nota:** Las cancelaciones quedan registradas en el sistema de auditoría.

#### **Duplicar una Orden:**

Si quieres crear una orden similar a una existente:

1. Abrir la orden original
2. Clic en **"Duplicar Orden"**
3. Se crea una nueva orden con:
   - Los mismos productos y cantidades
   - La misma sucursal
   - **Fecha nueva:** Debes seleccionar nueva fecha de entrega
4. Puedes modificar los productos antes de confirmar
5. Confirmar la nueva orden

**Útil para:**
- Órdenes recurrentes
- Pedidos mensuales
- Reposición de inventario

### 8.5 Sincronización de Órdenes con SAP

#### **Proceso Automático:**

**Momento de Sincronización:**
- Las órdenes en estado "Aprobada" (Estado 2) se sincronizan automáticamente
- **Timing:** 2 días antes de la fecha de entrega
- **Hora:** 18:30 (después de la hora límite de pedidos)

**Ejemplo:**
- Orden con fecha de entrega: 20 de octubre
- Se sincroniza: 18 de octubre a las 18:30
- Estado cambia a: "En Producción" (Estado 3)

**Qué se envía a SAP:**
- Todos los productos de la orden
- Cantidades
- Precios según lista del cliente
- Dirección de entrega (sucursal)
- CardCode del cliente
- Fecha de entrega
- Comentarios

**Respuesta de SAP:**
- Se obtiene un **DocEntry** (número de orden en SAP)
- Se almacena para rastreo
- La orden queda vinculada entre ambos sistemas

#### **Sincronización Manual (Solo Administradores):**

Los administradores pueden forzar sincronización:

1. Ir a **Órdenes > Sincronización**
2. Ver lista de órdenes pendientes de sincronización
3. Seleccionar órdenes específicas o **"Sincronizar Todas"**
4. Monitorear el progreso
5. Ver resultados:
   - Órdenes sincronizadas exitosamente
   - Errores (con descripción del problema)

**Motivos para sincronización manual:**
- Resolver errores de sincronización automática
- Urgencia en procesar una orden
- Pruebas o validaciones

#### **Manejo de Errores:**

Si una orden falla al sincronizar:

1. **Se intenta nuevamente:**
   - Hasta 3 intentos automáticos
   - Con intervalo de 30 minutos entre cada intento

2. **Si persiste el error:**
   - Se notifica al administrador
   - El error queda registrado en la orden
   - Se almacena mensaje de error de SAP

3. **Soluciones comunes:**
   - Verificar que el cliente existe en SAP
   - Validar que productos están activos en SAP
   - Confirmar que precios estén actualizados
   - Revisar configuración de impuestos

### 8.6 Notificaciones de Órdenes

Recibirás notificaciones por email en los siguientes casos:

1. **Orden Creada:**
   - Confirmación con detalles de la orden
   - Fecha de entrega
   - Total

2. **Orden Aprobada:**
   - Notificación de aprobación
   - Confirmación de que será procesada

3. **Orden en Producción:**
   - Confirmación de sincronización con SAP
   - Número de orden SAP (DocEntry)

4. **Orden Entregada:**
   - Confirmación de entrega exitosa
   - Fecha y hora de entrega

5. **Orden Facturada:**
   - Notificación de facturación
   - Número de factura
   - Enlace para descargar factura PDF

6. **Orden Cancelada:**
   - Si administrador cancela la orden
   - Motivo de cancelación

---

## 9. CONSULTA DE FACTURAS

### 9.1 Acceso al Módulo de Facturas

1. Desde el menú lateral, haz clic en **🧾 Facturas**
2. Verás el listado de todas tus facturas emitidas

### 9.2 Listado de Facturas

#### **Información Mostrada:**

La tabla de facturas muestra:

**Columnas Principales:**
- **Número de Factura:** Número asignado por SAP (InvoiceNum)
- **DocEntry:** Identificador interno de SAP
- **Fecha de Facturación:** Cuándo se emitió
- **Orden Relacionada:** Order ID de la orden original
- **Subtotal:** Monto sin impuestos
- **IVA:** Impuesto calculado
- **Total:** Monto final facturado
- **Estado:** Activa, Anulada, etc.
- **Acciones:** Botones para descargar o ver detalles

#### **Información Adicional (Ver Detalles):**

Al hacer clic en una factura:

1. **Datos del Encabezado:**
   - Razón social del cliente
   - NIT
   - Dirección de facturación
   - Teléfono
   - Email

2. **Información de Entrega:**
   - Sucursal donde se entregó
   - Dirección de entrega
   - Fecha de entrega

3. **Detalle de Productos Facturados:**
   - Tabla con todos los ítems
   - Cantidades
   - Precios unitarios
   - Descuentos aplicados
   - Subtotales por ítem

4. **Información Fiscal:**
   - Base gravable
   - IVA discriminado
   - Retenciones (si aplican)
   - Total facturado

5. **Información de Pago:**
   - Condición de pago
   - Fecha de vencimiento
   - Estado del pago (si está integrado)

### 9.3 Filtros y Búsqueda

Puedes filtrar facturas por:

1. **Rango de Fechas:**
   - Fecha de facturación
   - Mes específico
   - Año específico
   - Últimos 30, 60, 90 días

2. **Por Sucursal:**
   - Si tienes múltiples sucursales
   - Ver facturas de una ubicación específica

3. **Por Estado:**
   - Activas
   - Anuladas
   - Notas crédito

4. **Por Monto:**
   - Rango de valores

5. **Búsqueda Rápida:**
   - Por número de factura
   - Por número de orden
   - Por DocEntry

### 9.4 Descarga de Facturas

#### **Descargar Factura Individual:**

1. En el listado, localiza la factura
2. Haz clic en botón **"Descargar PDF"** (ícono de descarga)
3. El archivo se descargará automáticamente
4. Formato: `Factura_[NumeroFactura]_[Fecha].pdf`

**Contenido del PDF:**
- Formato oficial de factura electrónica
- Logo de LA ARTESA
- Información fiscal completa
- Código QR para validación DIAN (si aplica)
- Todos los detalles de productos
- Totales y cálculos de impuestos

#### **Descargar Múltiples Facturas:**

1. Usa los checkboxes a la izquierda de cada factura
2. Selecciona las facturas que necesitas
3. Botón **"Descargar Seleccionadas"**
4. Se generará un archivo ZIP con todas las facturas

#### **Enviar Factura por Email:**

1. Abrir detalle de la factura
2. Botón **"Enviar por Email"**
3. Confirmar o modificar email de destino
4. La factura se enviará en PDF adjunto

### 9.5 Relación Orden-Factura

#### **Cómo se vinculan:**

1. **Orden Creada:** Se genera con Order ID único
2. **Orden Sincronizada:** Se crea en SAP con DocEntry
3. **Orden Entregada:** SAP genera documento de entrega (Delivery)
4. **Orden Facturada:** SAP genera factura (Invoice) vinculada a la entrega

**En el sistema de LA ARTESA:**
- Las órdenes muestran el InvoiceNum cuando están facturadas
- Las facturas muestran el Order ID original
- Puedes navegar entre orden y factura con un clic

#### **Sincronización de Facturas:**

**Frecuencia:** 3 veces al día (8:00 AM, 12:00 PM, 16:00 PM)

**Proceso:**
1. Se consulta SAP por nuevas facturas
2. Se buscan facturas vinculadas a órdenes del sistema
3. Se importan los detalles completos
4. Se actualizan los estados de las órdenes a "Facturada"
5. Se envían notificaciones a los clientes

**Detección Automática:**
- El sistema identifica facturas por el DocEntry de la orden
- Asocia la factura al cliente correcto usando CardCode
- Valida que los montos coincidan

### 9.6 Estados de Factura

Las facturas pueden tener los siguientes estados:

#### **Activa:**
- Factura válida y vigente
- Color: Verde
- Se puede descargar y usar normalmente

#### **Anulada:**
- Factura cancelada o anulada
- Color: Rojo
- Se mantiene para registro histórico
- No se puede usar para efectos fiscales

#### **Con Nota Crédito:**
- Se generó una nota crédito asociada
- Color: Naranja
- Ver detalle muestra la nota crédito vinculada

### 9.7 Reportes de Facturación

Los usuarios pueden generar reportes:

1. **Menú: Facturas > Reportes**

2. **Tipos de Reportes:**

   **Reporte Mensual:**
   - Total facturado por mes
   - Cantidad de facturas
   - Promedio de compra
   - Productos más comprados

   **Reporte Anual:**
   - Total facturado en el año
   - Comparativa mes a mes
   - Tendencias de compra

   **Reporte por Sucursal:**
   - Facturación de cada ubicación
   - Comparativa entre sucursales

3. **Exportar Reportes:**
   - Formato PDF
   - Formato Excel (.xlsx)
   - Formato CSV

### 9.8 Notas y Devoluciones

Si necesitas gestionar una devolución o nota crédito:

1. **Contactar Soporte:**
   - No se pueden crear notas desde la aplicación
   - Debes contactar al área de servicio al cliente

2. **Proceso:**
   - Se validará la solicitud
   - Se generará nota crédito en SAP
   - Se sincronizará automáticamente con la aplicación
   - Aparecerá vinculada a la factura original

3. **Ver Nota Crédito:**
   - En el detalle de la factura
   - Sección "Notas Crédito Asociadas"
   - Puedes descargar PDF de la nota

---

## 10. FUNCIONES ADMINISTRATIVAS

### 10.1 Gestión de Usuarios (Solo Rol 1)

Los administradores tienen acceso completo a la gestión de usuarios.

#### **Ver Listado de Usuarios:**

1. **Menú: 👥 Usuarios**
2. Verás tabla con todos los usuarios del sistema

**Información Mostrada:**
- ID del Usuario
- Nombre completo
- Email
- Rol (Admin, User, Functional Admin)
- Estado (Activo, Inactivo)
- Fecha de registro
- Última conexión
- Acciones

#### **Filtros de Usuarios:**

- Por rol
- Por estado (activo/inactivo)
- Por fecha de registro
- Búsqueda por nombre o email

#### **Crear Nuevo Usuario:**

1. Botón **"+ Nuevo Usuario"**
2. Completar formulario:
   - Nombre completo
   - Email (único)
   - Contraseña temporal
   - Seleccionar rol (1, 2 o 3)

3. **Guardar Usuario**

**Nota:** El usuario recibirá un email con:
- Sus credenciales temporales
- Link para cambiar contraseña
- Instrucciones de acceso

#### **Editar Usuario:**

1. Clic en botón **"Editar"** del usuario
2. Puedes modificar:
   - Nombre
   - Email
   - Rol
   - Estado (Activo/Inactivo)

3. **No puedes modificar:**
   - Contraseña (el usuario debe usar recuperación de contraseña)
   - ID del usuario
   - Historial

4. Guardar cambios

#### **Desactivar/Activar Usuario:**

**Desactivar:**
- Cambia estado a "Inactivo"
- El usuario no podrá iniciar sesión
- Mantiene todo su historial
- Sus órdenes permanecen visibles

**Activar:**
- Cambia estado de vuelta a "Activo"
- El usuario recupera acceso completo

#### **Resetear Contraseña:**

1. En la fila del usuario, botón **"Resetear Contraseña"**
2. Confirmar acción
3. Se genera token de recuperación
4. Se envía email al usuario con instrucciones

#### **Ver Actividad del Usuario:**

1. Clic en el nombre del usuario
2. Vista detallada mostrando:
   - Historial de órdenes
   - Historial de login
   - Cambios en perfil
   - Actividad reciente

### 10.2 Gestión de Perfiles de Cliente (Rol 1 y 3)

#### **Ver Todos los Perfiles:**

1. **Menú: Perfiles > Gestionar Perfiles**
2. Lista de todos los perfiles de cliente

**Información:**
- Razón social
- NIT
- CardCode SAP
- Estado de sincronización
- Usuario asociado
- Fecha de creación

#### **Revisar y Aprobar Perfiles:**

Cuando un usuario completa su perfil, el administrador debe revisarlo:

1. Perfiles nuevos aparecen como "Pendiente de Revisión"
2. Hacer clic en **"Revisar"**
3. Verificar todos los datos:
   - Información fiscal correcta
   - Documentos cargados y legibles
   - NIT válido
   - Datos de contacto

4. **Opciones:**
   - **Aprobar:** Marca perfil como listo para sincronización
   - **Rechazar:** Solicita correcciones (envía email al usuario)
   - **Solicitar Más Información**

#### **Sincronizar Perfil con SAP:**

Una vez aprobado:

1. El perfil entra en cola de sincronización
2. En la próxima sincronización automática (3:00 AM):
   - Se busca o crea el cliente en SAP
   - Se asigna CardCode
   - Se configuran precios y condiciones
   - Se habilita para crear órdenes

3. **Sincronización Manual:**
   - Botón **"Sincronizar Ahora"**
   - Útil para casos urgentes
   - Ver resultado en tiempo real

#### **Editar Perfil de Cliente:**

Los administradores pueden modificar cualquier campo del perfil:

1. Abrir el perfil
2. Botón **"Editar Información"**
3. Modificar los campos necesarios
4. Guardar cambios

**Importante:** Ciertos cambios requieren re-sincronización:
- NIT
- Razón social
- Tipo de régimen

### 10.3 Gestión de Productos (Solo Rol 1)

Cubierto en detalle en [Sección 7.5](#75-gestión-de-productos-solo-administradores)

**Resumen de Funciones:**
- Crear productos manualmente
- Editar productos existentes
- Gestionar imágenes de productos
- Activar/desactivar productos
- Actualizar precios
- Modificar códigos de impuestos
- Sincronizar con SAP

### 10.4 Configuración del Portal (Rol 1 y 3)

#### **Acceso a Configuración:**

1. **Menú: ⚙️ Configuración**
2. Panel de configuración del portal

#### **Opciones Disponibles:**

**1. Hora Límite de Pedidos:**

- Define hasta qué hora del día se pueden crear órdenes para entrega en 2 días
- Formato 24 horas (HH:MM)
- Ejemplo: Si se configura 18:00:
  - Órdenes creadas antes de las 18:00 → entrega mínima en 2 días
  - Órdenes creadas después de las 18:00 → entrega mínima en 3 días

**Configurar:**
1. Campo "Hora Límite de Pedidos"
2. Seleccionar hora en selector
3. Guardar cambios

**2. Banner de Inicio:**

- Imagen principal que se muestra en la pantalla de inicio
- Visible para todos los usuarios de la empresa

**Configurar:**
1. Sección "Banner de Inicio"
2. Botón **"Subir Nueva Imagen"**
3. Seleccionar imagen:
   - Formato: JPG, PNG
   - Resolución recomendada: 1920x600 px
   - Tamaño máximo: 5 MB

4. Vista previa de la imagen
5. Botón **"Guardar Banner"**

**3. Información de Contacto:**

- Email de soporte
- Teléfono de contacto
- Dirección física de la empresa

**4. Términos y Condiciones:**

- Texto de términos que los usuarios deben aceptar
- Editable con editor de texto enriquecido

#### **Guardar Configuración:**

- Los cambios se guardan inmediatamente
- Aparece mensaje de confirmación
- Los cambios aplican para todos los usuarios de la empresa

**Nota:** Para Rol 3 (Functional Admin), solo pueden modificar configuraciones de su propia empresa. Para Rol 1 (Admin), pueden configurar globalmente el sistema.

### 10.5 Estadísticas y Reportes Globales (Solo Rol 1)

Los administradores pueden acceder a reportes avanzados:

#### **Dashboard Administrativo:**

**Menú: 📊 Reportes > Dashboard Admin**

Muestra métricas globales:

1. **Usuarios:**
   - Total de usuarios registrados
   - Usuarios activos (han iniciado sesión en últimos 30 días)
   - Usuarios inactivos
   - Nuevos registros por período

2. **Órdenes:**
   - Total de órdenes en el sistema
   - Órdenes por estado
   - Tasa de conversión (órdenes creadas vs facturadas)
   - Órdenes canceladas (con motivos)

3. **Facturación:**
   - Total facturado en el período
   - Comparativa mes actual vs mes anterior
   - Top 10 clientes por facturación
   - Promedio de factura

4. **Productos:**
   - Productos más vendidos (global)
   - Productos con baja rotación
   - Productos agotados
   - Productos nuevos

5. **Sincronización SAP:**
   - Última sincronización exitosa
   - Errores pendientes
   - Clientes pendientes de sincronización
   - Órdenes en cola

#### **Generar Reportes Personalizados:**

1. **Menú: Reportes > Nuevo Reporte**
2. Seleccionar tipo de reporte:
   - Ventas por cliente
   - Ventas por producto
   - Ventas por sucursal
   - Órdenes por período
   - Facturación detallada

3. Configurar parámetros:
   - Rango de fechas
   - Filtros (cliente, producto, sucursal)
   - Agrupación (por día, semana, mes)

4. Generar reporte

5. Opciones de exportación:
   - Ver en pantalla
   - Exportar a Excel
   - Exportar a PDF
   - Exportar a CSV

#### **Reportes Programados:**

Configura reportes automáticos que se envían por email:

1. **Menú: Reportes > Programar Reporte**
2. Seleccionar tipo de reporte
3. Configurar frecuencia:
   - Diario
   - Semanal (día específico)
   - Mensual (día específico)

4. Destinatarios (emails)
5. Activar programación

**Ejemplo:**
- Reporte de facturación mensual
- Se envía el día 1 de cada mes
- A: gerencia@artesa.com, contabilidad@artesa.com

### 10.6 Auditoría y Logs (Solo Rol 1)

#### **Ver Logs del Sistema:**

1. **Menú: Sistema > Auditoría**
2. Ver registro de eventos importantes

**Eventos Auditados:**
- Inicios de sesión exitosos y fallidos
- Creación y modificación de usuarios
- Creación y cancelación de órdenes
- Cambios en perfiles de cliente
- Sincronizaciones con SAP
- Cambios de configuración
- Errores críticos del sistema

**Información de cada evento:**
- Fecha y hora exacta
- Usuario que realizó la acción
- Tipo de evento
- Detalles del evento
- IP de origen
- Resultado (éxito o error)

#### **Filtros de Auditoría:**

- Por tipo de evento
- Por usuario
- Por rango de fechas
- Por resultado (éxitos o errores)

#### **Exportar Logs:**

- Exporta registros de auditoría para análisis externo
- Formatos: CSV, Excel
- Útil para auditorías contables o de seguridad

#### **Anomalías Detectadas:**

El sistema detecta automáticamente:
- Múltiples intentos fallidos de login
- Accesos desde ubicaciones inusuales
- Cambios masivos en corto tiempo
- Errores repetidos en sincronización SAP

**Ver Anomalías:**
1. **Menú: Sistema > Anomalías**
2. Lista de eventos sospechosos o inusuales
3. Cada anomalía muestra:
   - Descripción
   - Severidad (baja, media, alta)
   - Usuario involucrado
   - Acciones sugeridas

---

## 11. SINCRONIZACIÓN CON SAP

### 11.1 Introducción a la Sincronización

LA ARTESA está integrada con SAP Business One para garantizar que los datos estén siempre actualizados. La sincronización es bidireccional en ciertos casos.

#### **Datos que se Sincronizan:**

**Desde SAP hacia LA ARTESA:**
- Catálogo de productos (diariamente)
- Precios y listas de precios (diariamente)
- Información de clientes (diariamente)
- Estados de órdenes (3 veces al día)
- Entregas y facturas (3 veces al día)

**Desde LA ARTESA hacia SAP:**
- Nuevas órdenes (2 días antes de fecha de entrega)
- Actualización de perfiles de cliente (bajo demanda)

### 11.2 Sincronización Automática Programada

El sistema ejecuta varias tareas de sincronización automáticamente:

#### **Sincronización de Productos:**

**Horario Principal:** 00:00 (medianoche) - Sincronización completa
**Horario Grupo Prioritario (127):** Cada 6 horas (00:00, 06:00, 12:00, 18:00)

**Proceso:**
1. Se conecta al Service Layer de SAP
2. Obtiene lista de productos activos
3. Para cada producto:
   - Si es nuevo: lo crea en LA ARTESA
   - Si existe: actualiza precio, stock, descripción
   - Si tiene nueva imagen: la descarga

4. Actualiza códigos de impuestos
5. Sincroniza listas de precios especiales
6. Registra resultado en logs

**Productos Priorizados:**
- Grupo 127 tiene sincronización cada 6 horas
- Asegura que productos clave estén siempre actualizados

#### **Sincronización de Clientes:**

**Horario:** 03:00 AM (diariamente)

**Proceso Completo:**
1. **Actualizar Clientes Existentes:**
   - Busca clientes con CardCode en LA ARTESA
   - Actualiza datos desde SAP:
     - Razón social
     - NIT
     - Dirección
     - Teléfonos
     - Email
     - Lista de precios asignada

2. **Buscar Nuevos Clientes CI:**
   - Busca en SAP clientes cuyo CardCode inicie con "CI"
   - Verifica si ya existen en LA ARTESA
   - Si no existen:
     - Crea usuario automáticamente
     - Crea perfil de cliente
     - Genera token de recuperación
     - Envía email de activación

3. **Sincronizar Sucursales (Clientes Institucionales):**
   - Obtiene direcciones de entrega desde SAP (tabla CRD1)
   - Crea o actualiza sucursales
   - Verifica emails de encargados
   - Genera tokens de acceso

**Estadísticas de Sincronización:**
- Total de clientes actualizados
- Nuevos usuarios creados
- Sucursales sincronizadas
- Errores (si los hay)

#### **Sincronización de Órdenes a SAP:**

**Horario:** 18:30 (diariamente)

**Proceso:**
1. **Selección de Órdenes:**
   - Busca órdenes en estado "Aprobada" (Estado 2)
   - Que tengan fecha de entrega en 2 días
   - Que no hayan sido sincronizadas antes
   - Que el cliente tenga CardCode SAP válido

2. **Envío a SAP:**
   - Para cada orden seleccionada:
     - Construye documento Order en formato SAP
     - Incluye todos los productos con cantidades
     - Aplica precios y descuentos
     - Establece dirección de entrega (sucursal)
     - Configura fecha de entrega

3. **Respuesta de SAP:**
   - Si es exitoso:
     - Obtiene DocEntry (número de orden en SAP)
     - Actualiza estado a "En Producción" (Estado 3)
     - Marca como sincronizada
     - Envía notificación al cliente

   - Si falla:
     - Registra error en la orden
     - Incrementa contador de intentos
     - Reintentará en siguiente ciclo (máximo 3 intentos)

#### **Actualización de Estados desde SAP:**

**Horario:** 08:00, 12:00, 16:00 (tres veces al día)

**Proceso:**
1. **Verificar Entregas:**
   - Consulta entregas generadas en SAP
   - Busca DocEntry de órdenes de LA ARTESA
   - Actualiza estado a "Entregada" (Estado 4)
   - Registra número de entrega (DeliveryNum)

2. **Verificar Facturas:**
   - Consulta facturas emitidas en SAP
   - Vincula facturas con órdenes
   - Actualiza estado a "Facturada" (Estado 5)
   - Importa detalles completos de la factura
   - Envía notificación al cliente

3. **Entregas Parciales:**
   - Detecta si solo se entregó parte de la orden
   - Marca como "Entrega Parcial"
   - Registra cantidades entregadas vs solicitadas

### 11.3 Sincronización Manual (Solo Administradores)

Los administradores pueden forzar sincronizaciones fuera del horario programado:

#### **Sincronizar Productos:**

1. **Menú: Sincronización SAP > Productos**
2. Opciones:

   **Sincronización Completa:**
   - Sincroniza todos los productos del catálogo SAP
   - Puede tomar varios minutos
   - Recomendado cuando hay cambios masivos en SAP

   **Sincronización por Grupo:**
   - Seleccionar código de grupo específico
   - Ejemplo: Grupo 127, Grupo 103
   - Más rápido que sincronización completa

   **Sincronización Incremental:**
   - Solo productos modificados recientemente en SAP
   - Más rápida

3. Hacer clic en **"Iniciar Sincronización"**
4. Monitorear progreso en tiempo real:
   - Barra de progreso
   - Productos procesados / Total
   - Errores encontrados

5. Ver resumen al finalizar:
   - Productos nuevos: X
   - Productos actualizados: Y
   - Errores: Z
   - Tiempo transcurrido

#### **Sincronizar Clientes:**

1. **Menú: Sincronización SAP > Clientes**
2. Opciones:

   **Sincronización General:**
   - Actualiza todos los clientes con CardCode

   **Sincronización de Clientes Institucionales:**
   - Solo clientes del Grupo 103
   - Incluye sincronización de sucursales

   **Sincronización Masiva de Clientes CI:**
   - **Importante:** Solo usar una vez al inicio del proyecto
   - Importa masivamente todos los clientes CI de SAP
   - Crea usuarios para cada uno
   - Genera tokens de activación

3. Hacer clic en **"Sincronizar"**
4. Ver progreso y resultados

#### **Sincronizar Órdenes:**

1. **Menú: Sincronización SAP > Órdenes**
2. Ver lista de órdenes pendientes de sincronización
3. Opciones:

   **Sincronizar Todas:**
   - Intenta sincronizar todas las órdenes pendientes

   **Sincronizar Seleccionadas:**
   - Seleccionar órdenes específicas con checkboxes
   - Útil para resolver errores individuales

4. Ver resultados:
   - Órdenes sincronizadas exitosamente
   - Órdenes con error (descripción del error)

#### **Actualizar Estados desde SAP:**

1. **Menú: Sincronización SAP > Actualizar Estados**
2. Forzar verificación de:
   - Entregas nuevas
   - Facturas emitidas
   - Estados de órdenes en SAP

3. Ver resumen de actualizaciones

#### **Validar Sucursales:**

1. **Menú: Sincronización SAP > Validar Sucursales**
2. Compara sucursales entre SAP y LA ARTESA
3. Muestra:
   - Sucursales faltantes (están en SAP, no en LA ARTESA)
   - Sucursales extra (están en LA ARTESA, no en SAP)
   - Discrepancias en información

4. Opción de **"Sincronizar Sucursales"** para corregir

### 11.4 Monitor de Sincronización

#### **Ver Estado de Sincronización:**

1. **Menú: Sincronización SAP > Estado**
2. Dashboard mostrando:

   **Última Sincronización:**
   - Productos: Fecha y hora, resultado
   - Clientes: Fecha y hora, resultado
   - Órdenes: Fecha y hora, resultado
   - Estados: Fecha y hora, resultado

   **Próxima Sincronización Programada:**
   - Countdown hasta la siguiente sincronización

   **Estadísticas:**
   - Total de sincronizaciones hoy
   - Sincronizaciones exitosas
   - Errores en las últimas 24 horas

   **Errores Pendientes:**
   - Lista de órdenes con errores de sincronización
   - Descripción del error
   - Acciones sugeridas

#### **Resolver Errores de Sincronización:**

Errores comunes y soluciones:

**Error: "Cliente no encontrado en SAP"**
- **Causa:** El CardCode no existe en SAP
- **Solución:** 
  1. Verificar CardCode en perfil del cliente
  2. Corregir si es incorrecto
  3. O crear cliente manualmente en SAP

**Error: "Producto no disponible"**
- **Causa:** Producto desactivado en SAP o sin stock
- **Solución:**
  1. Activar producto en SAP
  2. O quitar producto de la orden

**Error: "Lista de precios inválida"**
- **Causa:** Cliente no tiene lista de precios asignada en SAP
- **Solución:**
  1. Asignar lista de precios en SAP
  2. Re-sincronizar cliente

**Error: "Fecha de entrega no válida"**
- **Causa:** Fecha en el pasado o muy lejana
- **Solución:**
  1. Editar la orden (si está en estado Pendiente)
  2. Ajustar fecha de entrega

**Error: "Sesión SAP expirada"**
- **Causa:** Problema de conexión con SAP
- **Solución:**
  1. El sistema reintenta automáticamente
  2. Si persiste, contactar soporte técnico

### 11.5 Logs de Sincronización

#### **Ver Logs Detallados:**

1. **Menú: Sincronización SAP > Logs**
2. Registro de todos los eventos de sincronización

**Información en Logs:**
- Fecha y hora exacta
- Tipo de sincronización (productos, clientes, órdenes)
- Resultado (éxito, error, advertencia)
- Detalles específicos
- Tiempo de ejecución
- Usuario que inició (si fue manual)

#### **Filtrar Logs:**

- Por tipo de sincronización
- Por resultado (solo errores, solo éxitos)
- Por rango de fechas
- Búsqueda por término específico

#### **Exportar Logs:**

- Descargar logs en formato CSV o Excel
- Útil para análisis o soporte técnico

---

## 12. PREGUNTAS FRECUENTES

### 12.1 Sobre Registro y Acceso

**¿Puedo crear una cuenta sin tener un NIT?**
Sí, puedes registrarte inicialmente, pero no podrás crear órdenes hasta completar tu perfil con NIT válido.

**¿Qué hago si mi contraseña no cumple los requisitos?**
Asegúrate de incluir: mínimo 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial.

**¿Cuánto tiempo dura el token de recuperación de contraseña?**
El token es válido por 1 hora desde su generación.

**¿Puedo usar mi cuenta en múltiples dispositivos?**
Sí, pero solo puedes tener una sesión activa por vez. Al iniciar en un nuevo dispositivo, se cierra la sesión anterior.

### 12.2 Sobre Perfiles y Sincronización

**¿Cuánto tiempo tarda en sincronizarse mi perfil con SAP?**
La sincronización automática ocurre a las 3:00 AM. Si es urgente, puedes solicitar sincronización manual al administrador.

**¿Qué significa "Pendiente de Sincronización"?**
Tu perfil está completo y esperando la próxima sincronización automática para obtener un CardCode SAP y poder crear órdenes.

**¿Puedo crear órdenes mientras mi perfil está "Pendiente de Sincronización"?**
No, debes esperar a que tu perfil se sincronice y obtenga un CardCode SAP.

**¿Qué documentos debo cargar obligatoriamente?**
Fotocopia de cédula del representante legal y RUT actualizado (no mayor a 6 meses).

**¿En qué formato deben estar los documentos?**
PDF, JPG o PNG, máximo 5 MB cada uno.

### 12.3 Sobre Sucursales

**¿Cómo obtengo un token de sucursal?**
El administrador de tu empresa o el administrador del sistema puede generar y enviarte el token por email.

**¿Cuánto dura el token de una sucursal?**
90 días desde su generación. Puedes solicitar renovación antes del vencimiento.

**¿Una sucursal puede ver órdenes de otras sucursales?**
No, cada sucursal solo ve sus propias órdenes.

**¿Puedo tener múltiples sucursales con el mismo email?**
No, cada sucursal debe tener un email único para el encargado.

**¿Qué pasa si cambio el email del encargado de una sucursal?**
Se requiere una nueva verificación del email. El acceso se suspende hasta que se verifique el nuevo email.

### 12.4 Sobre Productos

**¿Puedo ver productos que están agotados?**
Sí, los productos agotados se muestran pero no puedes agregarlos a una orden.

**¿Los precios incluyen IVA?**
Los precios mostrados NO incluyen IVA. El impuesto se calcula al crear la orden.

**¿Por qué no veo todos los productos de SAP?**
Solo se sincronizan productos activos. Si falta alguno, contacta al administrador.

**¿Los productos tienen imágenes?**
La mayoría sí. Si un producto no tiene imagen, se muestra un placeholder genérico.

### 12.5 Sobre Órdenes

**¿Cuál es la anticipación mínima para crear una orden?**
Mínimo 2 días de anticipación. Si creas una orden después de la hora límite (ej: 18:00), se añade un día más.

**¿Puedo editar una orden después de crearla?**
Solo si está en estado "Pendiente". Una vez que pasa a "Aprobada" o "En Producción", ya no se puede editar.

**¿Puedo cancelar una orden?**
Sí, si está en estado "Pendiente" o "Aprobada". No puedes cancelar órdenes en "En Producción" o posteriores.

**¿Qué pasa si cancelo una orden?**
La orden cambia a estado "Cancelada" y queda en tu historial. No afecta tus órdenes futuras.

**¿Cuándo se sincroniza mi orden con SAP?**
2 días antes de la fecha de entrega, a las 18:30.

**¿Recibiré confirmación de mi orden?**
Sí, recibirás confirmación por email en cada cambio de estado: creada, aprobada, en producción, entregada, facturada.

**¿Puedo duplicar una orden anterior?**
Sí, abre la orden y usa el botón "Duplicar". Podrás ajustar fecha y productos antes de confirmar.

**¿Hay un monto mínimo de orden?**
Depende de la configuración de tu empresa. Consulta con el administrador o soporte.

### 12.6 Sobre Facturas

**¿Cuándo se genera la factura de mi orden?**
La factura se genera en SAP después de la entrega. Se sincroniza automáticamente 3 veces al día.

**¿Puedo descargar la factura en PDF?**
Sí, desde el módulo de Facturas, haz clic en "Descargar PDF".

**¿La factura que descargo es válida fiscalmente?**
Sí, es la factura electrónica oficial generada por SAP y con validez ante la DIAN.

**¿Puedo solicitar una nota crédito?**
Debes contactar al área de servicio al cliente. Las notas crédito se gestionan en SAP y luego se sincronizan.

**¿Cómo sé qué orden corresponde a cada factura?**
En los detalles de la factura verás el Order ID. También en la orden verás el número de factura.

### 12.7 Sobre Sincronización

**¿Qué significa "sincronización automática"?**
Es el proceso mediante el cual el sistema actualiza datos entre LA ARTESA y SAP sin intervención manual.

**¿Puedo forzar una sincronización?**
Los usuarios normales no pueden. Solo los administradores pueden forzar sincronizaciones manuales.

**¿Qué hago si mi orden falló al sincronizar con SAP?**
Contacta al administrador. Ellos verán el error específico y podrán resolverlo o reintentar la sincronización.

**¿Cada cuánto se sincronizan los precios?**
Diariamente a medianoche. Los productos del Grupo 127 se sincronizan cada 6 horas.

### 12.8 Problemas Técnicos

**No puedo iniciar sesión, ¿qué hago?**
1. Verifica que tu email y contraseña sean correctos
2. Usa la opción "Recuperar Contraseña"
3. Si el problema persiste, contacta soporte

**La página se carga muy lento, ¿es normal?**
No, si experimentas lentitud:
1. Verifica tu conexión a internet
2. Prueba en otro navegador
3. Limpia caché y cookies
4. Si persiste, reporta a soporte

**No veo mis órdenes, ¿dónde están?**
1. Asegúrate de estar en la sección correcta (Órdenes > Mis Órdenes)
2. Verifica los filtros aplicados (puede que estés filtrando por estado)
3. Si eres sucursal, solo verás órdenes de tu sucursal

**No puedo subir un documento, ¿por qué?**
Verifica:
1. El archivo sea menor a 5 MB
2. El formato sea PDF, JPG o PNG
3. El archivo no esté corrupto
4. Tu conexión a internet sea estable

**¿Por qué no aparece mi perfil como sincronizado?**
1. La sincronización automática es a las 3:00 AM
2. Puede haber un error en los datos de tu perfil
3. Contacta al administrador para sincronización manual

---

## 13. SOPORTE Y CONTACTO

### 13.1 Canales de Soporte

#### **Soporte Técnico:**
- **Email:** soporte.tecnico@artesa.com
- **Teléfono:** +57 (1) 234-5678
- **Horario:** Lunes a Viernes, 8:00 AM - 6:00 PM
- **Tiempo de Respuesta:** Máximo 24 horas hábiles

#### **Soporte Comercial:**
- **Email:** comercial@artesa.com
- **Teléfono:** +57 (1) 234-5679
- **Horario:** Lunes a Viernes, 8:00 AM - 5:00 PM

#### **Soporte para Emergencias:**
- **WhatsApp:** +57 300 123 4567
- **Disponible:** 24/7 solo para casos críticos

### 13.2 ¿Qué Incluir al Contactar Soporte?

Para recibir ayuda más rápida, incluye:

1. **Información del Usuario:**
   - Tu nombre completo
   - Email registrado
   - Empresa

2. **Descripción del Problema:**
   - Qué estabas intentando hacer
   - Qué esperabas que pasara
   - Qué pasó realmente
   - Mensaje de error (si hay)

3. **Capturas de Pantalla:**
   - Si es posible, adjunta capturas del problema

4. **Información del Navegador:**
   - Navegador y versión (Chrome 115, Firefox 118, etc.)
   - Sistema operativo (Windows 11, macOS, etc.)

5. **Datos Relevantes:**
   - Order ID (si es problema con una orden)
   - Número de factura (si es problema con factura)
   - Fecha y hora del incidente

### 13.3 Tutoriales y Recursos

#### **Videos Tutoriales:**

Accede a nuestra biblioteca de videos:
- **URL:** https://artesa.com/tutoriales
- **Temas cubiertos:**
  - Cómo registrarse
  - Cómo completar tu perfil
  - Cómo crear tu primera orden
  - Cómo gestionar sucursales
  - Cómo consultar facturas

#### **Documentación Adicional:**

- **Manual de Administrador:** Para usuarios con Rol 1
- **Guía de Sincronización SAP:** Detalles técnicos de integración
- **Catálogo de Productos PDF:** Lista completa descargable

#### **Centro de Ayuda:**

- **URL:** https://ayuda.artesa.com
- Base de conocimiento con artículos detallados
- Búsqueda por tema
- Actualizaciones frecuentes

### 13.4 Reportar un Bug o Problema

Si encuentras un error en el sistema:

1. **Formulario de Reporte:**
   - **Menú:** Ayuda > Reportar Problema
   - Completa los campos del formulario

2. **Información a Incluir:**
   - Descripción detallada del bug
   - Pasos para reproducirlo
   - Capturas o grabación de pantalla
   - Frecuencia (¿siempre pasa o es aleatorio?)

3. **Prioridad:**
   - Crítico: El sistema no funciona
   - Alta: Una funcionalidad clave no funciona
   - Media: Una funcionalidad secundaria no funciona
   - Baja: Problema cosmético o menor

4. **Seguimiento:**
   - Recibirás un número de ticket
   - Te notificaremos cuando el bug sea resuelto

### 13.5 Sugerencias y Mejoras

¿Tienes ideas para mejorar la aplicación?

1. **Formulario de Sugerencias:**
   - **Menú:** Ayuda > Enviar Sugerencia

2. **Describe tu Idea:**
   - Qué funcionalidad nueva propondrías
   - Qué problema resolvería
   - Cómo te ayudaría en tu trabajo

3. **Evaluación:**
   - El equipo de desarrollo evalúa todas las sugerencias
   - Las más votadas/útiles se priorizan

### 13.6 Actualizaciones del Sistema

#### **Notificaciones de Actualización:**

Recibirás notificaciones cuando:
- Se lancen nuevas funcionalidades
- Se realicen mejoras importantes
- Haya cambios en el sistema que afecten tu uso

#### **Historial de Cambios:**

- **Menú:** Ayuda > Novedades
- Ver todas las actualizaciones recientes
- Descripción de nuevas funcionalidades
- Tutoriales sobre cómo usarlas

#### **Mantenimientos Programados:**

- Se notifican con al menos 48 horas de anticipación
- Se realizan en horarios de baja actividad (madrugadas)
- Duración típica: 1-2 horas
- Durante mantenimiento, el sistema puede no estar disponible

---

## GLOSARIO DE TÉRMINOS

**CardCode:** Código único de cliente en SAP Business One

**Client Profile:** Perfil de cliente con información fiscal y comercial

**DocEntry:** Número único de documento en SAP (orden, entrega, factura)

**InvoiceNum:** Número de factura visible para el cliente

**ItemCode:** Código de producto en SAP

**Order ID:** Identificador único de orden en LA ARTESA

**SAP B1 / SAP Business One:** Sistema ERP de gestión empresarial

**Service Layer:** API de SAP Business One para integraciones

**Ship-To Code:** Código de dirección de entrega en SAP

**Sincronización:** Proceso de actualizar datos entre LA ARTESA y SAP

**TaxCode:** Código de impuesto en SAP

**Token:** Código de acceso único para autenticación

**Sucursal / Branch:** Ubicación física de entrega de un cliente

**Lista de Precios:** Condiciones especiales de precio para un cliente

---

## APÉNDICE: CÓDIGOS Y REFERENCIAS

### Estados de Órdenes

| ID | Nombre | Descripción |
|----|--------|-------------|
| 1 | Pendiente | Orden recién creada |
| 2 | Aprobada | Aprobada para procesamiento |
| 3 | En Producción | Sincronizada con SAP |
| 4 | Entregada | Productos entregados al cliente |
| 5 | Facturada | Factura electrónica generada |
| 6 | Cancelada | Orden cancelada |

### Roles de Usuario

| ID | Nombre | Acceso |
|----|--------|--------|
| 1 | ADMIN | Acceso completo al sistema |
| 2 | USER | Usuario/Cliente estándar |
| 3 | FUNCTIONAL_ADMIN | Cliente con permisos extendidos |

### Grupos de Productos SAP

| Código | Nombre | Sincronización |
|--------|--------|----------------|
| 127 | Productos Prioritarios | Cada 6 horas |
| 103 | Clientes Institucionales | Diaria |
| Otros | Productos Generales | Diaria |

---

**FIN DEL MANUAL FUNCIONAL**

**Versión del Documento:** 1.0  
**Última Actualización:** Octubre 2025  
**Preparado por:** Equipo de Desarrollo LA ARTESA  

Para más información, visita: **https://artesa.com**  
Soporte: **soporte@artesa.com**  
Tel: **+57 (1) 234-5678**

---

© 2025 LA ARTESA. Todos los derechos reservados.
