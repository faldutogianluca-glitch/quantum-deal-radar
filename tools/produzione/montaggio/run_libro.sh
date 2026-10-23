#!/bin/bash
# Video dal libro: attesa HeyGen -> audio/trascrizione (9x16 e 4x5) -> prova del video 1 in 9:16, versione A
S=/tmp/qre-work
V=/home/user/quantum-deal-radar/videos
cd $S/hg
for i in $(seq 1 120); do out=$(python3 gen.py poll 2>&1 | grep libro); echo "$out" | grep -q failed && { echo "$out"; exit 1; }; echo "$out" | grep -q -v completed || break; sleep 30; done
python3 gen.py poll >/dev/null 2>&1
for n in 1 2 3 4; do
  SRC=$S/hg/out/libro-$n.mp4; W=$S/impegni/libro$n; mkdir -p $W
  P=$V/libro-nuda-proprieta-9x16/assets/avatar
  [ -f $P/vL$n.mp4 ] || ffmpeg -v error -y -i $SRC -an -c:v libx264 -crf 17 -preset medium -g 25 -pix_fmt yuv420p $P/vL$n.mp4
  [ -f $P/vL$n-audio.m4a ] || ffmpeg -v error -y -i $SRC -vn -af loudnorm=I=-14:TP=-1.5:LRA=11 -ar 48000 -c:a aac -b:a 192k $P/vL$n-audio.m4a
  if [ ! -f $P/vL$n-words.json ]; then
    ( cd $W && NODE_USE_ENV_PROXY=1 npx hyperframes transcribe $SRC -e parakeet -l it -d tr --json >/dev/null 2>&1 )
    python3 -c "import json;d=json.load(open('$W/tr/transcript.json'));W=d if isinstance(d,list) else d['words'];json.dump([{'text':w['text'],'start':w['start'],'end':w['end']} for w in W],open('$P/vL$n-words.json','w'),ensure_ascii=False)"
  fi
  cp -n $P/vL$n* $V/libro-nuda-proprieta-4x5/assets/avatar/
  echo "pronto $n"
done
cd $V/libro-nuda-proprieta-9x16 && python3 $S/impegni/gen.py libro 1 A 9x16 | cut -c1-200
npx --yes hyperframes@0.8.161 check > $S/impegni/check-L1.log 2>&1 && echo "CHECK OK" || echo "CHECK FAIL"
npx --yes hyperframes@0.8.161 render -o renders/libro-1-A-9x16.mp4 > $S/impegni/render-L1A.log 2>&1 && echo "RENDER OK" || echo "RENDER FAIL"
