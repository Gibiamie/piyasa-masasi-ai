from __future__ import annotations

# MIC hourly OHLC cache for Portfolio Chart.
# Yahoo is fetched server-side by GitHub Actions so the browser never depends on cross-origin chart requests.
import json
import math
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import requests

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "ai-infrastructure-bulletin" / "data" / "equity-catalog.json"
HOURLY_DIR = ROOT / "mic" / "data" / "hourly"
STATE_FILE = ROOT / "mic" / "data" / "hourly-history-state.json"
RANGE = "60d"
INTERVAL = "1h"
BATCH_SIZE = max(10, min(300, int(os.getenv("MIC_HOURLY_HISTORY_BATCH", "120"))))
WORKERS = max(2, min(12, int(os.getenv("MIC_HOURLY_HISTORY_WORKERS", "8"))))
MISSING_PRIORITY_LIMIT = max(
    0,
    min(BATCH_SIZE, int(os.getenv("MIC_HOURLY_HISTORY_MISSING_PRIORITY", str(BATCH_SIZE)))),
)
FORCED_PRIORITY = [
    item.strip().upper()
    for item in os.getenv("MIC_HOURLY_HISTORY_PRIORITY", "").split(",")
    if item.strip()
]
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
}


def finite(value):
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def key_of(asset):
    market = str(asset.get("market") or "US").upper().strip()
    symbol = str(asset.get("symbol") or "").upper().strip()
    return f"{market}:{symbol}"


def eligible(asset):
    market = str(asset.get("market") or "").upper().strip()
    return market in {"BIST", "US"} and bool(asset.get("symbol"))


def path_of(asset):
    market, symbol = key_of(asset).split(":", 1)
    return HOURLY_DIR / market / f"{symbol}.json"


def fetch_one(asset):
    key = key_of(asset)
    market, symbol = key.split(":", 1)
    provider_symbol = str(asset.get("provider_symbol") or (f"{symbol}.IS" if market == "BIST" else symbol)).strip()
    if not symbol or not provider_symbol:
        return key, None, "invalid symbol"

    encoded = quote(provider_symbol, safe="")
    last_error = "no response"
    for host in ("query1.finance.yahoo.com", "query2.finance.yahoo.com"):
        try:
            response = requests.get(
                f"https://{host}/v8/finance/chart/{encoded}",
                params={
                    "range": RANGE,
                    "interval": INTERVAL,
                    "events": "div,splits",
                    "includePrePost": "false",
                },
                headers=HEADERS,
                timeout=30,
            )
            response.raise_for_status()
            chart = response.json().get("chart") or {}
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
            bars = []

            for index, timestamp in enumerate(timestamps):
                close = finite(closes[index] if index < len(closes) else None)
                if close is None:
                    continue
                open_price = finite(opens[index] if index < len(opens) else None)
                high = finite(highs[index] if index < len(highs) else None)
                low = finite(lows[index] if index < len(lows) else None)
                volume = finite(volumes[index] if index < len(volumes) else None)
                bars.append([
                    int(timestamp),
                    open_price if open_price is not None else close,
                    high if high is not None else close,
                    low if low is not None else close,
                    close,
                    volume if volume is not None else 0,
                ])

            bars.sort(key=lambda row: row[0])
            if len(bars) < 2:
                raise RuntimeError(f"only {len(bars)} valid bars")

            return key, {
                "key": key,
                "symbol": symbol,
                "market": market,
                "provider_symbol": provider_symbol,
                "provider": "Yahoo Finance chart feed via GitHub Actions",
                "range": RANGE,
                "interval": INTERVAL,
                "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "bars": bars,
            }, None
        except Exception as exc:  # noqa: BLE001
            last_error = f"{host}: {exc}"

    return key, None, last_error


def load_state():
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"cursor": 0, "cycles": 0, "last_success": 0, "last_failed": 0, "failed": []}


def append_unique(target, seen, assets, limit):
    count = 0
    for asset in assets:
        if len(target) >= limit:
            break
        key = key_of(asset)
        if not key or key in seen:
            continue
        seen.add(key)
        target.append(asset)
        count += 1
    return count


def main():
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    assets = [asset for asset in catalog.get("assets", []) if eligible(asset)]
    assets.sort(key=key_of)
    if not assets:
        raise RuntimeError("Canonical equity catalogue is empty")

    by_key = {key_of(asset): asset for asset in assets}
    state = load_state()
    cursor = int(state.get("cursor") or 0) % len(assets)

    forced = [by_key[key] for key in FORCED_PRIORITY if key in by_key]
    retry = []
    for item in state.get("failed") or []:
        asset = by_key.get(str(item.get("key") or "").upper())
        if asset:
            retry.append(asset)

    missing_all = [asset for asset in assets if not path_of(asset).exists()]
    missing_all.sort(key=key_of)
    missing_before = len(missing_all)
    missing = missing_all[:MISSING_PRIORITY_LIMIT]

    batch = []
    seen = set()
    forced_count = append_unique(batch, seen, forced, BATCH_SIZE)
    retry_count = append_unique(batch, seen, retry, BATCH_SIZE)
    missing_count = append_unique(batch, seen, missing, BATCH_SIZE)

    regular_added = 0
    examined = 0
    while len(batch) < BATCH_SIZE and examined < len(assets):
        asset = assets[(cursor + examined) % len(assets)]
        examined += 1
        key = key_of(asset)
        if key in seen:
            continue
        seen.add(key)
        batch.append(asset)
        regular_added += 1

    successes = 0
    failures = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        jobs = {pool.submit(fetch_one, asset): asset for asset in batch}
        for future in as_completed(jobs):
            key, payload, error = future.result()
            if payload:
                market, symbol = key.split(":", 1)
                directory = HOURLY_DIR / market
                directory.mkdir(parents=True, exist_ok=True)
                path = directory / f"{symbol}.json"
                serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
                if not path.exists() or path.read_text(encoding="utf-8") != serialized:
                    path.write_text(serialized, encoding="utf-8")
                successes += 1
            else:
                failures.append({"key": key, "error": error})

    next_cursor = (cursor + examined) % len(assets) if examined else cursor
    cycles = int(state.get("cycles") or 0) + (1 if examined and next_cursor <= cursor else 0)
    missing_after = sum(1 for asset in assets if not path_of(asset).exists())
    out = {
        "cursor": next_cursor,
        "eligible_count": len(assets),
        "catalog": "ai-infrastructure-bulletin/data/equity-catalog.json",
        "range": RANGE,
        "interval": INTERVAL,
        "batch_size": len(batch),
        "forced_priority_count": forced_count,
        "retry_count": retry_count,
        "missing_priority_count": missing_count,
        "missing_before": missing_before,
        "missing_after": missing_after,
        "regular_batch_size": regular_added,
        "last_run": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "last_success": successes,
        "last_failed": len(failures),
        "failed": failures[:100],
        "cycles": cycles,
        "provider": "Yahoo Finance chart feed via GitHub Actions",
    }
    STATE_FILE.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(
        "Hourly history coverage "
        f"cursor={cursor}->{next_cursor}; forced={forced_count}; retry={retry_count}; "
        f"missing={missing_before}->{missing_after}; missing_priority={missing_count}; "
        f"regular={regular_added}; success={successes}; failed={len(failures)}; eligible={len(assets)}"
    )
    if successes == 0:
        raise RuntimeError("Hourly history batch produced no successful files")


if __name__ == "__main__":
    main()
