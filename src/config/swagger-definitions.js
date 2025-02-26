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
 *     Product:
 *       type: object
 *       properties:
 *         product_id:
 *           type: integer
 *           example: 1
 *         name:
 *           type: string
 *           example: Producto Ejemplo
 *         description:
 *           type: string
 *           example: Descripción detallada del producto
 *         price_list1:
 *           type: number
 *           format: float
 *           example: 100.00
 *         price_list2:
 *           type: number
 *           format: float
 *           example: 90.00
 *         price_list3:
 *           type: number
 *           format: float
 *           example: 80.00
 *         stock:
 *           type: integer
 *           example: 50
 *         barcode:
 *           type: string
 *           example: 7501234567890
 *         image_url:
 *           type: string
 *           example: https://example.com/images/product.jpg
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
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
 */