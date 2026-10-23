import json,sys,os
p='risultati_utm.json'
r=json.load(open(p)) if os.path.exists(p) else []
new=json.loads(sys.argv[1])
ids={x['id'] for x in r}
for n in new:
    r=[x for x in r if x['id']!=n['id']]
    r.append(n)
json.dump(r,open(p,'w'),indent=1,ensure_ascii=False)
print(len(r),'records; ok:',sum(1 for x in r if x['ok']))
