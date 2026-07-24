# MIC v29 — Acımasız Profesyonel Ürün, Finansal Güvenlik ve Teknik Denetim Raporu

**Denetim tarihi:** 24 Temmuz 2026  
**İncelenen kaynak:** `Gibiamie/Gibiamie.github.io`, `main` dalı  
**Mobil uygulama yolu:** `/mic/`  
**Desktop uygulama yolu:** `/mic-desktop/`  
**Kodun fiilî çalışma sürümü:** v29  
**Rapor durumu:** Kaynak kodu, dağıtım mimarisi, karar motoru, veri katmanı, responsive CSS ve temel kullanıcı akışları üzerinde ayrıntılı statik/runtime-yolu denetimi

---

## 1. Denetimin sınırı ve güven düzeyi

Bu raporda aşağıdaki alanlar doğrudan GitHub üzerindeki güncel dosyalardan incelendi:

- Mobil ve desktop HTML iskeleti
- Dinamik v29 yükleyicisi
- Karar motoru
- RP-14 yatırımcı profili
- Gerçek ve sanal portföy
- Piyasa snapshot verisi ve fiyat kaynağı gösterimi
- Grafik ve teknik gösterge altyapısı
- 1 saat / 4 saat gateway mantığı
- Teknik yöntemler v27-v29
- Halka arz takvimi
- PWA manifest ve service worker
- Mobil ve desktop responsive CSS
- localStorage veri yapısı

**Önemli sınır:** Bu çalışma ortamında GitHub Pages adresi harici tarayıcıda açılıp gerçek cihaz ekran görüntüsüyle doğrulanamadı. Bu nedenle “Samsung Galaxy S25 üzerinde piksel seviyesinde görüntülendi”, “Safari’de çalıştı” veya “tüm bağlantılara tıklandı” iddiası yapılmamaktadır. Buna karşılık, aşağıdaki birçok bulgu doğrudan koddan kesin olarak doğrulanabilen kusurlardır. Canlı cihaz gerektiren konular ayrıca “canlı doğrulama gerekli” olarak işaretlenmiştir.

---

# 2. Yönetici kararı

## 2.1 Net sonuç

**MIC v29, geniş özellikli ve ciddi emek verilmiş bir beta analiz laboratuvarıdır; ancak mevcut hâliyle finansal okuryazarlığı düşük veya orta seviyedeki kullanıcıya işlem kararı üreten güvenli bir ürün değildir.**

### Yayın kararı

| Kullanım | Karar |
|---|---|
| Portföyü ve gecikmeli fiyatları görüntüleme | Koşullu kullanılabilir |
| Eğitim ve grafik inceleme | Uyarılarla kullanılabilir |
| Sanal portföy denemesi | Veri eksikliği açık gösterilirse kullanılabilir |
| Gerçek portföy için otomatik AL/TUT/AZALT/SAT | **YAYINLANMAMALI** |
| Lot bazlı satış yönlendirmesi | **DERHÂL KAPATILMALI** |
| Profesyonel yatırım terminali olarak kullanım | **UYGUN DEĞİL** |
| Finansal okuryazarlığı düşük kullanıcıya açık genel yayın | **NO-GO** |

## 2.2 Denetim puanları

Bu puanlar nicel performans testi değil, kod ve ürün riski üzerinden profesyonel denetim görüşüdür.

| Alan | Puan | Karar |
|---|---:|---|
| Özellik kapsamı | 8/10 | Güçlü |
| Veri kaynağını açıklama | 6/10 | İyi yönde |
| Yatırımcı profil modeli | 6/10 | Temel olarak makul |
| Finansal karar güvenliği | **2/10** | Kritik yetersiz |
| Temettü yatırımcısı desteği | **1/10** | Yok denecek kadar az |
| Mobil kullanılabilirlik | 5/10 | Aşırı yoğun |
| Desktop kullanılabilirlik | **3/10** | Navigasyon kusurlu |
| Tablet uyumu | **2/10** | Kritik navigasyon riski |
| Erişilebilirlik | **2/10** | Yetersiz |
| PWA/offline dayanıklılığı | 4/10 | Kırılgan |
| Kod mimarisi / sürdürülebilirlik | **2/10** | Patch yığını |
| Güncel regresyon testi | **2/10** | Kanıt yok |
| Genel production-readiness | **3/10** | Yayına hazır değil |

---

# 3. Kritik öncelik sınıfları

- **P0 — Bloker:** Yanlış finansal karara, veri kaybına veya ana akışın kullanılamamasına yol açabilir. Yayın öncesi çözülmelidir.
- **P1 — Yüksek:** Güven, doğruluk, performans veya sürdürülebilirliği ciddi biçimde bozar.
- **P2 — Orta:** Kullanıcı deneyimi, erişilebilirlik veya kaliteyi düşürür.
- **P3 — İyileştirme:** Ürünü olgunlaştırır ancak tek başına yayın blokajı değildir.

---

# 4. P0 — Yayını bloke eden kritik bulgular

## MIC-P0-001 — Konsantrasyon sınırı doğrudan satış emrine çevriliyor

**Adres:** `mic/app-main.js` → `decision()`  
**Kesinlik:** Kodla doğrulandı  
**Etkilenen kullanıcı:** Tüm kullanıcılar; özellikle başlangıç ve temettü yatırımcısı

### Mevcut davranış

Pozisyon ağırlığı:

```text
weight > cap + rebalanceBand
```

olduğunda sistem:

1. Pozisyonu yumuşak sınırın kenarına değil ana hedef ağırlığa düşürüyor.
2. Satılacak lotu yukarı yuvarlıyor.
3. “DENGELE / AZALT” başlığı altında açık lot satışı yazıyor.

Bu nedenle TUPRS için 59 lot, AYES için 1.073 lot azalt gibi sonuçlar oluşuyor.

### Neden kritik?

- Portföy ağırlığı şirketin yatırım tezinin bozulduğunu göstermez.
- Temettü stratejisi, lot biriktirme tercihi ve kullanıcı niyeti dikkate alınmıyor.
- Uygulama “yatırım tavsiyesi değildir” yazsa bile kullanıcıya doğrudan işlem miktarı veriyor.
- Finansal okuryazarlığı düşük kullanıcı bunu matematiksel senaryo değil satış emri olarak algılar.
- Kazanan pozisyonların mekanik budanmasına ve gereksiz vergi/komisyon/fırsat maliyetine yol açabilir.

### Gerekli düzeltme

Varsayılan motor:

```text
Şirket kararı
Temettü sağlığı
Konsantrasyon durumu
Kullanıcı eylemi
```

olmak üzere dört ayrı sonuç üretmelidir.

Ağırlık tek başına yalnızca:

```text
KONSANTRASYON UYARISI — SATIŞ SİNYALİ DEĞİLDİR
```

üretmelidir.

Lot hesabı ancak kullanıcı:

```text
Konsantrasyonu azaltma senaryosunu hesapla
```

düğmesine açıkça basarsa gösterilmelidir.

### Kabul kriteri

- Ağırlık aşımı hiçbir testte kendiliğinden “sat”, “azalt” veya lot sayısı üretmemeli.
- TUPRS %14,11 ve AYES %15,73 örneklerinde varsayılan sonuç satış olmamalı.
- Kullanıcı stratejisi tanımlanmamışsa “STRATEJİ BELİRLENMEDİ” gösterilmeli.
- Lot hesabı tavsiye değil matematiksel senaryo olarak etiketlenmeli.

---

## MIC-P0-002 — Fiyatı bulunmayan pozisyon sıfır değer sayılıyor ve diğer ağırlıkları şişiriyor

**Adres:** `mic/price-integrity-v18.js` → `portfolioStats()`  
**Kesinlik:** Kodla doğrulandı  
**Etkilenen kullanıcı:** Gerçek portföy kullanan herkes

### Mevcut davranış

Fiyat yoksa:

```text
valueTRY = 0
```

oluyor. Portföy toplamı yalnızca fiyatı bulunan hisseler üzerinden hesaplanıyor. Böylece fiyatı eksik pozisyonlar portföyden yokmuş gibi davranılıyor.

### Örnek

Gerçek portföy:

```text
A hissesi: 100.000 TL
B hissesi: 100.000 TL fakat fiyat verisi eksik
```

Sistem gerçek ağırlık %50 yerine A hissesini %100 gösterebilir. Ardından otomatik “azalt” mekanizması devreye girebilir.

### Neden kritik?

Bu, yalnızca görsel hata değil; doğrudan yanlış satış önerisi üretebilen veri bütünlüğü kusurudur.

### Gerekli düzeltme

Fiyatı eksik tek bir pozisyon bile varsa:

- Kesin portföy ağırlığı hesaplanmamalı.
- “PORTFÖY AĞIRLIĞI HESAPLANAMADI” gösterilmeli.
- Konsantrasyon ve lot kararı kilitlenmeli.
- Son bilinen fiyat kullanılacaksa açık tarih ve “tahmini” etiketiyle kullanıcı onayı alınmalı.
- Alternatif olarak kullanıcı broker fiyatını manuel doğrulayabilmeli.

### Kabul kriteri

- Eksik fiyatlı portföyde hiçbir AL/AZALT/SAT kararı üretilmemeli.
- Toplam değer “kısmi” olarak işaretlenmeli.
- Ağırlık yüzdeleri gizlenmeli veya güven aralığıyla gösterilmeli.

---

## MIC-P0-003 — `/mic-desktop/` 820 px ve altında navigasyonsuz kalıyor

**Adres:** `mic-desktop/index.html`, `mic-desktop/desktop.css`  
**Kesinlik:** Kodla doğrulandı  
**Etkilenen platform:** Tablet, dar pencere, küçük laptop, split-screen

### Mevcut davranış

Desktop sayfasında navigasyon yalnızca `.sideNav` içindedir. CSS 820 px altında sidebar’ı gizliyor ve `.bottom` navigasyonu göstermeye çalışıyor.

Fakat desktop HTML’de `.bottom` navigasyonu bulunmuyor.

### Sonuç

- Sidebar kayboluyor.
- Alt navigasyon yok.
- Kullanıcı bulunduğu sayfadan başka sayfaya geçemiyor.
- Tablet deneyimi fiilen kilitleniyor.

### Gerekli düzeltme

Tek bir ortak navigasyon bileşeni kullanılmalı:

- Büyük ekran: sidebar görünümü
- Küçük ekran: aynı veri kaynağından alt menü veya hamburger
- Route kayıt sistemi dinamik modülleri de desteklemeli

### Kabul kriteri

Aşağıdaki genişliklerde tüm sayfalara erişilebilmeli:

```text
360, 390, 412, 768, 820, 1024, 1366, 1920 px
```

---

## MIC-P0-004 — Teknik Yöntemler modülü desktop’ta null-reference hatasına açık

**Adres:** `mic/technical-methods-v27.js` → `boot()`  
**Kesinlik:** Kodla doğrulandı  
**Etkilenen platform:** `/mic-desktop/`

### Mevcut davranış

Kod:

```javascript
let navb = document.querySelector('.bottom');
navb.querySelector(...)
```

mantığında çalışıyor. Desktop sayfasında `.bottom` olmadığı için `navb` null olur.

### Olası sonuç

- Uncaught TypeError
- Yöntemler navigasyonu eklenmez
- Sonraki v28/v29 eklentileri eksik veya tutarsız yüklenebilir
- Kullanıcı desktop’ta özelliğe erişemez

### Gerekli düzeltme

- Mobil ve desktop için ortak `registerRoute()` / `registerNavigationItem()` API’si kurulmalı.
- DOM sınıfı arayarak navigasyon eklemek yasaklanmalı.
- Her dinamik modül yüklenirken null-safe ve idempotent olmalı.

### Kabul kriteri

- Console’da sıfır uncaught error.
- “Yöntemler” hem mobil hem desktop navigasyonda görünmeli.
- Sayfa yenileme ve tekrar modül yüklemede çift menü oluşmamalı.

---

## MIC-P0-005 — Halka arz modülü profile bağlı olmayan kişisel “KATIL / AL” kararı yayımlıyor

**Adres:** `mic/data/ipo-calendar.json`, `mic/ipo-calendar-v26.js`  
**Kesinlik:** Kodla doğrulandı  
**Etkilenen kullanıcı:** Tüm kullanıcılar

### Mevcut davranış

Statik JSON içinde:

- `KATIL`
- `SINIRLI KATIL`
- `22,50 USD ALTI SINIRLI AL`
- önerilen lot
- azami bütçe

gibi doğrudan kararlar bulunuyor.

Bunlar:

- Kullanıcının güncel RP-14 profiline bağlı değil.
- Portföy değiştiğinde yeniden hesaplanmıyor.
- Bazı kararlar yalnızca belirli bir kullanıcının sepetine göre yazılmış.
- Güncel tarih ve izahname değişikliğine otomatik bağlanmıyor.

### Neden kritik?

Ana uygulama “profil tamamlanmadan karar üretmez” derken, halka arz ekranı profilsiz ve statik karar veriyor. Bu ürün içinde ciddi güven ve yönetişim çelişkisidir.

### Gerekli düzeltme

Takvim yalnızca doğrulanmış gerçekleri göstermeli:

- Tarih
- Fiyat
- Arz miktarı
- Dağıtım
- Resmî kaynak
- Veri güncellik durumu

Karar katmanı ayrı ve dinamik olmalı:

```text
Profil yok → KARAR ÜRETİLEMEZ
Portföy eksik → KONSANTRASYON ETKİSİ HESAPLANAMAZ
Resmî belge eski → VERİ DOĞRULAMA GEREKLİ
```

### Kabul kriteri

Statik veri dosyasında kullanıcıya özgü “al/katıl” ve bütçe bulunmamalı.

---

## MIC-P0-006 — v29 için güncel uçtan uca regresyon testi kanıtı yok

**Adres:** Test ve yayın süreci  
**Kesinlik:** Mevcut dosyalardan doğrulandı  
**Etkilenen alan:** Tüm ürün

Mevcut test raporu v7 içindir. O tarihten sonra:

- RP-14
- veri bütünlüğü
- katalog
- Nasdaq
- kripto gateway
- gelişmiş grafik
- IPO
- teknik yöntemler v27-v29
- çok sayıda dinamik patch

eklenmiştir.

v7 testinin “tarayıcı hatası 0” sonucu v29 için geçerli kabul edilemez.

### Gerekli düzeltme

Playwright veya eşdeğeriyle en az:

- mobil
- desktop
- tablet
- offline
- cache update
- storage migration
- eksik veri
- yanlış saat
- modül 404
- portföy ağırlığı
- temettü stratejisi

testleri otomatik çalışmalıdır.

### Kabul kriteri

Her release commit’inde CI test raporu ve ekran görüntüsü artefaktı oluşmalı.

---

# 5. P1 — Yüksek öncelikli ürün ve teknik kusurlar

## MIC-P1-001 — v12 HTML üzerine v29 patch yığını bindiriliyor

### Durum

HTML, CSS ve ana script etiketleri v12 olarak duruyor. `chart-workspace-v10.js` dosyası ise adı v10 olmasına rağmen v29 uyumluluk yükleyicisi gibi çalışıyor.

### Risk

- Gerçek sürümün hangi dosyada olduğu anlaşılmıyor.
- Bir patch eski fonksiyonu ezebilir.
- Script yükleme sırası değişirse davranış değişebilir.
- Hata ayıklama güçleşir.
- Eski cache ile yeni runtime karışabilir.
- Yeni geliştirici yanlış dosyayı değiştirir.

### Düzeltme

v30’da:

- Tek güncel HTML
- Tek uygulama giriş dosyası
- Modüler import
- Tek sürüm manifesti
- Patch/monkey-patch katmanlarının kaldırılması

gereklidir.

---

## MIC-P1-002 — Dinamik script yükleyicisinde hata yönetimi yok

`addScript()` yalnızca `onload` kullanıyor; `onerror` ve merkezi durum kaydı yok.

### Sonuç

Bir dosya 404 veya ağ hatası verirse:

- Bağımlı zincir durabilir.
- Kullanıcı hangi modülün eksik olduğunu bilmez.
- Uygulamanın bir bölümü v12, bir bölümü v29 kalabilir.
- “Uygulama açıldı” görüntüsü altında gizli kısmi arıza oluşur.

### Düzeltme

- Her modül durumunu gösteren dependency health ekranı
- Timeout
- onerror
- retry
- critical/non-critical ayrımı
- last-known-good sürüme dönüş

---

## MIC-P1-003 — Service worker kurulumu tek dosya hatasında tamamen başarısız olabilir

`cache.addAll(CORE)` atomik davranır. Listedeki tek bir dosya bulunmazsa install reddedilebilir.

### Düzeltme

- Dosyaları ayrı ayrı cache et
- Başarısız dosyaları raporla
- Kritik çekirdek ve opsiyonel modülleri ayır
- Yeni sürümü ancak çekirdek health-check geçerse aktive et

---

## MIC-P1-004 — Service worker 404/500 cevabını da cache edebilir

Network-first akış yalnızca fetch exception olduğunda cache’e düşüyor. HTTP 404/500 teknik olarak başarılı fetch cevabıdır ve cache’e yazılabilir.

### Düzeltme

```javascript
if (!response.ok) throw ...
```

kontrolü eklenmeli ve bozuk yanıt son bilinen iyi cache’in üzerine yazılmamalıdır.

---

## MIC-P1-005 — Mobil alt menü sekiz öğe ile 448 px minimum genişliğe ulaşıyor

### Mevcut yapı

- Temel menü: 6 öğe
- IPO sonrası: 7
- Yöntemler sonrası: 8
- Her öğe minimum 56 px
- 360–412 px telefonlarda yatay kaydırma gerekiyor
- Metin 8–9 px’e düşüyor

### Risk

- Son menüler görünmeden kalabilir.
- Kullanıcı yatay kaydırılabildiğini anlamaz.
- Dokunma hedefleri küçüktür.
- “Yöntemler” ve “Ayarlar” kaybolmuş sanılabilir.
- Erişilebilirlik standardının altındadır.

### Düzeltme

En fazla beş ana sekme:

```text
Ana
Ara
Portföy
Analiz
Daha Fazla
```

IPO, yöntemler, profil ve ayarlar “Daha Fazla” altında düzenlenmelidir.

---

## MIC-P1-006 — Temettü yatırım stratejisi veri modelinde yok

Eksik alanlar:

- Pozisyon amacı
- Temettü geliri / temettü büyümesi
- DRIP tercihi
- Maliyet üzerinden verim
- Güncel temettü verimi
- Dağıtım oranı
- Serbest nakit akışı temettü karşılama oranı
- Temettü kesinti geçmişi
- Kullanıcının korumak istediği minimum lot
- Temettü gelir hedefi

### Sonuç

Uygulama TUPRS gibi bir çekirdek temettü pozisyonunu sıradan taktik hisseyle aynı değerlendiriyor.

---

## MIC-P1-007 — Bedelsiz, bölünme ve diğer kurumsal işlemler otomatik yönetilmiyor

### Eksik işlemler

- Bedelsiz sermaye artırımı
- Hisse bölünmesi
- Ters bölünme
- Bedelli sermaye artırımı
- Temettü
- Spin-off
- Birleşme/devir
- Kod değişikliği

### Risk

AYES gibi pozisyonlarda:

- lot
- maliyet
- kâr/zarar
- toplam getiri
- ağırlık

yanlış kalabilir.

### Düzeltme

Kurumsal işlem kayıt tablosu ve maliyet/lot düzeltme motoru kurulmalıdır.

---

## MIC-P1-008 — Portföy toplam getirisi temettüyü içermiyor

Mevcut açık K/Z yalnızca:

```text
(güncel fiyat - ortalama maliyet) × adet
```

üzerinden gidiyor.

### Eksikler

- Alınan temettüler
- Yeniden yatırılan temettüler
- Nakit temettü bakiyesi
- Vergi
- Komisyon
- Gerçekleşmiş K/Z
- Kur etkisi
- Toplam getiri

### Sonuç

Temettü yatırımcısının gerçek performansı yanlış görünür.

---

## MIC-P1-009 — Sanal portföy fiyat yoksa maliyeti güncel fiyat gibi kullanıyor

Bu davranış P&L’nin sıfır veya yapay stabil görünmesine neden olabilir.

### Düzeltme

Fiyat yoksa:

- pozisyon değeri “hesaplanamadı”
- toplam equity “kısmi”
- işlem engeli
- ağırlık kararı kilidi

olmalıdır.

---

## MIC-P1-010 — Sanal portföyde FX verisi yoksa eski sabit kur kullanılıyor

Fallback:

```text
USDTRY = 40
EURTRY = 44
```

Güncel piyasa snapshot’ı bundan ciddi biçimde farklı olabilir.

### Sonuç

BIST sanal işlemleri USD bazında hatalı değerlendirilebilir.

### Düzeltme

Kur yoksa işlem yapılmamalı; sabit varsayım kullanılmamalıdır.

---

## MIC-P1-011 — Hisse puanı temel analiz için aşırı basit

Kullanılan ana değişkenler:

- ROE
- gelir büyümesi
- F/K
- günlük değişim
- volatilite
- sabit makro puanı

### Sorunlar

- Sektöre göre F/K anlamı değişir.
- Banka, rafineri, holding, sanayi aynı formülle puanlanır.
- Borç yok.
- FCF yok.
- marj yok.
- sermaye yoğunluğu yok.
- kâr kalitesi yok.
- temettü yok.
- yönetim yok.
- veri dönemi yok.
- tek seferlik kalem yok.
- makro puan sabit.

### Sonuç

“MIC 75/100” gerçekte sağlam bir yatırım kalitesi ölçümü değildir.

### Düzeltme

Sektör bazlı modeller ve puan kalibrasyonu gerekir. Puan olasılık gibi gösterilmemelidir.

---

## MIC-P1-012 — “Veri güveni” veri doğruluğunu değil alan sayısını ölçüyor

Confidence, birkaç alanın mevcut olmasına göre artıyor. Bu:

- kaynağın güvenilirliği
- verinin yaşı
- dönem uyumu
- revizyon
- aykırı değer
- muhasebe kalitesi

anlamına gelmez.

### Düzeltme

“Veri kapsamı” ve “veri güvenilirliği” ayrılmalıdır.

---

## MIC-P1-013 — Sektör ve korelasyon konsantrasyonu yok

Uygulama tek hisse ağırlığını görür; fakat:

- EREGL
- CEMTS
- KOCMT
- AYES
- KARCL

gibi aynı temaya maruz pozisyonları toplam sektör riski olarak değerlendirmez.

### Düzeltme

- sektör
- alt sektör
- ülke
- para birimi
- faktör
- korelasyon

bazlı konsantrasyon ekranı eklenmelidir.

---

## MIC-P1-014 — Halka arz “Yenile” gerçek kaynakları taramıyor

Düğme yalnızca statik JSON’u yeniden indirir.

### Kullanıcı algısı

“Yenile” ifadesi KAP/SEC kontrol edildi sanısı yaratabilir.

### Düzeltme

Düğme adı:

```text
Kayıtlı takvimi yeniden yükle
```

olmalı veya gerçek backend doğrulaması kurulmalıdır.

---

## MIC-P1-015 — IPO veri dosyası tarihsel olarak eski kalabilir

JSON’un güncelleme tarihi 22 Temmuz’dur. Uygulamanın çalışma tarihi daha ileri olsa bile fiyat, kod veya işlem tarihi değişikliklerini otomatik teyit etmez.

### Düzeltme

- `verified_at`
- `source_document_date`
- `expires_at`
- `verification_status`

alanları zorunlu olmalıdır.

---

## MIC-P1-016 — IPO metodolojisi ile kaynak kalitesi tutarlı değil

Metodoloji “KAP/SPK/resmî” derken bazı kayıtlar haber/finans sitelerine dayanıyor.

### Düzeltme

Karar üreten alanlarda yalnızca:

- KAP
- SPK
- Borsa İstanbul
- SEC
- NYSE
- Nasdaq
- ihraççı izahnamesi

kullanılmalıdır.

---

## MIC-P1-017 — Teknik “kalite puanları” istatistiksel olarak kalibre edilmemiş

Örnekler:

- arz-talep kalite puanı
- formasyon 76/100
- order block durumu
- piyasa filtresi 0–100

### Risk

Başlangıç kullanıcı 76/100’ü “%76 başarı ihtimali” sanabilir.

### Düzeltme

Puan yerine:

```text
Kural eşleşmesi: 4/6
Teyit: yok
Backtest: yapılmadı
İstatistiksel başarı oranı: bilinmiyor
```

gösterilmelidir.

---

## MIC-P1-018 — Açılış aralığı ekranında örnek sayılar gerçek seviye gibi görünebilir

Günlük kapanışın ±%0,4’ü üzerinden örnek OR High/Low hesaplanıyor.

“ÖRNEK” etiketi olsa da finansal okuryazarlığı düşük kullanıcı bunu o günün açılış aralığı sanabilir.

### Düzeltme

Gerçek intraday veri yoksa fiyat rakamı hiç gösterilmemelidir. Yalnızca eğitim animasyonu kullanılmalıdır.

---

## MIC-P1-019 — Haftalık hacim profili gerçek volume-at-price değildir

Günlük toplam hacim, günün low-high aralığına eşit dağıtılıyor. Bu yöntem gerçek işlem fiyatı hacim dağılımını temsil etmez.

### Düzeltme

Başlık:

```text
Yaklaşık günlük-aralık hacim modeli
```

olmalı veya intraday veri olmadan POC/VAH/VAL gösterilmemelidir.

---

## MIC-P1-020 — Teknik yöntem sembol listesi portföyü kapsamıyor

Yöntemler modülü yalnızca 10 sabit sembol içeriyor. AYES ve portföydeki çoğu hisse seçilemiyor.

### Düzeltme

Sembol listesi güncel `market.assets` ve kullanıcının portföyünden dinamik gelmelidir.

---

## MIC-P1-021 — Gateway tokeni localStorage’da tutuluyor

### Risk

- Aynı origin’de çalışan tüm scriptler tokeni okuyabilir.
- XSS veya zararlı üçüncü taraf kodu tokeni sızdırabilir.
- Tarayıcı uzantıları görebilir.
- Kullanıcı başka cihazda yedekleyemez; silerse kaybeder.

### Düzeltme

Kullanıcı tarayıcısında kalıcı admin tokeni tutmak yerine:

- kısa ömürlü oturum tokeni
- backend proxy
- cihaz bazlı revocation
- minimum yetki

kullanılmalıdır.

---

## MIC-P1-022 — localStorage veri şeması v3 olarak kalmış, migration yok

v29 çalışırken storage anahtarı hâlâ eski sürüm adını taşır.

### Risk

- Eski veri alanları yeni kodla uyumsuz olabilir.
- Sessiz veri kaybı veya yanlış varsayılan değer oluşabilir.
- Geri dönüş mümkün değildir.

### Düzeltme

```text
schemaVersion
migrationLog
backupBeforeMigration
validation
```

zorunlu olmalıdır.

---

## MIC-P1-023 — localStorage büyümesi UI donmasına ve kota hatasına yol açabilir

Günlük geçmiş, intraday cache, portföy ve işlemler tek JSON içinde senkron kaydediliyor.

### Risk

- Her `save()` ana thread’i bloklar.
- 2.000 bar × çok varlık kota doldurabilir.
- `setItem` hatası yakalanmıyor.
- Kaydetme başarısız olsa bile kullanıcı fark etmeyebilir.

### Düzeltme

- IndexedDB
- cache boyutu limiti
- LRU temizleme
- hata bildirimi
- ayrı storage store’ları

---

## MIC-P1-024 — Nasdaq doğrudan tarayıcı çağrıları CORS/rate-limit nedeniyle güvenilir değildir

Kod hata yakalıyor; ancak ürün dili resmî Nasdaq kaydı bulunduğunda veri çalışacak izlenimi verebilir.

### Düzeltme

Tüm dış veri çağrıları kontrollü backend veya düzenli statik pipeline üzerinden yapılmalıdır.

---

## MIC-P1-025 — Kripto fiyatında 70 saniyelik bekleme var ve iptal yok

### Risk

Kullanıcı uygulamanın donduğunu sanabilir.

### Düzeltme

- 10–15 saniye kullanıcı timeout
- iptal düğmesi
- gateway wake-up durumu
- tekrar deneme
- son bilinen fiyat

---

# 6. P2 — Kullanılabilirlik, erişilebilirlik ve kalite kusurları

## MIC-P2-001 — 8–11 px metinler okunabilirlik sınırının altında

Özellikle:

- alt menü
- badge
- kaynak zamanı
- durum etiketleri
- IPO detayları

çok küçüktür.

### Düzeltme

Ana interaktif metin minimum 12–14 px; dokunma alanı minimum 44×44 px olmalıdır.

---

## MIC-P2-002 — Klavye odak görünümü yetersiz

`:focus-visible` sistemi yok. Keyboard kullanıcı hangi öğede olduğunu göremeyebilir.

---

## MIC-P2-003 — Toast mesajlarında `aria-live` yok

Ekran okuyucu kullanıcı işlem sonucunu duymayabilir.

---

## MIC-P2-004 — Renk tek başına anlam taşıyor

Yeşil/kırmızı:

- kâr/zarar
- iyi/kötü
- boğa/ayı
- durum

için yoğun kullanılıyor. Renk körlüğünde ayrım zorlaşır.

---

## MIC-P2-005 — Canvas grafiklerin erişilebilir tablo alternatifi yok

Ekran okuyucu grafik içeriğine erişemez.

### Düzeltme

Her grafiğe:

- son değer
- dönem getirisi
- min/max
- erişilebilir veri tablosu
- CSV indir

eklenmelidir.

---

## MIC-P2-006 — Browser geri/ileri düğmesi sayfa navigasyonunu takip etmiyor

`nav()` yalnızca DOM sınıfı değiştiriyor. URL/history yok.

### Sonuç

Mobil kullanıcı geri düğmesine bastığında uygulama içinde önceki sayfaya değil sayfadan çıkabilir.

---

## MIC-P2-007 — Derin bağlantı yok

Belirli:

- hisse
- grafik
- IPO
- yöntem
- portföy pozisyonu

URL ile açılamıyor.

---

## MIC-P2-008 — Portföy ekleme `prompt()` ile yapılıyor

### Sorun

- Mobilde kötü UX
- Alan açıklaması yok
- Hatalı ondalık ayırıcı
- Kurumsal işlem notu yok
- tarih yok
- komisyon yok

### Düzeltme

Tam form ve doğrulama ekranı kullanılmalıdır.

---

## MIC-P2-009 — Gerçek portföy pozisyonu düzenlenemiyor

Kullanıcı genellikle silip yeniden eklemek zorunda kalır.

### Gerekli özellikler

- lot düzenle
- maliyet düzenle
- işlem ekle
- bölünme uygula
- temettü kaydet
- not ekle

---

## MIC-P2-010 — Veri dışa aktarma ve yedekleme yok

Cihaz temizlenirse profil ve portföy kaybolabilir.

### Düzeltme

- JSON export/import
- CSV export
- şifreli yedek
- migration preview

---

## MIC-P2-011 — Veri silme geri alınamaz

“Cihaz verilerini temizle” öncesi otomatik yedek veya ikinci doğrulama yok.

---

## MIC-P2-012 — Chart x-axis etiketleri küçük ekranda üst üste gelebilir

Canvas sabit kenar boşlukları ve altı tarih etiketi kullanıyor. Küçük telefon, uzun sayı ve yüksek devicePixelRatio kombinasyonunda canlı test gereklidir.

### Düzeltme

Etiket yoğunluğu gerçek piksel genişliğine göre adaptif olmalıdır.

---

## MIC-P2-013 — Çok sayıda gösterge sayfayı aşırı uzatabilir

Her gösterge ayrı canvas paneli üretir. Birkaç gösterge seçildiğinde:

- yüksek scroll
- yüksek CPU
- çok redraw
- mobil jank

oluşabilir.

### Düzeltme

En fazla iki aktif alt panel; diğerleri sekmeli olmalıdır.

---

## MIC-P2-014 — Teknik jargon başlangıç kullanıcı için aşırı yoğun

Örnekler:

- POC
- VAH
- VAL
- FVG
- BOS
- breaker
- fakeout
- displacement
- ADX
- ATR

### Düzeltme

Kullanıcı seviyesi modu:

```text
Başlangıç
Standart
Gelişmiş
Profesyonel
```

eklenmelidir.

---

## MIC-P2-015 — “AL/SAT” grafik etiketleri başlangıç kullanıcıyı yönlendirebilir

Supertrend üzerinde doğrudan AL/SAT etiketi gösteriliyor.

### Düzeltme

```text
Gösterge dönüşü
Yukarı yön değişimi
Aşağı yön değişimi
```

gibi nötr ifade kullanılmalı.

---

## MIC-P2-016 — Mobilde arama tüm katalog üzerinde her tuşta çalışıyor

Binlerce Nasdaq kaydı üzerinde debounce olmadan filtreleme düşük performanslı cihazlarda gecikme yaratabilir.

### Düzeltme

- 200–300 ms debounce
- prefix index
- Web Worker
- sonuç sanallaştırma

---

## MIC-P2-017 — PWA manifest eksik

Eksikler:

- icons
- maskable icon
- id
- scope
- screenshots
- shortcuts
- categories

### Sonuç

Kurulum deneyimi ve cihaz görünümü zayıftır.

---

## MIC-P2-018 — Modül health ekranı yok

Kullanıcı uygulamanın:

- grafik
- Nasdaq
- crypto
- IPO
- yöntemler

modüllerinden hangisinin çalışmadığını göremez.

---

## MIC-P2-019 — Cihaz saati IPO durumunu etkileyebilir

Takvim açık/kapalı statüsünü cihaz saatinden hesaplar. Yanlış saat veya timezone yanlış durum gösterebilir.

### Düzeltme

Sunucu doğrulama zamanı kullanılmalı; cihaz saati sapması gösterilmelidir.

---

## MIC-P2-020 — “Yakın zamanlı snapshot” piyasa açık/kapalı durumunu bilmiyor

Beş dakika önce alınmış veri piyasa kapalıyken “yakın zamanlı” olabilir fakat anlık işlem yapılabilir fiyat değildir.

### Düzeltme

- piyasa takvimi
- seans durumu
- sembol bazlı timestamp
- trading halt
- gecikme türü

gösterilmelidir.

---

## MIC-P2-021 — CSP ve güvenlik başlıkları zayıf

GitHub Pages sınırlamaları altında bile meta CSP değerlendirilmeli. Dinamik gateway nedeniyle `connect-src` kontrollü yönetilmelidir.

---

## MIC-P2-022 — Hata raporu kullanıcıya indirilebilir değil

Bir hata olduğunda:

- sürüm
- modül durumları
- console özet
- storage schema
- veri timestamp
- cihaz bilgisi

tek dosya olarak alınamıyor.

---

# 7. Kullanıcı seviyesine göre risk analizi

## 7.1 Başlangıç seviyesi

### En büyük riskler

1. “MIC 75/100” ifadesini başarı ihtimali sanması
2. “DENGELE/AZALT 1.073 lot” mesajını emir gibi uygulaması
3. Teknik göstergedeki AL/SAT etiketlerini gerçek sinyal sanması
4. Örnek açılış seviyesini canlı fiyat sanması
5. Halka arz “KATIL” kararını kişisel tavsiye sanması
6. Snapshot fiyatı anlık fiyat sanması
7. Temettü hissesini yalnızca ağırlık nedeniyle satması

### Başlangıç modu zorunlu özellikleri

- İşlem fiili kullanmayan nötr dil
- Puan yerine veri kontrol listesi
- Tek ekranda en fazla üç ana mesaj
- “Bu neden satış sinyali değildir?” açıklaması
- Profil ve strateji tamamlanmadan karar kilidi
- Senaryo düğmesinden önce lot göstermeme
- Teknik yöntemleri varsayılan gizleme

### Mevcut uygunluk

**Uygun değil.**

---

## 7.2 Orta seviye / temettü yatırımcısı

### En büyük riskler

- Temettü ve toplam getiri hesaplanmıyor.
- DRIP stratejisi tanımlanamıyor.
- Kurumsal işlemler yok.
- Şirket tezi ve konsantrasyon kararı karışıyor.
- Maliyet üzerinden temettü verimi yok.
- Nakit akışı ve payout değerlendirmesi yok.

### Gerekli ekran

```text
Şirket tezi: Sağlam / İzlenmeli / Bozuldu
Temettü sağlığı: Güçlü / Orta / Riskli / Veri yetersiz
Konsantrasyon: Normal / Uyarı / Yüksek
DRIP tercihi: Aynı hisse / portföy geneli / nakit
```

### Mevcut uygunluk

**Temettü yatırımcısı için güvenilir değil.**

---

## 7.3 İleri seviye yatırımcı

### Beklentiler

- Ham veri
- Kaynak tarihi
- formül
- varsayım
- sektör karşılaştırması
- senaryo
- export
- kullanıcı tarafından ayarlanabilir eşikler

### Mevcut durum

Özellik sayısı yüksek; ancak modeller kalibre edilmediği ve mimari parçalı olduğu için ileri kullanıcı yanlış kesinlik hissedebilir.

### Mevcut uygunluk

**Araştırma sandbox’ı olarak kısmen uygun; işlem motoru olarak uygun değil.**

---

## 7.4 Profesyonel / kurumsal kullanıcı

### Eksikler

- Lisanslı gerçek zamanlı veri
- denetlenebilir model yönetişimi
- değişiklik kaydı
- dört göz kontrolü
- backtest
- model validation
- compliance
- kullanıcı yetkisi
- immutable audit log
- broker reconciliation
- kurumsal işlem feed’i
- risk attribution

### Mevcut uygunluk

**Uygun değil.**

---

# 8. Sayfa ve akış bazında inceleme

## 8.1 Açılış / Ana sayfa

### Olumlu

- Profil ve portföy durumu görünür.
- Snapshot durumu gösteriliyor.
- Gerçek/sanal portföy ayrımı var.

### Sorun

- HTML v12, çalışma sürümü v29.
- Dinamik kartlar yükleme sırasına bağlı.
- Halka arz kartı desktop’ta navigasyona tek alternatif olabilir.
- Modül arızası görünmez.

### Düzeltme

Ana sayfada “Sistem durumu” kartı:

```text
Çekirdek: Hazır
Piyasa verisi: 24 dk gecikmeli
Grafikler: Hazır
IPO: 2 gün önce doğrulandı
Intraday: Bağlı değil
```

---

## 8.2 Profil sayfası

### Olumlu

RP-14:

- risk isteği
- finansal kapasite
- deneyim

bileşenlerini ayırıyor ve sert uygunluk sınırları uyguluyor.

### Sorunlar

- Tek pozisyon limiti kullanıcı tarafından giriliyor fakat kullanıcı bunun hedef mi, yumuşak mı, sert mi olduğunu bilmiyor.
- Strateji bazlı limit yok.
- Pozisyon bazlı amaç yok.
- Profil sonucu ile varlık kararı arasındaki ilişki açıklansa da motor bunu doğru uygulamıyor.

### Düzeltme

Üç ayrı limit:

```text
Hedef dağılım
Yumuşak uyarı
Kritik konsantrasyon
```

ve her biri için açıklama.

---

## 8.3 Araştırma sayfası

### Olumlu

- Tür filtreleri
- geniş Nasdaq katalog
- alias araması
- fiyat kaynağı

### Sorunlar

- Çok geniş katalogda performans
- kimlik kaydı ile fiyat verisi ayrımı
- temel puanın yetersizliği
- profilden bağımsız teknik içerik yoğunluğu
- varlık türü bazlı model eksikliği

### Düzeltme

Sonuçlarda veri durumu ikonu:

```text
Kimlik
Fiyat
Grafik
Temel veri
Karar uygunluğu
```

---

## 8.4 Gerçek portföy

### Olumlu

- fiyat kaynağı ve tarih görünür
- broker bağlantısı olmadığı açık
- 26 pozisyon yükleme desteği

### Kritik sorunlar

- eksik fiyat sıfır değer
- otomatik azalt
- temettü yok
- kurumsal işlem yok
- edit yok
- yedek yok
- sektör riski yok

### Karar

**Mevcut gerçek portföy ekranı izleme için kullanılabilir; işlem kararı için kullanılamaz.**

---

## 8.5 Sanal portföy

### Olumlu

- gerçek paradan ayrı
- işlem geçmişi
- nakit
- P/L
- pozisyon limiti

### Sorunlar

- fiyat yoksa maliyet fallback
- sabit FX fallback
- komisyon/slippage yok
- emir zamanı yok
- borsa açık/kapalı kontrolü yok
- kurumsal işlem yok
- temettü yok

### Düzeltme

Sanal portföy “gerçekçi simülasyon” değilse açıkça:

```text
Basitleştirilmiş eğitim simülasyonu
```

olarak etiketlenmelidir.

---

## 8.6 Grafik sayfası

### Olumlu

- Mum/çizgi
- dönem
- haftalık/aylık aggregation
- intraday veri ayrımı
- BIST yapay intraday engeli
- çoklu gösterge

### Sorunlar

- küçük ekranda yoğun toolbar
- çoklu canvas performansı
- erişilebilirlik
- AL/SAT etiketi
- veri tarihi ile sinyal zamanı ayrımı
- grafik ve dönem kontrollerinin kavramsal karmaşası

### Düzeltme

Mobilde:

```text
Fiyat
Göstergeler
Detay
```

sekmesiyle sadeleştirilmelidir.

---

## 8.7 Teknik Yöntemler

### Olumlu

- veri sınırları hakkında uyarılar
- fakeout için teyit zinciri
- “garanti değil” dili
- günlük/intraday ayrımı

### Kritik sorun

- desktop navigasyon/crash
- sabit sembol listesi
- sentetik OR seviyeleri
- approximate volume profile
- kalibre edilmemiş kalite puanları
- başlangıç kullanıcı için aşırı jargon

### Karar

**Gelişmiş kullanıcıya yönelik deneysel laboratuvar olarak ayrı “Beta” alanında tutulmalıdır. Ana karar motoruna bağlanmamalıdır.**

---

## 8.8 Halka Arz Takvimi

### Olumlu

- BIST/ABD filtreleri
- tarih/fiyat/dağıtım
- kaynak bağlantısı
- açık/kapalı durumu

### Kritik sorun

- statik ve eski kalabilir
- “yenile” yanıltıcı
- profilesiz alım kararı
- kişisel portföy kararının statik dosyada bulunması
- kaynak kalite tutarsızlığı
- desktop sidebar girişi yok

### Karar

**Takvim olarak kullanılabilir; öneri motoru kapatılmalıdır.**

---

## 8.9 Ayarlar

### Olumlu

- veri durumu
- gateway
- temizleme

### Sorunlar

- yönetici ayarı normal kullanıcıya açık
- token storage riski
- fazla teknik bilgi
- export/import yok
- cache yönetimi yok
- hata tanılama yok

---

# 9. Platform uyumluluk matrisi

## 9.1 Kaynak koduna göre beklenen durum

| Platform | Beklenen durum | Kritik not |
|---|---|---|
| Android Chrome `/mic/` | Temel akış büyük ölçüde açılabilir | Alt menü yatay taşar |
| Samsung Internet `/mic/` | Canlı test gerekli | PWA ve backdrop-filter farkları |
| iPhone Safari `/mic/` | Canlı test gerekli | Install prompt yok, localStorage/PWA farkı |
| Windows Chrome `/mic-desktop/` >1180 px | Temel sidebar akışı muhtemelen çalışır | Yöntemler/IPO sidebar entegrasyonu eksik |
| Windows Edge `/mic-desktop/` >1180 px | Canlı test gerekli | Dinamik modül sırası |
| Tablet `/mic-desktop/` <=820 px | **Kritik arıza** | Navigasyon yok |
| Dar desktop pencere <=820 px | **Kritik arıza** | Navigasyon yok |
| Offline cold start | Garanti değil | `cache.addAll` kırılgan |
| Eski cache’den update | Riskli | v12 shell + v29 loader |

## 9.2 Zorunlu gerçek cihaz matrisi

- Samsung Galaxy S25 — Chrome
- Samsung Galaxy S25 — Samsung Internet
- iPhone 13/15 — Safari
- iPad — Safari portrait/landscape
- Windows 11 — Chrome
- Windows 11 — Edge
- 360×800
- 390×844
- 412×915
- 768×1024
- 820×1180
- 1024×768
- 1366×768
- 1920×1080

---

# 10. Zorunlu test senaryoları

## 10.1 Finansal güvenlik testleri

1. Ağırlık yumuşak sınırı %0,01 aşsın → satış çıkmamalı.
2. Ağırlık sert sınırı aşsın, tez sağlam → senaryo çıkmalı, emir çıkmamalı.
3. Bir pozisyonda fiyat eksik → tüm ağırlık kararları kilitlenmeli.
4. Temettü stratejisi seçili → DRIP tercihi korunmalı.
5. Temettü kesintisi → ayrı risk uyarısı.
6. Bedelsiz → lot ve maliyet otomatik düzelsin.
7. Sektör toplamı sınırı aşsın → sektör uyarısı.
8. IPO profili eksik → karar yok.
9. Statik veri süresi dolmuş → IPO önerisi gizlensin.
10. Fiyat 24 saat eski → işlem miktarı hesaplanmasın.

## 10.2 Fonksiyon testleri

- Profil oluştur/kaydet/yeniden aç
- Gerçek portföy ekle/düzenle/sil
- Sanal al/sat/reset
- tüm varlık türlerinde arama
- grafiğe geçiş
- dönem değiştirme
- gösterge ekle/çıkar
- IPO filtre/detay/link
- yöntemler tüm sekmeler
- gateway test
- veri temizleme
- export/import

## 10.3 Hata testleri

- `market.json` 404
- history 404
- CSS 404
- dinamik JS 404
- service worker eski sürüm
- localStorage bozuk JSON
- localStorage quota exceeded
- yanlış cihaz saati
- internet kesilmesi
- gateway timeout
- Nasdaq CORS
- boş portföy
- 500 pozisyon
- çok uzun şirket adı
- çok büyük fiyat
- küsuratlı lot

## 10.4 Görsel regresyon

Her çözünürlükte ekran görüntüsü karşılaştırması:

- metin taşması
- kart üst üste binmesi
- buton kırpılması
- grafik etiketi çakışması
- modal taşması
- alt menü görünürlüğü
- yatay scroll
- safe-area

---

# 11. Önerilen yeni finansal karar mimarisi

## 11.1 Pozisyon stratejisi

Her pozisyon için zorunlu:

```text
Temettü geliri
Temettü büyümesi
Uzun vadeli büyüme
Değer
Taktik
Spekülatif
Belirlenmedi
```

## 11.2 Dört bağımsız sonuç

### A. Şirket tezi

```text
Sağlam
İzlenmeli
Bozuldu
Veri yetersiz
```

### B. Gelir/temettü sağlığı

```text
Sürdürülebilir
İzlenmeli
Kesinti riski
Uygulanamaz
Veri yetersiz
```

### C. Konsantrasyon

```text
Normal
Yumuşak uyarı
Yüksek
Kritik
Hesaplanamadı
```

### D. Eylem

```text
Tut
Yeni nakit ekleme
Organik dengele
Temettü planını sürdür
İnceleme gerekli
Senaryo hesapla
Tez bozulduğu için azaltmayı değerlendir
```

## 11.3 Yasaklı otomatik davranışlar

- Ağırlıktan otomatik lot satışı
- Eksik veriyle karar
- Statik dosyadan kişisel alım kararı
- Temel veri yokken teknik sinyalle AL
- “kalite puanı”nı başarı ihtimali gibi göstermek

---

# 12. Önerilen düzeltme yol haritası

## Faz 0 — Acil güvenlik kilidi

1. `DENGELE/AZALT` otomatik lot çıktısını kapat.
2. Eksik fiyat varsa ağırlık kararını kilitle.
3. IPO “KATIL/AL” alanlarını gizle.
4. Desktop <=820 navigasyonunu düzelt.
5. Teknik yöntemler desktop null hatasını düzelt.
6. Uygulama üstüne “Beta — işlem emri üretmez” güvenlik bandı ekle.

**Faz 0 tamamlanmadan yeni özellik eklenmemeli.**

## Faz 1 — Veri ve strateji doğruluğu

1. Pozisyon stratejisi
2. Temettü/DRIP
3. Kurumsal işlem
4. toplam getiri
5. sektör konsantrasyonu
6. veri eksikliği karar kapısı
7. gerçek IPO verification pipeline

## Faz 2 — Mimari refactor

1. v12 shell + patch yığınını kaldır
2. tek v30 uygulama
3. route registry
4. modül health
5. IndexedDB
6. schema migration
7. güvenli service worker
8. export/import

## Faz 3 — UX ve erişilebilirlik

1. beş ana navigasyon
2. kullanıcı seviyesi modu
3. 44 px touch target
4. 14 px minimum metin
5. keyboard/focus
6. aria-live
7. chart table
8. deep link/history
9. tablet layout

## Faz 4 — Yayın doğrulaması

1. otomatik E2E
2. visual regression
3. accessibility audit
4. performance budget
5. security test
6. finansal model validation
7. release checklist

---

# 13. Kesin kabul kapıları

MIC gerçek kullanıcıya karar desteği olarak sunulmadan önce:

- [ ] Konsantrasyon tek başına satış üretmiyor.
- [ ] Eksik fiyat karar motorunu kilitliyor.
- [ ] Temettü stratejisi tanımlanabiliyor.
- [ ] Kurumsal işlemler işleniyor.
- [ ] IPO verisi güncellik doğrulaması taşıyor.
- [ ] Desktop/tablet navigasyonu çalışıyor.
- [ ] Mobil menü yatay kaydırma gerektirmiyor.
- [ ] v29 veya sonraki sürüm için E2E raporu var.
- [ ] PWA update rollback testi geçti.
- [ ] localStorage migration/export hazır.
- [ ] Tüm puanların ne anlama geldiği açıklanıyor.
- [ ] Başlangıç modunda teknik jargon ve AL/SAT etiketleri gizli.
- [ ] Tüm kararlar kullanılan veri ve tarih ile açıklanıyor.
- [ ] Hiçbir statik JSON kişisel yatırım tavsiyesi taşımıyor.

---

# 14. Son hüküm

MIC’in en büyük problemi özellik eksikliği değildir. Tam tersine, ürün çok hızlı biçimde genişlemiş; fakat **finansal karar güvenliği, mimari bütünlük ve güncel regresyon testi özellik artışının gerisinde kalmıştır.**

En tehlikeli nokta:

> Uygulama bazı ekranlarda veri sınırlarını dürüstçe açıklarken, başka bir ekranda yalnızca portföy ağırlığı nedeniyle kesin lot azaltma mesajı üretmektedir.

Bu çelişki kullanıcı güvenini yıkar ve finansal okuryazarlığı düşük kullanıcıyı sağlıksız işlemlere yönlendirebilir.

## Nihai karar

**Mevcut v29: NO-GO — gerçek para için otomatik karar motoru olarak yayınlanmamalıdır.**

Şu koşulla beta kullanılabilir:

- Otomatik AL/AZALT/SAT kapatılır.
- Ürün “portföy görüntüleme, eğitim ve analiz sandbox’ı” olarak sunulur.
- Eksik veri ve model sınırları açıkça gösterilir.
- Kritik P0 maddeleri kapatılır.

Yeni özellik geliştirmeden önce ürünün güvenlik ve mimari borcu temizlenmelidir.
