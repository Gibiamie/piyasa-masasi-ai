import importlib.util
import json
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("update_prices", ROOT / "scripts" / "update_prices.py")
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class PriceUpdateTests(unittest.TestCase):
    def test_watchlist_contains_requested_tickers(self):
        config = json.loads((ROOT / "data" / "watchlist.json").read_text(encoding="utf-8"))
        by_ticker = {item["ticker"]: item for item in config["tickers"]}
        self.assertIn("LUNR", by_ticker)
        self.assertEqual(by_ticker["TTRAK"]["provider_symbol"], "TTRAK.IS")

    def test_exchange_symbol_and_native_currency_are_preserved(self):
        start = datetime(2025, 1, 1, tzinfo=timezone.utc)
        timestamps = [int((start + timedelta(days=index)).timestamp()) for index in range(270)]
        closes = [100.0 + index for index in range(270)]
        payload = {
            "chart": {
                "error": None,
                "result": [{
                    "meta": {"currency": "TRY"},
                    "timestamp": timestamps,
                    "indicators": {"quote": [{"close": closes}]},
                }],
            }
        }
        item = {
            "ticker": "TTRAK",
            "provider_symbol": "TTRAK.IS",
            "company": "Türk Traktör",
            "risk_badge": "ESTABLISHED",
        }
        with patch.object(MODULE, "fetch_json", return_value=payload) as mocked:
            ticker, row, error = MODULE.fetch_symbol(item)
        self.assertIsNone(error)
        self.assertEqual(ticker, "TTRAK")
        self.assertIsNotNone(row)
        assert row is not None
        self.assertEqual(row["provider_symbol"], "TTRAK.IS")
        self.assertEqual(row["currency"], "TRY")
        self.assertIsNotNone(row["return_252d_pct"])
        self.assertIn("TTRAK.IS", mocked.call_args.args[0])

    def test_percentage_change_rejects_zero_denominator(self):
        self.assertEqual(MODULE.pct_change(110.0, 100.0), 10.0)
        self.assertIsNone(MODULE.pct_change(10.0, 0.0))


if __name__ == "__main__":
    unittest.main()
