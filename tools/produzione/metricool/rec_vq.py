import json,sys,os
f='/tmp/qre-work/risultati_vq.json'
r=json.load(open(f)) if os.path.exists(f) else []
id_,old,new,uuid,ok,err=sys.argv[1:7]
r=[x for x in r if x['id']!=id_]
r.append({"id":id_,"old_metricool_id":int(old),"new_id":int(new) if new else None,"uuid":uuid,"ok":ok=='1',"error":err or None})
json.dump(r,open(f,'w'),indent=1,ensure_ascii=False)
print(len(r))
