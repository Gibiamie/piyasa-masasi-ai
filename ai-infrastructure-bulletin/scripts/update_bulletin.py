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
DATA_DIR = ROOT / "data"
REPORT_PATH = DATA_DIR / "report.json"
WATCHLIST_PATH = DATA_DIR / "watchlist.json"
MUSCAT = ZoneInfo("Asia/Muscat")
USER_AGENT = "TTRAK-LUNR-Bulletin/1.1 (+https://github.com/Gibiamie/piyasa-masasi-ai)"
FOCUS_TICKERS = ("TTRAK", "LUNR")

COMPANIES: dict[str, dict[str, str]] = {
    "TTRAK": {
        "company": "Türk Traktör",
        "query": '("Türk Traktör" OR TurkTraktor OR TTRAK) (bilanço OR satış OR üretim OR ihracat OR yatırım OR temettü OR tractor OR earnings OR guidance)',
        "hl": "tr",
        "gl": "TR",
        "ceid": "TR:tr",
        "risk_badge": "ESTABLISHED",
    },
    "LUNR": {
        "company": "Intuitive Machines",
        "query": '("Intuitive Machines" OR LUNR) (NASA OR contract OR mission OR launch OR earnings OR guidance OR financing OR spacecraft)',
        "hl": "en-US",
        "gl": "US",
        "ceid": "US:en",
        "risk_badge": "SPECULATIVE",
    },
}

MATERIAL_TERMS = {
    "billion": 3,
    "million": 1,
    "gigawatt": 4,
    "megawatt": 2,
    "contract": 3,
    "partnership": 2,
    "investment": 2,
    "capacity": 2,
    "acquisition": 3,
    "earnings": 3,
    "guidance": 3,
    "revenue": 2,
    "margin": 2,
    "launch": 2,
    "mission": 2,
    "nasa": 2,
    "financing": 3,
    "offering": 3,
    "dilution": 3,
    "bilanço": 3,
    "satış": 2,
    "üretim": 2,
    "ihracat": 2,
    "yatırım": 2,
    "temettü": 3,
    "sözleşme": 3,
    "sipariş": 2,
    "net kâr": 3,
    "net kar": 3,
    "zarar": 3,
    "türk traktör": 2,
    "turktraktor": 2,
    "intuitive machines": 2,
    "lunr": 2,
}

POSITIVE_TERMS = {
    "expand", "partnership", "contract", "growth", "record", "launch success", "award",
    "increase", "beat", "profit", "büyüme", "artış", "rekor", "kâr", "kar", "ihracat artışı",
}
NEGATIVE_TERMS = {
    "delay", "cancel", "loss", "investigation", "downgrade", "decline", "failure", "dilution",
    "offering", "cut", "düşüş", "azalış", "zarar", "iptal", "erteleme", "üretim duruşu",
}
TRUSTED_PUBLISHERS = {
    "Reuters", "Associated Press", "Bloomberg", "Financial Times", "The Wall Street Journal",
    "KAP", "Nasdaq", "NASA", "Intuitive Machines", "TürkTraktör",
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


def request_text(url: str, timeout: int = 30) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def google_news(ticker: str, config: dict[str, str], now: datetime) -> list[NewsItem]:
    encoded = urllib.parse.quote_plus(f"{config['query']} when:1d")
    url = (
        "https://news.google.com/rss/search?"
        f"q={encoded}&hl={urllib.parse.quote_plus(config['hl'])}"
        f"&gl={urllib.parse.quote_plus(config['gl'])}"
        f"&ceid={urllib.parse.quote_plus(config['ceid'])}"
    )
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
            items.append(NewsItem(
                title=title,
                link=link,
                publisher=publisher,
                published_at=published,
                ticker=ticker,
                company=config["company"],
                risk_badge=config["risk_badge"],
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


def company_context(ticker: str) -> tuple[str, str]:
    if ticker == "TTRAK":
        return (
            "Türk Traktör için iç pazar talebi, ihracat, üretim adedi, fiyatlama gücü ve marjlar yatırım tezinin ana sürücüleridir.",
            "Tarım makinesi döngüsü, kur, faiz, çiftçi finansmanı ve ihracat talebi birlikte izlenmelidir.",
        )
    return (
        "Intuitive Machines için NASA sözleşmeleri, görev başarısı, fırlatma takvimi, nakit tüketimi ve yeni finansman ihtiyacı yatırım tezinin ana sürücüleridir.",
        "Görev gecikmesi veya başarısızlığı, yüksek volatilite ve sermaye sulanması riski birlikte izlenmelidir.",
    )


def event_from_item(item: NewsItem) -> dict[str, Any]:
    rating = sentiment(item.title)
    event_id = "evt-" + hashlib.sha256(
        f"{item.ticker}|{normalize_title(item.title)}|{item.published_at.date()}".encode()
    ).hexdigest()[:14]
    confidence = "HIGH" if item.publisher in TRUSTED_PUBLISHERS else "MEDIUM"
    why_it_matters, core_risk = company_context(item.ticker)
    investment_meaning = {
        "POSITIVE": "Araştırma görünümü pozitif yönde değişti; fiyatlama, bilanço etkisi ve uygulama takvimi teyit edilmelidir.",
        "NEGATIVE": "Araştırma görünümü zayıfladı; etkinin geçici mi yapısal mı olduğu resmî açıklamalarla kontrol edilmelidir.",
        "NEUTRAL": "Gelişme izlenmeli; tek başına pozisyon artırma veya azaltma kararı üretmek için yeterli değildir.",
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
        "why_it_matters": why_it_matters,
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
            "risks": [core_risk, "Haber başlığı finansal etkiyi tek başına tam olarak ölçmez"],
        },
        "risk_badge": item.risk_badge,
        "confidence": confidence,
        "sources": [{
            "source_type": "PRIMARY_OR_TRUSTED" if confidence == "HIGH" else "SECONDARY_NEWS",
            "publisher": item.publisher,
            "title": item.title,
            "published_at": item.published_at.isoformat(),
            "url": item.link,
            "primary_source": item.publisher in {"KAP", "NASA", "Intuitive Machines", "TürkTraktör"},
        }],
    }


def pct_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return None
    return round((current / previous - 1) * 100, 2)


def empty_market_row(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "ticker": item["ticker"],
        "provider_symbol": item.get("provider_symbol", item["ticker"]),
        "company": item["company"],
        "currency": item.get("currency", "USD"),
        "price": None,
        "return_1d_pct": None,
        "return_21d_pct": None,
        "return_252d_pct": None,
        "distance_from_52w_high_pct": None,
        "price_as_of": None,
        "risk_badge": item["risk_badge"],
    }


def build_report() -> dict[str, Any]:
    now_utc = datetime.now(timezone.utc)
    now_muscat = now_utc.astimezone(MUSCAT)
    all_items: list[NewsItem] = []
    warnings: list[str] = []
    for ticker, config in COMPANIES.items():
        try:
            all_items.extend(google_news(ticker, config, now_utc))
        except Exception as exc:
            warnings.append(f"{ticker} haber akışı alınamadı: {type(exc).__name__}")

    seen: set[str] = set()
    selected: list[NewsItem] = []
    ranked = sorted(all_items, key=lambda item: (material_score(item.title), item.published_at), reverse=True)
    per_company: dict[str, int] = {ticker: 0 for ticker in FOCUS_TICKERS}
    for item in ranked:
        key = f"{item.ticker}|{normalize_title(item.title)}"
        if not key or key in seen or material_score(item.title) < 2:
            continue
        if per_company[item.ticker] >= 5:
            continue
        seen.add(key)
        selected.append(item)
        per_company[item.ticker] += 1

    events = [event_from_item(item) for item in selected]
    config = json.loads(WATCHLIST_PATH.read_text(encoding="utf-8"))
    watchlist = [empty_market_row(item) for item in config["tickers"]]
    dominant = events[0]["primary_theme"] if events else "TTRAK & LUNR"

    return {
        "report": {
            "report_id": now_muscat.strftime("%Y-%m-%d-%H%M"),
            "generated_at": now_muscat.isoformat(),
            "timezone": "Asia/Muscat",
            "window_start": (now_muscat - timedelta(hours=24)).isoformat(),
            "window_end": now_muscat.isoformat(),
            "market_data_as_of": None,
            "material_event_count": len(events),
            "headline_status": "MATERIAL_NEWS_FOUND" if events else "NO_MATERIAL_NEWS",
            "data_mode": "automated_public_sources",
        },
        "executive_summary": {
            "headline": "TTRAK ve LUNR için önem eşiğini geçen gelişmeler" if events else "Önemli yeni gelişme bulunmadı",
            "market_regime": "İki şirket odaklı günlük tarama",
            "dominant_theme": dominant,
            "main_positive_driver": "TTRAK için operasyonel performans; LUNR için sözleşme ve görev icrası",
            "main_risk": "TTRAK için döngüsel talep; LUNR için görev, nakit ve sulanma riski",
            "summary": (
                f"Son 24 saatte TTRAK ve LUNR için {len(events)} maddi gelişme tespit edildi. "
                "Yalnız bu iki şirket değerlendirme kapsamındadır."
                if events else
                "Bugün TTRAK ve LUNR için önem eşiğini geçen yeni bir gelişme bulunmadı."
            ),
        },
        "events": events,
        "watchlist": watchlist,
        "no_material_news_themes": [ticker for ticker in FOCUS_TICKERS if per_company[ticker] == 0],
        "data_quality_warnings": warnings,
        "general_assessment": "Değerlendirme yalnızca TTRAK ve LUNR içindir; araştırma sınıfları kişisel işlem emri değildir.",
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
        if not set(event.get("companies", [])).issubset(FOCUS_TICKERS):
            raise ValueError(f"Out-of-scope company: {event['event_id']}")
    watchlist_tickers = [item.get("ticker") for item in report["watchlist"]]
    if watchlist_tickers != list(FOCUS_TICKERS):
        raise ValueError(f"Watchlist scope must be {list(FOCUS_TICKERS)}")


def main() -> int:
    report = build_report()
    validate_report(report)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {REPORT_PATH} with {len(report['events'])} TTRAK/LUNR events")
    return 0


if __name__ == "__main__":
    sys.exit(main())
