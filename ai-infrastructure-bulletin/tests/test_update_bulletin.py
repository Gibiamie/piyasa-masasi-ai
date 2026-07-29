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
    def test_seed_report_is_valid(self):
        report = json.loads((ROOT / "data" / "report.json").read_text(encoding="utf-8"))
        MODULE.validate_report(report)

    def test_material_score_rewards_capacity_numbers(self):
        score = MODULE.material_score("Company signs 2 gigawatt AI data center capacity contract")
        self.assertGreaterEqual(score, 8)

    def test_duplicate_event_ids_are_rejected(self):
        report = json.loads((ROOT / "data" / "report.json").read_text(encoding="utf-8"))
        report["events"].append(report["events"][0])
        report["report"]["material_event_count"] += 1
        with self.assertRaises(ValueError):
            MODULE.validate_report(report)

    def test_percentage_change(self):
        self.assertEqual(MODULE.pct_change(110.0, 100.0), 10.0)
        self.assertIsNone(MODULE.pct_change(10.0, 0.0))

    def test_all_seed_events_have_sources(self):
        report = json.loads((ROOT / "data" / "report.json").read_text(encoding="utf-8"))
        self.assertTrue(all(event.get("sources") for event in report["events"]))


if __name__ == "__main__":
    unittest.main()
