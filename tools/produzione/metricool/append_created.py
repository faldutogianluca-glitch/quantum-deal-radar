import json, sys, os
p='/tmp/qre-work/quot/created.json'
pay=json.load(open('/tmp/qre-work/quot/payloads.json'))
fonte={x['data']:x['fonte'] for x in pay}
cur=json.load(open(p)) if os.path.exists(p) else []
for arg in sys.argv[1:]:
    d,i,u,m=arg.split('|')
    if any(c['data']==d for c in cur): continue
    cur.append({"data":d,"fonte":fonte[d],"id":int(i),"uuid":u,"media_static":m})
json.dump(cur,open(p,'w'),indent=1,ensure_ascii=False)
print(len(cur))
