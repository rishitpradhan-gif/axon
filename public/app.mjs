import {demo,parseCSV,parseEDF,analyzeChannel,VERSION,LIMITS} from './engine.mjs';
const $=s=>document.querySelector(s),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=2)=>n==null?'—':Number(n).toLocaleString('en-US',{maximumFractionDigits:d});
let recording=demo(),sourceName='Oscillation study',fileHash=null,selected=4,start=0,pinned=null,notes=[],analysis,timer;
const duration=()=>Math.min(+$('#window').value,recording.duration);
function toast(s){$('#toast').textContent=s;clearTimeout(timer);timer=setTimeout(()=>$('#toast').textContent='',4000);}
function saveFile(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function traces(){
 const width=1040,left=66,right=35,top=35,rowHeight=48,height=top+recording.channels.length*rowHeight+25,len=duration(),scale=+$('#scale').value,plotWidth=width-left-right;
 let svg=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Raw channel envelopes in microvolts; missing bins appear as gaps">`;
 for(let i=0;i<=8;i++){const x=left+i*plotWidth/8;svg+=`<line x1="${x}" y1="23" x2="${x}" y2="${height-25}" stroke="#eeeaf3"/><text x="${x}" y="13" text-anchor="middle">${fmt(start+len*i/8,2)} s</text>`;}
 recording.channels.forEach((channel,index)=>{
 const center=top+index*rowHeight+rowHeight/2,a=Math.floor(start*channel.fs),b=Math.min(channel.samples.length,Math.floor((start+len)*channel.fs));
 if(index===selected)svg+=`<rect x="0" y="${center-22}" width="${width}" height="44" fill="#f4f0f9" rx="5"/>`;
 svg+=`<text x="6" y="${center+4}" fill="#75618f">${escape(channel.label.slice(0,9))}</text><line x1="${left}" y1="${center}" x2="${width-right}" y2="${center}" stroke="#e9e5ef" stroke-dasharray="2 3"/>`;
 const bins=Math.min(900,b-a),path=[];
 for(let j=0;j<bins;j++){const lo=a+Math.floor(j*(b-a)/bins),hi=a+Math.floor((j+1)*(b-a)/bins);let min=Infinity,max=-Infinity,missing=false;for(let k=lo;k<hi;k++){const v=channel.samples[k];if(!Number.isFinite(v)){missing=true;break;}min=Math.min(min,v);max=Math.max(max,v);}if(missing)continue;
 const x=left+(j+.5)/bins*plotWidth,y1=center-Math.max(-scale,Math.min(scale,max))/scale*20,y2=center-Math.max(-scale,Math.min(scale,min))/scale*20;
 path.push(`M${x.toFixed(2)} ${y1.toFixed(2)}V${y2.toFixed(2)}`);}
 svg+=`<path d="${path.join(' ')}" fill="none" stroke="${index===selected?'#7054a3':'#ad9ac8'}" stroke-width="1.1" stroke-linecap="round"/>`;
 });svg+=`<path d="M${width-20} ${height-47}v20h7" fill="none" stroke="#85758e"/><text x="${width-24}" y="${height-5}" text-anchor="end">${scale} µV</text></svg>`;$('#traces').innerHTML=svg;
}
function spectrum(){
 const current=analysis.spectrum,other=pinned?.analysis.spectrum,valid=[current,other].filter(s=>s?.density);
 if(!valid.length){$('#spectrum').innerHTML='<p class="small-note">No usable spectral segments. Choose a window with finite samples.</p>';return;}
 const width=660,height=230,left=52,right=15,top=20,bottom=35,maxHz=Math.min(80,Math.max(analysis.fs/2,pinned?.analysis.fs/2||0));
 const db=x=>10*Math.log10(Math.max(1e-12,x));let lo=Infinity,hi=-Infinity;
 for(const s of valid)s.frequencies.forEach((f,i)=>{if(f<=maxHz){lo=Math.min(lo,db(s.density[i]));hi=Math.max(hi,db(s.density[i]));}});
 lo=Math.max(-120,Math.floor(lo/20)*20);hi=Math.max(lo+20,Math.ceil(hi/10)*10);const x=f=>left+f/maxHz*(width-left-right),y=d=>height-bottom-(d-lo)/(hi-lo)*(height-top-bottom);
 let svg=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Welch spectral density in decibels relative to one square microvolt per hertz"><text x="${left}" y="11">dB re 1 µV²/Hz</text>`;
 for(let i=0;i<=4;i++){const d=lo+(hi-lo)*i/4,yy=y(d);svg+=`<line x1="${left}" y1="${yy}" x2="${width-right}" y2="${yy}" stroke="#ece8f0"/><text x="${left-10}" y="${yy+3}" text-anchor="end">${fmt(d,0)}</text>`;}
 for(let i=0;i<=8;i++){const hz=i*maxHz/8;svg+=`<text x="${x(hz)}" y="${height-12}" text-anchor="middle">${fmt(hz,1)}</text>`;}
 const draw=(s,color,dash='')=>{if(!s?.density)return '';const points=s.frequencies.flatMap((f,i)=>f<=maxHz?[`${x(f).toFixed(2)},${y(db(s.density[i])).toFixed(2)}`]:[]).join(' ');return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.8" ${dash?'stroke-dasharray="5 4"':''}/>`;};
 svg+=draw(other,'#b88b57',true)+draw(current,'#8064ad')+`<text x="${width-12}" y="${height-1}" text-anchor="end">Hz</text></svg>`;$('#spectrum').innerHTML=svg;
}
function render(){
 const len=duration();start=Math.max(0,Math.min(start,recording.duration-len));const channel=recording.channels[selected];
 analysis=analyzeChannel(channel,start,start+len,{segmentSeconds:+$('#segment').value,threshold:+$('#threshold').value});
 $('#recording-name').textContent=sourceName;$('#page-title').textContent=sourceName;$('#format').textContent=recording.format==='Synthetic'?'SYNTHETIC DEMO':recording.format.toUpperCase();$('#duration').textContent=fmt(recording.duration)+' s';$('#channel-count').textContent=recording.channels.length;
 $('#channels').innerHTML=recording.channels.map((c,i)=>`<button class="channel ${i===selected?'active':''}" data-channel="${i}" aria-pressed="${i===selected}"><span><i></i>${escape(c.label)}</span><small>${fmt(c.fs)} Hz</small></button>`).join('');
 $('#window-label').textContent=`${fmt(start)} — ${fmt(start+len)} s`;
 $('#start').value=start.toFixed(3);$('#start').max=Math.max(0,recording.duration-len);$('#timeline').max=Math.max(0,recording.duration-len);$('#timeline').value=start;
 $('#selected-label').textContent=channel.label;$('#sample-info').textContent=`${fmt(channel.fs)} Hz selected · ${analysis.end_sample_exclusive-analysis.start_sample} samples`;
 $('#peak').textContent=analysis.peak_1_45_Hz===null?'—':fmt(analysis.peak_1_45_Hz)+' Hz';$('#rms').textContent=fmt(analysis.rms_ac_uV)+' µV';$('#segments').textContent=analysis.spectrum.segments_used+' / '+analysis.spectrum.segments_total;
 $('#spectral-detail').textContent=`Actual segment ${fmt(analysis.spectrum.segment_seconds,3)} s · Δf ${fmt(analysis.spectrum.df,3)} Hz · ${analysis.spectrum.tail_samples} unused tail samples. Acquisition prefilter: ${channel.prefilter}.`;
 $('#review-count').textContent=analysis.flags.length+' FLAGS';$('#flags').innerHTML=analysis.flags.length?analysis.flags.map(f=>`<div class="flag">${escape(f)}</div>`).join(''):'<div class="flag clear">No flags under these limited checks.</div>';
 const total=analysis.bands.reduce((s,b)=>s+(b.power_uV2||0),0);
 $('#bands').innerHTML=analysis.bands.map(b=>`<div class="band"><span title="${b.low}–${b.high} Hz">${b.name}</span><div class="band-meter"><div class="band-fill" style="width:${total?b.power_uV2/total*100:0}%"></div></div><b>${b.power_uV2===null?'n/a':fmt(b.power_uV2)}</b></div>`).join('');
 $('#pinned-label').textContent=pinned?`┄┄ ${pinned.analysis.channel} / ${fmt(pinned.analysis.start_s)}–${fmt(pinned.analysis.end_s)} s`:'';$('#unpin').hidden=!pinned;
 $('#record-warning').textContent=recording.warnings.join(' ');$('#notes').innerHTML=notes.map((n,i)=>`<div class="note-row"><span>${fmt(n.start_s)}–${fmt(n.end_s)} s<br>${escape(n.channel)}</span><p>${escape(n.text)}</p><button data-delete="${i}" aria-label="Delete note ${i+1}">×</button></div>`).join('');traces();spectrum();
}
function safeRender(){try{render();}catch(e){toast(e.message);}}
$('#channels').onclick=e=>{const b=e.target.closest('[data-channel]');if(b){selected=+b.dataset.channel;safeRender();}};
$('#timeline').oninput=e=>{start=+e.target.value;safeRender();};$('#start').onchange=e=>{if(!Number.isFinite(e.target.valueAsNumber))return render();start=e.target.valueAsNumber;safeRender();};
for(const id of ['window','scale','segment'])$('#'+id).onchange=safeRender;
$('#threshold').onchange=e=>{if(!e.target.checkValidity()||!e.target.value){e.target.value=150;toast('Threshold reset to 150 µV.');}safeRender();};
$('#prev').onclick=()=>{start-=duration();safeRender();};$('#next').onclick=()=>{start+=duration();safeRender();};
$('#pin').onclick=()=>{pinned={analysis:structuredClone(analysis),source:sourceName,file_sha256:fileHash};render();};$('#unpin').onclick=()=>{pinned=null;render();};
$('#note-form').onsubmit=e=>{e.preventDefault();const text=$('#note').value.trim();if(!text)return;if(notes.length>=100)return toast('Maximum 100 notes per session.');notes.push({start_s:analysis.start_s,end_s:analysis.end_s,channel:analysis.channel,text});$('#note').value='';render();};$('#notes').onclick=e=>{const b=e.target.closest('[data-delete]');if(b){notes.splice(+b.dataset.delete,1);render();}};
$('#methods').onclick=()=>$('#methods-dialog').showModal();$('#import').onclick=()=>{$('#import-error').textContent='';$('#import-dialog').showModal();};
$('#reset').onclick=()=>{if(!confirm('Replace this recording and notes with the synthetic demo? Export first to keep the analysis.'))return;recording=demo();sourceName='Oscillation study';fileHash=null;selected=4;start=0;pinned=null;notes=[];render();};
$('#load').onclick=async()=>{
 const button=$('#load');button.disabled=true;try{
 const file=$('#file').files[0];if(!file)throw Error('Choose an EDF or CSV recording.');if(file.size>LIMITS.bytes)throw Error('Maximum recording size is 32 MiB.');const bytes=await file.arrayBuffer();let next;
 if(/\.edf$/i.test(file.name))next=parseEDF(bytes);else if(/\.csv$/i.test(file.name))next=parseCSV(new TextDecoder('utf-8',{fatal:true}).decode(bytes),$('#csv-rate').valueAsNumber,$('#csv-unit').value);else throw Error('Choose a .edf or .csv file.');
 if(next.channels.some(c=>c.samples.length<8))throw Error('Each channel needs at least eight samples.');
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
 recording=next;sourceName=file.name;fileHash=hash;selected=0;start=0;pinned=null;notes=[];render();$('#import-dialog').close();toast('Recording opened locally. No data uploaded.');
 }catch(e){$('#import-error').textContent=e.message;}finally{button.disabled=false;}
};
$('#export').onclick=()=>{const report={schema:'axon-analysis/1',engine:VERSION,generated_at:new Date().toISOString(),source:{name:sourceName,file_sha256:fileHash,synthetic_seed:recording.format==='Synthetic'?713:null,format:recording.format,duration_s:recording.duration,channels:recording.channels.map(c=>({label:c.label,fs:c.fs,unit:c.unit,prefilter:c.prefilter,reference:c.reference,calibration:c.calibration}))},analysis,pinned,notes,limitations:['No raw samples included. Retain original file to reproduce.','No clinical interpretation or statistical inference.','Welch segments with missing samples are omitted; no interpolation.']};saveFile(JSON.stringify(report,null,2),'axon-analysis.json','application/json');toast('Analysis exported. Retain your original recording to reproduce it.');};
render();
