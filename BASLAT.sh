#!/bin/sh
# TikTok Oyun Fabrikası - Linux başlatıcısı (terminalde: sh BASLAT.sh; dosya yöneticisi izin veriyorsa çift tıkla).
# BASLAT.bat (Windows) ve BASLAT.command (macOS) ile aynı işi yapar: motoru ana sayfa kipinde açar; gereken kütüphaneyi
# motor ilk seferde kendisi indirir, durumu sayfada görünür. Düz POSIX sh; bash'e özgü bir şey yok.

# Betiğin kendi klasörüne geç: başka bir klasörden başlatılsa da. Yolda boşluk ve Türkçe harf olabilir.
cd "$(dirname "$0")" || exit 1

if command -v node >/dev/null 2>&1; then
  node kopru.js --ana-sayfa --ac
  kod=$?
  if [ "$kod" -ne 0 ]; then
    echo
    printf ' Kapatmak için Enter tuşuna bas. '
    read bos
  fi
  exit "$kod"
fi

# Node.js yoksa: düz bir ileti, tarayıcıda yardım sayfası, pencere açık kalır.
echo
echo " Node.js bulunamadı. Oyunların motoru için gerekli, ücretsiz bir program."
echo " https://nodejs.org adresinden LTS sürümünü kur, sonra BASLAT.sh dosyasını yeniden çalıştır."
YARDIM="$PWD/node-yok.html"
[ -f "$YARDIM" ] || YARDIM="$PWD/cekirdek/node-yok.html"
if [ -f "$YARDIM" ]; then
  echo " Yardım sayfası tarayıcıda açılıyor."
  echo
  # FABRIKA_TEST_ACMA: yalnız testler için; sayfayı açmak yerine yolunu yazar.
  if [ -n "$FABRIKA_TEST_ACMA" ]; then
    echo "ACILACAK: \"$YARDIM\""
  else
    xdg-open "$YARDIM" >/dev/null 2>&1
  fi
else
  echo " Kurulum: https://nodejs.org adresinden LTS yazan sürümü indirip kur."
  echo
fi
printf ' Kapatmak için Enter tuşuna bas. '
read bos
exit 1
