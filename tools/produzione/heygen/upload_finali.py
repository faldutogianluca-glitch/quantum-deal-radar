"""Carica nella libreria Assets di HeyGen le versioni finite (sottotitoli e grafiche) dei video avatar."""
import glob, json, os, urllib.request
KEY = os.environ["HEYGEN_API_KEY"]; R = "/home/user/quantum-deal-radar/"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets_finali.json")
done = json.load(open(OUT)) if os.path.exists(OUT) else {}
def api(method, path, body):
    r = urllib.request.Request("https://api.heygen.com" + path, method=method, data=json.dumps(body).encode(),
                               headers={"X-Api-Key": KEY, "Content-Type": "application/json"})
    with urllib.request.urlopen(r, timeout=120) as f: return json.load(f)["data"]
files = sorted(glob.glob(R + "videos/impegni-scritti-*/renders/*.mp4") + glob.glob(R + "videos/pillole-tiktok-9x16/renders/*.mp4")
               + glob.glob(R + "videos/libro-nuda-proprieta-*/renders/*.mp4"))
for f in files:
    name = "FINALE " + os.path.basename(f)
    if name in done: continue
    size = os.path.getsize(f)
    up = api("POST", "/v3/assets/direct-uploads", {"filename": name, "content_type": "video/mp4", "size_bytes": size})
    req = urllib.request.Request(up["upload_url"], method="PUT", data=open(f, "rb").read(), headers=up.get("upload_headers") or {"Content-Type": "video/mp4"})
    urllib.request.urlopen(req, timeout=600).read()
    c = api("POST", f"/v3/assets/{up['asset_id']}/complete", {})
    done[name] = {"asset_id": up["asset_id"], "url": c.get("url")}
    json.dump(done, open(OUT, "w"), indent=1); print("ok", name, up["asset_id"], flush=True)
print("FINE", len(done))
