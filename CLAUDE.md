## Dosya okuma — en kritik kural
- Read'i ASLA tam dosyaya çalıştırma. Önce Grep ile satırı bul,
  sonra Read'i offset/limit ile daralt.
- Kendi yazdığın/düzenlediğin dosyayı tekrar okuma.
- Bir dosyayı ikinci kez okumadan önce dur, gerçekten gerekli mi diye sor.

## Kapı komutları
```
npx tsc --noEmit
npm test 2>&1 | tail -15
npm run test:tz-utc 2>&1 | tail -8
npm run build 2>&1 | tail -5
```
Temizse "temiz" yaz, çıktıyı özetleme.

## Oturum
- Context %40'ı geçtiyse yeni iş başlatma.
