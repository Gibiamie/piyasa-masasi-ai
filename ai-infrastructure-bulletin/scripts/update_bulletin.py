#!/usr/bin/env python3
from __future__ import annotations

import hashlib
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
REPORT_PATH = ROOT / "data" / "report.json"
WATCHLIST_PATH = ROOT / "data" / "watchlist.json"
MUSCAT = ZoneInfo("Asia/Muscat")
USER_AGENT = "AI-Infrastructure-Market-Bulletin/2.0 (+https://github.com/Gibiamie/piyasa-masasi-ai)"

MATERIAL_TERMS = {
    "billion": 3, "million": 1, "milyar": 3, "milyon": 1,
    "contract": 3, "sözleşme": 3, "partnership": 2, "investment": 2, "yatırım": 2,
    "capacity": 2, "acquisition": 3, "earnings": 3, "bilanço": 3, "guidance": 3,
    "revenue": 2, "gelir": 2, "margin": 2, "marj": 2, "launch": 2, "mission": 2,
    "financing": 3, "offering": 3, "dilution": 3, "temettü": 3, "production": 2,
    "üretim": 2, "sales": 2, "satış": 2, "export": 2, "ihracat": 2, "order": 2,
    "sipariş": 2, "profit": 2, "kâr": 2, "kar": 2, "loss": 2, "zarar": 2,
}
POSITIVE_TERMS = {
    "expand", "partnership", "contract", "growth", "record", "award", "increase", "beat",
    "profit", "upgrade", "büyüme", "artış", "rekor", "kâr", "kar", "ihracat artışı",
}
NEGATIVE_TERMS = {
    "delay", "cancel", "loss", "investigation", "downgrade", "decline", "failure", "dilution",
    "offering", "cut", "düşüş", "azalış", "zarar", "iptal", "erteleme", "üretim duruşu",
}
TRUSTED_PUBLISHERS = {
    "Reuters", "Associated Press", "Bloomberg", "Financial Times", "The Wall Street Journal",
    "KAP", "Nasdaq", "NASA", "SEC", "Borsa İstanbul",
}


@dataclass(frozen=True)
class NewsItem:
    title: str
    link: str
    publisher: str
    published_at: datetime
    ticker: str
    company: str
    risk_badge: str
    key_drivers: tuple[str, ...]
    key_risks: tuple[str, ...]


def request_text(url: str, timeout: int = 30) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def locale_for(item: dict[str, Any]) -> dict[str, str]:
    configured = item.get("locale") or {}
    if configured:
        return {
            "hl": str(configured.get("hl") or "en-US"),
            "gl": str(configured.get("gl") or "US"),
            "ceid": str(configured.get("ceid") or "US:en"),
        }
    if str(item.get("provider_symbol", "")).upper().endswith(".IS"):
        return {"hl": "tr", "gl": "TR", "ceid": "TR:tr"}
    return {"hl": "en-US", "gl": "US", "ceid": "US:en"}


def default_query(item: dict[str, Any]) -> str:
    ticker = str(item["ticker"])
    company = str(item.get("company") or ticker)
    return (
        f'(\"{company}\" OR {ticker}) '
        "(earnings OR guidance OR revenue OR contract OR investment OR production OR sales OR dividend)"
    )


def google_news(item: dict[str, Any], now: datetime) -> list[NewsItem]:
    locale = locale_for(item)
    query = str(item.get("news_query") or default_query(item))
    encoded = urllib.parse.quote_plus(f"{query} when:1d")
    url = (
        "https://news.google.com/rss/search?"
        f"q={encoded}&hl={urllib.parse.quote_plus(locale['hl'])}"
        f"&gl={urllib.parse.quote_plus(locale['gl'])}"
        f"&ceid={urllib.parse.quote_plus(locale['ceid'])}"
    )
    root = ET.fromstring(request_text(url))
    items: list[NewsItem] = []
    for node in root.findall("./channel/item"):
        title = (node.findtext("title") or "").strip()
        link = (node.findtext("link") or "").strip()
        source = node.find("source")
        publisher = (source.text or "").strip() if source is not None else "Unknown"
        try:
            published = parsedate_to_datetime(node.findtext("pubDate") or "").astimezone(timezone.utc)
        except (TypeError, ValueError):
            continue
        if now - published > timedelta(hours=30):
            continue
        items.append(NewsItem(
            title=title,
            link=link,
            publisher=publisher,
            published_at=published,
            ticker=str(item["ticker"]),
            company=str(item.get("company") or item["ticker"]),
            risk_badge=str(item.get("risk_badge") or "GROWTH"),
            key_drivers=tuple(str(value) for value in item.get("key_drivers", [])),
            key_risks=tuple(str(value) for value in item.get("key_risks", [])),
        ))
    return items


def normalize_title(title: str) -> str:
    return re.sub(r"[^a-z0-9çğıöşü]+", " ", title.lower()).strip()


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
        f"{item.ticker}|{normalize_title(item.title)}|{item.published_at.date()}".encode()
    ).hexdigest()[:14]
    confidence = "HIGH" if item.publisher in TRUSTED_PUBLISHERS else "MEDIUM"
    drivers = list(item.key_drivers) or [f"{item.company} için gelir, kârlılık ve stratejik uygulama"]
    risks = list(item.key_risks) or ["Şirkete özgü finansal ve operasyonel riskler"]
    investment_meaning = {
        "POSITIVE": "Araştırma görünümü pozitif yönde değişti; finansal etki ve değerleme teyit edilmelidir.",
        "NEGATIVE": "Araştırma görünümü zayıfladı; etkinin geçici mi yapısal mı olduğu resmî kaynaklarla kontrol edilmelidir.",
        "NEUTRAL": "Gelişme izlenmeli; tek başına pozisyon kararı üretmek için yeterli değildir.",
    }[rating]
    return {
        "event_id": event_id,
        "primary_theme": item.ticker,
        "related_themes": [],
        "companies": [item.ticker],
        "headline": item.title,
        "event_time": item.published_at.isoformat(),
        "published_time": item.published_at.isoformat(),
        "retrieved_time": datetime.now(timezone.utc).isoformat(),
        "facts": [item.title],
        "why_it_matters": f"{item.company} yatırım tezinin ana sürücüleri: " + "; ".join(drivers[:3]) + ".",
        "investment_meaning": investment_meaning,
        "thesis_impact": (
            "THESIS_STRENGTHENED" if rating == "POSITIVE"
            else "THESIS_WEAKENED" if rating == "NEGATIVE"
            else "THESIS_UNCHANGED"
        ),
        "research_view": {
            "rating": rating,
            "time_horizon": "Orta-Uzun vadeli",
            "summary": investment_meaning,
            "reasons": [f"{item.company} için son 24 saatte önem filtresini geçen gelişme"],
            "risks": risks[:3] + ["Haber başlığı finansal etkiyi tek başına tam olarak ölçmez"],
        },
        "risk_badge": item.risk_badge,
        "confidence": confidence,
        "sources": [{
            "source_type": "PRIMARY_OR_TRUSTED" if confidence == "HIGH" else "SECONDARY_NEWS",
            "publisher": item.publisher,
            "title": item.title,
            "published_at": item.published_at.isoformat(),
            "url": item.link,
            "primary_source": item.publisher in TRUSTED_PUBLISHERS,
        }],
    }


def empty_market_row(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "ticker": item["ticker"],
        "provider_symbol": item.get("provider_symbol", item["ticker"]),
        "company": item.get("company", item["ticker"]),
        "currency": item.get("currency", "USD"),
        "price": None,
        "return_1d_pct": None,
        "return_21d_pct": None,
        "return_252d_pct": None,
        "distance_from_52w_high_pct": None,
        "price_as_of": None,
        "risk_badge": item.get("risk_badge", "GROWTH"),
        "sector": item.get("sector", "Diğer"),
    }


def build_report() -> dict[str, Any]:
    now_utc = datetime.now(timezone.utc)
    now_muscat = now_utc.astimezone(MUSCAT)
    config = json.loads(WATCHLIST_PATH.read_text(encoding="utf-8"))
    companies = config.get("tickers") or []
    all_items: list[NewsItem] = []
    warnings: list[str] = []
    for company in companies:
        try:
            all_items.extend(google_news(company, now_utc))
        except Exception as exc:
            warnings.append(f"{company.get('ticker', '?')} haber akışı alınamadı: {type(exc).__name__}")

    ranked = sorted(all_items, key=lambda value: (material_score(value.title), value.published_at), reverse=True)
    seen: set[str] = set()
    selected: list[NewsItem] = []
    per_company: dict[str, int] = {str(item["ticker"]): 0 for item in companies}
    for item in ranked:
        key = f"{item.ticker}|{normalize_title(item.title)}"
        if key in seen or material_score(item.title) < 2 or per_company.get(item.ticker, 0) >= 3:
            continue
        seen.add(key)
        selected.append(item)
        per_company[item.ticker] = per_company.get(item.ticker, 0) + 1

    events = [event_from_item(item) for item in selected]
    watchlist = [empty_market_row(item) for item in companies]
    companies_with_news = len({event["companies"][0] for event in events if event.get("companies")})
    return {
        "report": {
            "report_id": now_muscat.strftime("%Y-%m-%d-%H%M"),
            "generated_at": now_muscat.isoformat(),
            "timezone": "Asia/Muscat",
            "window_start": (now_muscat - timedelta(hours=24)).isoformat(),
            "window_end": now_muscat.isoformat(),
            "market_data_as_of": None,
            "material_event_count": len(events),
            "company_count": len(companies),
            "headline_status": "MATERIAL_NEWS_FOUND" if events else "NO_MATERIAL_NEWS",
            "data_mode": "automated_public_sources",
        },
        "executive_summary": {
            "headline": "Takip listesinin günlük şirket değerlendirmesi",
            "market_regime": "Çok şirketli günlük tarama",
            "dominant_theme": events[0]["primary_theme"] if events else "Önemli gelişme yok",
            "main_positive_driver": "Şirket bazında gelir, kapasite, sipariş ve stratejik uygulama",
            "main_risk": "Değerleme, finansman, döngü ve uygulama riski",
            "summary": (
                f"{len(companies)} şirket değerlendirildi; son 24 saatte {companies_with_news} şirket için "
                f"{len(events)} önem eşiğini geçen gelişme bulundu."
            ),
        },
        "events": events,
        "watchlist": watchlist,
        "company_evaluations": [],
        "no_material_news_tickers": [ticker for ticker, count in per_company.items() if count == 0],
        "data_quality_warnings": warnings,
        "general_assessment": "Her şirket ayrı fiyat, haber, temel sürücü ve risk bağlamında değerlendirilir; araştırma sınıfları kişisel işlem emri değildir.",
    }


def validate_report(report: dict[str, Any]) -> None:
    required = {"report", "executive_summary", "events", "watchlist", "company_evaluations"}
    missing = required - report.keys()
    if missing:
        raise ValueError(f"Missing report keys: {sorted(missing)}")
    if report["report"]["material_event_count"] != len(report["events"]):
        raise ValueError("material_event_count does not match events length")
    event_ids = [event["event_id"] for event in report["events"]]
    if len(event_ids) != len(set(event_ids)):
        raise ValueError("Duplicate event IDs")
    allowed = {"STRONG_POSITIVE", "POSITIVE", "NEUTRAL", "NEGATIVE", "HIGH_UNCERTAINTY"}
    tickers = {item["ticker"] for item in report["watchlist"]}
    for event in report["events"]:
        if not event.get("sources"):
            raise ValueError(f"Event has no source: {event['event_id']}")
        if event.get("research_view", {}).get("rating") not in allowed:
            raise ValueError(f"Invalid rating: {event['event_id']}")
        if not set(event.get("companies", [])).issubset(tickers):
            raise ValueError(f"Event references unknown ticker: {event['event_id']}")


def main() -> int:
    report = build_report()
    validate_report(report)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {REPORT_PATH} with {len(report['watchlist'])} companies and {len(report['events'])} events")
    return 0


if __name__ == "__main__":
    sys.exit(main())
