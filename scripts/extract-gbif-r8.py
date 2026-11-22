"""Stream the entire GBIF backbone; join every English vernacular to its taxon."""
import zipfile,io,csv,json,pathlib,collections
p=pathlib.Path('.category-cache/r8');z=zipfile.ZipFile(p/'gbif.zip');names={};count=0
for a in csv.reader(io.TextIOWrapper(z.open('VernacularName.tsv'),encoding='utf8'),delimiter='\t',quoting=csv.QUOTE_NONE):
 if len(a)>2 and a[2].lower() in ['en','eng','english']:
  count+=1;names.setdefault(a[0],collections.Counter())[a[1]]+=1
print('English vernacular rows',count,'taxa',len(names),flush=True)
out={'animals':[],'plants':[],'birds':[],'arthropods':[]};scanned=0
for a in csv.reader(io.TextIOWrapper(z.open('Taxon.tsv'),encoding='utf8'),delimiter='\t',quoting=csv.QUOTE_NONE):
 scanned+=1
 if a[0] not in names or len(a)<20:continue
 cat={'Animalia':'animals','Plantae':'plants'}.get(a[17])
 if not cat:continue
 common=sorted(names[a[0]],key=lambda n:(-names[a[0]][n],len(n),n));row={'display':common[0],'aliases':common[1:]+[a[7]],'source':'https://www.gbif.org/species/'+a[0]};out[cat].append(row)
 if cat=='animals' and a[18]=='Arthropoda':out['arthropods'].append(row)
 if cat=='animals' and a[19]=='Aves':out['birds'].append(row)
(p/'gbif-extracted.json').write_text(json.dumps(out,ensure_ascii=False));(p/'gbif-eml.xml').write_bytes(z.read('eml.xml'))
print('Taxa scanned',scanned,'English records', {k:len(v) for k,v in out.items()},flush=True)
