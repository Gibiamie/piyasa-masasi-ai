import copy
import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


BULLETIN = load_module("update_bulletin", ROOT / "scripts" / "update_bulletin.py")
PRICES = load_module("update_prices", ROOT / "scripts" / "update_prices.py")


class BulletinTests(unittest.TestCase):
    def load_report(self):
        return json.loads((ROOT / "data" / "report.json").read_text(encoding="utf-8"))

    def load_config(self):
        return json.loads((ROOT / "data" / "watchlist.json").read_text(encoding="utf-8"))["tickers"]

    def test_generated_report_is_valid(self):
        BULLETIN.validate_report(self.load_report())

    def test_restored_universe_contains_original_and_example_tickers(self):
        tickers = {item["ticker"] for item in self.load_config()}
        self.assertGreaterEqual(len(tickers), 18)
        self.assertTrue({"NVDA", "AMD", "VRT", "SMR", "TTRAK", "LUNR"}.issubset(tickers))

    def test_every_configured_company_has_an_evaluation(self):
        report = self.load_report()
        expected = {item["ticker"] for item in self.load_config()}
        actual = {item["ticker"] for item in report["company_evaluations"]}
        self.assertEqual(actual, expected)

    def test_research_content_is_bilingual(self):
        report = self.load_report()
        summary = report["executive_summary"]
        self.assertTrue(summary.get("headline_en"))
        self.assertTrue(summary.get("summary_en"))
        self.assertTrue(summary.get("main_risk_en"))
        self.assertTrue(all(event.get("why_it_matters_en") for event in report["events"]))
        self.assertTrue(all(event.get("investment_meaning_en") for event in report["events"]))
        self.assertTrue(all(event.get("research_view", {}).get("risks_en") for event in report["events"]))
        self.assertTrue(all(item.get("summary_en") for item in report["company_evaluations"]))
        self.assertTrue(all(item.get("key_drivers_en") for item in report["company_evaluations"]))
        self.assertTrue(all(item.get("key_risks_en") for item in report["company_evaluations"]))

    def test_every_event_references_configured_company(self):
        report = self.load_report()
        expected = {item["ticker"] for item in self.load_config()}
        self.assertTrue(all(set(event.get("companies", [])).issubset(expected) for event in report["events"]))

    def test_duplicate_event_ids_are_rejected(self):
        report = self.load_report()
        event = report["events"][0] if report["events"] else {
            "event_id": "evt-test",
            "primary_theme": "NVDA",
            "companies": ["NVDA"],
            "why_it_matters_en": "test",
            "investment_meaning_en": "test",
            "research_view": {"rating": "NEUTRAL"},
            "sources": [{"publisher": "test"}],
        }
        report["events"] = [copy.deepcopy(event), copy.deepcopy(event)]
        report["report"]["material_event_count"] = 2
        with self.assertRaises(ValueError):
            BULLETIN.validate_report(report)

    def test_material_score_rewards_material_events(self):
        self.assertGreaterEqual(BULLETIN.material_score("Company wins billion dollar contract and raises guidance"), 9)
        self.assertGreaterEqual(BULLETIN.material_score("Şirket bilanço satış üretim ve ihracat artışı açıkladı"), 8)

    def test_adjusted_performance_classification(self):
        row = {"price": 100, "return_21d_pct": 12, "return_252d_pct": 25}
        self.assertEqual(PRICES.evaluation_rating(row, [], "ESTABLISHED"), "POSITIVE")
        volatile = {"price": 10, "return_21d_pct": -30, "return_252d_pct": -60}
        self.assertEqual(PRICES.evaluation_rating(volatile, [], "SPECULATIVE"), "HIGH_UNCERTAINTY")

    def test_price_context_has_both_languages(self):
        tr, en = PRICES.performance_context({"return_21d_pct": -5, "return_252d_pct": 20})
        self.assertIn("252", tr)
        self.assertIn("252", en)
        self.assertNotEqual(tr, en)


if __name__ == "__main__":
    unittest.main()
