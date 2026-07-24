from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import requests

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "mic" / "data" / "supplemental-assets.json"
HISTORY_DIR = ROOT / "mic" / "data" / "history"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
}


def finite(value):
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def fetch_history(provider_symbol: str) -> list[dict]:
    encoded = quote(provider_symbol, safe="")
    last_error = "unknown error"
    for host in ("query1.finance.yahoo.com", "query2.finance.yahoo.com"):
        try:
            response = requests.get(
                f"https://{host}/v8/finance/chart/{encoded}",
                params={"range": "1y", "interval": "1d", "events": "div,splits"},
                headers=HEADERS,
                timeout=30,
            )
            response.raise_for_status()
            chart = response.json().get("chart", {})
            if chart.get("error"):
                raise RuntimeError(str(chart["error"]))
            result = (chart.get("result") or [None])[0]
            if not result:
                raise RuntimeError("empty chart result")
            timestamps = result.get("timestamp") or []
            quote_data = ((result.get("indicators") or {}).get("quote") or [{}])[0]
            opens = quote_data.get("open") or []
            highs = quote_data.get("high") or []
            lows = quote_data.get("low") or []
            closes = quote_data.get("close") or []
            volumes = quote_data.get("volume") or []
            rows = []
            for i, timestamp in enumerate(timestamps):
                close = finite(closes[i] if i < len(closes) else None)
                if close is None:
                    continue
                rows.append(
                    {
                        "date": datetime.fromtimestamp(timestamp, timezone.utc).date().isoformat(),
                        "open": finite(opens[i] if i < len(opens) else None),
                        "high": finite(highs[i] if i < len(highs) else None),
                        "low": finite(lows[i] if i < len(lows) else None),
                        "close": close,
                        "volume": finite(volumes[i] if i < len(volumes) else None),
                    }
                )
            if len(rows) < 20:
                raise RuntimeError(f"only {len(rows)} valid rows")
            return rows[-270:]
        except Exception as exc:  # noqa: BLE001
            last_error = f"{host}: {exc}"
    raise RuntimeError(last_error)


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    failures = []
    updated = 0
    for asset in catalog.get("assets", []):
        if asset.get("type") not in {"stock", "etf"}:
            continue
        symbol = str(asset.get("symbol") or "").upper().strip()
        provider_symbol = str(asset.get("provider_symbol") or symbol).strip()
        if not symbol or not provider_symbol:
            continue
        try:
            history = fetch_history(provider_symbol)
            payload = {
                "symbol": symbol,
                "provider_symbol": provider_symbol,
                "provider": "Yahoo Finance chart feed",
                "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "history": history,
            }
            path = HISTORY_DIR / f"{symbol}.json"
            path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            updated += 1
            print(f"{symbol}: {len(history)} rows")
        except Exception as exc:  # noqa: BLE001
            failures.append(f"{symbol}: {exc}")
            print(f"{symbol}: ERROR {exc}")
    print(f"updated={updated} failed={len(failures)}")
    if updated == 0:
        raise RuntimeError("no supplemental histories were updated")


if __name__ == "__main__":
    main()
