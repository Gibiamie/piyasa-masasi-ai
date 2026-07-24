from __future__ import annotations

import json
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import requests

ROOT = Path(__file__).resolve().parents[1]
MARKET = ROOT / "mic" / "data" / "market.json"
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


def yahoo_symbol(asset: dict) -> str | None:
    symbol = str(asset.get("symbol") or "").upper().strip()
    if not symbol:
        return None
    exchange = str(asset.get("exchange") or "").upper()
    asset_type = str(asset.get("type") or "").lower()
    if exchange == "BIST":
        return f"{symbol}.IS"
    if asset_type == "crypto":
        return f"{symbol}-USD"
    if asset_type == "fx":
        return {"USDTRY": "TRY=X", "EURTRY": "EURTRY=X"}.get(symbol)
    if asset_type == "commodity":
        return {"XAUUSD": "GC=F", "XAGUSD": "SI=F"}.get(symbol)
    if asset_type in {"stock", "etf", "index", "fund"}:
        return symbol
    return None


def fetch_yahoo(asset: dict) -> dict:
    symbol = str(asset.get("symbol") or "").upper().strip()
    provider_symbol = yahoo_symbol(asset)
    if not provider_symbol:
        raise RuntimeError("unsupported asset mapping")
    encoded = quote(provider_symbol, safe="")
    last_error = "unknown error"
    for host in ("query1.finance.yahoo.com", "query2.finance.yahoo.com"):
        url = f"https://{host}/v8/finance/chart/{encoded}"
        try:
            response = requests.get(
                url,
                params={"range": "1y", "interval": "1d", "events": "div,splits"},
                headers=HEADERS,
                timeout=25,
            )
            response.raise_for_status()
            payload = response.json().get("chart", {})
            if payload.get("error"):
                raise RuntimeError(str(payload["error"]))
            result = (payload.get("result") or [None])[0]
            if not result:
                raise RuntimeError("empty chart result")
            timestamps = result.get("timestamp") or []
            quote_data = ((result.get("indicators") or {}).get("quote") or [{}])[0]
            opens = quote_data.get("open") or []
            highs = quote_data.get("high") or []
            lows = quote_data.get("low") or []
            closes = quote_data.get("close") or []
            volumes = quote_data.get("volume") or []
            history = []
            for i, ts in enumerate(timestamps):
                close = finite(closes[i] if i < len(closes) else None)
                if close is None:
                    continue
                history.append(
                    {
                        "date": datetime.fromtimestamp(ts, timezone.utc).date().isoformat(),
                        "open": finite(opens[i] if i < len(opens) else None),
                        "high": finite(highs[i] if i < len(highs) else None),
                        "low": finite(lows[i] if i < len(lows) else None),
                        "close": close,
                        "volume": finite(volumes[i] if i < len(volumes) else None),
                    }
                )
            if len(history) < 20:
                raise RuntimeError(f"only {len(history)} valid rows")
            return {
                "symbol": symbol,
                "provider_symbol": provider_symbol,
                "provider": "Yahoo Finance chart feed",
                "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "history": history[-270:],
            }
        except Exception as exc:  # noqa: BLE001
            last_error = f"{host}: {exc}"
    raise RuntimeError(last_error)


def write_asset(asset: dict) -> tuple[str, bool, str]:
    symbol = str(asset.get("symbol") or "").upper().strip()
    try:
        data = fetch_yahoo(asset)
        path = HISTORY_DIR / f"{symbol}.json"
        text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        changed = not path.exists() or path.read_text(encoding="utf-8") != text
        if changed:
            path.write_text(text, encoding="utf-8")
        return symbol, changed, f"{len(data['history'])} rows"
    except Exception as exc:  # noqa: BLE001
        return symbol, False, f"ERROR {exc}"


def main() -> None:
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    market = json.loads(MARKET.read_text(encoding="utf-8"))
    assets_by_symbol = {}
    for asset in market.get("assets", []):
        symbol = str(asset.get("symbol") or "").upper().strip()
        if symbol and yahoo_symbol(asset):
            assets_by_symbol[symbol] = asset
    assets = [assets_by_symbol[symbol] for symbol in sorted(assets_by_symbol)]
    changed = 0
    failed = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(write_asset, asset): asset for asset in assets}
        for future in as_completed(futures):
            symbol, was_changed, message = future.result()
            changed += int(was_changed)
            if message.startswith("ERROR"):
                failed.append(f"{symbol}: {message}")
            print(symbol, message)
    print(f"symbols={len(assets)} changed={changed} failed={len(failed)}")
    if failed:
        print("\n".join(failed[:50]))
    if len(assets) and len(failed) == len(assets):
        raise RuntimeError("all history downloads failed")


if __name__ == "__main__":
    main()
