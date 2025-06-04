// src/controllers/uploadController.js
const path = require('path');
const fs = require('fs');
const { createContextLogger } = require('../config/logger');
const S3Service = require('../services/S3Service');

// Crear una instancia del logger con contexto
const logger = createContextLogger('UploadController');

/**
 * @swagger
 * components:
 *   schemas:
 *     UploadResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: Imagen subida exitosamente
 *         data:
 *           type: object
 *           properties:
 *             fileName:
 *               type: string
 *               example: 1623459874123.jpg
 *             relativePath:
 *               type: string
 *               example: /uploads/1623459874123.jpg
 *             imageUrl:
 *               type: string
 *               example: http://localhost:3000/uploads/1623459874123.jpg
 */

class UploadController {
  /**
   * @swagger
   * /api/upload:
   *   post:
   *     summary: Subir una imagen
   *     description: Sube una imagen al servidor y devuelve la URL para acceder a ella
   *     tags: [Uploads]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required:
   *               - image
   *             properties:
   *               image:
   *                 type: string
   *                 format: binary
   *                 description: Archivo de imagen a subir (JPG, PNG, GIF)
   *     responses:
   *       200:
   *         description: Imagen subida exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/UploadResponse'
   *       400:
   *         description: No se ha subido ningún archivo o el formato no es válido
   *       401:
   *         description: No autorizado - Token no proporcionado o inválido
   *       500:
   *         description: Error interno del servidor
   */
  uploadImage = async (req, res) => {
    try {
      if (!req.file && (!req.files || !req.files.image)) {
        logger.warn('Intento de carga sin archivo', { userId: req.user?.id });
        return res.status(400).json({
          success: false,
          message: 'No se ha subido ningún archivo'
        });
      }
  
      // Determinar el archivo (soporta multer y express-fileupload)
      let file;
      let fileName;
      
      if (req.file) {
        // Multer
        file = {
          data: fs.readFileSync(req.file.path),
          mimetype: req.file.mimetype,
          name: req.file.originalname
        };
        fileName = req.file.filename;
      } else {
        // Express-fileupload
        file = req.files.image;
        fileName = file.name;
      }
  
      // Generar una clave única para S3
      const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      const key = `general/${uniquePrefix}-${path.basename(fileName)}`;
      
      // Subir a S3
      const fileUrl = req.file 
        ? await S3Service.uploadFile(file.data, key, file.mimetype, { public: true })
        : await S3Service.uploadFormFile(file, key, { public: true });
  
      // Registrar información sobre el archivo subido
      logger.info('Archivo subido exitosamente', {
        userId: req.user?.id,
        fileName,
        key,
        size: req.file ? req.file.size : file.size,
        mimetype: req.file ? req.file.mimetype : file.mimetype
      });
  
      // Limpiar archivo temporal si se usó multer
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
  
      res.status(200).json({
        success: true,
        message: 'Imagen subida exitosamente',
        data: {
          fileName,
          key,
          imageUrl: fileUrl
        }
      });
    } catch (error) {
      logger.error('Error al subir imagen', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al procesar la imagen',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * @swagger
   * /api/upload/{fileName}:
   *   delete:
   *     summary: Eliminar una imagen
   *     description: Elimina una imagen previamente subida al servidor
   *     tags: [Uploads]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: fileName
   *         required: true
   *         schema:
   *           type: string
   *         description: Nombre del archivo a eliminar
   *     responses:
   *       200:
   *         description: Imagen eliminada exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: Imagen eliminada exitosamente
   *       400:
   *         description: Nombre de archivo no proporcionado
   *       401:
   *         description: No autorizado - Token no proporcionado o inválido
   *       403:
   *         description: Prohibido - Sin permisos para eliminar archivos
   *       404:
   *         description: Archivo no encontrado
   *       500:
   *         description: Error interno del servidor
   */
  deleteImage = async (req, res) => {
    try {
      const { fileName } = req.params;
      const { key } = req.query;
      
      if (!fileName && !key) {
        return res.status(400).json({
          success: false,
          message: 'Se requiere el nombre del archivo o la clave'
        });
      }
  
      let fileKey = key;
      
      // Si no se proporcionó la clave pero sí el nombre, intentar construir la clave
      if (!fileKey && fileName) {
        fileKey = `general/${fileName}`;
      }
      
      // Eliminar el archivo
      const deleted = await S3Service.deleteFile(fileKey);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Archivo no encontrado'
        });
      }
      
      logger.info('Archivo eliminado exitosamente', {
        userId: req.user?.id,
        fileKey
      });
  
      res.status(200).json({
        success: true,
        message: 'Imagen eliminada exitosamente'
      });
    } catch (error) {
      logger.error('Error al eliminar imagen', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al eliminar la imagen',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  /**
   * @swagger
   * /api/upload/test-s3:
   *   post:
   *     summary: Probar conexión y configuración de S3
   *     description: Realiza una prueba completa de S3 creando, leyendo y eliminando un archivo de prueba
   *     tags: [Uploads]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Prueba de S3 exitosa
   *       500:
   *         description: Error en la configuración de S3
   */
  testS3Configuration = async (req, res) => {
    try {
      logger.info('Iniciando prueba de configuración S3', {
        userId: req.user?.id,
        bucket: process.env.AWS_S3_BUCKET_NAME,
        region: process.env.AWS_REGION
      });

      // Verificar variables de entorno
      const requiredEnvVars = [
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY', 
        'AWS_REGION',
        'AWS_S3_BUCKET_NAME'
      ];

      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      if (missingVars.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Variables de entorno faltantes para S3',
          missingVariables: missingVars
        });
      }

      // Verificar modo de almacenamiento
      if (process.env.STORAGE_MODE !== 's3') {
        return res.status(400).json({
          success: false,
          message: 'STORAGE_MODE no está configurado como "s3"',
          currentMode: process.env.STORAGE_MODE
        });
      }

      // Crear archivo de prueba
      const testKey = `test/s3-test-${Date.now()}.txt`;
      const testContent = Buffer.from(`Prueba S3 - ${new Date().toISOString()}\nUsuario: ${req.user?.id}\nBucket: ${process.env.AWS_S3_BUCKET_NAME}`);
      
      // 1. Probar subida de archivo
      logger.info('Probando subida de archivo a S3', { testKey });
      const uploadResult = await S3Service.uploadFile(
        testContent, 
        testKey, 
        'text/plain',
        { public: true }
      );

      // 2. Probar verificación de existencia
      logger.info('Probando verificación de existencia', { testKey });
      const exists = await S3Service.fileExists(testKey);

      // 3. Probar generación de URL firmada
      logger.info('Probando generación de URL firmada', { testKey });
      const signedUrl = await S3Service.getSignedUrl('getObject', testKey, 300);

      // 4. Probar eliminación
      logger.info('Probando eliminación de archivo', { testKey });
      const deleteResult = await S3Service.deleteFile(testKey);

      // 5. Verificar que fue eliminado
      const existsAfterDelete = await S3Service.fileExists(testKey);

      const testResults = {
        environmentVariables: {
          bucket: process.env.AWS_S3_BUCKET_NAME,
          region: process.env.AWS_REGION,
          storageMode: process.env.STORAGE_MODE,
          hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
          hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY
        },
        tests: {
          upload: {
            success: !!uploadResult,
            url: uploadResult,
            key: testKey
          },
          fileExists: {
            success: exists,
            existed: exists
          },
          signedUrl: {
            success: !!signedUrl,
            url: signedUrl ? signedUrl.substring(0, 100) + '...' : null
          },
          delete: {
            success: deleteResult,
            deleted: deleteResult
          },
          fileExistsAfterDelete: {
            success: !existsAfterDelete,
            stillExists: existsAfterDelete
          }
        },
        overall: {
          success: !!uploadResult && exists && !!signedUrl && deleteResult && !existsAfterDelete,
          timestamp: new Date().toISOString()
        }
      };

      if (testResults.overall.success) {
        logger.info('Prueba de S3 completada exitosamente', testResults);
        res.status(200).json({
          success: true,
          message: 'Configuración de S3 verificada exitosamente',
          data: testResults
        });
      } else {
        logger.error('Prueba de S3 falló', testResults);
        res.status(500).json({
          success: false,
          message: 'La configuración de S3 tiene problemas',
          data: testResults
        });
      }
    } catch (error) {
      logger.error('Error durante la prueba de S3', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al probar configuración de S3',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        details: {
          errorCode: error.code,
          errorName: error.name,
          bucket: process.env.AWS_S3_BUCKET_NAME,
          region: process.env.AWS_REGION
        }
      });
    }
  };
  /**
   * @swagger
   * /api/upload/verify-iam:
   *   post:
   *     summary: Verificar credenciales IAM para S3
   *     description: Verifica que las credenciales IAM tengan los permisos necesarios para operar con S3
   *     tags: [Upload]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Credenciales IAM verificadas exitosamente
   *       500:
   *         description: Error en las credenciales IAM
   */
  verifyIAMCredentials = async (req, res) => {
    try {
      const AWS = require('aws-sdk');
      
      logger.info('Verificando credenciales IAM para S3', {
        userId: req.user?.id,
        bucket: process.env.AWS_S3_BUCKET_NAME,
        region: process.env.AWS_REGION
      });

      // Configurar AWS SDK con las credenciales del entorno
      AWS.config.update({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION
      });

      const s3 = new AWS.S3();
      const sts = new AWS.STS();
      const iam = new AWS.IAM();

      const verificationResults = {
        credentials: {},
        permissions: {},
        bucket: {},
        errors: []
      };

      try {
        // 1. Verificar identidad actual
        logger.info('Verificando identidad del usuario');
        const identity = await sts.getCallerIdentity().promise();
        verificationResults.credentials = {
          success: true,
          userId: identity.UserId,
          account: identity.Account,
          arn: identity.Arn,
          type: identity.Arn.includes('user') ? 'IAM User' : 'Role/Other'
        };
      } catch (error) {
        verificationResults.credentials = {
          success: false,
          error: error.message
        };
        verificationResults.errors.push(`Credenciales inválidas: ${error.message}`);
      }

      try {
        // 2. Verificar acceso al bucket (ListBucket)
        logger.info('Verificando permisos de ListBucket');
        const listParams = {
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          MaxKeys: 1
        };
        await s3.listObjectsV2(listParams).promise();
        verificationResults.permissions.listBucket = { success: true };
      } catch (error) {
        verificationResults.permissions.listBucket = { 
          success: false, 
          error: error.message 
        };
        verificationResults.errors.push(`ListBucket: ${error.message}`);
      }

      try {
        // 3. Verificar ubicación del bucket
        logger.info('Verificando ubicación del bucket');
        const locationResult = await s3.getBucketLocation({
          Bucket: process.env.AWS_S3_BUCKET_NAME
        }).promise();
        verificationResults.bucket.location = {
          success: true,
          region: locationResult.LocationConstraint || 'us-east-1'
        };
      } catch (error) {
        verificationResults.bucket.location = {
          success: false,
          error: error.message
        };
        verificationResults.errors.push(`Bucket location: ${error.message}`);
      }

      try {
        // 4. Probar PutObject con un archivo temporal
        logger.info('Verificando permisos de PutObject');
        const testKey = `iam-test/test-${Date.now()}.txt`;
        const putParams = {
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: testKey,
          Body: 'IAM Test File',
          ContentType: 'text/plain'
        };
        await s3.putObject(putParams).promise();
        verificationResults.permissions.putObject = { success: true, testKey };

        // 5. Probar GetObject
        logger.info('Verificando permisos de GetObject');
        const getParams = {
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: testKey
        };
        await s3.getObject(getParams).promise();
        verificationResults.permissions.getObject = { success: true };

        // 6. Probar DeleteObject
        logger.info('Verificando permisos de DeleteObject');
        const deleteParams = {
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: testKey
        };
        await s3.deleteObject(deleteParams).promise();
        verificationResults.permissions.deleteObject = { success: true };

      } catch (error) {
        if (!verificationResults.permissions.putObject) {
          verificationResults.permissions.putObject = { success: false, error: error.message };
          verificationResults.errors.push(`PutObject: ${error.message}`);
        } else if (!verificationResults.permissions.getObject) {
          verificationResults.permissions.getObject = { success: false, error: error.message };
          verificationResults.errors.push(`GetObject: ${error.message}`);
        } else {
          verificationResults.permissions.deleteObject = { success: false, error: error.message };
          verificationResults.errors.push(`DeleteObject: ${error.message}`);
        }
      }

      try {
        // 7. Verificar ACL permissions (opcional)
        logger.info('Verificando permisos de ACL');
        const aclParams = {
          Bucket: process.env.AWS_S3_BUCKET_NAME
        };
        await s3.getBucketAcl(aclParams).promise();
        verificationResults.permissions.getBucketAcl = { success: true };
      } catch (error) {
        verificationResults.permissions.getBucketAcl = { 
          success: false, 
          error: error.message 
        };
        // ACL no es crítico, no agregar a errores principales
      }

      // Evaluar resultado general
      const criticalPermissions = ['listBucket', 'putObject', 'getObject', 'deleteObject'];
      const successfulPermissions = criticalPermissions.filter(
        perm => verificationResults.permissions[perm]?.success
      );
      
      const overallSuccess = verificationResults.credentials.success && 
                           successfulPermissions.length === criticalPermissions.length;

      const responseData = {
        overall: {
          success: overallSuccess,
          credentialsValid: verificationResults.credentials.success,
          permissionsValid: successfulPermissions.length === criticalPermissions.length,
          successfulPermissions: successfulPermissions.length,
          totalPermissions: criticalPermissions.length
        },
        details: verificationResults,
        recommendations: []
      };

      // Agregar recomendaciones
      if (!overallSuccess) {
        if (!verificationResults.credentials.success) {
          responseData.recommendations.push('Verificar AWS_ACCESS_KEY_ID y AWS_SECRET_ACCESS_KEY');
        }
        if (!verificationResults.permissions.listBucket?.success) {
          responseData.recommendations.push('Agregar permiso s3:ListBucket al usuario IAM');
        }
        if (!verificationResults.permissions.putObject?.success) {
          responseData.recommendations.push('Agregar permiso s3:PutObject al usuario IAM');
        }
        if (!verificationResults.permissions.getObject?.success) {
          responseData.recommendations.push('Agregar permiso s3:GetObject al usuario IAM');
        }
        if (!verificationResults.permissions.deleteObject?.success) {
          responseData.recommendations.push('Agregar permiso s3:DeleteObject al usuario IAM');
        }
      }

      if (overallSuccess) {
        logger.info('Verificación IAM completada exitosamente', responseData);
        res.status(200).json({
          success: true,
          message: 'Credenciales IAM verificadas exitosamente',
          data: responseData
        });
      } else {
        logger.error('Verificación IAM falló', responseData);
        res.status(400).json({
          success: false,
          message: 'Las credenciales IAM tienen problemas de permisos',
          data: responseData
        });
      }

    } catch (error) {
      logger.error('Error durante verificación IAM', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al verificar credenciales IAM',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };
  /**
   * @swagger
   * /api/upload/s3-status:
   *   get:
   *     summary: Obtener estado de configuración S3
   *     description: Devuelve el estado actual de la configuración de S3 para el entorno
   *     tags: [Upload]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Estado de S3 obtenido exitosamente
   *       500:
   *         description: Error al obtener estado
   */
  getS3Status = async (req, res) => {
    try {
      logger.info('Solicitando estado de configuración S3', {
        userId: req.user?.id,
        environment: process.env.NODE_ENV
      });

      const configStatus = S3Service.getConfigurationStatus();
      
      // Información adicional del entorno
      const environmentInfo = {
        nodeEnv: process.env.NODE_ENV,
        dockerEnv: process.env.DOCKER_ENV,
        containerName: process.env.CONTAINER_NAME,
        healthCheckEnabled: process.env.HEALTH_CHECK_ENABLED
      };

      const response = {
        timestamp: new Date().toISOString(),
        environment: environmentInfo,
        s3Configuration: configStatus,
        recommendations: []
      };

      // Agregar recomendaciones basadas en el estado
      if (!configStatus.ready) {
        if (configStatus.localMode && process.env.NODE_ENV !== 'development') {
          response.recommendations.push('Considerar usar S3 en lugar de almacenamiento local para este entorno');
        }
        if (!configStatus.configured) {
          response.recommendations.push('Verificar credenciales y configuración de AWS S3');
        }
        if (!configStatus.credentials.hasAccessKey) {
          response.recommendations.push('Configurar AWS_ACCESS_KEY_ID');
        }
        if (!configStatus.credentials.hasSecretKey) {
          response.recommendations.push('Configurar AWS_SECRET_ACCESS_KEY');
        }
      }

      res.status(200).json({
        success: true,
        message: 'Estado de S3 obtenido exitosamente',
        data: response
      });

    } catch (error) {
      logger.error('Error al obtener estado de S3', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al obtener estado de configuración S3',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  };

  /**
   * @swagger
   * /api/upload/test-s3:
   *   post:
   *     summary: Probar conexión y configuración de S3
   *     description: Realiza una prueba completa de S3 creando, leyendo y eliminando un archivo de prueba
   *     tags: [Upload]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Prueba de S3 exitosa
   *       500:
   *         description: Error en la configuración de S3
   */
  testS3Configuration = async (req, res) => {
    try {
      logger.info('Iniciando prueba de configuración S3', {
        userId: req.user?.id,
        bucket: process.env.AWS_S3_BUCKET_NAME,
        region: process.env.AWS_REGION
      });

      // Verificar variables de entorno
      const requiredEnvVars = [
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY', 
        'AWS_REGION',
        'AWS_S3_BUCKET_NAME'
      ];

      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      if (missingVars.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Variables de entorno faltantes para S3',
          missingVariables: missingVars
        });
      }

      // Verificar modo de almacenamiento
      if (process.env.STORAGE_MODE !== 's3') {
        return res.status(400).json({
          success: false,
          message: 'STORAGE_MODE no está configurado como "s3"',
          currentMode: process.env.STORAGE_MODE
        });
      }

      // Crear archivo de prueba
      const testKey = `test/s3-test-${Date.now()}.txt`;
      const testContent = Buffer.from(`Prueba S3 - ${new Date().toISOString()}\nUsuario: ${req.user?.id}\nBucket: ${process.env.AWS_S3_BUCKET_NAME}`);
      
      // 1. Probar subida de archivo
      logger.info('Probando subida de archivo a S3', { testKey });
      const uploadResult = await S3Service.uploadFile(
        testContent, 
        testKey, 
        'text/plain',
        { public: true }
      );

      // 2. Probar verificación de existencia
      logger.info('Probando verificación de existencia', { testKey });
      const exists = await S3Service.fileExists(testKey);

      // 3. Probar generación de URL firmada
      logger.info('Probando generación de URL firmada', { testKey });
      const signedUrl = await S3Service.getSignedUrl('getObject', testKey, 300);

      // 4. Probar eliminación
      logger.info('Probando eliminación de archivo', { testKey });
      const deleteResult = await S3Service.deleteFile(testKey);

      // 5. Verificar que fue eliminado
      const existsAfterDelete = await S3Service.fileExists(testKey);

      const testResults = {
        environmentVariables: {
          bucket: process.env.AWS_S3_BUCKET_NAME,
          region: process.env.AWS_REGION,
          storageMode: process.env.STORAGE_MODE,
          hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
          hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY
        },
        tests: {
          upload: {
            success: !!uploadResult,
            url: uploadResult,
            key: testKey
          },
          fileExists: {
            success: exists,
            existed: exists
          },
          signedUrl: {
            success: !!signedUrl,
            url: signedUrl ? signedUrl.substring(0, 100) + '...' : null
          },
          delete: {
            success: deleteResult,
            deleted: deleteResult
          },
          fileExistsAfterDelete: {
            success: !existsAfterDelete,
            stillExists: existsAfterDelete
          }
        },
        overall: {
          success: !!uploadResult && exists && !!signedUrl && deleteResult && !existsAfterDelete,
          timestamp: new Date().toISOString()
        }
      };

      if (testResults.overall.success) {
        logger.info('Prueba de S3 completada exitosamente', testResults);
        res.status(200).json({
          success: true,
          message: 'Configuración de S3 verificada exitosamente',
          data: testResults
        });
      } else {
        logger.error('Prueba de S3 falló', testResults);
        res.status(500).json({
          success: false,
          message: 'La configuración de S3 tiene problemas',
          data: testResults
        });
      }
    } catch (error) {
      logger.error('Error durante la prueba de S3', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        message: 'Error al probar configuración de S3',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        details: {
          errorCode: error.code,
          errorName: error.name,
          bucket: process.env.AWS_S3_BUCKET_NAME,
          region: process.env.AWS_REGION
        }
      });
    }
  };
}

module.exports = new UploadController();