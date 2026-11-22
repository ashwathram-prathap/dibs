"""Select the full requested title set from the complete English monthly index."""
import json,pathlib,sys
root=pathlib.Path('.category-cache/r8')
proof=json.loads((root/'bulk-pageviews-complete.json').read_text())
assert proof['complete'] and proof['days']==31
wanted=set(json.load(sys.stdin)); result={}; scanned=0
with open(root/proof['output'],encoding='utf8') as source:
 for line in source:
  title,views,pageid=line.rstrip('\n').split('\t');scanned+=1
  if title in wanted:result[title]=[int(views),int(pageid)]
assert scanned==proof['articleTitles'],(scanned,proof['articleTitles'])
json.dump(result,sys.stdout,ensure_ascii=False,separators=(',',':'))
