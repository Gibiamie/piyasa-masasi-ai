from __future__ import annotations
import json, re, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
E=ROOT/"evidence"; E.mkdir(exist_ok=True)
commands={"pytest": ["pytest","-q"],"ruff":["ruff","check","."],"mypy":["mypy","src"],"wheel-build":[sys.executable,"-m","pip","wheel","--no-deps","--no-build-isolation","-w","dist","."],"clean-wheel-install":[sys.executable,"scripts/clean_wheel_install.py"]}
for gate,cmd in commands.items():
    if gate=="wheel-build":
        import shutil; shutil.rmtree(ROOT/"dist",ignore_errors=True)
    result=subprocess.run(cmd,cwd=ROOT,text=True,capture_output=True,check=False)
    metrics={}
    if gate=="pytest":
        text=result.stdout+result.stderr
        for key in ("passed","skipped","xfailed","failed"):
            m=re.search(rf"(\d+) {key}",text); metrics[key]=int(m.group(1)) if m else 0
    payload={"gate_id":"GATE-"+gate.upper(),"command":" ".join(cmd),"exit_code":result.returncode,"status":"PASS" if result.returncode==0 else "FAIL","stdout":result.stdout,"stderr":result.stderr,"metrics":metrics}
    (E/f"{gate}.json").write_text(json.dumps(payload,indent=2)+"\n",encoding="utf-8")
    print(f"{gate}: {payload['status']}")
