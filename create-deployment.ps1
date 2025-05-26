Write-Host "Creando nuevo ZIP corregido para Elastic Beanstalk..." -ForegroundColor Green

# Eliminar ZIP anterior si existe
if (Test-Path "laartesa-backend-v2.zip") {
    Remove-Item "laartesa-backend-v2.zip"
}

# Elementos a incluir
$itemsToInclude = @(
    ".ebextensions",
    "src",
    "docs", 
    "app.js",
    "package.json",
    "package-lock.json",
    "README.md",
    "CHANGELOG.md"
)

# Crear el ZIP
Compress-Archive -Path $itemsToInclude -DestinationPath "laartesa-backend-v2.zip" -Force

Write-Host "ZIP corregido creado: laartesa-backend-v2.zip" -ForegroundColor Green

$fileInfo = Get-Item "laartesa-backend-v2.zip"
Write-Host "Tamaño: $([math]::Round($fileInfo.Length / 1MB, 2)) MB" -ForegroundColor Cyan