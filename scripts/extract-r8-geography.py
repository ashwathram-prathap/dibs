"""Uncapped domain extracts. Run after downloading allCountries/alternateNamesV2 and OurAirports."""
import csv, io, json, pathlib, re, sys, urllib.parse, zipfile
p=pathlib.Path('.category-cache/r8'); target=p/'other-references'; target.mkdir(exist_ok=True)
codes={
 'mountains':{'MT','MTS','PK','PKS','VLC'},
 'rivers':{'STM','STMS','STMI','WAD','WADS','WADI'},
 'lakes':{'LK','LKS','LKI','LKN','LKNI','RSV','RSVI'},
 'islands':{'ISL','ISLS','ISLT'},
 'stations':{'RSTN','RSTNQ','RSTP','RSTPQ','MTRO'},
 'castles':{'CSTL','FORT','PAL'},
}
extra= '--extra' in sys.argv
extra_codes={
  'lakes':{'LKC','LKO','LKOI','LKSB','LKSC','LKSI','LKSN','LKSNI'},
  'rivers':{'STMA','STMC','STMD','STMSB'},
  'islands':{'ISLET','ISLF','ISLM'},
 }
if extra:
 codes=extra_codes
else:
 for slug, additional in extra_codes.items():codes[slug] |= additional
suffix='-geonames-extra' if extra else ''
only=next((set(a.split('=',1)[1].split(',')) for a in sys.argv[1:] if a.startswith('--only=')),None)
if only:
 if only-set(codes)-{'airports'}:raise ValueError('Unknown reference domain')
 codes={k:v for k,v in codes.items() if k in only}
rows={}; scanned=0
with zipfile.ZipFile(p/'allCountries.zip') as z:
 for a in csv.reader(io.TextIOWrapper(z.open('allCountries.txt'),encoding='utf8'),delimiter='\t',quoting=csv.QUOTE_NONE):
  scanned+=1
  slug=next((k for k,v in codes.items() if a[7] in v),None)
  if not slug:continue
  rows[a[0]]={'slug':slug,'display':a[1],'aliases':[a[2]]+[s for s in a[3].split(',') if re.fullmatch(r"[A-Za-zÀ-ž .’'\-]+",s)],'source':'https://www.geonames.org/'+a[0],'featureCode':a[7]}
print('Scanned GeoNames',scanned,'domain rows',len(rows),flush=True)
priorities={}; alternate_count=0
with zipfile.ZipFile(p/'alternateNamesV2.zip') as z:
 for a in csv.reader(io.TextIOWrapper(z.open('alternateNamesV2.txt'),encoding='utf8'),delimiter='\t',quoting=csv.QUOTE_NONE):
  alternate_count+=1
  r=rows.get(a[1])
  if r is None:continue
  if a[2]=='en' and a[6]!='1' and a[7]!='1':
   r['aliases'].append(a[3]); priority=(a[4]=='1',a[5]!='1',-len(a[3]))
   if a[1] not in priorities or priority>priorities[a[1]]:
    r['aliases'].append(r['display']);r['display']=a[3];priorities[a[1]]=priority
  elif a[2]=='link' and 'en.wikipedia.org/wiki/' in a[3]:
   r['wikipediaTitle']=urllib.parse.unquote(a[3].split('/wiki/',1)[1]).replace('_',' ')
   r['aliases'].append(re.sub(r' \([^)]*\)$','',r['wikipediaTitle']))
audit={'source':'GeoNames allCountries and alternateNamesV2; CC BY 4.0','scanned':scanned,'alternateRows':alternate_count,'categories':{}}
audit_path=pathlib.Path('review/round8/geography-extra-reference-extraction.json' if extra else 'review/round8/geography-reference-extraction.json')
if only and audit_path.exists():audit['categories']=json.loads(audit_path.read_text())['categories']
for slug,feature in codes.items():
 output=[{k:v for k,v in r.items() if k!='slug'} for r in rows.values() if r['slug']==slug]
 next_path=target/(slug+suffix+'.json.next')
 next_path.write_text(json.dumps(output,ensure_ascii=False))
 next_path.replace(target/(slug+suffix+'.json'))
 audit['categories'][slug]={'complete':True,'rows':len(output),'featureCodes':sorted(feature)}
 print(slug,len(output),flush=True)
if extra or (only and 'airports' not in only):
 audit_path.write_text(json.dumps(audit,indent=2)+'\n')
 sys.exit(0)
airports=[]
with open(p/'airports.csv',encoding='utf-8-sig') as f:
 for r in csv.DictReader(f):
  if r['type'] in ['heliport','balloonport'] or re.search(r'heliport|helipad|balloonport',r['name'],re.I):continue
  aliases=[r[c] for c in ['ident','icao_code','iata_code','gps_code','local_code'] if r[c]]
  aliases += [v.strip() for v in r['keywords'].split(',') if v.strip()]
  shortened=re.sub(r'\s+(International\s+)?(Airport|Airfield|Aerodrome)$','',r['name'],flags=re.I)
  if shortened and shortened!=r['name']:aliases.append(shortened)
  row={'display':r['name'],'aliases':aliases,'source':'https://ourairports.com/airports/'+r['ident']+'/','airportType':r['type']}
  if 'en.wikipedia.org/wiki/' in r['wikipedia_link']:row['wikipediaTitle']=urllib.parse.unquote(r['wikipedia_link'].split('/wiki/',1)[1]).replace('_',' ')
  if row.get('wikipediaTitle'):row['aliases'].append(re.sub(r' \([^)]*\)$','',row['wikipediaTitle']))
  airports.append(row)
(target/'airports.json').write_text(json.dumps(airports,ensure_ascii=False))
audit['categories']['airports']={'complete':True,'rows':len(airports),'source':'OurAirports public-domain full CSV; excludes heliports and balloonports; includes closed airports and seaplane bases'}
pathlib.Path('review/round8/geography-extra-reference-extraction.json' if extra else 'review/round8/geography-reference-extraction.json').write_text(json.dumps(audit,indent=2)+'\n')
print('airports',len(airports),flush=True)
