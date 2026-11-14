export const VERSION='axon-dsp/1.0.0';
export const LIMITS={bytes:32*1024*1024,channels:32,samples:4_000_000};
export const BANDS=[['Delta',1,4],['Theta',4,8],['Alpha',8,13],['Beta',13,30],['Gamma',30,45]];
const strict=s=>/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(String(s).trim())?Number(s):NaN;
export function fft(re,im){
 const n=re.length;if(n<2||(n&(n-1))||im.length!==n)throw Error('FFT requires equal power-of-two arrays.');
 for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
 for(let size=2;size<=n;size*=2){const angle=-2*Math.PI/size,wr=Math.cos(angle),wi=Math.sin(angle);for(let start=0;start<n;start+=size){let ar=1,ai=0;for(let j=0;j<size/2;j++){const a=start+j,b=a+size/2,tr=ar*re[b]-ai*im[b],ti=ar*im[b]+ai*re[b];re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;const next=ar*wr-ai*wi;ai=ar*wi+ai*wr;ar=next;}}}
}
export function welch(samples,fs,segmentSeconds=2){
 if(!Number.isFinite(fs)||fs<1||fs>100000||!Number.isFinite(segmentSeconds)||segmentSeconds<=0)throw Error('Invalid sampling/segment rate.');
 const n=2**Math.floor(Math.log2(Math.min(samples.length,fs*segmentSeconds,8192)));
 if(n<8)throw Error('Select at least eight samples.');
 const step=n/2,window=Float64Array.from({length:n},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/n)),sumW=window.reduce((a,b)=>a+b*b,0),psd=new Float64Array(n/2+1);
 let used=0,rejected=0,total=0,lastEnd=0;
 for(let start=0;start+n<=samples.length;start+=step){total++;lastEnd=start+n;const segment=samples.subarray? samples.subarray(start,start+n):samples.slice(start,start+n);if(!segment.every(Number.isFinite)){rejected++;continue;}
 const mean=segment.reduce((a,b)=>a+b,0)/n,re=Float64Array.from(segment,(v,i)=>(v-mean)*window[i]),im=new Float64Array(n);fft(re,im);
 for(let k=0;k<psd.length;k++)psd[k]+=(re[k]*re[k]+im[k]*im[k])/(fs*sumW)*(k===0||k===n/2?1:2);used++;
 }
 if(used)for(let k=0;k<psd.length;k++)psd[k]/=used;
 return {frequencies:Array.from(psd,(_,k)=>k*fs/n),density:used?Array.from(psd):null,nperseg:n,segment_seconds:n/fs,overlap_samples:step,df:fs/n,segments_used:used,segments_rejected:rejected,segments_total:total,tail_samples:samples.length-lastEnd,window:'periodic Hann',detrend:'segment mean',scaling:'one-sided density; uV^2/Hz'};
}
export function bandPower(spectrum,low,high,fs){
 if(!spectrum.density||high>fs/2||!spectrum.frequencies.some(f=>f>=low&&f<high))return null;
 return spectrum.density.reduce((sum,p,i)=>sum+(spectrum.frequencies[i]>=low&&spectrum.frequencies[i]<high?p*spectrum.df:0),0);
}
export function analyzeChannel(channel,start,end,{segmentSeconds=2,threshold=150}={}){
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>channel.samples.length/channel.fs+1e-9)throw Error('Window outside recording.');
 if(!Number.isFinite(threshold)||threshold<=0)throw Error('Threshold must be positive.');
 const a=Math.floor(start*channel.fs),b=Math.min(channel.samples.length,Math.floor(end*channel.fs)),samples=channel.samples.slice(a,b),finite=Array.from(samples).filter(Number.isFinite);
 const mean=finite.length?finite.reduce((a,b)=>a+b,0)/finite.length:null;
 let variance=0,min=Infinity,max=-Infinity,excursions=0,railCount=0;
 for(let i=0;i<samples.length;i++){const v=samples[i];if(Number.isFinite(v)){variance+=(v-mean)**2;min=Math.min(min,v);max=Math.max(max,v);if(Math.abs(v)>threshold)excursions++;}if(channel.rails?.[a+i])railCount++;}
 const spectrum=Math.min(samples.length,channel.fs*segmentSeconds)>=8?welch(samples,channel.fs,segmentSeconds):{density:null,frequencies:[],nperseg:0,segment_seconds:0,overlap_samples:0,df:null,segments_used:0,segments_rejected:0,segments_total:0,tail_samples:samples.length,window:'unavailable',detrend:'unavailable',scaling:'unavailable'},flags=[];
 if(Math.min(samples.length,channel.fs*segmentSeconds)<8)flags.push('FFT target or window has fewer than eight samples; spectrum unavailable');
 if(finite.length<samples.length)flags.push(`${samples.length-finite.length} missing samples; overlapping spectral segments excluded`);
 if(excursions)flags.push(`${excursions} samples exceed ±${threshold} µV (heuristic only)`);
 if(railCount)flags.push(`${railCount} samples at declared ADC rails`);
 if(finite.length&&max-min<1e-6)flags.push('Near-constant signal');
 if(spectrum.segments_used<3)flags.push('Fewer than three usable spectral segments');
 let peak=null;if(spectrum.density){let best=0;for(let i=0;i<spectrum.density.length;i++)if(spectrum.frequencies[i]>=1&&spectrum.frequencies[i]<=Math.min(45,channel.fs/2)&&spectrum.density[i]>best){best=spectrum.density[i];peak=spectrum.frequencies[i];}}
 const bands=BANDS.map(([name,lo,hi])=>({name,low:lo,high:hi,power_uV2:bandPower(spectrum,lo,hi,channel.fs)}));
 return {channel:channel.label,fs:channel.fs,start_sample:a,end_sample_exclusive:b,start_s:a/channel.fs,end_s:b/channel.fs,finite_samples:finite.length,missing_samples:samples.length-finite.length,mean_uV:mean,rms_ac_uV:finite.length?Math.sqrt(variance/finite.length):null,range_uV:finite.length?max-min:null,excursion_samples:excursions,adc_rail_samples:channel.rails?railCount:null,threshold_uV:threshold,peak_1_45_Hz:peak,bands,spectrum,flags};
}
export function parseCSV(text,fs,unit='uV'){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>LIMITS.bytes)throw Error('CSV exceeds 32 MiB.');
 if(!Number.isFinite(fs)||fs<1||fs>100000)throw Error('Sample rate must be 1–100000 Hz.');
 const factor=({uV:1,'µV':1,'μV':1,mV:1000,V:1e6})[unit];if(!factor)throw Error('Use uV, mV or V.');
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/);if(lines.at(-1)==='')lines.pop();const labels=lines.shift().split(',').map(s=>s.trim());
 if(labels.some(s=>/^(time|time_s|timestamp)$/i.test(s)))throw Error('Remove the time column; declare the sample rate explicitly.');
 if(!labels.length||labels.length>LIMITS.channels||labels.some(s=>!s||s.length>80||/["\r\n]/.test(s))||new Set(labels).size!==labels.length)throw Error('Use 1–32 unique channel-name headers, without CSV quotes.');
 if(lines.length<8||lines.length*labels.length>LIMITS.samples)throw Error('Use at least eight rows and at most four million total samples.');
 const channels=labels.map(label=>({label,fs,unit:'uV',samples:new Float64Array(lines.length),prefilter:'Not supplied (CSV)',reference:'As supplied'}));
 lines.forEach((line,i)=>{const values=line.split(',');if(values.length!==labels.length)throw Error(`CSV row ${i+2} has the wrong number of channels.`);values.forEach((raw,j)=>{const s=raw.trim();let value=s===''||s.toLowerCase()==='nan'?NaN:strict(s)*factor;if(!Number.isNaN(value)&&(!Number.isFinite(value)||Math.abs(value)>1e9))throw Error(`Value out of range in row ${i+2}.`);if(s!==''&&s.toLowerCase()!=='nan'&&Number.isNaN(value))throw Error(`Nonnumeric sample in row ${i+2}.`);channels[j].samples[i]=value;});});
 return {format:'CSV',channels,duration:lines.length/fs,warnings:['Sample rate, units and original reference are user declarations. No resampling or filtering applied.']};
}
export function parseEDF(buffer){
 if(!(buffer instanceof ArrayBuffer)||buffer.byteLength>LIMITS.bytes||buffer.byteLength<256)throw Error('EDF must be 256 bytes–32 MiB.');
 const bytes=new Uint8Array(buffer),view=new DataView(buffer),decoder=new TextDecoder('ascii');
 const str=(start,n)=>decoder.decode(bytes.subarray(start,start+n)).trim(),num=(start,n)=>strict(str(start,n));
 if(str(0,8)!=='0')throw Error('Only 16-bit classic EDF version 0 is supported.');
 if(str(192,44).startsWith('EDF+'))throw Error('EDF+ is not supported in this release; discontinuous timing and annotations must not be silently discarded. Export continuous classic EDF or sample-only CSV.');
 const header=num(184,8),count=num(252,4),duration=num(244,8);let records=num(236,8);
 if(!Number.isInteger(count)||count<1||count>LIMITS.channels||header!==256+256*count||header>buffer.byteLength||!Number.isFinite(duration)||duration<=0||!Number.isInteger(records)||records< -1)throw Error('Invalid EDF header geometry.');
 let offset=256;const column=n=>{const values=Array.from({length:count},(_,i)=>str(offset+i*n,n));offset+=count*n;return values;};
 const labels=column(16);column(80);const units=column(8),pmin=column(8).map(strict),pmax=column(8).map(strict),dmin=column(8).map(strict),dmax=column(8).map(strict),prefilters=column(80),sizes=column(8).map(strict);column(32);
 if(labels.some(v=>!v)||new Set(labels).size!==count||sizes.some(n=>!Number.isSafeInteger(n)||n<1))throw Error('Invalid channel labels or sample counts.');
 const perRecord=sizes.reduce((a,b)=>a+b,0),payload=buffer.byteLength-header;
 if(records===-1){if(payload%(perRecord*2))throw Error('Incomplete EDF data record.');records=payload/(perRecord*2);}
 if(records<1||perRecord*records>LIMITS.samples||payload!==perRecord*records*2)throw Error('EDF payload size mismatch or sample limit exceeded.');
 const channels=labels.map((label,i)=>{
 const factor=({uV:1,'µV':1,'μV':1,mV:1000,V:1e6})[units[i]],fs=sizes[i]/duration;
 if(!factor)throw Error(`Unsupported dimension for ${label}: ${units[i]}. This release requires all channels in voltage units.`);
 if(!Number.isFinite(pmin[i])||!Number.isFinite(pmax[i])||pmin[i]===pmax[i]||!Number.isInteger(dmin[i])||!Number.isInteger(dmax[i])||dmin[i]<-32768||dmax[i]>32767||dmax[i]<=dmin[i]||!Number.isFinite(fs)||fs<1||fs>100000||Math.max(Math.abs(pmin[i]*factor),Math.abs(pmax[i]*factor))>1e9)throw Error(`Invalid calibration or rate for ${label}.`);
 return {label,fs,unit:'uV',samples:new Float64Array(records*sizes[i]),rails:new Uint8Array(records*sizes[i]),prefilter:prefilters[i]||'Not supplied',reference:'As supplied',calibration:{physical_min:pmin[i],physical_max:pmax[i],digital_min:dmin[i],digital_max:dmax[i],original_unit:units[i]},factor};});
 let pos=header;
 for(let r=0;r<records;r++)for(let c=0;c<count;c++)for(let i=0;i<sizes[c];i++){
 const digital=view.getInt16(pos,true);pos+=2;if(digital<dmin[c]||digital>dmax[c])throw Error('Sample lies outside declared digital calibration.');
 const j=r*sizes[c]+i;channels[c].samples[j]=(pmin[c]+(digital-dmin[c])*(pmax[c]-pmin[c])/(dmax[c]-dmin[c]))*channels[c].factor;
 channels[c].rails[j]=digital===dmin[c]||digital===dmax[c]?1:0;
 }
 for(const c of channels)delete c.factor;
 return {format:'Classic EDF',channels,duration:records*duration,warnings:['Patient, recording-identification and start-date fields are not retained. Channel labels may still contain identifiers. Original reference and acquisition prefilters remain as declared.']};
}
export function demo(){
 const fs=256,seconds=32,labels=['Fp1','Fp2','C3','C4','O1','O2'];let seed=713;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32-.5;};
 const channels=labels.map((label,j)=>({label,fs,unit:'uV',prefilter:'None (synthetic)',reference:'Synthetic independent channels',samples:Float64Array.from({length:fs*seconds},(_,i)=>{const t=i/fs;let v=(j>3?22:9)*Math.sin(2*Math.PI*(j>3?10:9+j*.4)*t)+4*Math.sin(2*Math.PI*3*t)+random()*8;if(j<2)v+=100*Math.exp(-(((t-7)/.18)**2));if(j===2&&t>19&&t<20)v+=35*Math.sin(2*Math.PI*50*t);if(j===3&&t>24&&t<24.15)return NaN;return v;})}));
 return {format:'Synthetic',channels,duration:seconds,warnings:['Synthetic educational fixture: 10 Hz posterior oscillation, transient at 7 s, 50 Hz burst at 19–20 s, missing samples at 24 s. Not a measured brain recording.']};
}
