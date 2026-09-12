from __future__ import annotations
import json, subprocess, sys, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
wheel=next((ROOT/"dist").glob("*.whl"))
with tempfile.TemporaryDirectory() as td:
    venv=Path(td)/"venv"
    subprocess.run([sys.executable,"-m","venv",str(venv)],check=True)
    python=venv/("Scripts/python.exe" if sys.platform=="win32" else "bin/python")
    subprocess.run([str(python),"-m","pip","install",str(wheel)],check=True)
    code='from ai_research_schema_contract import ContractValidator; v=ContractValidator(); assert v.validate("value", {"type":"PERCENTAGE","amount_decimal":"10"}) == (); print("runtime smoke passed")'
    subprocess.run([str(python),"-c",code],check=True)
