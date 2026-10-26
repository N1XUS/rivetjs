#!/bin/zsh
# Lane X7: median of R isolated worker processes per mode. usage: cold-run.sh <out dir of cold-build.mjs> <greeting|details> <n> [R=5]
D=$1; L=$2; N=$3; R=${4:-5}; W=$(dirname $0)/cold-worker.mjs
req=20; warm=8; [ $N -le 100 ] && { req=150; warm=40; }; [ $N -le 1 ] && { req=2000; warm=300; }
for m in ordinary-resume ordinary; do
  for r in $(seq $R); do node $W $D/$L.$m.mjs $N $req $warm; done | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=s.trim().split("\n").map(JSON.parse);const med=f=>a.map(f).sort((x,y)=>x-y)[a.length>>1];
console.log(process.argv[1].padEnd(24),"cpu",med(j=>j.cpuMs).toFixed(3),"ms  wall",med(j=>j.wallMs).toFixed(3),"ms  maxRSS",(med(j=>j.maxRSSKiB)/1024).toFixed(0),"MiB  bytes",a[0].bytes,a[0].hash.slice(0,10))})' "$L.$m"
done
