"""Uncapped domain-title complement from the complete English Wikipedia title dump."""
import gzip, json, re, hashlib, pathlib
names=[]
scanned=0
with gzip.open('.category-cache/r8/enwiki-titles.gz','rt') as source:
 for line in source:
  scanned+=1
  title=line.strip().replace('_',' ')
  if ':' not in title and re.search(r'\b(castle|palace|fortress|château|chateau)\b',title,re.I) and not re.match(r'^(List of|Lists of|Category|Template|File|Portal|User|Talk|Wikipedia)\b',title):
   names.append(title)
with open('.category-cache/r8/castle-title-candidates.json','w') as output:json.dump(names,output)
print('Full title scan',scanned,'domain title candidates',len(names))

source=pathlib.Path('.category-cache/r8/enwiki-titles.gz')
proof={'source':'https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-all-titles-in-ns0.gz','scanned':scanned,'candidateTitles':len(names),'sha256':hashlib.file_digest(source.open('rb'),'sha256').hexdigest(),'method':'Complete namespace-zero title dump; domain keywords and namespace/list exclusions only. Description verification occurs in the following enrichment step.'}
pathlib.Path('review/round8/castle-title-inventory.json').write_text(json.dumps(proof,indent=2)+'\n')
