from __future__ import annotations
import csv
import io
import json
import math
from datetime import datetime, timezone
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'mic' / 'data' / 'market.json'
SUPPLEMENTAL = ROOT / 'mic' / 'data' / 'supplemental-assets.json'
NASDAQ_OUT = ROOT / 'mic' / 'data' / 'nasdaq-assets.json'
NASDAQ_CSV = ROOT / 'mic' / 'data' / 'nasdaq-listed.csv'
NASDAQ_QUOTES_OUT = ROOT / 'mic' / 'data' / 'nasdaq-quotes.json'
NASDAQ_URL = 'https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt'
NASDAQ_SCREENER_URL = 'https://api.nasdaq.com/api/screener/stocks'
US_QUOTE_EXCHANGES = ('NASDAQ', 'NYSE', 'AMEX')
COLS = ['name','description','type','subtype','close','change','volume','market_cap_basic','price_earnings_ttm','return_on_equity','revenue_growth_ttm_yoy','Volatility.D','sector','industry','currency','Perf.W','Perf.1M','Perf.3M','Perf.6M','Perf.Y','Perf.YTD']
HEADERS={'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36'}
NASDAQ_HEADERS={
    **HEADERS,
    'Accept':'application/json,text/plain,*/*',
    'Accept-Language':'en-US,en;q=0.9',
    'Origin':'https://www.nasdaq.com',
    'Referer':'https://www.nasdaq.com/'
}


def f(v):
    try:
        x=float(v); return x if math.isfinite(x) else None
    except (TypeError,ValueError): return None


def numeric(v):
    if v is None:
        return None
    text=str(v).strip().replace('$','').replace('%','').replace(',','')
    if text in {'','N/A','n/a','--','-'}:
        return None
    if text.startswith('(') and text.endswith(')'):
        text='-'+text[1:-1]
    return f(text)


def yahoo_last(symbol):
    try:
        r=requests.get(f'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}',params={'range':'5d','interval':'1d'},headers=HEADERS,timeout=20)
        r.raise_for_status()
        result=(r.json().get('chart',{}).get('result') or [None])[0]
        closes=(((result or {}).get('indicators') or {}).get('quote') or [{}])[0].get('close') or []
        values=[f(v) for v in closes]
        values=[v for v in values if v is not None]
        return values[-1] if values else None
    except Exception:
        return None


def supplemental_assets():
    try:
        return json.loads(SUPPLEMENTAL.read_text(encoding='utf-8')).get('assets',[])
    except Exception:
        return []


def instrument_class(name: str, is_etf: bool) -> str:
    if is_etf:
        return 'ETF'
    value=name.casefold()
    checks=(
        ('warrant','Warrant'),('rights','Right'),(' right','Right'),
        ('units','Unit'),(' unit','Unit'),('preferred','Preferred'),
        ('depositary share','Depositary Share'),('senior note','Note'),
        ('bond','Bond'),('closed end fund','Closed-End Fund'),
        ('ordinary share','Ordinary Share'),('common share','Common Stock'),
        ('common stock','Common Stock'),('american depositary','ADR/ADS')
    )
    for needle,label in checks:
        if needle in value:
            return label
    return 'Nasdaq Listed Security'


def sync_nasdaq_directory() -> int:
    response=requests.get(NASDAQ_URL,headers=NASDAQ_HEADERS,timeout=45)
    response.raise_for_status()
    text=response.content.decode('utf-8-sig',errors='replace')
    rows=list(csv.DictReader(io.StringIO(text),delimiter='|'))
    assets=[]
    file_creation_time=None
    for row in rows:
        symbol=str(row.get('Symbol') or '').strip().upper()
        if not symbol:
            continue
        if symbol.startswith('FILE CREATION TIME:'):
            file_creation_time=symbol.split(':',1)[1].strip()
            continue
        if str(row.get('Test Issue') or '').strip().upper()=='Y':
            continue
        name=str(row.get('Security Name') or symbol).strip()
        is_etf=str(row.get('ETF') or '').strip().upper()=='Y'
        category=str(row.get('Market Category') or '').strip().upper()
        status=str(row.get('Financial Status') or '').strip().upper() or 'N'
        round_lot=str(row.get('Round Lot Size') or '').strip()
        nextshares=str(row.get('NextShares') or '').strip().upper()
        cls=instrument_class(name,is_etf)
        assets.append({
            'symbol':symbol,
            'name':name,
            'type':'etf' if is_etf else 'stock',
            'subtype':cls,
            'instrument_class':cls,
            'exchange':'NASDAQ',
            'currency':'USD',
            'provider_symbol':symbol,
            'search_aliases':[name],
            'price':None,
            'price_as_of':None,
            'market_category':category,
            'market_tier':{'Q':'Nasdaq Global Select Market','G':'Nasdaq Global Market','S':'Nasdaq Capital Market'}.get(category,'Nasdaq'),
            'financial_status':status,
            'round_lot_size':int(round_lot) if round_lot.isdigit() else None,
            'is_etf':is_etf,
            'nextshares':nextshares=='Y',
            'official_directory':True,
            'data_coverage':{'identity':True,'quote_snapshot':False,'daily_ohlcv':False,'fundamentals':False},
            'official_source':NASDAQ_URL
        })
    assets.sort(key=lambda x:x['symbol'])
    previous={}
    if NASDAQ_OUT.exists():
        try: previous=json.loads(NASDAQ_OUT.read_text(encoding='utf-8'))
        except Exception: previous={}
    changed=previous.get('assets')!=assets
    updated_at=(datetime.now(timezone.utc).isoformat(timespec='seconds') if changed else previous.get('updated_at'))
    payload={
        'updated_at':updated_at,
        'source':'Nasdaq Trader official Nasdaq-listed securities directory',
        'source_url':NASDAQ_URL,
        'file_creation_time':file_creation_time,
        'count':len(assets),
        'counts':{
            'etf':sum(1 for a in assets if a['type']=='etf'),
            'other_listed_securities':sum(1 for a in assets if a['type']!='etf'),
            'global_select':sum(1 for a in assets if a['market_category']=='Q'),
            'global_market':sum(1 for a in assets if a['market_category']=='G'),
            'capital_market':sum(1 for a in assets if a['market_category']=='S')
        },
        'assets':assets
    }
    serialized=json.dumps(payload,ensure_ascii=False,separators=(',',':'))
    if not NASDAQ_OUT.exists() or NASDAQ_OUT.read_text(encoding='utf-8')!=serialized:
        NASDAQ_OUT.write_text(serialized,encoding='utf-8')
    csv_buffer=io.StringIO(newline='')
    writer=csv.writer(csv_buffer)
    writer.writerow(['Symbol','Security Name','MIC Type','Instrument Class','Market Tier','Financial Status','Round Lot Size'])
    for a in assets:
        writer.writerow([a['symbol'],a['name'],a['type'],a['instrument_class'],a['market_tier'],a['financial_status'],a['round_lot_size'] or ''])
    csv_text=csv_buffer.getvalue()
    if not NASDAQ_CSV.exists() or NASDAQ_CSV.read_text(encoding='utf-8')!=csv_text:
        NASDAQ_CSV.write_text(csv_text,encoding='utf-8')
    return len(assets)


def sync_nasdaq_quotes() -> int:
    previous={}
    if NASDAQ_QUOTES_OUT.exists():
        try: previous=json.loads(NASDAQ_QUOTES_OUT.read_text(encoding='utf-8'))
        except Exception: previous={}
    quotes={}
    failures=[]
    now=datetime.now(timezone.utc).isoformat(timespec='seconds')
    for exchange in US_QUOTE_EXCHANGES:
        try:
            response=requests.get(
                NASDAQ_SCREENER_URL,
                params={'tableonly':'true','limit':'10000','offset':'0','exchange':exchange,'download':'true'},
                headers=NASDAQ_HEADERS,
                timeout=75
            )
            response.raise_for_status()
            data=response.json().get('data') or {}
            rows=data.get('rows') or (data.get('table') or {}).get('rows') or []
            usable=0
            for row in rows:
                symbol=str(row.get('symbol') or row.get('Symbol') or '').strip().upper()
                if not symbol:
                    continue
                price=numeric(row.get('lastsale') or row.get('lastSale') or row.get('last_sale'))
                change=numeric(row.get('pctchange') or row.get('percentChange') or row.get('percent_change'))
                quote={
                    'symbol':symbol,
                    'name':row.get('name') or row.get('securityName'),
                    'exchange':exchange,
                    'price':price,
                    'change':change,
                    'net_change':numeric(row.get('netchange') or row.get('netChange')),
                    'volume':numeric(row.get('volume')),
                    'market_cap':numeric(row.get('marketCap') or row.get('marketcap')),
                    'country':row.get('country'),
                    'ipo_year':row.get('ipoyear') or row.get('ipoYear'),
                    'sector':row.get('sector'),
                    'industry':row.get('industry'),
                    'price_as_of':now,
                    'source':'Nasdaq.com US stock screener snapshot'
                }
                if price is not None or quote['volume'] is not None or quote['market_cap'] is not None:
                    quotes[symbol]=quote
                    usable+=1
            if usable == 0:
                raise RuntimeError('no usable quote rows')
        except Exception as error:
            failures.append(exchange)
            print(f'warning: {exchange} quote snapshot not refreshed: {error}')

    for symbol, quote in (previous.get('quotes') or {}).items():
        exchange=str(quote.get('exchange') or 'NASDAQ').upper()
        if exchange in failures and symbol not in quotes:
            quotes[symbol]=quote
    if not quotes:
        print('warning: US quote snapshots produced no usable rows')
        return len(previous.get('quotes') or {})
    payload={
        'updated_at':now,
        'source':'Nasdaq.com US stock screener snapshots',
        'source_url':NASDAQ_SCREENER_URL,
        'exchanges':list(US_QUOTE_EXCHANGES),
        'failed_exchanges':failures,
        'count':len(quotes),
        'counts_by_exchange':{exchange:sum(1 for quote in quotes.values() if str(quote.get('exchange') or 'NASDAQ').upper()==exchange) for exchange in US_QUOTE_EXCHANGES},
        'quotes':quotes
    }
    NASDAQ_QUOTES_OUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    return len(quotes)


def main():
    old=json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else {'assets':[],'fx':{'USDTRY':40}}
    old_by_key={(a.get('exchange'),a.get('symbol')):a for a in old.get('assets',[])}
    payload={'filter':[{'left':'exchange','operation':'equal','right':'BIST'}],'options':{'lang':'tr'},'symbols':{'query':{'types':[]},'tickers':[]},'columns':COLS,'sort':{'sortBy':'market_cap_basic','sortOrder':'desc'},'range':[0,1000]}
    r=requests.post('https://scanner.tradingview.com/turkey/scan',json=payload,headers=HEADERS,timeout=45); r.raise_for_status()
    assets=[]
    for row in r.json().get('data',[]):
        d=row.get('d') or []
        if len(d)<len(COLS): continue
        x=dict(zip(COLS,d)); symbol=str(x.get('name') or row.get('s','').split(':')[-1]).upper().strip()
        subtype=str(x.get('subtype') or '').lower(); typ='etf' if 'etf' in subtype or str(x.get('type')).lower()=='fund' else 'stock'
        if not symbol: continue
        previous=old_by_key.get(('BIST',symbol),{})
        assets.append({'symbol':symbol,'name':str(x.get('description') or symbol),'type':typ,'exchange':'BIST','currency':str(x.get('currency') or 'TRY').upper(),'price':f(x.get('close')),'change':f(x.get('change')),'volume':f(x.get('volume')),'market_cap':f(x.get('market_cap_basic')),'pe':f(x.get('price_earnings_ttm')),'roe':f(x.get('return_on_equity')),'revenue_growth':f(x.get('revenue_growth_ttm_yoy')),'volatility':f(x.get('Volatility.D')),'sector':x.get('sector'),'industry':x.get('industry'),'history':previous.get('history',[]),'history_updated_at':previous.get('history_updated_at'),'performance':{'1H':f(x.get('Perf.W')),'1A':f(x.get('Perf.1M')),'3A':f(x.get('Perf.3M')),'6A':f(x.get('Perf.6M')),'1Y':f(x.get('Perf.Y')),'YTD':f(x.get('Perf.YTD'))}})

    assets += [a for a in old.get('assets',[]) if a.get('exchange')!='BIST']
    index={(a.get('exchange'),a.get('symbol')):i for i,a in enumerate(assets)}
    for catalog in supplemental_assets():
        key=(catalog.get('exchange'),catalog.get('symbol'))
        previous=old_by_key.get(key,{})
        merged={**catalog,**previous}
        merged['symbol']=previous.get('symbol') or catalog.get('symbol')
        merged['name']=previous.get('name') or catalog.get('name')
        merged['type']=previous.get('type') or catalog.get('type')
        merged['exchange']=previous.get('exchange') or catalog.get('exchange')
        merged['currency']=previous.get('currency') or catalog.get('currency')
        merged['provider_symbol']=previous.get('provider_symbol') or catalog.get('provider_symbol') or merged['symbol']
        merged['price']=yahoo_last(merged['provider_symbol']) or previous.get('price') or catalog.get('price')
        merged['history']=previous.get('history') or catalog.get('history',[])
        merged['history_updated_at']=previous.get('history_updated_at') or catalog.get('history_updated_at')
        merged['performance']=previous.get('performance') or catalog.get('performance',{})
        if key in index:
            assets[index[key]]=merged
        else:
            index[key]=len(assets);assets.append(merged)

    old_fx=old.get('fx',{})
    fx={'USDTRY':yahoo_last('TRY=X') or old_fx.get('USDTRY',40),'EURTRY':yahoo_last('EURTRY=X') or old_fx.get('EURTRY',44)}
    out={'updated_at':datetime.now(timezone.utc).isoformat(timespec='seconds'),'source':'BIST snapshot, performance, FX and curated supplemental asset feed; GitHub Actions periodic refresh','fx':fx,'assets':assets}
    OUT.write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    nasdaq_count=sync_nasdaq_directory()
    quote_count=sync_nasdaq_quotes()
    print(f'wrote {len(assets)} market assets; Nasdaq directory={nasdaq_count}; quote snapshot={quote_count}; supplemental={len(supplemental_assets())}; USDTRY={fx["USDTRY"]}; EURTRY={fx["EURTRY"]}')


if __name__=='__main__':
    main()
