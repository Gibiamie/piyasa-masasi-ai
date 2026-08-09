from __future__ import annotations

# MIC Nasdaq daily-history coverage and refresh rotation.
import json
import math
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

import requests

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "mic" / "data" / "nasdaq-assets.json"
HISTORY_DIR = ROOT / "mic" / "data" / "history"
STATE_FILE = ROOT / "mic" / "data" / "nasdaq-history-state.json"
BATCH_SIZE = max(10, min(500, int(os.getenv("MIC_NASDAQ_HISTORY_BATCH", "200"))))
WORKERS = max(2, min(12, int(os.getenv("MIC_NASDAQ_HISTORY_WORKERS", "8"))))
MISSING_PRIORITY_LIMIT = max(
    0,
    min(BATCH_SIZE, int(os.getenv("MIC_NASDAQ_HISTORY_MISSING_PRIORITY", str(BATCH_SIZE)))),
)
FORCED_PRIORITY = [
    item.strip().upper()
    for item in os.getenv("MIC_NASDAQ_HISTORY_PRIORITY", "").split(",")
    if item.strip()
]
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
}
EXCLUDED = {"Warrant", "Right", "Unit", "Note", "Bond"}


def finite(value):
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def eligible(asset):
    return asset.get("type") == "etf" or asset.get("instrument_class") not in EXCLUDED


def symbol_of(asset):
    return str(asset.get("symbol") or "").upper().strip()


def history_path(asset):
    return HISTORY_DIR / f"{symbol_of(asset)}.json"


def fetch_one(asset):
    symbol = symbol_of(asset)
    provider_symbol = str(asset.get("provider_symbol") or symbol).strip()
    if not symbol or not provider_symbol or not re.fullmatch(r"[A-Z0-9.\-^]+", symbol):
        return symbol, None, "invalid symbol"

    encoded = quote(provider_symbol, safe="")
    last_error = "no response"
    for host in ("query1.finance.yahoo.com", "query2.finance.yahoo.com"):
        try:
            response = requests.get(
                f"https://{host}/v8/finance/chart/{encoded}",
                params={"range": "2y", "interval": "1d", "events": "div,splits"},
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
            history = []

            for index, timestamp in enumerate(timestamps):
                close = finite(closes[index] if index < len(closes) else None)
                if close is None:
                    continue
                open_price = finite(opens[index] if index < len(opens) else None)
                high = finite(highs[index] if index < len(highs) else None)
                low = finite(lows[index] if index < len(lows) else None)
                volume = finite(volumes[index] if index < len(volumes) else None)
                history.append(
                    {
                        "date": datetime.fromtimestamp(timestamp, timezone.utc).date().isoformat(),
                        "open": open_price if open_price is not None else close,
                        "high": high if high is not None else close,
                        "low": low if low is not None else close,
                        "close": close,
                        "volume": volume if volume is not None else 0,
                    }
                )

            history.sort(key=lambda row: row["date"])
            if len(history) < 2:
                raise RuntimeError(f"only {len(history)} valid rows")

            return (
                symbol,
                {
                    "symbol": symbol,
                    "provider_symbol": provider_symbol,
                    "provider": "Yahoo Finance chart feed",
                    "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    "history": history[-540:],
                },
                None,
            )
        except Exception as exc:  # noqa: BLE001
            last_error = f"{host}: {exc}"

    return symbol, None, last_error


def load_state():
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"cursor": 0, "cycles": 0, "last_success": 0, "last_failed": 0, "failed": []}


def append_unique(target, seen, assets, limit):
    added = 0
    for asset in assets:
        if len(target) >= limit:
            break
        symbol = symbol_of(asset)
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        target.append(asset)
        added += 1
    return added


def main():
    HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    assets = [asset for asset in catalog.get("assets", []) if eligible(asset)]
    assets.sort(key=symbol_of)
    if not assets:
        raise RuntimeError("Nasdaq catalog is empty")

    by_symbol = {symbol_of(asset): asset for asset in assets if symbol_of(asset)}
    state = load_state()
    previous_failed = int(state.get("last_failed") or 0)
    previous_success = int(state.get("last_success") or 0)
    cursor = 0 if previous_failed > 0 and previous_success == 0 else int(state.get("cursor") or 0) % len(assets)

    forced = [by_symbol[symbol] for symbol in FORCED_PRIORITY if symbol in by_symbol]
    retry = []
    for item in state.get("failed") or []:
        asset = by_symbol.get(str(item.get("symbol") or "").upper())
        if asset:
            retry.append(asset)

    # Missing daily histories are coverage defects, so fill them before routine refresh rotation.
    missing = [asset for asset in assets if not history_path(asset).exists()]
    missing.sort(key=symbol_of)
    missing = missing[:MISSING_PRIORITY_LIMIT]

    batch = []
    seen = set()
    forced_count = append_unique(batch, seen, forced, BATCH_SIZE)
    retry_count = append_unique(batch, seen, retry, BATCH_SIZE)
    missing_count = append_unique(batch, seen, missing, BATCH_SIZE)

    regular_added = 0
    regular_examined = 0
    while len(batch) < BATCH_SIZE and regular_examined < len(assets):
        asset = assets[(cursor + regular_examined) % len(assets)]
        regular_examined += 1
        symbol = symbol_of(asset)
        if not symbol or symbol in seen:
            continue
        seen.add(symbol)
        batch.append(asset)
        regular_added += 1

    successes = 0
    failures = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        jobs = {pool.submit(fetch_one, asset): asset for asset in batch}
        for future in as_completed(jobs):
            symbol, payload, error = future.result()
            if payload:
                path = HISTORY_DIR / f"{symbol}.json"
                serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
                if not path.exists() or path.read_text(encoding="utf-8") != serialized:
                    path.write_text(serialized, encoding="utf-8")
                successes += 1
            else:
                failures.append({"symbol": symbol, "error": error})

    next_cursor = (cursor + regular_examined) % len(assets) if regular_examined else cursor
    cycles = int(state.get("cycles") or 0) + (1 if regular_examined and next_cursor <= cursor else 0)
    missing_after = sum(1 for asset in assets if not history_path(asset).exists())
    out = {
        "cursor": next_cursor,
        "eligible_count": len(assets),
        "batch_size": len(batch),
        "forced_priority_count": forced_count,
        "missing_priority_count": missing_count,
        "missing_before": len([asset for asset in assets if not history_path(asset).exists()]) + successes,
        "missing_after": missing_after,
        "regular_batch_size": regular_added,
        "retry_count": retry_count,
        "last_run": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "last_success": successes,
        "last_failed": len(failures),
        "failed": failures[:100],
        "cycles": cycles,
        "provider": "Yahoo Finance chart feed",
    }
    STATE_FILE.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(
        "Nasdaq history coverage "
        f"cursor={cursor}->{next_cursor}; forced={forced_count}; retry={retry_count}; "
        f"missing_priority={missing_count}; regular={regular_added}; success={successes}; "
        f"failed={len(failures)}; missing_after={missing_after}; eligible={len(assets)}"
    )
    if successes == 0:
        raise RuntimeError("Nasdaq history batch produced no successful files")


if __name__ == "__main__":
    main()
