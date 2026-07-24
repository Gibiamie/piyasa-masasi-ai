# MIC Market Gateway

MIC'in mobil ve laptop arayüzleri statik GitHub Pages üzerinde çalışır. Piyasa verisi sağlayıcılarının gizli anahtarları tarayıcıya konulamaz. Bu servis, sağlayıcı anahtarlarını sunucuda tutan merkezi veri geçididir.

## Desteklenen veri yolları

| Piyasa | Sağlayıcı | 1 saat | 4 saat | Veri sınıfı |
|---|---|---:|---:|---|
| ABD hisse/ETF | Alpaca Market Data | Sağlayıcıdan 1h | Gerçek 1h barlardan OHLCV toplama | `PROVIDER_NATIVE_BAR` / `AGGREGATED_FROM_1H` |
| Kripto | CCXT + seçilen borsa | Borsa destekliyorsa doğal 1h | Doğal 4h; yoksa gerçek 1h barlardan toplama | `PROVIDER_NATIVE_BAR` / `AGGREGATED_FROM_1H` |
| BIST | Lisanslı BIST dağıtıcısı/alt dağıtıcısı | Sağlayıcı sözleşmesine göre | Sağlayıcı sözleşmesine göre | `PROVIDER_NATIVE_BAR` |

BIST lisanslı sağlayıcısı yapılandırılmamışsa servis `BIST_LICENSED_PROVIDER_REQUIRED` döndürür. `tvDatafeed` bu herkese açık ağ geçidinde kullanılmaz.

## Güvenlik

- Alpaca anahtarları yalnızca sunucunun çevresel değişkenlerindedir.
- Tarayıcıya API secret gönderilmez.
- CORS yalnızca `ALLOWED_ORIGINS` listesindeki alan adlarına açılır.
- İsteğe bağlı `MIC_GATEWAY_TOKEN` ile istemci–sunucu erişimi korunur.
- IP başına dakikalık oran sınırı uygulanır.
- BIST uç noktası lisanslı sağlayıcı olmadan açılmaz.

## Çalıştırma

```bash
cd backend/market-gateway
cp .env.example .env
npm install
npm start
```

Node.js 20 veya üzeri gerekir. `.env` dosyası GitHub'a yüklenmemelidir.

## API

```text
GET /api/v1/bars?market=US&symbol=LUNR&interval=1h&limit=500
GET /api/v1/bars?market=US&symbol=LUNR&interval=4h&limit=2000
GET /api/v1/bars?market=CRYPTO&symbol=BTC/USDT&interval=4h&limit=500
GET /api/v1/bars?market=BIST&symbol=THYAO&interval=1h&limit=500
```

Örnek yanıt:

```json
{
  "market": "US",
  "symbol": "LUNR",
  "interval": "4h",
  "provider": "ALPACA",
  "feed": "iex",
  "data_class": "AGGREGATED_FROM_1H",
  "source_interval": "1h",
  "delayed_or_limited": true,
  "bars": [],
  "generated_at": "2026-07-18T00:00:00.000Z",
  "manipulation": false
}
```

## Üretim kararı

Alpaca Basic kişisel/teknik beta için IEX kapsamıyla kullanılabilir. Herkese açık çok kullanıcılı dağıtım için sağlayıcı sözleşmesi ve uygun partner planı ayrıca doğrulanmalıdır. BIST intraday veri yalnızca lisanslı dağıtıcı/alt dağıtıcı ile etkinleştirilmelidir.
