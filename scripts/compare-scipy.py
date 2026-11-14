"""Run pinned SciPy against deterministic input/output supplied by the JS engine."""
import json, subprocess, hashlib
from pathlib import Path
import numpy as np
import scipy
from scipy.signal import welch
root=Path(__file__).resolve().parents[1]
js="""
import {welch} from './public/engine.mjs';
const cases=[];for(const fs of [100,128,256,512])for(const seconds of [1,2,4]){
 const x=Array.from({length:Math.floor(fs*8.3)},(_,i)=>14*Math.sin(2*Math.PI*10*i/fs)+3*Math.cos(2*Math.PI*17.3*i/fs)+Math.sin(i*i*.33));
 cases.push({fs,seconds,x,result:welch(x,fs,seconds)});
}console.log(JSON.stringify(cases));
"""
cases=json.loads(subprocess.check_output(['node','--input-type=module','-e',js],cwd=root))
results=[]
for c in cases:
 r=c['result'];f,p=welch(c['x'],fs=c['fs'],window='hann',nperseg=r['nperseg'],noverlap=r['overlap_samples'],detrend='constant',scaling='density',return_onesided=True,average='mean')
 np.testing.assert_allclose(f,r['frequencies'],atol=0,rtol=0)
 np.testing.assert_allclose(p,r['density'],rtol=1e-9,atol=1e-10)
 results.append({'fs':c['fs'],'target_segment_seconds':c['seconds'],'nperseg':r['nperseg'],'max_absolute_error':float(np.max(np.abs(p-r['density'])))})
report={'engine_sha256':hashlib.sha256((root/'public/engine.mjs').read_bytes()).hexdigest(),'scope':'Executed numerical parity on 12 deterministic finite synthetic signals; not EEG or clinical validation','scipy':scipy.__version__,'numpy':np.__version__,'cases':results,'tolerance':{'rtol':1e-9,'atol':1e-10},'system_environment_note':'System NumPy failed to import due to architecture mismatch; comparison ran in a separate pinned temporary venv.'}
(root/'docs/scipy-comparison.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'cases_passed':len(results),'max_absolute_error':max(r['max_absolute_error'] for r in results)}))
