@echo off
chcp 65001 >nul
title TikTok Oyun Fabrikasi - motor
cd /d "%~dp0"

rem Node.js yoksa: duz bir ileti, tarayicida yardim sayfasi, pencere acik kalir.
where node >nul 2>nul
if errorlevel 1 goto nodeyok

rem Motor: ana sayfayi tarayicida acar. Gereken kutuphaneyi ilk seferde kendisi indirir; durumu sayfada gorunur.
node kopru.js --ana-sayfa --ac
if errorlevel 1 goto hata
exit /b 0

:hata
echo.
pause
exit /b 1

:nodeyok
echo.
echo  Node.js bulunamadi. Oyunlarin motoru icin gerekli, ucretsiz bir program.
echo  https://nodejs.org adresinden LTS surumunu kur, sonra BASLAT.bat dosyasina yeniden cift tikla.
echo  Yardim sayfasi tarayicida aciliyor.
echo.
set "YARDIM=%~dp0node-yok.html"
if not exist "%YARDIM%" set "YARDIM=%~dp0cekirdek\node-yok.html"
if not exist "%YARDIM%" goto bekle
rem FABRIKA_TEST_ACMA: yalniz testler icin; sayfayi acmak yerine yolunu yazar.
if defined FABRIKA_TEST_ACMA goto testyaz
start "" "%YARDIM%"
goto bekle
:testyaz
echo ACILACAK: "%YARDIM%"
:bekle
pause
exit /b 1
