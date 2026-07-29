#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
WATCHLIST_PATH = ROOT / "data" / "watchlist.json"
HEADERS = {"User-Agent": "Mozilla/5.0", "Accept": "application/json,text/plain,*/*"}


def fetch_json(url: str, timeout: int = 30) -> dict[str, Any]:
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def parse_request(title: str, body: str) -> tuple[str, str]:
    match = re.fullmatch(r"\[AI-BULLETIN\]\s+ADD\s+([A-Z0-9.^=-]{1,15})", title.strip().upper())
    if not match:
        raise ValueError("Issue title must match [AI-BULLETIN] ADD SYMBOL")
    provider_symbol = match.group(1)
    company_match = re.search(r"^Company:\s*(.+?)\s*$", body, flags=re.MULTILINE | re.IGNORECASE)
    company = company_match.group(1).strip() if company_match else provider_symbol
    if len(company) > 100:
        raise ValueError("Company name is too long")
    return provider_symbol, company


def yahoo_meta(provider_symbol: str) -> dict[str, Any]:
    encoded = urllib.parse.quote(provider_symbol, safe="")
    last_error: Exception | None = None
    for host in ("query1.finance.yahoo.com", "query2.finance.yahoo.com"):
        try:
            payload = fetch_json(f"https://{host}/v8/finance/chart/{encoded}?range=5d&interval=1d")
            chart = payload.get("chart") or {}
            if chart.get("error"):
                raise RuntimeError(str(chart["error"]))
            result = (chart.get("result") or [None])[0]
            if not result:
                raise RuntimeError("empty chart result")
            return result.get("meta") or {}
        except Exception as exc:
            last_error = exc
    raise RuntimeError(f"Yahoo symbol validation failed: {last_error}")


def main() -> int:
    provider_symbol, requested_company = parse_request(
        os.environ.get("ISSUE_TITLE", ""), os.environ.get("ISSUE_BODY", "")
    )
    meta = yahoo_meta(provider_symbol)
    canonical_symbol = str(meta.get("symbol") or provider_symbol).upper()
    display_ticker = canonical_symbol[:-3] if canonical_symbol.endswith(".IS") else canonical_symbol
    company = requested_company if requested_company.upper() != provider_symbol else str(
        meta.get("longName") or meta.get("shortName") or display_ticker
    )
    currency = str(meta.get("currency") or ("TRY" if canonical_symbol.endswith(".IS") else "USD")).upper()
    config = json.loads(WATCHLIST_PATH.read_text(encoding="utf-8"))
    tickers = config.get("tickers") or []
    if any(
        str(item.get("ticker", "")).upper() == display_ticker
        or str(item.get("provider_symbol", "")).upper() == canonical_symbol
        for item in tickers
    ):
        print(f"{display_ticker} already exists")
        return 0
    is_bist = canonical_symbol.endswith(".IS")
    item: dict[str, Any] = {
        "ticker": display_ticker,
        "provider_symbol": canonical_symbol,
        "company": company,
        "currency": currency,
        "risk_badge": "GROWTH",
        "sector": "Kullanıcı Tarafından Eklenen",
        "sector_en": "User-Added Asset",
        "news_query": (
            f'(\"{company}\" OR {display_ticker}) '
            + ("(bilanço OR satış OR üretim OR ihracat OR yatırım OR temettü)" if is_bist else "(earnings OR guidance OR revenue OR contract OR investment OR production OR sales)")
        ),
        "key_drivers": ["Gelir ve kârlılık gelişimi", "Şirketin ana faaliyet göstergeleri", "Stratejik yatırım ve uygulama"],
        "key_drivers_en": ["Revenue and profitability development", "Core operating indicators", "Strategic investment and execution"],
        "key_risks": ["Değerleme riski", "Finansman ve bilanço riski", "Sektörel ve operasyonel riskler"],
        "key_risks_en": ["Valuation risk", "Financing and balance-sheet risk", "Sector and operating risks"],
    }
    if is_bist:
        item["locale"] = {"hl": "tr", "gl": "TR", "ceid": "TR:tr"}
    tickers.append(item)
    config["tickers"] = tickers
    WATCHLIST_PATH.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Added {display_ticker} ({canonical_symbol}) as {company}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
