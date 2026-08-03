# AI Altyapısı Piyasa Bülteni

MIC'ten bağımsız, AI altyapısı temalı günlük piyasa araştırma uygulaması.

## Canlı adres

`https://gibiamie.github.io/piyasa-masasi-ai/ai-infrastructure-bulletin/`

## Özellikler

- Son 24 saatin maddi AI altyapısı haberleri
- Veri merkezi, enerji, GPU, soğutma, nükleer ve bulut tema filtreleri
- Kaynak ve güven seviyesi
- Pozitif / nötr / negatif / yüksek belirsizlik araştırma görüşü
- BIST, Nasdaq, NYSE ve AMEX için 15 dakikalık periyodik fiyat snapshot katmanı
- 1 gün–2 yıl aralıkları, çizgi/mum görünümü, hacim ve dönem yüksek/düşük/getiri özeti
- Portföy ortalama maliyet çizgisi ile alış/satış işaretleri
- TradingView işlem içi grafik sekmesi
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

Haber taraması Google News RSS üzerinden üretilir. Günlük OHLC geçmişi Yahoo Finance grafik akışından; periyodik BIST snapshot'ı MIC/TradingView tarayıcısından; ABD snapshot'ları Nasdaq.com tarayıcısından alınır. Her varlıkta kaynak, son fiyat zamanı ve veri seviyesi gösterilir. Uygulama kişiselleştirilmiş yatırım danışmanlığı veya otomatik işlem emri üretmez.
