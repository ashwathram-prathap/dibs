"""Select the full requested title set from the complete English monthly index."""
import json,pathlib,sys
root=pathlib.Path('.category-cache/r8')
proof=json.loads((root/'bulk-pageviews-complete.json').read_text())
assert proof['complete'] and proof['days']==31
wanted=set(json.load(sys.stdin)); result={}; scanned=0
with open(root/proof['output'],encoding='utf8') as source:
 for line in source:
  title,views,pageid=line.rstrip('\n').split('\t');scanned+=1
  # Wikimedia serializes titles containing quotation marks as JSON strings.
  # Decode those before matching ordinary Wikipedia/API title strings.
  if title.startswith('"'):
   try:
    decoded=json.loads(title)
    if isinstance(decoded,str):title=decoded
   except json.JSONDecodeError:pass
  if title in wanted:
   previous=result.get(title,[0,0])
   result[title]=[previous[0]+int(views),int(pageid) or previous[1]]
assert scanned==proof['articleTitles'],(scanned,proof['articleTitles'])
json.dump(result,sys.stdout,ensure_ascii=False,separators=(',',':'))
