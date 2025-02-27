/**
 * Este modelo representa la estructura de la tabla para almacenar
 * la información del perfil de cliente en la base de datos PostgreSQL.
 */

module.exports = (sequelize, DataTypes) => {
  const ClientProfile = sequelize.define('client_profile', {
    // ID único para cada perfil
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    
    // Relación con el usuario (llave foránea)
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      field: "userId" // Importante para PostgreSQL
    },
    
    // Información Básica
    nombre: {
      type: DataTypes.STRING,
      allowNull: false
    },
    tipoDocumento: {
      type: DataTypes.ENUM('CC', 'CE', 'PASAPORTE'),
      allowNull: false,
      defaultValue: 'CC',
      field: "tipoDocumento" // Importante para PostgreSQL
    },
    numeroDocumento: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "numeroDocumento" // Importante para PostgreSQL
    },
    direccion: {
      type: DataTypes.STRING,
      allowNull: false
    },
    ciudad: {
      type: DataTypes.STRING,
      allowNull: false
    },
    pais: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Colombia'
    },
    telefono: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true
      }
    },
    
    // Información Empresarial
    razonSocial: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "razonSocial" // Importante para PostgreSQL
    },
    nit: {
      type: DataTypes.STRING,
      allowNull: true
    },
    representanteLegal: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "representanteLegal" // Importante para PostgreSQL
    },
    actividadComercial: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "actividadComercial" // Importante para PostgreSQL
    },
    sectorEconomico: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "sectorEconomico" // Importante para PostgreSQL
    },
    tamanoEmpresa: {
      type: DataTypes.ENUM('Microempresa', 'Pequeña', 'Mediana', 'Grande'),
      allowNull: true,
      defaultValue: 'Microempresa',
      field: "tamanoEmpresa" // Importante para PostgreSQL
    },
    
    // Información Financiera
    ingresosMensuales: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      field: "ingresosMensuales" // Importante para PostgreSQL
    },
    patrimonio: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },
    
    // Información Bancaria
    entidadBancaria: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "entidadBancaria" // Importante para PostgreSQL
    },
    tipoCuenta: {
      type: DataTypes.ENUM('Ahorros', 'Corriente'),
      allowNull: true,
      defaultValue: 'Ahorros',
      field: "tipoCuenta" // Importante para PostgreSQL
    },
    numeroCuenta: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "numeroCuenta" // Importante para PostgreSQL
    },
    
    // Información de Contacto Alternativo
    nombreContacto: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "nombreContacto" // Importante para PostgreSQL
    },
    cargoContacto: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "cargoContacto" // Importante para PostgreSQL
    },
    telefonoContacto: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "telefonoContacto" // Importante para PostgreSQL
    },
    emailContacto: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "emailContacto", // Importante para PostgreSQL
      validate: {
        isEmail: true
      }
    },
    
    // Rutas de los documentos cargados
    fotocopiaCedula: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "fotocopiaCedula" // Importante para PostgreSQL
    },
    fotocopiaRut: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "fotocopiaRut" // Importante para PostgreSQL
    },
    anexosAdicionales: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "anexosAdicionales" // Importante para PostgreSQL
    },
    
    // Campos para auditoría
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "createdAt" // Importante para PostgreSQL
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "updatedAt" // Importante para PostgreSQL
    }
  }, {
    tableName: 'client_profiles',
    timestamps: true,
    underscored: false, // Importante para PostgreSQL - mantener camelCase
    freezeTableName: true
  });

  // Asociación con el modelo de Usuario
  ClientProfile.associate = (models) => {
    ClientProfile.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'usuario'
    });
  };

  return ClientProfile;
};