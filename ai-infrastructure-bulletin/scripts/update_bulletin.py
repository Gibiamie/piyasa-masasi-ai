#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
REPORT_PATH = DATA_DIR / "report.json"
WATCHLIST_PATH = DATA_DIR / "watchlist.json"
MUSCAT = ZoneInfo("Asia/Muscat")
USER_AGENT = "AIInfrastructureBulletin/1.0 (+https://github.com/Gibiamie/piyasa-masasi-ai)"

THEMES = {
    "Yapay Zeka": '"artificial intelligence" model launch regulation enterprise AI',
    "Veri Merkezi Kapasitesi": '"AI data center" capacity megawatt gigawatt construction',
    "Enerji ve Güç Altyapısı": '"data center power" grid turbine electricity AI',
    "GPU ve Özel Çipler": "Nvidia AMD AI GPU ASIC HBM data center",
    "Soğutma Teknolojileri": '"data center cooling" liquid cooling immersion AI',
    "Nükleer ve Yenilenebilir": "AI data center nuclear SMR PPA renewable energy",
    "Bulut Yatırımları": "AWS Azure Google Cloud AI infrastructure capex",
}
MATERIAL_TERMS = {
    "billion": 3,
    "gigawatt": 4,
    "megawatt": 2,
    "contract": 2,
    "partnership": 2,
    "investment": 2,
    "capacity": 2,
    "acquisition": 3,
    "earnings": 2,
    "guidance": 3,
    "regulation": 2,
    "grid": 2,
    "power": 1,
    "data center": 2,
    "gpu": 1,
    "hbm": 2,
}
POSITIVE_TERMS = {"expand", "partnership", "contract", "investment", "growth", "record", "launch", "capacity"}
NEGATIVE_TERMS = {"delay", "cancel", "loss", "investigation", "ban", "shortage", "downgrade", "decline"}
TRUSTED_PUBLISHERS = {"Reuters", "Associated Press", "Bloomberg", "Financial Times", "The Wall Street Journal"}


@dataclass(frozen=True)
class NewsItem:
    title: str
    link: str
    publisher: str
    published_at: datetime
    theme: str


def request_text(url: str, timeout: int = 30) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def google_news(theme: str, query: str, now: datetime) -> list[NewsItem]:
    encoded = urllib.parse.quote_plus(f"{query} when:1d")
    url = f"https://news.google.com/rss/search?q={encoded}&hl=en-US&gl=US&ceid=US:en"
    root = ET.fromstring(request_text(url))
    items: list[NewsItem] = []
    for node in root.findall("./channel/item"):
        title = (node.findtext("title") or "").strip()
        link = (node.findtext("link") or "").strip()
        source = node.find("source")
        publisher = (source.text or "").strip() if source is not None else "Unknown"
        raw_date = node.findtext("pubDate") or ""
        try:
            published = parsedate_to_datetime(raw_date).astimezone(timezone.utc)
        except (TypeError, ValueError):
            continue
        if now - published <= timedelta(hours=30):
            items.append(NewsItem(title, link, publisher, published, theme))
    return items


def normalize_title(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()


def material_score(title: str) -> int:
    lowered = title.lower()
    return sum(weight for term, weight in MATERIAL_TERMS.items() if term in lowered)


def sentiment(title: str) -> str:
    lowered = title.lower()
    positive = sum(term in lowered for term in POSITIVE_TERMS)
    negative = sum(term in lowered for term in NEGATIVE_TERMS)
    if positive >= negative + 2:
        return "POSITIVE"
    if negative >= positive + 1:
        return "NEGATIVE"
    return "NEUTRAL"


def event_from_item(item: NewsItem) -> dict[str, Any]:
    rating = sentiment(item.title)
    event_id = "evt-" + hashlib.sha256(
        f"{normalize_title(item.title)}|{item.published_at.date()}".encode()
    ).hexdigest()[:14]
    confidence = "HIGH" if item.publisher in TRUSTED_PUBLISHERS else "MEDIUM"
    investment_meaning = {
        "POSITIVE": "Araştırma görünümü pozitif; finansal büyüklük, uygulama takvimi ve değerleme teyidi izlenmelidir.",
        "NEGATIVE": "Araştırma görünümü negatif; etkinin geçici mi yapısal mı olduğu resmî açıklamalarla kontrol edilmelidir.",
        "NEUTRAL": "Gelişme izlenmeli; tek başına kişisel alım veya satım kararı üretmek için yeterli değildir.",
    }[rating]
    return {
        "event_id": event_id,
        "primary_theme": item.theme,
        "related_themes": [],
        "companies": [],
        "headline": item.title,
        "event_time": item.published_at.isoformat(),
        "published_time": item.published_at.isoformat(),
        "retrieved_time": datetime.now(timezone.utc).isoformat(),
        "facts": [item.title],
        "why_it_matters": f"{item.theme} temasında maddi önem filtresini geçen güncel bir gelişmedir. Sayısal ayrıntılar kaynak üzerinden doğrulanmalıdır.",
        "investment_meaning": investment_meaning,
        "thesis_impact": "THESIS_STRENGTHENED" if rating == "POSITIVE" else "THESIS_WEAKENED" if rating == "NEGATIVE" else "THESIS_UNCHANGED",
        "research_view": {
            "rating": rating,
            "time_horizon": "Orta-Uzun vadeli",
            "summary": investment_meaning,
            "reasons": ["Maddi gelişme filtresini geçti"],
            "risks": ["Haber başlığı finansal etkiyi tek başına tam olarak ölçmez"],
        },
        "risk_badge": "STANDARD",
        "confidence": confidence,
        "sources": [{
            "source_type": "REPUTABLE_NEWS" if confidence == "HIGH" else "SECONDARY_NEWS",
            "publisher": item.publisher,
            "title": item.title,
            "published_at": item.published_at.isoformat(),
            "url": item.link,
            "primary_source": False,
        }],
    }


def stooq_history(symbol: str) -> list[dict[str, str]]:
    url = f"https://stooq.com/q/d/l/?s={urllib.parse.quote(symbol)}&i=d"
    rows = list(csv.DictReader(io.StringIO(request_text(url))))
    return [row for row in rows if row.get("Close") not in (None, "", "N/D")]


def pct_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return None
    return round((current / previous - 1) * 100, 2)


def market_row(item: dict[str, Any]) -> dict[str, Any]:
    output: dict[str, Any] = {
        "ticker": item["ticker"],
        "company": item["company"],
        "currency": "USD",
        "price": None,
        "return_1d_pct": None,
        "return_21d_pct": None,
        "return_252d_pct": None,
        "distance_from_52w_high_pct": None,
        "price_as_of": None,
        "risk_badge": item["risk_badge"],
    }
    try:
        rows = stooq_history(item["stooq"])
        closes = [float(row["Close"]) for row in rows]
        if len(closes) < 2:
            return output
        current = closes[-1]
        output["price"] = round(current, 2)
        output["price_as_of"] = rows[-1]["Date"]
        output["return_1d_pct"] = pct_change(current, closes[-2])
        if len(closes) >= 22:
            output["return_21d_pct"] = pct_change(current, closes[-22])
        if len(closes) >= 253:
            output["return_252d_pct"] = pct_change(current, closes[-253])
        recent = closes[-252:] if len(closes) >= 252 else closes
        output["distance_from_52w_high_pct"] = pct_change(current, max(recent))
    except Exception as exc:
        output["data_error"] = type(exc).__name__
    return output


def build_report() -> dict[str, Any]:
    now_utc = datetime.now(timezone.utc)
    now_muscat = now_utc.astimezone(MUSCAT)
    all_items: list[NewsItem] = []
    warnings: list[str] = []
    for theme, query in THEMES.items():
        try:
            all_items.extend(google_news(theme, query, now_utc))
        except Exception as exc:
            warnings.append(f"{theme} haber akışı alınamadı: {type(exc).__name__}")

    seen: set[str] = set()
    selected: list[NewsItem] = []
    ranked = sorted(all_items, key=lambda item: (material_score(item.title), item.published_at), reverse=True)
    for item in ranked:
        key = normalize_title(item.title)
        if not key or key in seen or material_score(item.title) < 2:
            continue
        seen.add(key)
        selected.append(item)
        if len(selected) >= 16:
            break

    events = [event_from_item(item) for item in selected]
    config = json.loads(WATCHLIST_PATH.read_text(encoding="utf-8"))
    watchlist = [market_row(item) for item in config["tickers"]]
    market_dates = [row["price_as_of"] for row in watchlist if row.get("price_as_of")]
    dominant = events[0]["primary_theme"] if events else "Önemli gelişme yok"

    return {
        "report": {
            "report_id": now_muscat.strftime("%Y-%m-%d-%H%M"),
            "generated_at": now_muscat.isoformat(),
            "timezone": "Asia/Muscat",
            "window_start": (now_muscat - timedelta(hours=24)).isoformat(),
            "window_end": now_muscat.isoformat(),
            "market_data_as_of": max(market_dates) if market_dates else None,
            "material_event_count": len(events),
            "headline_status": "MATERIAL_NEWS_FOUND" if events else "NO_MATERIAL_NEWS",
            "data_mode": "automated_public_sources",
        },
        "executive_summary": {
            "headline": "Önem eşiğini geçen gelişmeler" if events else "Önemli yeni gelişme bulunmadı",
            "market_regime": "Otomatik günlük tarama",
            "dominant_theme": dominant,
            "main_positive_driver": "Kapasite, sipariş ve yatırım büyümesi",
            "main_risk": "Kaynak doğrulaması, uygulama ve değerleme riski",
            "summary": f"Son 24 saatte {len(events)} maddi gelişme tespit edildi. Kartlar kaynak kalitesi ve önem filtresine göre sıralandı." if events else "Bugün önem eşiğini geçen yeni bir gelişme bulunmadı. Bülteni doldurmak için düşük önem seviyeli içerik eklenmedi.",
        },
        "events": events,
        "watchlist": watchlist,
        "no_material_news_themes": [theme for theme in THEMES if not any(event["primary_theme"] == theme for event in events)],
        "data_quality_warnings": warnings,
        "general_assessment": "Araştırma sınıfları kişisel işlem emri değildir.",
    }


def validate_report(report: dict[str, Any]) -> None:
    required = {"report", "executive_summary", "events", "watchlist"}
    missing = required - report.keys()
    if missing:
        raise ValueError(f"Missing report keys: {sorted(missing)}")
    if report["report"]["material_event_count"] != len(report["events"]):
        raise ValueError("material_event_count does not match events length")
    event_ids = [event["event_id"] for event in report["events"]]
    if len(event_ids) != len(set(event_ids)):
        raise ValueError("Duplicate event IDs")
    allowed = {"STRONG_POSITIVE", "POSITIVE", "NEUTRAL", "NEGATIVE", "HIGH_UNCERTAINTY"}
    for event in report["events"]:
        if not event.get("sources"):
            raise ValueError(f"Event has no source: {event['event_id']}")
        if event.get("research_view", {}).get("rating") not in allowed:
            raise ValueError(f"Invalid rating: {event['event_id']}")


def main() -> int:
    report = build_report()
    validate_report(report)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {REPORT_PATH} with {len(report['events'])} events")
    return 0


if __name__ == "__main__":
    sys.exit(main())
