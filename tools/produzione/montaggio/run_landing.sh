#!/bin/bash
# Video landing 31, 32, 33: attesa HeyGen, preparazione, montaggio, controllo, render
S=/tmp/qre-work
cd $S/hg
for i in $(seq 1 120); do
  out=$(python3 gen.py poll 2>&1 | grep -E "^video-3[123] ")
  echo "$out" | grep -q failed && { echo "FAILED: $out"; exit 1; }
  [ "$(echo "$out" | grep -c completed)" -ge 3 ] && break
  sleep 30
done
for n in 31 32 33; do
  [ -f out/video-$n.mp4 ] || { echo "MISSING $n"; exit 1; }
  ( cd $S/impegni && NODE_USE_ENV_PROXY=1 bash prep.sh $n > $S/impegni/prep-$n.log 2>&1 ) || { echo "PREP FAIL $n"; continue; }
  python3 $S/impegni/gen.py $n > $S/impegni/gen-$n.log 2>&1 || { echo "GEN FAIL $n"; tail -3 $S/impegni/gen-$n.log; continue; }
  cd /home/user/quantum-deal-radar/videos/impegni-scritti-9x16
  npx --yes hyperframes@0.8.161 check > $S/impegni/check-$n.log 2>&1 && echo "CHECK OK $n" || echo "CHECK FAIL $n"
  npx --yes hyperframes@0.8.161 render -o renders/landing-$n-9x16.mp4 > $S/impegni/render-$n.log 2>&1 && echo "RENDER OK $n" || echo "RENDER FAIL $n"
done
echo DONE31
