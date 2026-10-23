import json,sys,os
p='/tmp/qre-work/risultati_linkedin.json'
# args: id old new uuid new_time ok error
a=sys.argv[1:]
r={"id":a[0],"old_metricool_id":int(a[1]),"new_id":(int(a[2]) if a[2] else None),"uuid":a[3],"new_time":a[4] or None,"ok":a[5]=='1',"error":a[6] if len(a)>6 and a[6] else None}
L=json.load(open(p)) if os.path.exists(p) else []
L=[x for x in L if x['id']!=r['id']]+[r]
json.dump(L,open(p,'w'),ensure_ascii=False,indent=1)
print(len(L), sum(x['ok'] for x in L))
