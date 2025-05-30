Write-Host "Creando paquete para Docker en EC2..." -ForegroundColor Green

# Eliminar ZIP anterior si existe
if (Test-Path "artesa-api-docker.zip") {
    Remove-Item "artesa-api-docker.zip"
    Write-Host "ZIP anterior eliminado" -ForegroundColor Yellow
}

# Elementos ESENCIALES para Docker (adaptado de tu script)
$itemsToInclude = @(
    "src",                    # Todo el código fuente
    "docker",                 # Configuraciones de Docker
    "app.js",                 # Archivo principal
    "package.json",           # Dependencias
    "package-lock.json",      # Lock de dependencias
    ".dockerignore"           # Configuración Docker (si existe)
)

# Verificar qué archivos existen antes de incluirlos
$existingItems = @()
foreach ($item in $itemsToInclude) {
    if (Test-Path $item) {
        $existingItems += $item
        Write-Host "✓ Incluido: $item" -ForegroundColor Green
    } else {
        Write-Host "⚠ No encontrado: $item" -ForegroundColor Yellow
    }
}

# Crear el ZIP solo con archivos existentes
if ($existingItems.Count -gt 0) {
    Compress-Archive -Path $existingItems -DestinationPath "artesa-api-docker.zip" -Force
    
    Write-Host "✅ Paquete Docker creado: artesa-api-docker.zip" -ForegroundColor Green
    
    $fileInfo = Get-Item "artesa-api-docker.zip"
    Write-Host "📦 Tamaño: $([math]::Round($fileInfo.Length / 1MB, 2)) MB" -ForegroundColor Cyan
    
    # Mostrar contenido del ZIP
    Write-Host "`n📋 Contenido del ZIP:" -ForegroundColor Blue
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead("$PWD\artesa-api-docker.zip")
    $zip.Entries | ForEach-Object { Write-Host "  - $($_.FullName)" -ForegroundColor Gray }
    $zip.Dispose()
    
} else {
    Write-Host "❌ Error: No se encontraron archivos para incluir" -ForegroundColor Red
    exit 1
}

Write-Host "`n🚀 Listo para transferir a EC2!" -ForegroundColor Green
Write-Host "Comando para transferir:" -ForegroundColor Yellow
Write-Host 'scp -i "C:\Users\jayco\OneDrive\CLIENTES\MASORG\Desarrollo\LaArtesa\artesa-key.pem" artesa-api-docker.zip ec2-user@ec2-44-216-131-63.compute-1.amazonaws.com:/home/ec2-user/' -ForegroundColor Cyan