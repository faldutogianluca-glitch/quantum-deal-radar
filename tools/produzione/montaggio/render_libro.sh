#!/bin/bash
# Tutte le versioni dei video dal libro: 9:16 A e B, 4:5 A
S=/tmp/qre-work/impegni
V=/home/user/quantum-deal-radar/videos
for n in ${ONLY:-1 2 3 4}; do
  for job in "A 9x16" "B 9x16" "A 4x5"; do
    set -- $job; var=$1; k=$2
    cd $V/libro-nuda-proprieta-$k
    python3 $S/gen.py libro $n $var $k >/dev/null 2>$S/gen-L$n$var$k.err || { echo "GEN FAIL $n $var $k"; continue; }
    npx --yes hyperframes@0.8.161 check > $S/check-L$n$var$k.log 2>&1 || echo "CHECK FAIL $n $var $k"
    npx --yes hyperframes@0.8.161 render -o renders/libro-$n-$var-$k.mp4 > $S/render-L$n$var$k.log 2>&1 && echo "OK $n $var $k" || echo "RENDER FAIL $n $var $k"
  done
done
echo FINE
