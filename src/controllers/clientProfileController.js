// Controlador para manejar las operaciones del perfil de cliente
const { ClientProfile, User } = require('../models');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Para generar nombres únicos para los archivos

// Directorio donde se guardarán los archivos subidos
const uploadDir = path.join(__dirname, '../uploads');

// Asegurarse de que el directorio existe
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Función para guardar un archivo y devolver su ruta
const saveFile = async (file) => {
  if (!file) return null;
  
  const uniqueFilename = `${uuidv4()}_${file.name}`;
  const filePath = path.join(uploadDir, uniqueFilename);
  
  // Asegurarse de que el buffer del archivo se guarda correctamente
  await fs.promises.writeFile(filePath, file.data);
  
  return uniqueFilename; // Devolver solo el nombre del archivo
};

// Controlador para el perfil de cliente
const clientProfileController = {
  // Crear un nuevo perfil de cliente
  create: async (req, res) => {
    try {
      const { userId } = req.body;
      
      // Verificar si ya existe un perfil para este usuario
      const existingProfile = await ClientProfile.findOne({ where: { userId } });
      if (existingProfile) {
        return res.status(400).json({ message: 'Este usuario ya tiene un perfil, debe actualizarlo' });
      }
      
      // Procesar los archivos cargados
      let fotocopiaCedulaPath = null;
      let fotocopiaRutPath = null;
      let anexosAdicionalesPath = null;
      
      if (req.files) {
        if (req.files.fotocopiaCedula) {
          fotocopiaCedulaPath = await saveFile(req.files.fotocopiaCedula);
        }
        
        if (req.files.fotocopiaRut) {
          fotocopiaRutPath = await saveFile(req.files.fotocopiaRut);
        }
        
        if (req.files.anexosAdicionales) {
          anexosAdicionalesPath = await saveFile(req.files.anexosAdicionales);
        }
      }
      
      // Datos para crear el perfil
      const profileData = {
        ...req.body,
        fotocopiaCedula: fotocopiaCedulaPath,
        fotocopiaRut: fotocopiaRutPath,
        anexosAdicionales: anexosAdicionalesPath
      };
      
      // Crear el perfil en la base de datos
      const newProfile = await ClientProfile.create(profileData);
      
      return res.status(201).json(newProfile);
    } catch (error) {
      console.error('Error al crear perfil:', error);
      return res.status(500).json({ message: 'Error al crear el perfil', error: error.message });
    }
  },
  
  // Obtener el perfil de un cliente por su ID de usuario
  getByUserId: async (req, res) => {
    try {
      const { userId } = req.params;
      
      const profile = await ClientProfile.findOne({ where: { userId } });
      
      if (!profile) {
        return res.status(404).json({ message: 'Perfil no encontrado' });
      }
      
      return res.status(200).json(profile);
    } catch (error) {
      console.error('Error al obtener perfil:', error);
      return res.status(500).json({ message: 'Error al obtener el perfil', error: error.message });
    }
  },
  
  // Actualizar el perfil de un cliente
  update: async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Verificar si existe el perfil
      const existingProfile = await ClientProfile.findOne({ where: { userId } });
      
      if (!existingProfile) {
        return res.status(404).json({ message: 'Perfil no encontrado' });
      }
      
      // Procesar los archivos cargados
      let fotocopiaCedulaPath = existingProfile.fotocopiaCedula;
      let fotocopiaRutPath = existingProfile.fotocopiaRut;
      let anexosAdicionalesPath = existingProfile.anexosAdicionales;
      
      if (req.files) {
        // Si hay nuevos archivos, eliminar los anteriores y guardar los nuevos
        if (req.files.fotocopiaCedula) {
          if (existingProfile.fotocopiaCedula) {
            const oldPath = path.join(uploadDir, existingProfile.fotocopiaCedula);
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
            }
          }
          fotocopiaCedulaPath = await saveFile(req.files.fotocopiaCedula);
        }
        
        if (req.files.fotocopiaRut) {
          if (existingProfile.fotocopiaRut) {
            const oldPath = path.join(uploadDir, existingProfile.fotocopiaRut);
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
            }
          }
          fotocopiaRutPath = await saveFile(req.files.fotocopiaRut);
        }
        
        if (req.files.anexosAdicionales) {
          if (existingProfile.anexosAdicionales) {
            const oldPath = path.join(uploadDir, existingProfile.anexosAdicionales);
            if (fs.existsSync(oldPath)) {
              fs.unlinkSync(oldPath);
            }
          }
          anexosAdicionalesPath = await saveFile(req.files.anexosAdicionales);
        }
      }
      
      // Datos para actualizar el perfil
      const profileData = {
        ...req.body,
        fotocopiaCedula: fotocopiaCedulaPath,
        fotocopiaRut: fotocopiaRutPath,
        anexosAdicionales: anexosAdicionalesPath
      };
      
      // Actualizar el perfil
      await existingProfile.update(profileData);
      
      // Obtener el perfil actualizado
      const updatedProfile = await ClientProfile.findOne({ where: { userId } });
      
      return res.status(200).json(updatedProfile);
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      return res.status(500).json({ message: 'Error al actualizar el perfil', error: error.message });
    }
  },
  
  // Eliminar un perfil
  delete: async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Verificar si existe el perfil
      const existingProfile = await ClientProfile.findOne({ where: { userId } });
      
      if (!existingProfile) {
        return res.status(404).json({ message: 'Perfil no encontrado' });
      }
      
      // Eliminar los archivos asociados al perfil
      if (existingProfile.fotocopiaCedula) {
        const filepath = path.join(uploadDir, existingProfile.fotocopiaCedula);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      }
      
      if (existingProfile.fotocopiaRut) {
        const filepath = path.join(uploadDir, existingProfile.fotocopiaRut);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      }
      
      if (existingProfile.anexosAdicionales) {
        const filepath = path.join(uploadDir, existingProfile.anexosAdicionales);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
      }
      
      // Eliminar el perfil de la base de datos
      await existingProfile.destroy();
      
      return res.status(200).json({ message: 'Perfil eliminado correctamente' });
    } catch (error) {
      console.error('Error al eliminar perfil:', error);
      return res.status(500).json({ message: 'Error al eliminar el perfil', error: error.message });
    }
  },
  
  // Obtener un archivo
  getFile: async (req, res) => {
    try {
      const { userId, fileType } = req.params;
      
      // Verificar si existe el perfil
      const profile = await ClientProfile.findOne({ where: { userId } });
      
      if (!profile) {
        return res.status(404).json({ message: 'Perfil no encontrado' });
      }
      
      let filePath;
      
      // Determinar qué archivo se está solicitando
      if (fileType === 'cedula' && profile.fotocopiaCedula) {
        filePath = path.join(uploadDir, profile.fotocopiaCedula);
      } else if (fileType === 'rut' && profile.fotocopiaRut) {
        filePath = path.join(uploadDir, profile.fotocopiaRut);
      } else if (fileType === 'anexos' && profile.anexosAdicionales) {
        filePath = path.join(uploadDir, profile.anexosAdicionales);
      } else {
        return res.status(404).json({ message: 'Archivo no encontrado' });
      }
      
      // Verificar si el archivo existe
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'Archivo no encontrado en el servidor' });
      }
      
      // Enviar el archivo como respuesta
      return res.sendFile(filePath);
    } catch (error) {
      console.error('Error al obtener archivo:', error);
      return res.status(500).json({ message: 'Error al obtener el archivo', error: error.message });
    }
  }
};

module.exports = clientProfileController;