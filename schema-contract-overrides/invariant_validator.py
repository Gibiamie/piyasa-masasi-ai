from __future__ import annotations
from collections.abc import Mapping
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import cast
from .confidence_engine import ConfidenceEngine
from .currency_registry import CurrencyRegistry
from .errors import Violation
from .unit_registry import UnitRegistry

class InvariantValidator:
    def __init__(self, currencies: CurrencyRegistry | None = None, units: UnitRegistry | None = None, confidence: ConfidenceEngine | None = None) -> None:
        self.currencies = currencies or CurrencyRegistry()
        self.units = units or UnitRegistry()
        self.confidence = confidence or ConfidenceEngine()

    def validate(self, schema_name: str, instance: Mapping[str, object], context: Mapping[str, object] | None = None) -> tuple[Violation, ...]:
        if schema_name == "value":
            return self._value(instance, "")
        if schema_name == "time-expression":
            return self._time(instance)
        if schema_name == "normalized-claim":
            return self._normalized_claim(instance)
        if schema_name == "canonical-event":
            return self._event(instance, context or {})
        if schema_name == "extracted-claim":
            return self._extracted_claim(instance)
        return ()

    def _value(self, value: Mapping[str, object], path: str) -> tuple[Violation, ...]:
        kind = value.get("type")
        if kind == "MONEY":
            code = value.get("currency")
            exponent = value.get("minor_unit_exponent")
            if not isinstance(code, str) or not self.currencies.is_valid(code):
                return (Violation("INVALID_CURRENCY", self._p(path, "currency"), "Currency is not supported", actual=code),)
            expected = self.currencies.exponent(code)
            if exponent != expected:
                return (Violation("CURRENCY_EXPONENT_MISMATCH", self._p(path, "minor_unit_exponent"), "Currency exponent mismatch", expected, exponent),)
        elif kind == "QUANTITY":
            code = value.get("unit_code")
            if not isinstance(code, str) or not self.units.is_valid(code):
                return (Violation("INVALID_UNIT", self._p(path, "unit_code"), "Unit is not supported", actual=code),)
        elif kind == "RANGE":
            return self._range(value, path)
        return ()

    def _range(self, value: Mapping[str, object], path: str) -> tuple[Violation, ...]:
        lower = cast(Mapping[str, object], value["lower"])
        upper = cast(Mapping[str, object], value["upper"])
        nested = (*self._value(lower, self._p(path, "lower")), *self._value(upper, self._p(path, "upper")))
        if nested:
            return tuple(nested)
        if lower.get("type") != upper.get("type"):
            return (Violation("RANGE_BOUND_TYPE_MISMATCH", path or "/", "Range bounds must have same type"),)
        kind = lower.get("type")
        try:
            if kind == "MONEY":
                if lower.get("currency") != upper.get("currency"):
                    return (Violation("RANGE_CURRENCY_MISMATCH", path or "/", "Money range currencies differ"),)
                lo, hi = Decimal(str(lower["amount_minor"])), Decimal(str(upper["amount_minor"]))
            elif kind == "QUANTITY":
                lu, uu = str(lower["unit_code"]), str(upper["unit_code"])
                if not self.units.compatible(lu, uu):
                    return (Violation("RANGE_UNIT_MISMATCH", path or "/", "Quantity range dimensions differ"),)
                lo = self.units.to_canonical(Decimal(str(lower["amount_decimal"])), lu)
                hi = self.units.to_canonical(Decimal(str(upper["amount_decimal"])), uu)
            elif kind == "MULTIPLE":
                if lower.get("multiple_code") != upper.get("multiple_code"):
                    return (Violation("RANGE_MULTIPLE_CODE_MISMATCH", path or "/", "Multiple range codes differ"),)
                lo, hi = Decimal(str(lower["amount_decimal"])), Decimal(str(upper["amount_decimal"]))
            else:
                lo, hi = Decimal(str(lower["amount_decimal"])), Decimal(str(upper["amount_decimal"]))
        except (InvalidOperation, KeyError):
            return (Violation("INVALID_DECIMAL", path or "/", "Range contains invalid decimal"),)
        if lo > hi:
            return (Violation("RANGE_INVERTED", path or "/", "Lower bound exceeds upper bound"),)
        if lo == hi and (value.get("lower_inclusive") is not True or value.get("upper_inclusive") is not True):
            return (Violation("RANGE_EMPTY", path or "/", "Equal bounds must both be inclusive"),)
        return ()

    def _time(self, value: Mapping[str, object]) -> tuple[Violation, ...]:
        if value.get("type") == "RANGE":
            start = datetime.fromisoformat(str(value["start"]).replace("Z", "+00:00"))
            end = datetime.fromisoformat(str(value["end"]).replace("Z", "+00:00"))
            if start > end:
                return (Violation("TIME_RANGE_INVERTED", "/", "Time range start exceeds end"),)
        return ()

    def _extracted_claim(self, value: Mapping[str, object]) -> tuple[Violation, ...]:
        loc = cast(Mapping[str, object], value.get("locator", {}))
        if loc.get("type") == "TEXT_OFFSETS" and int(cast(str | int, loc["start"])) >= int(cast(str | int, loc["end"])):
            return (Violation("TEXT_OFFSETS_INVERTED", "/locator", "Text offset start must precede end"),)
        if loc.get("type") == "TRANSCRIPT_TIMESTAMP" and float(cast(str | int | float, loc["start_seconds"])) > float(cast(str | int | float, loc["end_seconds"])):
            return (Violation("TIMESTAMP_RANGE_INVERTED", "/locator", "Transcript start exceeds end"),)
        return ()

    def _normalized_claim(self, value: Mapping[str, object]) -> tuple[Violation, ...]:
        metric = value.get("metric_type")
        v = cast(Mapping[str, object], value["value"])
        kind = v.get("type")
        expected = {"REVENUE":"MONEY","CAPEX":"MONEY","NET_INCOME":"MONEY","FREE_CASH_FLOW":"MONEY","GROSS_MARGIN":"PERCENTAGE","MARKET_SHARE":"PERCENTAGE","CAPACITY":"QUANTITY","SUBSCRIBERS":"QUANTITY","VALUATION_MULTIPLE":"MULTIPLE"}.get(str(metric))
        if expected and kind not in {expected, "RANGE"}:
            return (Violation("METRIC_VALUE_TYPE_MISMATCH", "/value/type", "Metric requires a different value type", expected, kind),)
        nested = self._value(v, "/value")
        if nested:
            return nested
        period = cast(Mapping[str, object], value["period"])
        pt = period.get("period_type")
        quarter = period.get("quarter")
        if pt in {"CALENDAR_QUARTER","FISCAL_QUARTER"} and quarter is None:
            return (Violation("PERIOD_QUARTER_REQUIRED", "/period/quarter", "Quarter is required"),)
        if pt not in {"CALENDAR_QUARTER","FISCAL_QUARTER"} and quarter is not None:
            return (Violation("PERIOD_QUARTER_FORBIDDEN", "/period/quarter", "Quarter is forbidden"),)
        if value.get("comparison_operator") == "RANGE" and kind != "RANGE":
            return (Violation("RANGE_OPERATOR_VALUE_MISMATCH", "/comparison_operator", "RANGE operator requires RANGE value"),)
        return ()

    def _event(self, value: Mapping[str, object], context: Mapping[str, object]) -> tuple[Violation, ...]:
        violations: list[Violation] = []
        occurred = cast(Mapping[str, object], value["occurred_at"])
        violations.extend(self._time(occurred))
        components = cast(Mapping[str, object], value["confidence_components"])
        expected = self.confidence.calculate(components)
        actual = float(cast(str | int | float, components["overall_confidence"]))
        if abs(expected - actual) > 0.00005:
            violations.append(Violation("CONFIDENCE_MISMATCH", "/confidence_components/overall_confidence", "Overall confidence is not deterministic result", expected, actual))
        version = int(cast(str | int, value["version_number"]))
        supersedes = value.get("supersedes_event_version_id")
        if version == 1 and supersedes is not None:
            violations.append(Violation("FIRST_VERSION_SUPERSEDES", "/supersedes_event_version_id", "First version cannot supersede another version"))
        if version > 1 and supersedes is None:
            violations.append(Violation("LATER_VERSION_MISSING_SUPERSEDES", "/supersedes_event_version_id", "Later version must supersede a prior version"))
        claim_sources = context.get("claim_source_document_ids")
        if isinstance(claim_sources, list):
            event_sources = set(cast(list[str], value["source_document_ids"]))
            missing = sorted(set(str(x) for x in claim_sources) - event_sources)
            if missing:
                violations.append(Violation("EVENT_SOURCE_LINEAGE_MISSING", "/source_document_ids", "Event does not include every resolved claim source", expected=missing))
        return tuple(violations)

    @staticmethod
    def _p(path: str, part: str) -> str:
        return f"{path}/{part}" if path else f"/{part}"
