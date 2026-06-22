'use strict';
const $=id=>document.getElementById(id); let audioCtx, analyser, data, raf, ws, gps=null, baseline=null, events=[], clockOffset=0;
const nodeId=$('nodeId'); nodeId.value=localStorage.nodeId||('NODO-'+Math.random().toString(36).slice(2,7).toUpperCase()); nodeId.onchange=()=>localStorage.nodeId=nodeId.value;
$('thr').oninput=()=> $('thrval').textContent=$('thr').value;
function log(s){$('log').textContent=new Date().toLocaleTimeString()+"  "+s+"\n"+$('log').textContent.slice(0,8000)}
function now(){return Date.now()+clockOffset}
async function start(){
 const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
 audioCtx=new (window.AudioContext||window.webkitAudioContext)(); const src=audioCtx.createMediaStreamSource(stream);
 analyser=audioCtx.createAnalyser(); analyser.fftSize=4096; analyser.smoothingTimeConstant=.55; src.connect(analyser); data=new Uint8Array(analyser.frequencyBinCount);
 $('status').textContent='ASCOLTO'; $('status').className='big ok'; loop(); log('Microfono avviato');
}
function extract(){
 analyser.getByteFrequencyData(data); const sr=audioCtx.sampleRate, bin=sr/analyser.fftSize; let total=0, band=0, peaks=[], hf=0, low=0;
 for(let i=1;i<data.length;i++){let f=i*bin,v=data[i]; total+=v; if(f>90&&f<650) low+=v; if(f>650&&f<5200) hf+=v; if(f>120&&f<4500){band+=v; if(v>75) peaks.push([f,v]);}}
 peaks.sort((a,b)=>b[1]-a[1]); peaks=peaks.slice(0,8).sort((a,b)=>a[0]-b[0]);
 let harmonic=0; for(let i=0;i<peaks.length;i++)for(let j=i+1;j<peaks.length;j++){let r=peaks[j][0]/peaks[i][0]; if(Math.abs(r-Math.round(r))<.06 && Math.round(r)>=2 && Math.round(r)<=8) harmonic++;}
 let centroid=0, sum=0; for(let i=1;i<data.length;i++){let f=i*bin,v=data[i]; if(f<6000){centroid+=f*v; sum+=v}}
 centroid=sum?centroid/sum:0; let rough=0; for(let i=2;i<data.length;i++) rough+=Math.abs(data[i]-data[i-1]); rough/=data.length;
 return {ts:now(), node:nodeId.value, total, band, low, hf, peaks, harmonic, centroid, rough, gps};
}
function score(f){
 let b = baseline || {band:3500,rough:6,total:20000}; let s=0;
 s += Math.min(0.35, Math.max(0,(f.band-b.band*1.15)/(b.band*3.5)));
 s += Math.min(0.25, f.harmonic/10);
 s += (f.centroid>350&&f.centroid<2800)?0.18:0;
 s += Math.min(0.15, Math.max(0,(f.rough-b.rough)/(b.rough*5)));
 s += (f.hf>f.low*.8)?0.07:0;
 return Math.max(0,Math.min(1,s));
}
function draw(){ const c=$('spec'),x=c.getContext('2d'),w=c.width,h=c.height; x.clearRect(0,0,w,h); x.fillStyle='#071018'; x.fillRect(0,0,w,h); x.strokeStyle='#5cc8ff'; x.beginPath(); for(let i=0;i<data.length;i++){let xx=i/data.length*w, yy=h-data[i]/255*h; if(i==0)x.moveTo(xx,yy); else x.lineTo(xx,yy)} x.stroke();}
function loop(){ let f=extract(), sc=score(f); draw(); $('score').textContent=sc.toFixed(2); $('features').textContent=`centroide ${f.centroid.toFixed(0)} Hz | armoniche ${f.harmonic} | picchi ${f.peaks.map(p=>p[0].toFixed(0)).join(', ')} Hz`;
 if(sc>parseFloat($('thr').value)){ $('status').textContent='POSSIBILE DRONE'; $('status').className='big bad'; if(navigator.vibrate) navigator.vibrate(100); let ev={...f,score:sc,type:'DRONE_CANDIDATE'}; events.push(ev); send({kind:'event',event:ev}); log(`Evento locale score=${sc.toFixed(2)}`); } else {$('status').textContent='ASCOLTO'; $('status').className='big ok'}
 raf=requestAnimationFrame(loop);
}
async function calibrate(){ if(!analyser) return alert('Avvia prima il microfono'); log('Calibrazione 20s... resta in silenzio ambientale normale'); let arr=[], end=Date.now()+20000; while(Date.now()<end){arr.push(extract()); await new Promise(r=>setTimeout(r,250));}
 baseline={band:avg(arr,'band'),rough:avg(arr,'rough'),total:avg(arr,'total')}; log('Baseline salvata: '+JSON.stringify(baseline));}
function avg(a,k){return a.reduce((s,x)=>s+x[k],0)/a.length}
function send(o){ if(ws&&ws.readyState===1) ws.send(JSON.stringify({...o,node:nodeId.value,clientTs:Date.now(),gps}))}
function connect(){ ws=new WebSocket($('wsurl').value); ws.onopen=()=>{$('mesh').textContent='Connesso'; log('Mesh connessa'); send({kind:'hello'})}; ws.onmessage=e=>{let m=JSON.parse(e.data); if(m.kind==='alarm'){$('alarm').textContent=m.level; $('alarm').className='big bad'; $('confirm').textContent=m.count; $('estimate').textContent=m.estimate?JSON.stringify(m.estimate):''} if(m.kind==='sync_reply'){clockOffset=m.serverTs-Date.now(); log('Offset clock '+clockOffset+' ms')} if(m.kind==='info')log('Server: '+m.text)}; ws.onclose=()=>{$('mesh').textContent='Disconnesso'} }
function geo(){navigator.geolocation.watchPosition(p=>{gps={lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy}; $('pos').textContent=`${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)} ±${gps.acc.toFixed(0)}m`; send({kind:'pos'});},e=>alert(e.message),{enableHighAccuracy:true,maximumAge:1000})}
function exportCsv(){let rows=['ts,node,score,lat,lon,centroid,harmonic,band,rough']; for(const e of events) rows.push([e.ts,e.node,e.score,e.gps?.lat||'',e.gps?.lon||'',e.centroid,e.harmonic,e.band,e.rough].join(',')); let a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'})); a.download='skylisten-events.csv'; a.click()}
$('start').onclick=start; $('calib').onclick=calibrate; $('geo').onclick=geo; $('connect').onclick=connect; $('sync').onclick=()=>send({kind:'sync'}); $('beacon').onclick=()=>send({kind:'event',event:{ts:now(),node:nodeId.value,score:.9,type:'TEST',gps}}); $('export').onclick=exportCsv;
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
