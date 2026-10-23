#!/bin/bash
# Pillole TikTok 6, 10, 14: HeyGen -> attesa -> audio/trascrizione -> montaggio -> check -> render
set -e
S=/tmp/qre-work
P=/home/user/quantum-deal-radar/videos/pillole-tiktok-9x16
cd $S/hg
grep -q pillola-14 jobs.json || python3 gen.py pillole
for i in $(seq 1 120); do out=$(python3 gen.py poll 2>&1 | grep pillola); echo "$out" | grep -q -v completed || break; echo "$out" | grep -q failed && { echo "$out"; exit 1; }; sleep 30; done
for n in 6 10 14; do
  SRC=$S/hg/out/pillola-$n.mp4; W=$S/impegni/pill$n; mkdir -p $W
  ffmpeg -v error -y -i $SRC -an -c:v libx264 -crf 17 -preset medium -g 25 -pix_fmt yuv420p $P/assets/avatar/v$n.mp4
  ffmpeg -v error -y -i $SRC -vn -af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 48000 -c:a aac -b:a 192k $P/assets/avatar/v$n-audio.m4a
  ( cd $W && NODE_USE_ENV_PROXY=1 npx hyperframes transcribe $SRC -e parakeet -l it -d tr --json >/dev/null 2>&1 )
  python3 -c "import json;d=json.load(open('$W/tr/transcript.json'));W=d if isinstance(d,list) else d['words'];json.dump([{'text':w['text'],'start':w['start'],'end':w['end']} for w in W],open('$P/assets/avatar/v$n-words.json','w'),ensure_ascii=False)"
  python3 $S/impegni/gen.py $n
  cd $P && npx --yes hyperframes@0.8.161 check >/dev/null 2>&1 || echo "CHECK FAIL $n"
  npx --yes hyperframes@0.8.161 render -o renders/pillola-$n-9x16.mp4 > $S/impegni/render-p$n.log 2>&1 && echo "OK $n" || echo "RENDER FAIL $n"
done
