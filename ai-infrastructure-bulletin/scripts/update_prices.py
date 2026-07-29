#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = ROOT / "data" / "report.json"
WATCHLIST_PATH = ROOT / "data" / "watchlist.json"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36",
    "Accept": "application/json,text/plain,*/*",
}


def finite(value: Any) -> float | None:
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def pct_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return None
    return round((current / previous - 1) * 100, 2)


def fetch_json(url: str, timeout: int = 30) -> dict[str, Any]:
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_symbol(item: dict[str, Any]) -> tuple[str, dict[str, Any] | None, str | None]:
    ticker = str(item["ticker"]).upper()
    provider_symbol = ticker.replace(".", "-")
    encoded = urllib.parse.quote(provider_symbol, safe="")
    last_error = "no response"
    for host in ("query1.finance.yahoo.com", "query2.finance.yahoo.com"):
        try:
            payload = fetch_json(
                f"https://{host}/v8/finance/chart/{encoded}?range=1y&interval=1d&events=div%2Csplits"
            )
            chart = payload.get("chart") or {}
            if chart.get("error"):
                raise RuntimeError(str(chart["error"]))
            result = (chart.get("result") or [None])[0]
            if not result:
                raise RuntimeError("empty chart result")
            timestamps = result.get("timestamp") or []
            quote = ((result.get("indicators") or {}).get("quote") or [{}])[0]
            closes = quote.get("close") or []
            history: list[tuple[str, float]] = []
            for index, timestamp in enumerate(timestamps):
                close = finite(closes[index] if index < len(closes) else None)
                if close is None:
                    continue
                date = datetime.fromtimestamp(timestamp, timezone.utc).date().isoformat()
                history.append((date, close))
            if len(history) < 2:
                raise RuntimeError(f"only {len(history)} valid rows")
            current = history[-1][1]
            recent = [close for _, close in history[-252:]]
            row: dict[str, Any] = {
                "ticker": ticker,
                "company": item["company"],
                "currency": "USD",
                "price": round(current, 2),
                "return_1d_pct": pct_change(current, history[-2][1]),
                "return_21d_pct": pct_change(current, history[-22][1]) if len(history) >= 22 else None,
                "return_252d_pct": pct_change(current, history[-253][1]) if len(history) >= 253 else None,
                "distance_from_52w_high_pct": pct_change(current, max(recent)),
                "price_as_of": history[-1][0],
                "risk_badge": item["risk_badge"],
                "provider": "Yahoo Finance chart feed",
            }
            return ticker, row, None
        except Exception as exc:
            last_error = f"{host}: {type(exc).__name__}: {exc}"
    return ticker, None, last_error


def main() -> int:
    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    config = json.loads(WATCHLIST_PATH.read_text(encoding="utf-8"))
    rows: dict[str, dict[str, Any]] = {}
    failures: list[dict[str, str]] = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        jobs = {pool.submit(fetch_symbol, item): item for item in config["tickers"]}
        for future in as_completed(jobs):
            ticker, row, error = future.result()
            if row:
                rows[ticker] = row
            else:
                failures.append({"ticker": ticker, "error": error or "unknown"})
    if not rows:
        raise RuntimeError("Yahoo price update produced no successful symbols")
    existing = {row["ticker"]: row for row in report.get("watchlist", [])}
    report["watchlist"] = [rows.get(item["ticker"], existing.get(item["ticker"], item)) for item in config["tickers"]]
    dates = [row.get("price_as_of") for row in rows.values() if row.get("price_as_of")]
    report["report"]["market_data_as_of"] = max(dates) if dates else None
    warnings = [warning for warning in report.get("data_quality_warnings", []) if "Fiyat" not in warning]
    if failures:
        warnings.append(f"{len(failures)} ticker için fiyat verisi alınamadı: " + ", ".join(item["ticker"] for item in failures))
    report["data_quality_warnings"] = warnings
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Yahoo prices: success={len(rows)} failed={len(failures)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
