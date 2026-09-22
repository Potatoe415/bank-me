@echo off
echo ===================================================
echo Nettoyage des anciens serveurs (Port 3000)...
echo ===================================================

:: Tuer les processus ecoutant sur le port 3000
FOR /F "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    echo Fermeture du processus PID %%a sur le port 3000...
    taskkill /F /PID %%a >nul 2>&1
)

:: Nettoyer le cache Next.js pour eviter les erreurs Turbopack/PostCSS
if exist ".next" (
    echo Suppression du cache .next...
    rmdir /s /q .next
)

echo.
echo ===================================================
echo Lancement du serveur local Bank-Me port 3000 (sans tunnel)
echo ===================================================
echo.
node start-local.js
pause
