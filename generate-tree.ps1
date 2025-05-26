# Script para generar estructura del proyecto LaArtesa
# Ejecutar desde la raíz del proyecto

param(
    [string]$OutputPath = "C:\Users\jayco\OneDrive\CLIENTES\MASORG\Desarrollo\LaArtesa\docs",
    [string]$ProjectName = "LaArtesa"
)

# Colores para output
$Green = "Green"
$Yellow = "Yellow"
$Red = "Red"

Write-Host "=== Generador de Estructura del Proyecto $ProjectName ===" -ForegroundColor $Green

# Verificar si estamos en la raíz del proyecto
if (-not (Test-Path "package.json")) {
    Write-Host "Error: No se encontró package.json. Ejecuta este script desde la raíz del proyecto." -ForegroundColor $Red
    exit 1
}

# Crear carpeta de destino si no existe
if (-not (Test-Path $OutputPath)) {
    Write-Host "Creando carpeta de destino: $OutputPath" -ForegroundColor $Yellow
    New-Item -Path $OutputPath -ItemType Directory -Force | Out-Null
}

# Obtener fecha y hora actual
$DateTime = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$DateTimeReadable = Get-Date -Format "dd/MM/yyyy HH:mm:ss"

# Nombres de archivos
$TreeFileName = "project-structure_$DateTime.txt"
$TreeFilePath = Join-Path $OutputPath $TreeFileName

Write-Host "Generando estructura del proyecto..." -ForegroundColor $Yellow

# Crear encabezado del archivo
$Header = @"
========================================
ESTRUCTURA DEL PROYECTO LAARTESA
========================================
Generado el: $DateTimeReadable
Ruta del proyecto: $PWD
========================================

"@

# Escribir encabezado
$Header | Out-File -FilePath $TreeFilePath -Encoding UTF8

# Generar estructura personalizada más limpia
try {
    Write-Host "Generando estructura de carpetas..." -ForegroundColor $Yellow
    
    # Función para generar estructura personalizada
    function Get-ProjectStructure {
        param($Path = ".", $Prefix = "", $MaxDepth = 3, $CurrentDepth = 0)
        
        if ($CurrentDepth -gt $MaxDepth) { return }
        
        $items = Get-ChildItem -Path $Path -Force | Where-Object {
            $_.Name -notmatch "^(node_modules|\.git|\.vscode|\.next|dist|build|coverage|\.nyc_output|logs|uploads)$" -and
            ($_.PSIsContainer -or $_.Name -match "\.(js|json|md|env|txt|sql|yml|yaml)$")
        } | Sort-Object @{Expression={$_.PSIsContainer}; Descending=$true}, Name
        
        $totalItems = $items.Count
        for ($i = 0; $i -lt $totalItems; $i++) {
            $item = $items[$i]
            $isLast = ($i -eq ($totalItems - 1))
            $connector = if ($isLast) { "└── " } else { "├── " }
            $newPrefix = if ($isLast) { "$Prefix    " } else { "$Prefix│   " }
            
            if ($item.PSIsContainer) {
                "$Prefix$connector$($item.Name)/"
                Get-ProjectStructure -Path $item.FullName -Prefix $newPrefix -MaxDepth $MaxDepth -CurrentDepth ($CurrentDepth + 1)
            } else {
                # Solo mostrar archivos relevantes
                if ($item.Name -match "^(app\.js|server\.js|index\.js|package\.json|\.env|README\.md|\.gitignore|Dockerfile|docker-compose\.yml)$" -or
                    ($CurrentDepth -eq 0 -and $item.Extension -match "\.(js|json|md)$")) {
                    "$Prefix$connector$($item.Name)"
                }
            }
        }
    }
    
    # Generar estructura
    $StructureOutput = Get-ProjectStructure
    
    # Agregar al archivo
    $StructureOutput | Out-File -FilePath $TreeFilePath -Append -Encoding UTF8
    
    Write-Host "✓ Estructura de carpetas generada exitosamente" -ForegroundColor $Green
    
    # Generar lista de archivos relevantes por carpeta
    Write-Host "Generando inventario de archivos relevantes..." -ForegroundColor $Yellow
    
    "`n" | Out-File -FilePath $TreeFilePath -Append -Encoding UTF8
    "ARCHIVOS RELEVANTES POR CARPETA:" | Out-File -FilePath $TreeFilePath -Append -Encoding UTF8
    "=" * 50 | Out-File -FilePath $TreeFilePath -Append -Encoding UTF8
    
    # Función para listar archivos relevantes
    function Get-RelevantFiles {
        param($FolderPath, $FolderName)
        
        if (Test-Path $FolderPath) {
            $files = Get-ChildItem -Path $FolderPath -File | Where-Object {
                $_.Extension -match "\.(js|json|md|sql|yml|yaml|env)$"
            } | Sort-Object Name
            
            if ($files.Count -gt 0) {
                "`n$FolderName/:" | Out-File -FilePath $TreeFilePath -Append -Encoding UTF8
                foreach ($file in $files) {
                    "  - $($file.Name)" | Out-File -FilePath $TreeFilePath -Append -Encoding UTF8
                }
            }
        }
    }
    
    # Listar archivos por carpetas importantes
    Get-RelevantFiles ".\src\config" "src/config"
    Get-RelevantFiles ".\src\controllers" "src/controllers"
    Get-RelevantFiles ".\src\models" "src/models"
    Get-RelevantFiles ".\src\routes" "src/routes"
    Get-RelevantFiles ".\src\services" "src/services"
    Get-RelevantFiles ".\src\middleware" "src/middleware"
    Get-RelevantFiles ".\src\utils" "src/utils"
    Get-RelevantFiles ".\src\validators" "src/validators"
    Get-RelevantFiles ".\docs" "docs"
    Get-RelevantFiles ".\scripts" "scripts"
    
    # Archivos en raíz
    $rootFiles = Get-ChildItem -Path "." -File | Where-Object {
        $_.Name -match "\.(js|json|md|env|txt|yml|yaml)$"
    } | Sort-Object Name
    
    if ($rootFiles.Count -gt 0) {
        "`nArchivos en raíz:" | Out-File -FilePath $TreeFilePath -Append -Encoding UTF8
        foreach ($file in $rootFiles) {
            "  - $($file.Name)" | Out-File -FilePath $TreeFilePath -Append -Encoding UTF8
        }
    }
    
    Write-Host "✓ Inventario de archivos completado" -ForegroundColor $Green
    Write-Host "Archivo guardado en: $TreeFilePath" -ForegroundColor $Green
    
} catch {
    Write-Host "Error al generar estructura: $($_.Exception.Message)" -ForegroundColor $Red
    exit 1
}

# Generar también un resumen de la estructura principal
$SummaryPath = Join-Path $OutputPath "project-summary_$DateTime.txt"
$Summary = @"
========================================
RESUMEN DE LA ESTRUCTURA - LAARTESA
========================================
Generado el: $DateTimeReadable

ESTRUCTURA PRINCIPAL:
├── src/                    # Código fuente del backend
│   ├── config/            # Configuraciones (DB, Swagger, Logger)
│   ├── controllers/       # Controladores de rutas
│   ├── middleware/        # Middlewares de autenticación y seguridad
│   ├── models/           # Modelos de datos y lógica de negocio
│   ├── routes/           # Definiciones de rutas
│   ├── services/         # Servicios (SAP, S3, etc.)
│   ├── utils/            # Utilidades y helpers
│   └── validators/       # Validadores de datos
├── docs/                 # Documentación del proyecto
├── scripts/              # Scripts de utilidad
├── uploads/              # Archivos subidos localmente (excluido)
└── logs/                 # Archivos de log (excluido)

ARCHIVOS CLAVE DEL PROYECTO:
├── app.js               # Punto de entrada de la aplicación
├── package.json         # Dependencias y scripts
├── .env                 # Variables de entorno
├── README.md           # Documentación principal
└── .gitignore          # Archivos ignorados por Git

ARCHIVOS RELEVANTES POR MÓDULO:
├── config/
│   ├── db.js           # Configuración de PostgreSQL
│   ├── logger.js       # Configuración de Winston
│   └── swagger.js      # Configuración de documentación API
├── models/
│   ├── User.js         # Modelo de usuarios
│   ├── Order.js        # Modelo de órdenes
│   ├── Product.js      # Modelo de productos
│   └── ClientProfile.js # Modelo de perfiles de cliente
├── services/
│   ├── SapBaseService.js    # Servicio base para SAP
│   ├── SapProductService.js # Sincronización de productos
│   ├── SapClientService.js  # Sincronización de clientes
│   └── SapOrderService.js   # Sincronización de órdenes

TECNOLOGÍAS UTILIZADAS:
- Backend: Node.js + Express
- Base de datos: PostgreSQL
- Autenticación: JWT
- Integración: SAP Business One
- Storage: AWS S3
- Documentación: Swagger
- Logging: Winston

========================================
"@

$Summary | Out-File -FilePath $SummaryPath -Encoding UTF8

Write-Host "✓ Resumen generado: $SummaryPath" -ForegroundColor $Green

# Preguntar si abrir la carpeta de destino
$OpenFolder = Read-Host "`n¿Deseas abrir la carpeta de documentación? (y/n)"
if ($OpenFolder -eq "y" -or $OpenFolder -eq "Y" -or $OpenFolder -eq "yes") {
    Start-Process explorer.exe $OutputPath
}

Write-Host "`n=== Proceso completado ===" -ForegroundColor $Green