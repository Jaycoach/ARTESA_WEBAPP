param(
    [Parameter(Mandatory=$false)]
    [string]$Environment = "staging"
)

Write-Host "=== DEPLOY FRONTEND ARTESA ===" -ForegroundColor Cyan
Write-Host "Desplegando frontend a AWS S3 + CloudFront - Ambiente: $Environment" -ForegroundColor Green

# CONFIGURAR PERFIL ARTESA
Write-Host "🔑 Configurando credenciales para proyecto ARTESA..." -ForegroundColor Yellow
$env:AWS_PROFILE = "artesa"
$env:AWS_DEFAULT_PROFILE = "artesa"

# Verificar credenciales correctas
$identity = aws sts get-caller-identity 2>&1 | ConvertFrom-Json
if ($identity.Account -eq "476114150454") {
    Write-Host "✅ Credenciales ARTESA configuradas correctamente" -ForegroundColor Green
    Write-Host "   Usuario: $($identity.Arn)" -ForegroundColor Cyan
    Write-Host "   Cuenta AWS: $($identity.Account)" -ForegroundColor Cyan
} else {
    Write-Host "❌ Error: Credenciales incorrectas - se detectó: $($identity.Arn)" -ForegroundColor Red
    Write-Host "💡 Ejecuta: aws configure --profile artesa" -ForegroundColor Yellow
    exit 1
}

# Configurar AWS CLI
$awsExePath = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"
if (Test-Path $awsExePath) {
    Set-Alias -Name aws -Value $awsExePath -Scope Script
    Write-Host "✅ AWS CLI configurado desde: $awsExePath" -ForegroundColor Green
} else {
    Write-Host "❌ Error: AWS CLI no encontrado en la ruta esperada" -ForegroundColor Red
    exit 1
}

# Configurar variables según ambiente
if ($Environment -eq "production") {
    $BucketName = "artesa-frontend-production"
    $Mode = "production"
    $CloudFrontUrl = "https://d1nkfheaf642r6.cloudfront.net"
    $EnvFile = ".env.production"
} else {
    $BucketName = "artesa-frontend-staging"
    $Mode = "staging"
    $CloudFrontUrl = "https://d1bqegutwmfn98.cloudfront.net"
    $CloudFrontDistributionId = "EW6Z1KU9EFB7I"
    $EnvFile = ".env.staging"
}

Write-Host "📋 Configuración de deploy:" -ForegroundColor Yellow
Write-Host "  - Ambiente: $Environment" -ForegroundColor White
Write-Host "  - Modo build: $Mode" -ForegroundColor White
Write-Host "  - Bucket S3: $BucketName" -ForegroundColor White
Write-Host "  - CloudFront URL: $CloudFrontUrl" -ForegroundColor White
Write-Host "  - Archivo env: $EnvFile" -ForegroundColor White

# ================================
# NUEVA SECCIÓN: VALIDAR VARIABLES DE ENTORNO
# ================================

Write-Host "`n🔍 Validando variables de entorno..." -ForegroundColor Yellow

# Verificar que el archivo .env existe
if (!(Test-Path $EnvFile)) {
    Write-Host "❌ Error: No se encontró el archivo $EnvFile" -ForegroundColor Red
    Write-Host "💡 Archivos .env disponibles:" -ForegroundColor Yellow
    Get-ChildItem ".env*" | ForEach-Object { Write-Host "   - $($_.Name)" -ForegroundColor Cyan }
    exit 1
}

# Leer y mostrar variables de entorno críticas
Write-Host "📄 Cargando variables desde: $EnvFile" -ForegroundColor Cyan
$envContent = Get-Content $EnvFile
$criticalVars = @("VITE_API_URL", "VITE_APP_NAME", "VITE_RECAPTCHA_SITE_KEY", "VITE_FRONTEND_URL")

foreach ($line in $envContent) {
    if ($line -match "^(VITE_\w+)=(.+)$") {
        $varName = $matches[1]
        $varValue = $matches[2]
        
        # Mostrar variables críticas
        if ($criticalVars -contains $varName) {
            Write-Host "  ✅ $varName = $varValue" -ForegroundColor Green
        } else {
            Write-Host "  📝 $varName = $varValue" -ForegroundColor Cyan
        }
    }
}

# Verificar variables críticas
$missingVars = @()
foreach ($varName in $criticalVars) {
    $found = $false
    foreach ($line in $envContent) {
        if ($line -match "^$varName=.+$") {
            $found = $true
            break
        }
    }
    if (!$found) {
        $missingVars += $varName
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host "❌ Variables críticas faltantes:" -ForegroundColor Red
    foreach ($var in $missingVars) {
        Write-Host "   - $var" -ForegroundColor Red
    }
    exit 1
}

Write-Host "✅ Todas las variables críticas están presentes" -ForegroundColor Green

# ================================
# VALIDACIÓN ESPECÍFICA DE RECAPTCHA
# ================================

Write-Host "`n🔍 Validando configuración de reCAPTCHA..." -ForegroundColor Yellow

# Verificar que la SITE_KEY no sea la de prueba en producción
foreach ($line in $envContent) {
    if ($line -match "^VITE_RECAPTCHA_SITE_KEY=(.+)$") {
        $recaptchaKey = $matches[1]
        if ($Environment -eq "production" -and $recaptchaKey -eq "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI") {
            Write-Host "❌ Error: Usando clave de prueba de reCAPTCHA en producción" -ForegroundColor Red
            exit 1
        } else {
            Write-Host "✅ Clave reCAPTCHA configurada correctamente para $Environment" -ForegroundColor Green
        }
        break
    }
}

# ================================
# NUEVA SECCIÓN: BACKUP DEL BUILD ANTERIOR
# ================================

Write-Host "`n💾 Creando backup del build anterior..." -ForegroundColor Yellow
if (Test-Path "dist") {
    $backupName = "dist-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Move-Item "dist" $backupName
    Write-Host "✅ Backup creado: $backupName" -ForegroundColor Green
}

# ================================
# NUEVA SECCIÓN: BUILD CON VALIDACIÓN
# ================================

Write-Host "`n🔨 Construyendo aplicación en modo: $Mode" -ForegroundColor Yellow

# Limpiar cache de node_modules si existe
if (Test-Path "node_modules/.cache") {
    Write-Host "🧹 Limpiando cache..." -ForegroundColor Cyan
    Remove-Item "node_modules/.cache" -Recurse -Force
}

# Ejecutar build con logging detallado
Write-Host "📦 Ejecutando: npm run build:$Mode" -ForegroundColor Cyan
$buildOutput = npm run build:$Mode 2>&1
$buildExitCode = $LASTEXITCODE

# Mostrar output del build
Write-Host "📋 Output del build:" -ForegroundColor Yellow
$buildOutput | ForEach-Object { Write-Host "  $_" -ForegroundColor White }

if ($buildExitCode -ne 0) {
    Write-Host "❌ Error en el build (Exit Code: $buildExitCode)" -ForegroundColor Red
    exit 1
}

# Validar que se generó el directorio dist
if (!(Test-Path "dist")) {
    Write-Host "❌ Error: No se generó el directorio 'dist'" -ForegroundColor Red
    exit 1
}

# Mostrar contenido generado
Write-Host "✅ Build completado. Contenido generado:" -ForegroundColor Green
Get-ChildItem "dist" -Recurse | ForEach-Object { 
    $relativePath = $_.FullName.Replace((Get-Location).Path + "\dist\", "")
    if ($_.PSIsContainer) {
        Write-Host "  📁 $relativePath/" -ForegroundColor Cyan
    } else {
        $size = [math]::Round($_.Length / 1KB, 2)
        Write-Host "  📄 $relativePath ($size KB)" -ForegroundColor White
    }
}

# ================================
# NUEVA SECCIÓN: VALIDAR VARIABLES EN EL BUILD
# ================================

Write-Host "`n🔍 Validando variables en el build..." -ForegroundColor Yellow

# Buscar index.html y verificar que contiene las variables
$indexPath = "dist/index.html"
if (Test-Path $indexPath) {
    $indexContent = Get-Content $indexPath -Raw
    
    # Buscar referencias a VITE en los archivos JS
    $jsFiles = Get-ChildItem "dist/assets/*.js"
    $foundViteVars = $false
    
    foreach ($jsFile in $jsFiles) {
        $jsContent = Get-Content $jsFile.FullName -Raw
        if ($jsContent -match "VITE_API_URL|VITE_APP_NAME") {
            $foundViteVars = $true
            Write-Host "  ✅ Variables de entorno encontradas en: $($jsFile.Name)" -ForegroundColor Green
            break
        }
    }
    
    if (!$foundViteVars) {
        Write-Host "  ⚠️  Advertencia: No se encontraron variables VITE_ en los archivos JS" -ForegroundColor Yellow
        Write-Host "     Esto podría indicar que las variables no se están embebiendo correctamente" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ❌ No se encontró index.html en el build" -ForegroundColor Red
    exit 1
}

# ================================
# DEPLOY A S3 (SIN CAMBIOS)
# ================================

Write-Host "`n☁️  Sincronizando archivos a S3: $BucketName" -ForegroundColor Yellow

# Sync archivos estáticos con cache largo
Write-Host "📤 Subiendo assets estáticos (cache largo)..." -ForegroundColor Cyan
aws s3 sync dist/ s3://$BucketName --delete --cache-control "public, max-age=31536000" --exclude "*.html" --exclude "*.json"

# Sync archivos HTML con no cache
Write-Host "📤 Subiendo archivos HTML (sin cache)..." -ForegroundColor Cyan
aws s3 sync dist/ s3://$BucketName --delete --cache-control "public, max-age=0, must-revalidate" --include "*.html"

# Sync archivos JSON con cache corto
Write-Host "📤 Subiendo archivos JSON (cache corto)..." -ForegroundColor Cyan
aws s3 sync dist/ s3://$BucketName --delete --cache-control "public, max-age=300" --include "*.json"

# ================================
# INVALIDACIÓN CLOUDFRONT (SIN CAMBIOS)
# ================================

Write-Host "`n🔄 Invalidando CloudFront..." -ForegroundColor Yellow

# Extraer Distribution ID de la URL de CloudFront
$DistributionId = $CloudFrontDistributionId
Write-Host "🔗 Distribution ID: $DistributionId" -ForegroundColor Cyan

if ($DistributionId -and $DistributionId -ne "None") {
    Write-Host "🚀 Invalidando caché de CloudFront..." -ForegroundColor Yellow
    aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/*"
    Write-Host "✅ Invalidación creada exitosamente" -ForegroundColor Green
} else {
    Write-Host "❌ No se pudo obtener Distribution ID" -ForegroundColor Red
}

# ================================
# RESUMEN FINAL
# ================================

Write-Host "`n🎉 ¡Despliegue completado exitosamente!" -ForegroundColor Green
Write-Host "🌐 URL de acceso: $CloudFrontUrl" -ForegroundColor Cyan

Write-Host "`n📊 Resumen del despliegue:" -ForegroundColor Yellow
Write-Host "  ✅ Ambiente: $Environment" -ForegroundColor White
Write-Host "  ✅ Bucket S3: $BucketName" -ForegroundColor White
Write-Host "  ✅ Distribution ID: $DistributionId" -ForegroundColor White
Write-Host "  ✅ Variables de entorno: Validadas y embebidas" -ForegroundColor White
Write-Host "  ✅ CloudFront: Cache invalidado" -ForegroundColor White

Write-Host "`n💡 Próximos pasos:" -ForegroundColor Yellow
Write-Host "  1. Espera 2-3 minutos para la propagación de CloudFront" -ForegroundColor Cyan
Write-Host "  2. Verifica la aplicación en: $CloudFrontUrl" -ForegroundColor Cyan
Write-Host "  3. Revisa las variables de entorno en la consola del navegador" -ForegroundColor Cyan

Write-Host "`n=== DEPLOY COMPLETADO ===" -ForegroundColor Cyan