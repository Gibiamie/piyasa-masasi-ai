import copy
import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("update_bulletin", ROOT / "scripts" / "update_bulletin.py")
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class BulletinTests(unittest.TestCase):
    def load_report(self):
        return json.loads((ROOT / "data" / "report.json").read_text(encoding="utf-8"))

    def test_generated_report_is_valid(self):
        MODULE.validate_report(self.load_report())

    def test_material_score_rewards_company_material_events(self):
        self.assertGreaterEqual(MODULE.material_score("Türk Traktör satış ve ihracat bilanço açıklaması"), 7)
        self.assertGreaterEqual(MODULE.material_score("Intuitive Machines wins NASA contract for LUNR mission"), 7)

    def test_duplicate_event_ids_are_rejected(self):
        report = self.load_report()
        event = report["events"][0] if report["events"] else {
            "event_id": "evt-test",
            "primary_theme": "TTRAK",
            "companies": ["TTRAK"],
            "research_view": {"rating": "NEUTRAL"},
            "sources": [{"publisher": "test"}],
        }
        report["events"] = [copy.deepcopy(event), copy.deepcopy(event)]
        report["report"]["material_event_count"] = 2
        with self.assertRaises(ValueError):
            MODULE.validate_report(report)

    def test_percentage_change(self):
        self.assertEqual(MODULE.pct_change(110.0, 100.0), 10.0)
        self.assertIsNone(MODULE.pct_change(10.0, 0.0))

    def test_all_events_have_sources(self):
        report = self.load_report()
        self.assertTrue(all(event.get("sources") for event in report["events"]))

    def test_scope_is_only_ttrak_and_lunr(self):
        report = self.load_report()
        self.assertEqual([item["ticker"] for item in report["watchlist"]], ["TTRAK", "LUNR"])
        self.assertTrue(all(set(event.get("companies", [])).issubset({"TTRAK", "LUNR"}) for event in report["events"]))


if __name__ == "__main__":
    unittest.main()
