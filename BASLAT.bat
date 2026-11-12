@echo off
chcp 65001 >nul
title Canli Oyun - Kopru
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js bulunamadi. https://nodejs.org adresinden LTS surumunu kur, sonra yeniden dene.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\tiktok-live-connector" (
  echo.
  echo  Gereken kutuphane indiriliyor, bir kez yapilir...
  call npm install --omit=dev
  if errorlevel 1 (
    echo.
    echo  Kutuphane indirilemedi. Internet baglantini kontrol edip yeniden dene.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo  Kendi yayininla oynamak icin TikTok kullanici adini yaz.
echo  Yalnizca denemek istiyorsan bos birak ve Enter'a bas: TikTok'a baglanmadan, sahte izleyicilerle acilir.
echo.
set "KULLANICI="
set /p KULLANICI= TikTok kullanici adin (basinda @ olmadan):eskidiziler74

rem --sor: klasorde birden cok oyun varsa kopru hangisinin acilacagini sorar (depo kokunden calistirinca).
if "%KULLANICI%"=="" (
  node kopru.js --deneme --ac --sor
) else (
  node kopru.js "%KULLANICI%" --ac --sor
)
echo.
pause
