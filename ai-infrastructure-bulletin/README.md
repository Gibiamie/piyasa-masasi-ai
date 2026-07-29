# AI Altyapısı Piyasa Bülteni

MIC'ten bağımsız, AI altyapısı temalı günlük piyasa araştırma uygulaması.

## Canlı adres

`https://gibiamie.github.io/piyasa-masasi-ai/ai-infrastructure-bulletin/`

## Özellikler

- Son 24 saatin maddi AI altyapısı haberleri
- Veri merkezi, enerji, GPU, soğutma, nükleer ve bulut tema filtreleri
- Kaynak ve güven seviyesi
- Pozitif / nötr / negatif / yüksek belirsizlik araştırma görüşü
- 1 gün, 21 ve 252 işlem günü fiyat performansı
- 52 haftalık zirveye uzaklık
- Cihaz bazlı takip listesi düzenleme
- Günlük GitHub Actions güncellemesi
- PWA ve son veriyi çevrimdışı görüntüleme

## Yerel test

```bash
python -m unittest discover -s tests -v
node --check app.js
python scripts/update_bulletin.py
```

Haber taraması Google News RSS, fiyat performansı Stooq günlük CSV üzerinden üretilir. Uygulama kişiselleştirilmiş yatırım danışmanlığı veya otomatik işlem emri üretmez.
