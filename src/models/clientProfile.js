/**
 * Este modelo representa la estructura de la tabla para almacenar
 * la información del perfil de cliente en la base de datos.
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
        onDelete: 'CASCADE'
      },
      
      // Información Básica
      nombre: {
        type: DataTypes.STRING,
        allowNull: false
      },
      tipoDocumento: {
        type: DataTypes.ENUM('CC', 'CE', 'PASAPORTE'),
        allowNull: false,
        defaultValue: 'CC'
      },
      numeroDocumento: {
        type: DataTypes.STRING,
        allowNull: false
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
        allowNull: true
      },
      nit: {
        type: DataTypes.STRING,
        allowNull: true
      },
      representanteLegal: {
        type: DataTypes.STRING,
        allowNull: true
      },
      actividadComercial: {
        type: DataTypes.STRING,
        allowNull: true
      },
      sectorEconomico: {
        type: DataTypes.STRING,
        allowNull: true
      },
      tamanoEmpresa: {
        type: DataTypes.ENUM('Microempresa', 'Pequeña', 'Mediana', 'Grande'),
        allowNull: true,
        defaultValue: 'Microempresa'
      },
      
      // Información Financiera
      ingresosMensuales: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true
      },
      patrimonio: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true
      },
      
      // Información Bancaria
      entidadBancaria: {
        type: DataTypes.STRING,
        allowNull: true
      },
      tipoCuenta: {
        type: DataTypes.ENUM('Ahorros', 'Corriente'),
        allowNull: true,
        defaultValue: 'Ahorros'
      },
      numeroCuenta: {
        type: DataTypes.STRING,
        allowNull: true
      },
      
      // Información de Contacto Alternativo
      nombreContacto: {
        type: DataTypes.STRING,
        allowNull: true
      },
      cargoContacto: {
        type: DataTypes.STRING,
        allowNull: true
      },
      telefonoContacto: {
        type: DataTypes.STRING,
        allowNull: true
      },
      emailContacto: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isEmail: true
        }
      },
      
      // Rutas de los documentos cargados
      fotocopiaCedula: {
        type: DataTypes.STRING,
        allowNull: true
      },
      fotocopiaRut: {
        type: DataTypes.STRING,
        allowNull: true
      },
      anexosAdicionales: {
        type: DataTypes.STRING,
        allowNull: true
      },
      
      // Campos para auditoría
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    }, {
      tableName: 'client_profiles',
      timestamps: true
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