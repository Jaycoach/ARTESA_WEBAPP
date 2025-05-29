param(
    [Parameter(Mandatory=$false)]
    [string]$Environment = "staging"
)

Write-Host "Desplegando frontend a AWS S3 + CloudFront - Ambiente: $Environment" -ForegroundColor Green

# Configurar AWS CLI
$awsExePath = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"
if (Test-Path $awsExePath) {
    Set-Alias -Name aws -Value $awsExePath -Scope Script
    Write-Host "AWS CLI configurado desde: $awsExePath" -ForegroundColor Green
} else {
    Write-Host "Error: AWS CLI no encontrado en la ruta esperada" -ForegroundColor Red
    exit 1
}

# Configurar variables según ambiente
if ($Environment -eq "production") {
    $BucketName = "artesa-frontend-production"
    $Mode = "production"
    $CloudFrontUrl = "https://d1nkfheaf642r6.cloudfront.net"
} else {
    $BucketName = "artesa-frontend-staging"
    $Mode = "staging"
    $CloudFrontUrl = "https://d1bqegutwmfn98.cloudfront.net"
}

Write-Host "Construyendo aplicación en modo: $Mode" -ForegroundColor Yellow

# Build
npm run build:$Mode

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error en el build" -ForegroundColor Red
    exit 1
}

Write-Host "Sincronizando archivos a S3: $BucketName" -ForegroundColor Yellow

# Sync archivos estáticos con cache largo
aws s3 sync dist/ s3://$BucketName --delete --cache-control "public, max-age=31536000" --exclude "*.html" --exclude "*.json"

# Sync archivos HTML con no cache
aws s3 sync dist/ s3://$BucketName --delete --cache-control "public, max-age=0, must-revalidate" --include "*.html"

# Sync archivos JSON con cache corto
aws s3 sync dist/ s3://$BucketName --delete --cache-control "public, max-age=300" --include "*.json"

Write-Host "Obteniendo Distribution ID de CloudFront..." -ForegroundColor Yellow

# Extraer Distribution ID de la URL de CloudFront
$DistributionId = $CloudFrontUrl -replace "https://", "" -replace "\.cloudfront\.net.*", ""
Write-Host "Distribution ID extraído de la URL: $DistributionId" -ForegroundColor Cyan

if ($DistributionId -and $DistributionId -ne "None") {
    Write-Host "Invalidando CloudFront: $DistributionId" -ForegroundColor Yellow
    aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/*"
    Write-Host "Invalidación creada exitosamente" -ForegroundColor Green
} else {
    Write-Host "No se pudo obtener Distribution ID" -ForegroundColor Red
}

Write-Host "¡Despliegue completado!" -ForegroundColor Green
Write-Host "URL de acceso: $CloudFrontUrl" -ForegroundColor Cyan

# Mostrar información adicional
Write-Host "" -ForegroundColor White
Write-Host "Información del despliegue:" -ForegroundColor Yellow
Write-Host "- Ambiente: $Environment" -ForegroundColor White
Write-Host "- Bucket S3: $BucketName" -ForegroundColor White
Write-Host "- Distribution ID: $DistributionId" -ForegroundColor White
Write-Host "- URL CloudFront: $CloudFrontUrl" -ForegroundColor White