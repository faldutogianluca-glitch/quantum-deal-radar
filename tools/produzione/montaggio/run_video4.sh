#!/bin/bash
S=/tmp/qre-work
cd $S/hg
for i in $(seq 1 120); do
  python3 gen.py poll 2>&1 | grep "^video-4 " | grep -q completed && break
  python3 gen.py poll 2>&1 | grep "^video-4 " | grep -q failed && { echo "VIDEO4 FAILED"; exit 1; }
  sleep 30
done
[ -f out/video-4.mp4 ] || { echo "VIDEO4 MISSING"; exit 1; }
cd $S/impegni && NODE_USE_ENV_PROXY=1 bash prep.sh 4 || exit 1
python3 $S/impegni/gen.py 4 >/dev/null || { echo "GEN FAIL"; exit 1; }
for k in 9x16 4x5; do
  cd /home/user/quantum-deal-radar/videos/impegni-scritti-$k
  npx --yes hyperframes@0.8.161 check >$S/impegni/check-v4-$k.log 2>&1 && echo "CHECK OK $k" || echo "CHECK FAIL $k"
  npx --yes hyperframes@0.8.161 render -o renders/impegni-scritti-4-$k.mp4 >$S/impegni/render-4-$k.log 2>&1 && echo "RENDER OK $k" || echo "RENDER FAIL $k"
done
echo DONE4
