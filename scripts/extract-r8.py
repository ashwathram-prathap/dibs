"""Extract full downloaded reference lists; no query-order limits."""
import csv,io,json,zipfile,xml.etree.ElementTree as ET,re,pathlib
p=pathlib.Path('.category-cache/r8'); out={k:[] for k in ['animals','birds','plants','foods','fruits-vegetables','cities']}
def add(k,name,aliases=[],source='',**kw):
 if len(name)>1 and len(name)<96 and not re.search(r'\b(fuck|shit|cunt|nigger|faggot|rape|nazi)\b',name,re.I): out[k].append(dict(display=name,aliases=aliases,source=source,**kw))
rows={}
for line in (p/'wordnet/data.noun').read_text().splitlines():
 if not line[:1].isdigit():continue
 data,gloss=line.split('|',1); a=data.split(); count=int(a[3],16); words=a[4:4+count*2:2]; idx=4+count*2; n=int(a[idx]); ptr=[a[idx+1+i*4:idx+5+i*4] for i in range(n)]; rows[a[0]]=(a[1],words,ptr,gloss)
def descend(root):
 todo=[key for key,r in rows.items() if root in r[1]]; seen=set()
 while todo:
  key=todo.pop()
  if key in seen:continue
  seen.add(key); todo += [ptr[1] for ptr in rows[key][2] if ptr[0]=='~' and ptr[2]=='n']
 return seen
animals=descend('animal'); plants=descend('plant'); birds=descend('bird'); fruits=descend('edible_fruit')|descend('vegetable')
for key,(lex,words,ptr,gloss) in rows.items():
 cats=(['animals'] if lex=='05' and key in animals else ['plants'] if lex=='20' and key in plants else ['foods'] if lex=='13' else []) + (['birds'] if key in birds and lex=='05' else []) + (['fruits-vegetables'] if key in fruits and lex in ['13','20'] else [])
 # WordNet capitalized taxonomy (genus/family/Latin) is not a player common name.
 common=[w.replace('_',' ') for w in words if w[0].islower() and not w.startswith(('genus_','family_','order_','class_','phylum_','subclass_','suborder_','subfamily_','superfamily_','division_','subphylum_')) and not w.endswith(('idae','aceae','ales'))]
 if not common:continue
 for cat in cats:
  for w in common:add(cat,w,source='https://wordnet.princeton.edu/',synset=key)
# IOC 15.2 current complete master list (English and scientific-name columns).
with zipfile.ZipFile(p/'ioc15.2.xlsx') as z:
 ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
 strings=[''.join(t.itertext()) for t in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',ns)]
 for row in ET.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('s:sheetData/s:row',ns)[1:]:
  vals={re.sub(r'[0-9]','',c.attrib['r']):(strings[int(c.find('s:v',ns).text)] if c.attrib.get('t')=='s' else '') for c in row.findall('s:c',ns) if c.find('s:v',ns) is not None}
  if vals.get('E'):
   for cat in ['birds','animals']:add(cat,vals['E'],[vals['D']],source='https://www.worldbirdnames.org/Multiling%20IOC%2015.2.xlsx')
with open(p/'usda.txt',encoding='utf-8-sig') as f:
 for row in csv.DictReader(f):
  if row['Common Name']:add('plants',row['Common Name'],[re.sub(r' \(.*','',row['Scientific Name with Author'])],source='https://plants.sc.egov.usda.gov/DocumentLibrary/Txt/plantlst.txt')
for block in (p/'food.txt').read_text().split('\n\n'):
 names=re.search(r'^en: (.+)$',block,re.M)
 if names:
  names=names[1].split(', ')
  if not re.search(r'\b(products|foods|beverages|supplements|baby|substitutes)\b',names[0],re.I):add('foods',names[0],names[1:],source='https://github.com/openfoodfacts/openfoodfacts-server/blob/main/taxonomies/food/categories.txt')
with zipfile.ZipFile(p/'cities1000.zip') as z:
 for line in z.read('cities1000.txt').decode().splitlines():
  a=line.split('\t'); aliases=[a[2]]+[s for s in a[3].split(',') if s and len(s)<96 and re.fullmatch(r"[A-Za-zÀ-ž .’'\-]+",s)]
  add('cities',a[1],aliases,source='https://www.geonames.org/'+a[0],population=int(a[14]),country=a[8],admin=a[10])
(p/'candidates.json').write_text(json.dumps(out,ensure_ascii=False))
print({k:len(v) for k,v in out.items()})
