# Script para buscar archivos de configuración en el proyecto
# Equivalente a: find src/views -name "package.json" -o -name "vite.config.js" -o -name "index.html"

# Generar nombre de archivo de salida con timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$outputFile = "config-files-found_$timestamp.txt"

# Función para escribir tanto en consola como en archivo
function Write-Output-Both {
    param($Message, $Color = "White")
    Write-Host $Message -ForegroundColor $Color
    Add-Content -Path $outputFile -Value $Message
}

# Limpiar archivo de salida si existe
if (Test-Path $outputFile) {
    Remove-Item $outputFile
}

Write-Output-Both "========================================" "Cyan"
Write-Output-Both "ARCHIVOS DE CONFIGURACIÓN ENCONTRADOS" "Yellow"
Write-Output-Both "========================================" "Cyan"
Write-Output-Both "Fecha: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')" "Gray"
Write-Output-Both "Proyecto: $(Split-Path -Leaf (Get-Location))" "Gray"
Write-Output-Both ""

# Definir los patrones de archivos a buscar
$patterns = @("package.json", "vite.config.js", "index.html")
$searchPath = "src/views"

# Verificar si la ruta existe
if (-not (Test-Path $searchPath)) {
    Write-Output-Both "⚠️  La ruta '$searchPath' no existe" "Yellow"
    Write-Output-Both "Buscando en toda la estructura del proyecto..." "Gray"
    $searchPath = "."
}

Write-Output-Both "🔍 Ruta de búsqueda: $searchPath" "Green"
Write-Output-Both "📁 Patrones buscados: $($patterns -join ', ')" "Green"
Write-Output-Both ""

$foundFiles = @()

foreach ($pattern in $patterns) {
    $files = Get-ChildItem -Path $searchPath -Recurse -Name $pattern -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        $foundFiles += [PSCustomObject]@{
            Name = $pattern
            Path = $file
            FullPath = Join-Path (Get-Location) $file
            Size = (Get-Item $file -ErrorAction SilentlyContinue).Length
        }
    }
}

if ($foundFiles.Count -eq 0) {
    Write-Output-Both "❌ No se encontraron archivos con los patrones especificados" "Red"
} else {
    Write-Output-Both "✅ ARCHIVOS ENCONTRADOS ($($foundFiles.Count)):" "Green"
    Write-Output-Both ""
    
    # Agrupar por tipo de archivo
    $groupedFiles = $foundFiles | Group-Object Name | Sort-Object Name
    
    foreach ($group in $groupedFiles) {
        Write-Output-Both "📄 $($group.Name) ($($group.Count) archivo(s)):" "Cyan"
        
        foreach ($file in $group.Group | Sort-Object Path) {
            $sizeInfo = if ($file.Size) { " ($('{0:N0}' -f $file.Size) bytes)" } else { "" }
            Write-Output-Both "   └─ $($file.Path)$sizeInfo" "Gray"
        }
        Write-Output-Both ""
    }
}

Write-Output-Both "========================================" "Cyan"
Write-Output-Both "Búsqueda completada" "Yellow"
Write-Output-Both "Archivo de salida: $outputFile" "Green"

Write-Host ""
Write-Host "📝 Información guardada en: $outputFile" -ForegroundColor Green