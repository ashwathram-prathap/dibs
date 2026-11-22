"""Stream Wikimedia's complete October human pageviews, retaining all English articles.
Source/licence: https://dumps.wikimedia.org/other/pageview_complete/readme.html (CC0).
Monthly records are project, title, page ID, access method, total, daily counts.
All access methods and null-page-ID rows are summed, matching title-based API totals.
Article eligibility is independently established from reference lists and metadata.
"""
import bz2, hashlib, json, os, pathlib, time
root=pathlib.Path('.category-cache/r8')
source=root/'pageviews-202610-user.bz2'
expected=3893755947
while not source.exists() or source.stat().st_size < expected:
 time.sleep(10)
if source.stat().st_size != expected: raise RuntimeError('Unexpected monthly dump length')
print('Complete monthly dump downloaded; extracting English article totals',flush=True)
target=root/'pageviews-202610-en.tsv'
scanned=english=emitted=0
current=None; total=0; page_id=None
with bz2.open(source,'rt',encoding='utf8') as data, open(str(target)+'.next','w') as out:
 for line in data:
  scanned+=1
  if not line.startswith('en.wikipedia '): continue
  fields=line.rstrip('\n').split(' ')
  if len(fields)!=6: raise RuntimeError('Unexpected monthly row format')
  project,title,pid,access,count,daily=fields
  if not (pid=='null' or pid.isdigit()): raise RuntimeError('Unexpected page ID')
  if access not in ('desktop','mobile-web','mobile-app'): raise RuntimeError('Unexpected access method: '+access)
  english+=1
  if title!=current:
   if current is not None:
    out.write(current.replace('_',' ')+'\t'+str(total)+'\t'+page_id+'\n'); emitted+=1
   current=title; total=0; page_id=pid if pid.isdigit() else '0'
  if pid.isdigit() and int(pid)>0:page_id=pid
  total+=int(count)
  if english%1000000==0:print('English access rows',english,'article titles',emitted,flush=True)
 if current is not None:out.write(current.replace('_',' ')+'\t'+str(total)+'\t'+page_id+'\n');emitted+=1
if emitted<6000000:raise RuntimeError('English extraction is suspiciously incomplete')
os.replace(str(target)+'.next',target)
sha=hashlib.file_digest(open(source,'rb'),'sha256').hexdigest()
report={'source':'https://dumps.wikimedia.org/other/pageview_complete/monthly/2026/2026-10/pageviews-202610-user.bz2','licence':'CC0','bytes':expected,'sha256':sha,'periodStart':'2026-10-01','periodEnd':'2026-10-31','days':31,'agent':'user','access':'all-access','rowsScanned':scanned,'englishAccessRows':english,'articleTitles':emitted,'complete':True,'output':'pageviews-202610-en.tsv'}
(root/'bulk-pageviews-complete.json').write_text(json.dumps(report))
pathlib.Path('review/round8/bulk-pageviews-extraction.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report),flush=True)
