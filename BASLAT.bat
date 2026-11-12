@echo off
chcp 65001 >nul
title TikTok Oyun Fabrikasi
cd /d "%~dp0"

rem ZIP icinden cift tiklandiysa (cikarilmadan) yaninda hicbir sey yoktur: once klasore cikarmasini soyle.
if not exist "%~dp0kopru.js" goto cikarilmamis

rem Hazir paket kendi Node'unu tasir (node\node.exe); varsa o kullanilir, kurulu Node gerekmez.
if exist "%~dp0node\node.exe" goto paketnode

rem Node.js yoksa: duz bir ileti, tarayicida yardim sayfasi, pencere acik kalir.
where node >nul 2>nul
if errorlevel 1 goto nodeyok

rem Motor arka planda, penceresiz acilir (--gizli) ve ana sayfayi tarayicida acar. Gereken kutuphaneyi ilk seferde
rem kendisi indirir; durumu sayfada gorunur. Motor hazir olunca bu pencere kendiliginden kapanir. Motor acilamazsa
rem nedeni ve motorun son satirlari bu pencerede kalir (:hata). Ana sayfadaki "Motoru kapat" motoru durdurur ("Baslat"
rem uyandirir), o sekme kapaninca motor tamamen kapanir; tarayicida hicbir sayfasi acik degilken 10 dakika sonra da.
node kopru.js --ana-sayfa --ac --gizli
if errorlevel 1 goto hata
exit /b 0

:paketnode
"%~dp0node\node.exe" kopru.js --ana-sayfa --ac --gizli
if errorlevel 1 goto hata
exit /b 0

:cikarilmamis
echo.
echo  Once ZIP'i bir klasore cikar (sag tik, Tumunu ayikla), sonra BASLAT.bat'a cift tikla.
echo.
pause
exit /b 1

:hata
echo.
pause
exit /b 1

:nodeyok
echo.
echo  Node.js bulunamadi. Oyunlarin motoru icin gerekli, ucretsiz bir program.
echo  En kolayi: hicbir sey kurmadan calisan hazir paketi indir:
echo    https://github.com/furkancavlak/tiktok-oyun-fabrikasi/releases
echo  Ya da Node.js kur, sonra BASLAT.bat dosyasina yeniden cift tikla:
echo    https://nodejs.org/dist/v24.15.0/node-v24.15.0-x64.msi
echo    (node.exe ya da Standalone Binary degil, .msi uzantili kurulum dosyasi)
set "YARDIM=%~dp0node-yok.html"
if not exist "%YARDIM%" set "YARDIM=%~dp0cekirdek\node-yok.html"
if not exist "%YARDIM%" goto yardimyok
echo  Yardim sayfasi tarayicida aciliyor.
echo.
rem FABRIKA_TEST_ACMA: yalniz testler icin; sayfayi acmak yerine yolunu yazar.
if defined FABRIKA_TEST_ACMA goto testyaz
start "" "%YARDIM%"
goto bekle
:testyaz
echo ACILACAK: "%YARDIM%"
goto bekle
:yardimyok
rem Yardim sayfasi yoksa (eksik kopya): yalniz kisa kurulum tarifi.
echo  Kurulum: https://nodejs.org adresinden LTS yazan surumu indirip kur (Windows icin .msi kurulum dosyasi).
echo.
:bekle
pause
exit /b 1
