"""Genera i video avatar HeyGen della serie "Impegni scritti".
Uso: python3 gen.py test   -> 2 prove da ~10 s sul look 42 (voce clone e voce italiana)
     python3 gen.py serie VOICE_ID -> i 4 video
Scrive gli id in jobs.json; poll con: python3 gen.py poll"""
import json, os, re, sys, time, urllib.request
BASE = "https://api.heygen.com"
KEY = os.environ["HEYGEN_API_KEY"]
HERE = os.path.dirname(os.path.abspath(__file__))
JOBS = os.path.join(HERE, "jobs.json")
# Look 2 "Thoughtful person in black hoodie" (lo stesso della pillola caparra), scelto da Pitágora il 20/10
LOOK = "be4625ecae0b4a1a8a40d5894ddfaf28"
LOOKS = {i: LOOK for i in (1, 2, 3, 4)}
VOICES = {"clone": "3e1efa8926764447a60b1ee091b03a02", "italiana": "3c27cf868333414c97d0d0b8fb8cba56"}
MD = "/home/user/quantum-deal-radar/marketing/video-avatar/impegni-scritti.md"
MOTION = "speaking calmly and confidently to camera, hands resting together, small natural hand gestures on key words"

def req(method, path, body=None):
    r = urllib.request.Request(BASE + path, method=method, headers={"X-Api-Key": KEY, "Content-Type": "application/json"},
                               data=json.dumps(body).encode() if body else None)
    with urllib.request.urlopen(r, timeout=60) as f:
        return json.load(f)

def scripts():
    t = open(MD).read()
    return [re.sub(r"\n\n+", "\n\n", s).strip() for s in re.findall(r"## Video \d\..*?```\n(.*?)```", t, re.S)]

def create(look, voice, script, title, speed=1.0):
    body = {"type": "avatar", "avatar_id": look, "voice_id": voice, "script": script, "title": title,
            "resolution": "1080p", "aspect_ratio": "9:16", "motion_prompt": MOTION, "expressiveness": "medium",
            "voice_settings": {"locale": "it-IT", "speed": speed}}
    return req("POST", "/v3/videos", body)["data"]["video_id"]

def save(jobs): json.dump(jobs, open(JOBS, "w"), indent=1)
jobs = json.load(open(JOBS)) if os.path.exists(JOBS) else {}
cmd = sys.argv[1]
if cmd == "test":
    line = "Quante volte hai mandato un immobile a un compratore e non hai più saputo niente? Da noi non succede."
    for name, v in VOICES.items():
        jobs[f"prova-{name}"] = create(LOOKS[1], v, line, f"Prova voce {name}")
    save(jobs)
elif cmd == "serie":
    v = sys.argv[2]
    for i, s in enumerate(scripts(), 1):
        jobs[f"video-{i}"] = create(LOOKS[i], v, s, f"Impegni scritti {i}")
    save(jobs)
elif cmd == "pillole":
    # pillole TikTok (copioni in marketing/analisi-tiktok-2026-10.md), voce un po' più rapida per stare nei 60 s
    P = json.load(open(os.path.join(HERE, "..", "impegni", "pillole.json")))
    for n, s in P.items():
        jobs[f"pillola-{n}"] = create(LOOK, VOICES["clone"], s.replace("Facile.it", "Facile punto it"), f"La casa in pillole {n} TikTok", 1.07)
    save(jobs)
elif cmd == "pillole2":
    # secondo lotto di pillole (1, 13, 15): copioni in videos/pillole-tiktok-9x16/copioni.json, solo dopo l'approvazione di Pitagora
    P = json.load(open("/home/user/quantum-deal-radar/videos/pillole-tiktok-9x16/copioni.json"))
    for n in ("1", "13", "15"):
        k = f"pillola-{n}"
        if k in jobs: continue
        jobs[k] = create(LOOK, VOICES["clone"], P[n], f"La casa in pillole {n} TikTok", 1.07)
        save(jobs)
elif cmd == "libro":
    # video dal libro (copioni approvati in marketing/libro-nuda-proprieta/primo-lotto.md, sezioni 1-4)
    t = open("/home/user/quantum-deal-radar/marketing/libro-nuda-proprieta/primo-lotto.md").read()
    for n in (1, 2, 3, 4):
        k = f"libro-{n}"
        if k in jobs: continue
        s = re.search(r"```\n(.*?)```", re.split(r"\n## \d\. ", t)[n], re.S).group(1).strip()
        jobs[k] = create(LOOK, VOICES["clone"], re.sub(r"\n\n+", "\n\n", s), f"Libro nuda proprieta {n}", 1.07)
        save(jobs)
elif cmd == "poll":
    os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
    for k, vid in jobs.items():
        d = req("GET", f"/v3/videos/{vid}")["data"]
        print(k, d["status"], d.get("failure_message") or "")
        out = os.path.join(HERE, "out", k + ".mp4")
        if d["status"] == "completed" and not os.path.exists(out):
            urllib.request.urlretrieve(d["video_url"], out)
