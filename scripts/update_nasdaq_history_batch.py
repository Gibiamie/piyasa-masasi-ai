from __future__ import annotations
# MIC Nasdaq history rotation v25.2
import json
import math
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote
import requests

ROOT=Path(__file__).resolve().parents[1]
CATALOG=ROOT/'mic'/'data'/'nasdaq-assets.json'
HISTORY_DIR=ROOT/'mic'/'data'/'history'
STATE_FILE=ROOT/'mic'/'data'/'nasdaq-history-state.json'
BATCH_SIZE=max(10,min(500,int(os.getenv('MIC_NASDAQ_HISTORY_BATCH','200'))))
WORKERS=max(2,min(8,int(os.getenv('MIC_NASDAQ_HISTORY_WORKERS','5'))))
HEADERS={
    'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36',
    'Accept':'application/json,text/plain,*/*'
}
EXCLUDED={'Warrant','Right','Unit','Note','Bond'}


def finite(value):
    try:
        number=float(value)
        return number if math.isfinite(number) else None
    except (TypeError,ValueError):
        return None


def eligible(asset):
    return asset.get('type')=='etf' or asset.get('instrument_class') not in EXCLUDED


def fetch_one(asset):
    symbol=str(asset.get('symbol') or '').upper().strip()
    provider_symbol=str(asset.get('provider_symbol') or symbol).strip()
    if not symbol or not provider_symbol or not re.fullmatch(r'[A-Z0-9.\-^]+',symbol):
        return symbol,None,'invalid symbol'
    encoded=quote(provider_symbol,safe='')
    last_error='no response'
    for host in ('query1.finance.yahoo.com','query2.finance.yahoo.com'):
        try:
            response=requests.get(
                f'https://{host}/v8/finance/chart/{encoded}',
                params={'range':'1y','interval':'1d','events':'div,splits'},
                headers=HEADERS,
                timeout=30
            )
            response.raise_for_status()
            chart=response.json().get('chart') or {}
            if chart.get('error'):
                raise RuntimeError(str(chart['error']))
            result=(chart.get('result') or [None])[0]
            if not result:
                raise RuntimeError('empty chart result')
            timestamps=result.get('timestamp') or []
            quote_data=((result.get('indicators') or {}).get('quote') or [{}])[0]
            opens=quote_data.get('open') or []
            highs=quote_data.get('high') or []
            lows=quote_data.get('low') or []
            closes=quote_data.get('close') or []
            volumes=quote_data.get('volume') or []
            history=[]
            for i,timestamp in enumerate(timestamps):
                close=finite(closes[i] if i<len(closes) else None)
                if close is None:
                    continue
                open_price=finite(opens[i] if i<len(opens) else None)
                high=finite(highs[i] if i<len(highs) else None)
                low=finite(lows[i] if i<len(lows) else None)
                volume=finite(volumes[i] if i<len(volumes) else None)
                history.append({
                    'date':datetime.fromtimestamp(timestamp,timezone.utc).date().isoformat(),
                    'open':open_price if open_price is not None else close,
                    'high':high if high is not None else close,
                    'low':low if low is not None else close,
                    'close':close,
                    'volume':volume if volume is not None else 0
                })
            history.sort(key=lambda x:x['date'])
            if len(history)<2:
                raise RuntimeError(f'only {len(history)} valid rows')
            payload={
                'symbol':symbol,
                'provider_symbol':provider_symbol,
                'provider':'Yahoo Finance chart feed',
                'updated_at':datetime.now(timezone.utc).isoformat(timespec='seconds'),
                'history':history[-270:]
            }
            return symbol,payload,None
        except Exception as exc:
            last_error=f'{host}: {exc}'
    return symbol,None,last_error


def load_state():
    try:return json.loads(STATE_FILE.read_text(encoding='utf-8'))
    except Exception:return {'cursor':0,'cycles':0,'last_success':0,'last_failed':0,'failed':[]}


def main():
    catalog=json.loads(CATALOG.read_text(encoding='utf-8'))
    assets=[a for a in catalog.get('assets',[]) if eligible(a)]
    assets.sort(key=lambda a:a.get('symbol',''))
    if not assets:
        raise RuntimeError('Nasdaq catalog is empty')
    by_symbol={str(a.get('symbol') or '').upper():a for a in assets}
    state=load_state()
    previous_failed=int(state.get('last_failed') or 0)
    previous_success=int(state.get('last_success') or 0)
    cursor=0 if previous_failed>0 and previous_success==0 else int(state.get('cursor') or 0)%len(assets)
    regular=[assets[(cursor+i)%len(assets)] for i in range(min(BATCH_SIZE,len(assets)))]
    retry=[]
    for item in state.get('failed') or []:
        asset=by_symbol.get(str(item.get('symbol') or '').upper())
        if asset:
            retry.append(asset)
    batch=[];seen=set()
    for asset in retry+regular:
        symbol=str(asset.get('symbol') or '').upper()
        if symbol and symbol not in seen:
            seen.add(symbol);batch.append(asset)
    HISTORY_DIR.mkdir(parents=True,exist_ok=True)
    successes=0;failures=[]
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        jobs={pool.submit(fetch_one,a):a for a in batch}
        for future in as_completed(jobs):
            symbol,payload,error=future.result()
            if payload:
                path=HISTORY_DIR/f'{symbol}.json'
                serialized=json.dumps(payload,ensure_ascii=False,separators=(',',':'))
                if not path.exists() or path.read_text(encoding='utf-8')!=serialized:
                    path.write_text(serialized,encoding='utf-8')
                successes+=1
            else:
                failures.append({'symbol':symbol,'error':error})
    next_cursor=(cursor+len(regular))%len(assets)
    cycles=int(state.get('cycles') or 0)+(1 if next_cursor<=cursor else 0)
    out={
        'cursor':next_cursor,
        'eligible_count':len(assets),
        'batch_size':len(batch),
        'regular_batch_size':len(regular),
        'retry_count':len(retry),
        'last_run':datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'last_success':successes,
        'last_failed':len(failures),
        'failed':failures[:100],
        'cycles':cycles,
        'provider':'Yahoo Finance chart feed'
    }
    STATE_FILE.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(f'Nasdaq history batch cursor={cursor}->{next_cursor}; retry={len(retry)}; success={successes}; failed={len(failures)}; eligible={len(assets)}')
    if successes==0:
        raise RuntimeError('Nasdaq history batch produced no successful files')


if __name__=='__main__':
    main()
