import json,sys,os
f='risultati_statici.json'
r=json.load(open(f)) if os.path.exists(f) else []
id_,old,new,uuid,ok=sys.argv[1:6]; err=sys.argv[6] if len(sys.argv)>6 else None
r=[x for x in r if x['id']!=id_]
r.append({"id":id_,"old_metricool_id":int(old),"new_id":int(new) if new!='null' else None,"uuid":uuid,"ok":ok=='true',"error":err})
json.dump(r,open(f,'w'),indent=1,ensure_ascii=False); print(len(r))
