/**
 * @swagger
 * components:
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: Ingrese el token JWT en el formato - Bearer <token>
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único del usuario
 *           example: 1
 *         name:
 *           type: string
 *           description: Nombre del usuario
 *           example: John Doe
 *         mail:
 *           type: string
 *           format: email
 *           description: Correo electrónico del usuario
 *           example: john@example.com
 *         rol_id:
 *           type: integer
 *           description: ID del rol del usuario
 *           example: 2
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación del usuario
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de última actualización
 *         is_active:
 *           type: boolean
 *           description: Indica si el usuario está activo
 *           example: true
 *     
 *     LoginRequest:
 *       type: object
 *       required:
 *         - mail
 *         - password
 *       properties:
 *         mail:
 *           type: string
 *           format: email
 *           description: Correo electrónico del usuario
 *           example: usuario@example.com
 *         password:
 *           type: string
 *           format: password
 *           description: Contraseña del usuario
 *           example: contraseña123
 *     
 *     LoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Login exitoso
 *         data:
 *           type: object
 *           properties:
 *             token:
 *               type: string
 *               example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *             user:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                 name:
 *                   type: string
 *                   example: John Doe
 *                 mail:
 *                   type: string
 *                   example: john@example.com
 *                 role:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 2
 *                     name:
 *                       type: string
 *                       example: USER
 *     
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - name
 *         - mail
 *         - password
 *       properties:
 *         name:
 *           type: string
 *           description: Nombre completo del usuario
 *           example: John Doe
 *         mail:
 *           type: string
 *           format: email
 *           description: Correo electrónico del usuario
 *           example: john@example.com
 *         password:
 *           type: string
 *           format: password
 *           description: Contraseña del usuario
 *           example: Contraseña123
 *     
 *     UserDetails:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Identificador único del usuario
 *           example: 1
 *         username:
 *           type: string
 *           description: Nombre completo del usuario
 *           example: John Doe
 *         email:
 *           type: string
 *           format: email
 *           description: Correo electrónico del usuario
 *           example: john@example.com
 *         role:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *               description: ID del rol
 *               example: 2
 *             name:
 *               type: string
 *               description: Nombre del rol
 *               example: USER
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Fecha y hora de creación del usuario
 *         isActive:
 *           type: boolean
 *           description: Indica si el usuario está activo
 *           example: true
 *
 *     Product:
 *       type: object
 *       properties:
 *         product_id:
 *           type: integer
 *           description: Identificador único del producto
 *           example: 1
 *         name:
 *           type: string
 *           description: Nombre del producto
 *           example: Pantalón casual
 *         description:
 *           type: string
 *           description: Descripción detallada del producto
 *           example: Pantalón de algodón de alta calidad
 *         price_list1:
 *           type: number
 *           format: float
 *           description: Precio en la lista 1 (precio normal)
 *           example: 59.99
 *         price_list2:
 *           type: number
 *           format: float
 *           description: Precio en la lista 2 (precio mayorista)
 *           example: 49.99
 *         price_list3:
 *           type: number
 *           format: float
 *           description: Precio en la lista 3 (precio especial)
 *           example: 39.99
 *         stock:
 *           type: integer
 *           description: Cantidad disponible en inventario
 *           example: 100
 *         barcode:
 *           type: string
 *           description: Código de barras único del producto
 *           example: 7501234567890
 *         image_url:
 *           type: string
 *           description: URL de la imagen del producto
 *           example: https://example.com/images/product.jpg
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Fecha y hora de creación
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Fecha y hora de última actualización
 *
 *     Order:
 *       type: object
 *       properties:
 *         order_id:
 *           type: integer
 *           example: 1
 *         user_id:
 *           type: integer
 *           example: 1
 *         order_date:
 *           type: string
 *           format: date-time
 *         total_amount:
 *           type: number
 *           format: float
 *           example: 150.00
 *     
 *     OrderDetail:
 *       type: object
 *       properties:
 *         order_detail_id:
 *           type: integer
 *           example: 1
 *         order_id:
 *           type: integer
 *           example: 1
 *         product_id:
 *           type: integer
 *           example: 2
 *         quantity:
 *           type: integer
 *           example: 3
 *         unit_price:
 *           type: number
 *           format: float
 *           example: 50.00
 * 
 *   responses:
 *     UnauthorizedError:
 *       description: Token de acceso no proporcionado o inválido
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: error
 *               message:
 *                 type: string
 *                 example: Token inválido o expirado
 *
 *     ForbiddenError:
 *       description: No tiene permisos suficientes para esta acción
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: error
 *               message:
 *                 type: string
 *                 example: No tiene permisos para realizar esta acción
 */