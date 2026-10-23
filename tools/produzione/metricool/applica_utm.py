import json,sys
S='/tmp/qre-work'
P='/home/user/quantum-deal-radar/marketing/calendario-pubblicazioni.json'
cal=json.load(open(P)); byid={p['id']:p for p in cal['contenuti']}
res=json.load(open(f'{S}/risultati_utm.json'))
n=0
for r in res:
    if not r['ok'] or not r.get('new_id'): continue
    p=byid.get(r['id'])
    if not p: print('manca nel calendario',r['id']); continue
    if p.get('metricool_id')!=r['new_id']:
        p['metricool_id']=r['new_id']; n+=1
    if r.get('uuid') and p.get('metricool_uuid') and p['metricool_uuid']!=r['uuid']: print('uuid diverso',r['id'])
    note='Link tracciato (utm) applicato il 22/10/2026.'
    if note not in (p.get('note') or ''): p['note']=((p.get('note') or '')+' '+note).strip()
json.dump(cal,open(P,'w'),ensure_ascii=False,indent=1); open(P,'a').write('\n')
print('id aggiornati',n,'su',sum(1 for r in res if r['ok'] and r.get('new_id')))
