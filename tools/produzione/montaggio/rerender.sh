#!/bin/bash
S=/tmp/qre-work/impegni
P=/home/user/quantum-deal-radar/videos/pillole-tiktok-9x16
for n in 6; do
  python3 $S/gen.py $n >/dev/null || exit 1
  cd $P && npx --yes hyperframes@0.8.161 check > $S/check-p$n.log 2>&1 && echo "CHECK OK $n" || echo "CHECK FAIL $n"
  npx --yes hyperframes@0.8.161 render -o renders/pillola-$n-9x16.mp4 > $S/render-p$n.log 2>&1 && echo "OK $n" || echo "RENDER FAIL $n"
done
