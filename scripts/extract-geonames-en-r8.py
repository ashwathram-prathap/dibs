import zipfile,csv,io,json,pathlib,urllib.parse
p=pathlib.Path('.category-cache/r8')
with zipfile.ZipFile(p/'cities1000.zip') as z: ids={a.split('\t',1)[0] for a in z.read('cities1000.txt').decode().splitlines()}
names={};links={};aliases={};count=0
with zipfile.ZipFile(p/'alternateNamesV2.zip') as z:
 for a in csv.reader(io.TextIOWrapper(z.open('alternateNamesV2.txt'),encoding='utf8'),delimiter='\t',quoting=csv.QUOTE_NONE):
  count+=1
  if a[1] not in ids:continue
  if a[2]=='en' and len(a[3])<96:
   if a[6]!='1' and a[7]!='1':aliases.setdefault(a[1],[]).append(a[3])
   priority=(a[4]=='1',a[5]!='1',a[6]!='1',a[7]!='1',-len(a[3]))
   if a[1] not in names or priority>tuple(names[a[1]][1]):names[a[1]]=[a[3],priority]
  elif a[2]=='link' and 'en.wikipedia.org/wiki/' in a[3]:links[a[1]]=urllib.parse.unquote(a[3].split('/wiki/',1)[1]).replace('_',' ')
(p/'geonames-en.json').write_text(json.dumps({'names':{k:v[0] for k,v in names.items()},'wiki':links,'aliases':aliases},ensure_ascii=False));print('Scanned',count,'alternate records; English city names',len(names),'Wikipedia titles',len(links))
