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
MIC_HISTORY_DIR = ROOT.parent / "mic" / "data" / "history"
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
    ticker = str(item["ticker"]).upper().strip()
    provider_symbol = str(item.get("provider_symbol") or ticker.replace(".", "-")).strip()
    encoded = urllib.parse.quote(provider_symbol, safe="")
    last_error = "no response"
    for host in ("query1.finance.yahoo.com", "query2.finance.yahoo.com"):
        try:
            payload = fetch_json(f"https://{host}/v8/finance/chart/{encoded}?range=2y&interval=1d&events=div%2Csplits")
            chart = payload.get("chart") or {}
            if chart.get("error"):
                raise RuntimeError(str(chart["error"]))
            result = (chart.get("result") or [None])[0]
            if not result:
                raise RuntimeError("empty chart result")
            meta = result.get("meta") or {}
            timestamps = result.get("timestamp") or []
            indicators = result.get("indicators") or {}
            quote = (indicators.get("quote") or [{}])[0]
            adjclose = (indicators.get("adjclose") or [{}])[0].get("adjclose") or []
            opens = quote.get("open") or []
            highs = quote.get("high") or []
            lows = quote.get("low") or []
            closes = quote.get("close") or []
            volumes = quote.get("volume") or []
            history: list[tuple[str, float, float]] = []
            ohlc_by_date: dict[str, dict[str, Any]] = {}
            for index, timestamp in enumerate(timestamps):
                close = finite(closes[index] if index < len(closes) else None)
                adjusted = finite(adjclose[index] if index < len(adjclose) else None)
                if close is None:
                    continue
                adjusted = adjusted if adjusted is not None else close
                date = datetime.fromtimestamp(timestamp, timezone.utc).date().isoformat()
                history.append((date, close, adjusted))
                ohlc_by_date[date] = {
                    "date": date,
                    "open": finite(opens[index] if index < len(opens) else None) or close,
                    "high": finite(highs[index] if index < len(highs) else None) or close,
                    "low": finite(lows[index] if index < len(lows) else None) or close,
                    "close": close,
                    "volume": finite(volumes[index] if index < len(volumes) else None) or 0,
                }
            by_date = {date: (close, adjusted) for date, close, adjusted in history}
            history = [(date, values[0], values[1]) for date, values in sorted(by_date.items())]
            if len(history) < 2:
                raise RuntimeError(f"only {len(history)} valid rows")
            current_close = history[-1][1]
            current_adjusted = history[-1][2]
            recent_closes = [close for _, close, _ in history[-252:]]
            return ticker, {
                "ticker": ticker,
                "provider_symbol": provider_symbol,
                "company": item.get("company", ticker),
                "currency": str(meta.get("currency") or item.get("currency") or "USD").upper(),
                "price": round(current_close, 2),
                "return_1d_pct": pct_change(current_adjusted, history[-2][2]),
                "return_21d_pct": pct_change(current_adjusted, history[-22][2]) if len(history) >= 22 else None,
                "return_252d_pct": pct_change(current_adjusted, history[-253][2]) if len(history) >= 253 else None,
                "distance_from_52w_high_pct": pct_change(current_close, max(recent_closes)),
                "price_as_of": history[-1][0],
                "risk_badge": item.get("risk_badge", "GROWTH"),
                "sector": item.get("sector", "Diğer"),
                "sector_en": item.get("sector_en", item.get("sector", "Other")),
                "provider": "Yahoo Finance chart feed",
                "data_status": "CURRENT",
                "_history": [ohlc_by_date[date] for date, _, _ in history[-540:]],
            }, None
        except Exception as exc:
            last_error = f"{host}: {type(exc).__name__}: {exc}"
    return ticker, None, last_error


def performance_context(row: dict[str, Any]) -> tuple[str, str]:
    short = finite(row.get("return_21d_pct"))
    long = finite(row.get("return_252d_pct"))
    if short is None or long is None:
        return (
            "Trend karşılaştırması için yeterli fiyat geçmişi bulunmuyor.",
            "There is insufficient price history for a trend comparison.",
        )
    if long > 0 and short < 0:
        return (
            "252 işlem günlük trend pozitif, son 21 işlem gününde düzeltme var; bunun kâr realizasyonu mu yoksa tez zayıflaması mı olduğu izlenmelidir.",
            "The 252-trading-day trend is positive, but the last 21 trading days show a correction; determine whether this is profit-taking or a weakening thesis.",
        )
    if long > 0 and short > 0:
        return (
            "Hem 252 hem 21 işlem günlük trend pozitif; momentum güçlü, ancak değerleme ve haberin fiyatlanmış olma riski kontrol edilmelidir.",
            "Both the 252- and 21-trading-day trends are positive; momentum is strong, but valuation and the risk that news is already priced in must be checked.",
        )
    if long < 0 and short > 0:
        return (
            "252 işlem günlük trend negatif, son 21 işlem gününde tepki yükselişi var; kalıcı dönüş için temel teyit gerekir.",
            "The 252-trading-day trend is negative, while the last 21 trading days show a rebound; a durable reversal requires fundamental confirmation.",
        )
    if long < 0 and short < 0:
        return (
            "Hem 252 hem 21 işlem günlük trend negatif; fiyat baskısı sürüyor ve tez yeniden doğrulanmalıdır.",
            "Both the 252- and 21-trading-day trends are negative; price pressure persists and the thesis should be revalidated.",
        )
    return (
        "Kısa ve uzun vadeli performans belirgin yön üretmiyor.",
        "Short- and long-term performance do not produce a clear directional signal.",
    )


def evaluation_rating(row: dict[str, Any], events: list[dict[str, Any]], risk_badge: str) -> str:
    if row.get("price") is None:
        return "HIGH_UNCERTAINTY"
    event_score = sum(
        1 if event.get("research_view", {}).get("rating") in {"POSITIVE", "STRONG_POSITIVE"}
        else -1 if event.get("research_view", {}).get("rating") == "NEGATIVE"
        else 0
        for event in events
    )
    short = finite(row.get("return_21d_pct")) or 0.0
    long = finite(row.get("return_252d_pct")) or 0.0
    score = event_score + (1 if short > 5 else -1 if short < -10 else 0) + (1 if long > 10 else -1 if long < -20 else 0)
    if risk_badge == "SPECULATIVE" and (abs(short) >= 20 or abs(long) >= 50):
        return "HIGH_UNCERTAINTY"
    if score >= 3:
        return "STRONG_POSITIVE"
    if score >= 1:
        return "POSITIVE"
    if score <= -2:
        return "NEGATIVE"
    return "NEUTRAL"


def build_evaluations(config: list[dict[str, Any]], rows: dict[str, dict[str, Any]], events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_ticker: dict[str, list[dict[str, Any]]] = {}
    for event in events:
        for ticker in event.get("companies", []):
            by_ticker.setdefault(ticker, []).append(event)
    evaluations: list[dict[str, Any]] = []
    for item in config:
        ticker = str(item["ticker"])
        row = rows.get(ticker) or {
            "ticker": ticker,
            "company": item.get("company", ticker),
            "price": None,
            "return_21d_pct": None,
            "return_252d_pct": None,
            "risk_badge": item.get("risk_badge", "GROWTH"),
        }
        company_events = by_ticker.get(ticker, [])
        rating = evaluation_rating(row, company_events, str(item.get("risk_badge", "GROWTH")))
        thesis_impact = {
            "STRONG_POSITIVE": "THESIS_STRENGTHENED",
            "POSITIVE": "THESIS_STRENGTHENED",
            "NEGATIVE": "THESIS_WEAKENED",
            "HIGH_UNCERTAINTY": "INSUFFICIENT_EVIDENCE",
            "NEUTRAL": "THESIS_UNCHANGED",
        }[rating]
        context_tr, context_en = performance_context(row)
        news_text = (
            f"Son 24 saatte {len(company_events)} önem eşiğini geçen gelişme bulundu."
            if company_events
            else "Son 24 saatte önem eşiğini geçen şirkete özgü yeni gelişme bulunmadı."
        )
        news_text_en = (
            f"{len(company_events)} company-specific developments passed the materiality threshold in the last 24 hours."
            if company_events
            else "No new company-specific development passed the materiality threshold in the last 24 hours."
        )
        evaluations.append({
            "ticker": ticker,
            "company": item.get("company", ticker),
            "sector": item.get("sector", "Diğer"),
            "sector_en": item.get("sector_en", item.get("sector", "Other")),
            "rating": rating,
            "thesis_impact": thesis_impact,
            "time_horizon": "Orta-Uzun vadeli",
            "time_horizon_en": "Medium to long term",
            "confidence": "LOW" if row.get("price") is None else "MEDIUM" if not company_events else "HIGH",
            "risk_badge": item.get("risk_badge", "GROWTH"),
            "summary": f"{news_text} {context_tr}",
            "summary_en": f"{news_text_en} {context_en}",
            "performance_context": context_tr,
            "performance_context_en": context_en,
            "material_event_count": len(company_events),
            "key_drivers": item.get("key_drivers", ["Gelir, kârlılık ve stratejik uygulama"]),
            "key_drivers_en": item.get("key_drivers_en", ["Revenue, profitability and strategic execution"]),
            "key_risks": item.get("key_risks", ["Değerleme, finansman ve uygulama riski"]),
            "key_risks_en": item.get("key_risks_en", ["Valuation, financing and execution risk"]),
            "latest_event_headlines": [event.get("headline") for event in company_events[:3]],
            "price_context": {
                key: row.get(key)
                for key in (
                    "currency", "price", "return_1d_pct", "return_21d_pct", "return_252d_pct",
                    "distance_from_52w_high_pct", "price_as_of", "data_status"
                )
            },
        })
    return evaluations


def main() -> int:
    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    config = json.loads(WATCHLIST_PATH.read_text(encoding="utf-8")).get("tickers") or []
    rows: dict[str, dict[str, Any]] = {}
    histories: dict[str, dict[str, Any]] = {}
    failures: list[dict[str, str]] = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        jobs = {pool.submit(fetch_symbol, item): item for item in config}
        for future in as_completed(jobs):
            ticker, row, error = future.result()
            if row:
                history = row.pop("_history", [])
                if history:
                    histories[ticker] = {
                        "symbol": ticker,
                        "provider_symbol": row.get("provider_symbol") or ticker,
                        "provider": row.get("provider") or "Yahoo Finance chart feed",
                        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                        "history": history,
                    }
                rows[ticker] = row
            else:
                failures.append({"ticker": ticker, "error": error or "unknown"})
    if not rows:
        raise RuntimeError("Yahoo price update produced no successful symbols")
    MIC_HISTORY_DIR.mkdir(parents=True, exist_ok=True)
    for ticker, payload in histories.items():
        (MIC_HISTORY_DIR / f"{ticker}.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    existing = {row["ticker"]: row for row in report.get("watchlist", [])}
    watchlist: list[dict[str, Any]] = []
    for item in config:
        ticker = str(item["ticker"])
        if ticker in rows:
            watchlist.append(rows[ticker])
        else:
            fallback = existing.get(ticker, {}).copy()
            fallback.update({
                "ticker": ticker,
                "company": item.get("company", ticker),
                "risk_badge": item.get("risk_badge", "GROWTH"),
                "sector": item.get("sector", "Diğer"),
                "sector_en": item.get("sector_en", item.get("sector", "Other")),
                "data_status": "STALE_FALLBACK" if fallback.get("price") is not None else "UNAVAILABLE",
            })
            watchlist.append(fallback)
    report["watchlist"] = watchlist
    report["company_evaluations"] = build_evaluations(config, {row["ticker"]: row for row in watchlist}, report.get("events", []))
    dates = [row.get("price_as_of") for row in watchlist if row.get("price_as_of")]
    report["report"]["market_data_as_of"] = max(dates) if dates else None
    report["report"]["company_count"] = len(config)
    warnings = [warning for warning in report.get("data_quality_warnings", []) if "ticker için fiyat" not in warning]
    if failures:
        warnings.append(f"{len(failures)} ticker için fiyat verisi alınamadı: " + ", ".join(item["ticker"] for item in failures))
    report["data_quality_warnings"] = warnings
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Yahoo prices: success={len(rows)} failed={len(failures)} evaluations={len(report['company_evaluations'])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
