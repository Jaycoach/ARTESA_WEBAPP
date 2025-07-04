@echo off
echo 🔧 Configurando entorno para Windows...

REM Crear directorios
mkdir docker\scripts 2>nul

REM Verificar si Git Bash está disponible
where git >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo ✅ Git encontrado, usando Git Bash para permisos...
    "C:\Program Files\Git\bin\bash.exe" -c "chmod +x docker/scripts/entrypoint.sh"
) else (
    echo ⚠️ Git no encontrado, los permisos se manejarán en Docker
)

echo ✅ Configuración completada
pause