#!/bin/bash
# Render delle 4 puntate in 9:16 e 4:5
G=/tmp/qre-work/impegni/gen.py
V=/home/user/quantum-deal-radar/videos
for n in 1 2 3 4; do
  python3 $G $n >/dev/null || exit 1
  for k in 9x16 4x5; do
    cd $V/impegni-scritti-$k
    npx --yes hyperframes@0.8.161 check >/dev/null 2>&1 || echo "CHECK FAIL $n $k"
    npx --yes hyperframes@0.8.161 render -o renders/impegni-scritti-$n-$k.mp4 >/tmp/qre-work/impegni/render-$n-$k.log 2>&1 && echo "OK $n $k" || echo "RENDER FAIL $n $k"
  done
done
