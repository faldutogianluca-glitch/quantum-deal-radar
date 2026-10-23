#!/bin/bash
# Prepara l'episodio N: video muto, audio a -14 LUFS, trascrizione parola per parola, nei due progetti.
set -e
N=$1
S=/tmp/qre-work
SRC=$S/hg/out/video-$N.mp4
W=$S/impegni/ep$N; mkdir -p $W
ffmpeg -v error -y -i $SRC -an -c:v libx264 -crf 17 -preset medium -g 25 -pix_fmt yuv420p $W/v$N.mp4
ffmpeg -v error -y -i $SRC -vn -af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 48000 -c:a aac -b:a 192k $W/v$N-audio.m4a
( cd $W && NODE_USE_ENV_PROXY=1 npx hyperframes transcribe $SRC -e parakeet -l it -d tr --json >/dev/null 2>&1 )
python3 - <<PY
import json
d=json.load(open("$W/tr/transcript.json")); W=d if isinstance(d,list) else d["words"]
json.dump([{"text":w["text"],"start":w["start"],"end":w["end"]} for w in W],open("$W/v$N-words.json","w"),ensure_ascii=False)
print(len(W),"parole; fine",W[-1]["end"]); print(" ".join(w["text"] for w in W))
PY
for k in 4x5 9x16; do cp $W/v$N.mp4 $W/v$N-audio.m4a $W/v$N-words.json /home/user/quantum-deal-radar/videos/impegni-scritti-$k/assets/avatar/; done
