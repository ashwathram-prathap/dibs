"""Rebuild the complete OurAirports base, before verified Wikipedia aliases."""
import csv,json,pathlib,re,urllib.parse
root=pathlib.Path('.category-cache/r8')
rows=[]
with (root/'airports.csv').open(encoding='utf-8-sig') as source:
 for record in csv.DictReader(source):
  if record['type'] in ['heliport','balloonport'] or re.search(r'heliport|helipad|balloonport',record['name'],re.I):continue
  aliases=[record[key] for key in ['ident','icao_code','iata_code','gps_code','local_code'] if record[key]]
  # Free-form keywords include nearby rivers, events and generic aviation tags.
  # Verified historical names come from the article redirect pass instead.
  short=re.sub(r'\s+(International\s+)?(Airport|Airfield|Aerodrome)$','',record['name'],flags=re.I)
  if short and short!=record['name']:aliases.append(short)
  row={'display':record['name'],'aliases':aliases,'source':'https://ourairports.com/airports/'+record['ident']+'/','airportType':record['type']}
  if 'en.wikipedia.org/wiki/' in record['wikipedia_link']:
   row['wikipediaTitle']=urllib.parse.unquote(record['wikipedia_link'].split('/wiki/',1)[1]).replace('_',' ')
   row['aliases'].append(re.sub(r' \([^)]*\)$','',row['wikipediaTitle']))
  rows.append(row)
data=json.dumps(rows,ensure_ascii=False)
(root/'airports-base-reference.json').write_text(data)
target=root/'other-references/airports.json'
temporary=target.with_suffix('.json.next');temporary.write_text(data);temporary.replace(target)
print('Complete OurAirports base',len(rows))
