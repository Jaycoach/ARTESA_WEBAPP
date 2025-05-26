param(
    [Parameter(Mandatory=$false)]
    [string]$Environment = "staging"
)

Write-Host "Desplegando frontend a AWS S3 + CloudFront - Ambiente: $Environment" -ForegroundColor Green

# Configurar variables según ambiente
if ($Environment -eq "production") {
    $BucketName = "artesa-frontend-production"
    $Mode = "production"
} else {
    $BucketName = "artesa-frontend-staging"
    $Mode = "staging"
}

Write-Host "Construyendo aplicación en modo: $Mode" -ForegroundColor Yellow

# Build
npm run build -- --mode $Mode

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

# Obtener Distribution ID
$DistributionId = aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='CloudFront distribution for Artesa Frontend $Environment'].Id" --output text

if ($DistributionId -and $DistributionId -ne "None") {
    Write-Host "Invalidando CloudFront: $DistributionId" -ForegroundColor Yellow
    aws cloudfront create-invalidation --distribution-id $DistributionId --paths "/*"
    Write-Host "Invalidación creada exitosamente" -ForegroundColor Green
} else {
    Write-Host "No se encontró Distribution ID para el ambiente: $Environment" -ForegroundColor Red
}

Write-Host "¡Despliegue completado!" -ForegroundColor Green
Write-Host "URL de acceso: https://$DistributionId.cloudfront.net" -ForegroundColor Cyan