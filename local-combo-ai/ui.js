const $ = selector => document.querySelector(selector);
const token = $('meta[name="local-token"]').content;
let selected = null, candidates = [], currentJob = null, editing = false;
const categories = ['normal','counter','heat','follow-up','wall','wall-carry','situational'];
async function request(path, body) {
  const response = await fetch(path, body ? {method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':token},body:JSON.stringify(body)} : {});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || response.statusText);
  return result;
}
function element(tag, text, className) { const node=document.createElement(tag); if(text!==undefined)node.textContent=text;if(className)node.className=className;return node; }
function message(error){$('#status').textContent=String(error.message||error);}
async function refresh(){
  try {
    const state=await request('/api/status');
    if(!$('#character').options.length) for(const c of state.characters){const o=element('option',c.name);o.value=c.id;$('#character').append(o);}
    const activeJob=state.jobs.find(j=>['reading-frames','downloading','extracting-frames','checking-source'].includes(j.status));
    $('#status').textContent=state.active.error||state.active.message;
    if(activeJob)$('#status').textContent=`${state.active.busy?'Running':'Saved job progress'}: ${activeJob.title||activeJob.id}: ${activeJob.processedFrames||0}/${activeJob.selectedFrames||'?'} model frames · video ${Math.floor(activeJob.currentSecond||0)}s`;
    $('#jobs').replaceChildren();
    for(const job of state.jobs){const row=element('div',undefined,'job'),info=element('div',job.title||job.id);info.append(element('small',`${job.author} · ${job.character} · ${job.status} · ${job.candidateCount||0} candidates${job.selectedFrames?` · ${job.processedFrames||0}/${job.selectedFrames} frames`:''}${job.partialRun?' · PARTIAL TEST':''}`));if(job.error)info.append(element('small',`Error: ${job.error}`,'warning'));if(job.modelWarningFrames)info.append(element('small',`${job.modelWarningFrames} model readings need manual inspection`,'warning'));const open=element('button','Review / inspect');open.onclick=()=>openJob(job.id).catch(message);row.append(info,open);$('#jobs').append(row);}
  } catch(error){message(error);}
}
$('#scan').onsubmit=async event=>{event.preventDefault();try{await request('/api/start',{url:$('#url').value,character:$('#character').value,author:$('#author').value,file:$('#file').value,everyFrame:$('#everyFrame').checked,dense:$('#dense').checked});await refresh();}catch(error){message(error);}};
$('#weekly').onclick=()=>request('/api/weekly',{}).then(refresh).catch(message);
$('#stop').onclick=()=>request('/api/stop',{}).then(message).catch(message);
$('#doctor').onclick=async()=>{try{$('#diagnostics').hidden=false;$('#diagnostics').textContent=JSON.stringify(await request('/api/doctor'),null,2);}catch(error){message(error);}};
async function openJob(id){if(editing&&!confirm('Discard unsaved review edits?'))return;const data=await request(`/api/job/${id}`);selected=id;currentJob=data.job;candidates=data.candidates;editing=false;$('#review').hidden=false;$('#reviewTitle').textContent=`${currentJob.author} · ${currentJob.title||currentJob.character}${currentJob.captureTimingUnverified?' · Recording timestamps need source correction':''}`;$('#player').src=`/media/${id}/video.mp4`;renderReadings(data.observations);renderRoutes();}
function field(label,value,type,onchange){const wrap=element('label',label);const input=element(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;input.value=value??'';input.oninput=()=>{editing=true;onchange(input.value);};wrap.append(input);return wrap;}
function seek(second){$('#player').pause();$('#player').currentTime=Math.max(0,second);$('#player').scrollIntoView({behavior:'smooth',block:'center'});}
function renderRoutes(){
  $('#routes').replaceChildren();
  if(!candidates.length)$('#routes').append(element('p','No routes yet. A running scan saves candidates as it progresses. Unreadable frames remain in observations.json for inspection.'));
  candidates.forEach((c,index)=>{const card=element('article',undefined,`route${c.approved?' approved':''}`);card.append(element('h3',`Route ${index+1} · ${c.section||c.category}`));card.append(element('p',c.agreement?'Repeated counter readings agree. Still check the inputs and exact start time.':'Needs close review: readings are incomplete or not repeated.','warning'));if(c.symbolDraft)card.append(element('p',`Visual symbol draft: ${c.symbolDraft}. Check all strings, stance labels, timing, holds and whiffs.`,'muted'));if(c.modelNotation)card.append(element('p',`Unverified model text: ${c.modelNotation} · model damage reading: ${c.modelDamage??'unknown'}`,'muted'));
    const fields=element('div',undefined,'fields');fields.append(field('Input notation',c.notation,'textarea',v=>c.notation=v),field('Total damage',c.damage,'number',v=>c.damage=v===''?null:Number(v)),field('Hits',c.hits,'number',v=>c.hits=v===''?null:Number(v)));
    const category=element('label','Section'),select=element('select');for(const k of categories){const o=element('option',k);o.value=k;select.append(o);}select.value=c.category;select.onchange=()=>{c.category=select.value;editing=true;};category.append(select);fields.append(category,field('Start timestamp (seconds)',c.videoTimestampSeconds,'number',v=>c.videoTimestampSeconds=Number(v)),field('Conditions (one per line)',c.conditions.join('\n'),'textarea',v=>c.conditions=v.split('\n').map(x=>x.trim()).filter(Boolean)),field('Execution notes',c.notes,'textarea',v=>c.notes=v));card.append(fields);
    const actions=element('div',undefined,'actions'),watch=element('button','Watch this route');watch.onclick=()=>seek(c.evidence[0]?.second??c.videoTimestampSeconds);const source=element('a','YouTube timestamp ↗');source.href=`${currentJob.url}&t=${Math.floor(c.videoTimestampSeconds)}s`;source.target='_blank';source.rel='noopener noreferrer';actions.append(watch,source);
    for(const [key,label] of [['timestampReviewed','Start time checked'],['approved','Inputs and final damage checked / approve']]){const checkLabel=element('label',undefined,'check'),check=element('input');check.type='checkbox';check.checked=!!c[key];check.onchange=()=>{c[key]=check.checked;editing=true;card.classList.toggle('approved',!!c.approved);};checkLabel.append(check,document.createTextNode(label));actions.append(checkLabel);}card.append(actions);
    const evidence=element('div',undefined,'evidence');for(const e of c.evidence){const figure=element('figure'),image=element('img');image.src=`/media/${selected}/${e.frame}`;image.loading='lazy';image.alt=`Evidence at ${e.second.toFixed(2)} seconds`;image.onclick=()=>seek(e.second);figure.append(image,element('figcaption',`${e.second.toFixed(2)}s · damage ${e.damage??'?'} · hits ${e.hits??'?'} ${e.uncertainties.join('; ')}`));evidence.append(figure);}card.append(evidence);$('#routes').append(card);
  });
}
async function save(publish=false,push=false){if(!selected)return;try{const result=await request('/api/review',{jobId:selected,candidates,publish,push});editing=false;message(JSON.stringify(result));}catch(error){message(error);}}
$('#save').onclick=()=>save();$('#publish').onclick=()=>save(true);$('#push').onclick=()=>save(true,true);
$('#backFrame').onclick=()=>seek($('#player').currentTime-1/(currentJob?.videoFps||30));$('#forwardFrame').onclick=()=>seek($('#player').currentTime+1/(currentJob?.videoFps||30));$('#player').ontimeupdate=()=>{$('#playerTime').textContent=`${$('#player').currentTime.toFixed(3)} seconds`;};
let recorder=null;
const recordButton=element('button','Record a browser tab / window');recordButton.type='button';$('#scan .actions').append(recordButton);
const readings=element('details');readings.id='readings';readings.append(element('summary','All saved frame readings / detected titles'));$('#routes').before(readings);
function renderReadings(observations){readings.replaceChildren(element('summary',`All saved frame readings / detected titles (${observations.length})`));for(const o of observations){const line=element('div',undefined,'job'),text=element('span',`${o.second.toFixed(2)}s · ${o.kind} · ${o.title||o.section||''} · ${o.notation||''} · damage ${o.damage??'?'}`),jump=element('button','Inspect frame');jump.onclick=()=>seek(o.second);line.append(text,jump);readings.append(line);}}
const addRoute=element('button','Add a missed route at current video time');addRoute.type='button';$('#review .sticky').prepend(addRoute);addRoute.onclick=async()=>{try{await save();if(editing)return;await request('/api/add-candidate',{jobId:selected,second:$('#player').currentTime});await openJob(selected);}catch(error){message(error);}};
$('#scan').append(element('p','If YouTube blocks downloading: enter a registered guide URL and character, click Record, select only the video tab/window, and play the whole guide at normal speed from 0:00. Click Stop recording when it ends. Close ads first. Recording start times need correction during review.','wide muted'));
recordButton.onclick=async()=>{
  if(recorder?.state==='recording'){recorder.stop();return;}
  let stream;
  try{
    if(!navigator.mediaDevices?.getDisplayMedia)throw new Error('Screen recording is unavailable in this browser. Open http://127.0.0.1:18765 in Brave, Chrome or Edge, or import a local video file.');
    stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:30},audio:false});
    const capture=await request('/api/capture/start',{url:$('#url').value,character:$('#character').value,author:$('#author').value,everyFrame:$('#everyFrame').checked,dense:$('#dense').checked});
    let uploads=Promise.resolve(),failed=false;
    recorder=new MediaRecorder(stream,{mimeType:MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm',videoBitsPerSecond:4_000_000});
    recorder.ondataavailable=event=>{if(!event.data.size)return;uploads=uploads.then(async()=>{const r=await fetch(`/api/capture/chunk/${capture.session}`,{method:'POST',headers:{'X-Local-Token':token,'Content-Type':'application/octet-stream'},body:event.data});if(!r.ok)throw new Error((await r.json()).error);}).catch(error=>{failed=true;message(error);if(recorder.state==='recording')recorder.stop();});};
    recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());recordButton.textContent='Finishing recording…';recordButton.disabled=true;try{await uploads;if(!failed){await request('/api/capture/finish',{session:capture.session});message('Recording saved. Local frame extraction and vision analysis are starting.');}else await request('/api/capture/cancel',{session:capture.session});}catch(error){message(error);}finally{recorder=null;recordButton.disabled=false;recordButton.textContent='Record a browser tab / window';refresh();}};
    stream.getVideoTracks()[0].onended=()=>{if(recorder?.state==='recording')recorder.stop();};
    recorder.start(5000);recordButton.textContent='Stop recording & analyze';message('Recording the selected tab/window. Play the full video at 1× speed. Stop when it ends.');
  }catch(error){stream?.getTracks().forEach(t=>t.stop());message(error);}
};
window.addEventListener('beforeunload',event=>{if(editing){event.preventDefault();event.returnValue='';}});
refresh();setInterval(refresh,4000);
