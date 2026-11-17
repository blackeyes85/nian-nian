import {STORAGE_KEY,localDate,initialState,validateState,sumFor,addTap,undoTap,saveRecord,deleteRecord,PRACTICE_KINDS,PRESETS,projectKind,presetMatch,choosePractice,saveProject} from './model.js?v=picker-1';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=n=>n.toLocaleString('zh-CN');
let state,corruptRaw=null,storageBlocked=false,toastTimer,page='count',lastDay=localDate();
let pickerKind='chant',pickerBusy=false;
let countFeedbackTimer;
const icon=name=>`<svg aria-hidden="true"><use href="#${name}"/></svg>`;
function storageWarning(message){storageBlocked=true;$('#storage-alert').textContent=message;$('#storage-alert').hidden=false;$('#save-label').textContent='尚未保存';}
try {
  const raw=localStorage.getItem(STORAGE_KEY);
  if(raw){try{state=validateState(JSON.parse(raw));}catch(error){corruptRaw=raw;throw error;}}
  else {state=initialState();state.selected=state.projects[0].id;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
}catch(error){state ||= initialState();state.selected ||= state.projects[0].id;storageWarning(corruptRaw?'已有记录无法读取，已保留原始内容并暂停写入。请在「我的」中导出原始文件，再恢复有效备份。':'当前无法保存到浏览器。请允许网站存储或改用 Safari 普通浏览窗口后重试。');}
function selected(){return state.projects.find(p=>p.id===state.selected)||state.projects[0];}
function activeRecord(){return state.records.find(r=>r.id===state.active&&r.projectId===selected().id&&r.date===localDate()&&r.source==='counter');}
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2800);}
async function mutate(change,{replace=false}={}){
  const operation=()=>{
    if(corruptRaw&&!replace)throw new Error('请先导出原始数据并恢复有效备份，当前已暂停记录。');
    let base=state;
    if(!replace){const raw=localStorage.getItem(STORAGE_KEY);if(raw)base=validateState(JSON.parse(raw));}
    const next=change(structuredClone(base));
    localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
    state=next;corruptRaw=null;storageBlocked=false;$('#storage-alert').hidden=true;render();
    return true;
  };
  try{return navigator.locks?await navigator.locks.request('nian-nian-write',operation):operation();}
  catch(error){storageWarning(`这次操作未保存。${error.message || '请检查浏览器存储空间。'}`);toast('未能保存，请查看页面提示');return false;}
}
function projectOptions(all=false){return (all?'<option value="">全部项目</option>':'')+Object.entries(PRACTICE_KINDS).map(([kind,label])=>{
  const projects=state.projects.filter(p=>projectKind(p)===kind);
  return projects.length?`<optgroup label="${label}">${projects.map(p=>`<option value="${escape(p.id)}">${escape(p.name)} · ${p.unit}</option>`).join('')}</optgroup>`:'';
}).join('');}
function closePracticeMenu(focus=false){$('#practice-menu').hidden=true;$('#project-select').setAttribute('aria-expanded','false');if(focus)$('#project-select').focus();}
function positionPracticeMenu(){
  const box=$('#project-select').getBoundingClientRect();
  $('#practice-menu').style.setProperty('--menu-height',`${Math.max(230,Math.min(440,window.innerHeight-box.bottom-90))}px`);
}
function renderPracticeMenu(){
  const entries=state.projects.filter(p=>projectKind(p)===pickerKind).map(p=>({...p,choice:`project:${p.id}`}));
  for(const preset of PRESETS.filter(p=>p.kind===pickerKind))if(!presetMatch(state,preset))entries.push({...preset,choice:`preset:${preset.key}`});
  $$('[data-practice-kind]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.practiceKind===pickerKind)));
  $('#practice-category-help').textContent={chant:'佛号逐声累积，次数各自保存',sutra:'诵完一遍，再记一次；目标可调整',custom:'自己的功课，自己的计数方式'}[pickerKind];
  $('#practice-options').innerHTML=entries.length?entries.map(p=>{
    const active=p.id===state.selected;
    return `<button type="button" role="option" aria-selected="${active}" tabindex="${active?'0':'-1'}" class="practice-option" data-practice-choice="${escape(p.choice)}"><span class="practice-option-icon">${icon(pickerKind==='sutra'?'book':'lotus')}</span><span class="practice-option-copy"><strong>${escape(p.name)}</strong><small>按${p.unit}记录 · ${p.goal?`每日 ${number(p.goal)} ${p.unit}`:'不设目标'}</small></span><span class="practice-option-check">${active?icon('check'):''}</span></button>`;
  }).join(''):'<p class="practice-menu-empty">还没有自定义功课<br>可从下方添加名称与计数单位</p>';
  if(!$('#practice-options [tabindex="0"]'))$('#practice-options [role="option"]')?.setAttribute('tabindex','0');
}
function openPracticeMenu(){pickerKind=projectKind(selected());renderPracticeMenu();positionPracticeMenu();$('#practice-menu').hidden=false;$('#project-select').setAttribute('aria-expanded','true');}
async function selectPractice(choice){
  if(pickerBusy)return;
  try{choosePractice(state,choice);}catch(error){toast(error.message);return;}
  pickerBusy=true;$('#practice-menu').setAttribute('aria-busy','true');
  try{if(await mutate(s=>choosePractice(s,choice))){closePracticeMenu(true);toast(`已切换到${selected().name} · 按${selected().unit}记录`);}}
  finally{pickerBusy=false;$('#practice-menu').removeAttribute('aria-busy');}
}
function render(){
  const current=selected();state.selected=current.id;
  $('#today-label').textContent=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'long'}).format(new Date());
  const kind=projectKind(current),isSutra=kind==='sutra';
  $('#selected-project-name').textContent=current.name;
  $('#practice-kind-label').textContent=`${PRACTICE_KINDS[kind]} · 按${current.unit}记录`;
  $('#project-select').setAttribute('aria-label',`选择念诵功课：${current.name}`);
  $('#counter-caption').textContent=isSutra?'本次已诵':'本次念诵';
  $('#tap-hint').textContent=isSutra?'诵完一遍 · 记 +1':`轻触记录 +1 ${current.unit}`;
  $('#count-button').setAttribute('aria-label',isSutra?`${current.name}诵完一遍，记录加一`:`${current.name}念诵加一${current.unit}`);
  $('#practice-footnote').textContent=isSutra?'完整诵读一遍后轻触，已完成的遍数自动保存':'每次轻触即保存，退出也不会丢失进度';
  if(!$('#practice-menu').hidden)renderPracticeMenu();
  $('#save-label').textContent=storageBlocked?'尚未保存':'自动保存';
  const active=activeRecord(),today=sumFor(state,current.id,localDate()),all=sumFor(state,current.id),progress=current.goal?Math.min(1,today/current.goal):0;
  $('#session-count').textContent=number(active?.count||0);$('#session-count').classList.toggle('compact',(active?.count||0)>=100000);
  $('#counter-unit').textContent=current.unit;$('#summary-unit').textContent=current.unit;
  $('#today-total').textContent=number(today);$('#all-total').textContent=number(all);
  $('#practice-days').innerHTML=`${new Set(state.records.filter(r=>r.projectId===current.id).map(r=>r.date)).size}<small>天</small>`;
  $('#ring-progress').style.strokeDashoffset=898.5*(1-progress);$('#goal-bar').style.width=`${progress*100}%`;
  $('#goal-caption').textContent=current.goal?`今日 ${number(today)} / ${number(current.goal)} ${current.unit}${today>=current.goal?' · 已完成今日目标':''}`:'不设目标，按自己的节奏念诵';
  $('#goal-summary').textContent=current.goal?(today>=current.goal?'今日目标已完成，随心继续。':`距每日目标还差 ${number(current.goal-today)} ${current.unit}`):'不设每日目标，自在随心。';
  $('#undo-button').disabled=!active;$('#finish-button').disabled=!active;
  $('#week-unit').textContent=`单位：${current.unit}`;
  const week=Array.from({length:7},(_,i)=>{const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()-6+i);return {date,count:sumFor(state,current.id,localDate(date))};});
  const max=Math.max(1,...week.map(d=>d.count));
  $('#week-chart').innerHTML=week.map((d,i)=>`<div class="chart-day" aria-label="${localDate(d.date)}，${d.count}${current.unit}" title="${localDate(d.date)} · ${number(d.count)} ${current.unit}"><span class="chart-bar" style="height:${Math.max(3,42*d.count/max)}px"></span><small>${i===6?'今天':d.date.getDate()+'日'}</small></div>`).join('');
  const todayRecords=state.records.filter(r=>r.date===localDate()).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  $('#today-records').innerHTML=todayRecords.length?todayRecords.slice(0,5).map(recordHTML).join(''):emptyHTML('今天的第一念，从这里开始','点击上方圆形按钮，或补录已完成的念诵。');
  const historyProject=$('#history-project').value;$('#history-project').innerHTML=projectOptions(true);$('#history-project').value=state.projects.some(p=>p.id===historyProject)?historyProject:'';
  renderHistory();
  $('#project-list').innerHTML=state.projects.map(p=>`<div class="project-row"><div><strong>${escape(p.name)}</strong><small>${PRACTICE_KINDS[projectKind(p)]} · ${p.goal?`每日 ${number(p.goal)} ${p.unit}`:'不设每日目标'}</small></div><button class="text-button" data-edit-project="${escape(p.id)}">编辑</button></div>`).join('');
  try{const value=localStorage.getItem('nian-nian:last-backup');$('#backup-label').textContent=value?`上次导出：${new Date(value).toLocaleString('zh-CN')}`:'尚未导出过备份';}catch{}
}
function emptyHTML(title,detail){return `<div class="empty-state">${icon('lotus')}<strong>${escape(title)}</strong><p>${escape(detail)}</p></div>`;}
function recordHTML(r){
  const p=state.projects.find(p=>p.id===r.projectId);
  const time=new Date(r.createdAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
  return `<button class="record-row" data-record="${escape(r.id)}" aria-label="编辑 ${escape(p.name)} ${number(r.count)}${p.unit} 的记录"><span class="record-icon">${icon(r.source==='counter'?'lotus':'book')}</span><span class="record-info"><strong>${escape(p.name)}</strong><small>${r.source==='counter'?'实时计数':'手动补录'} · ${r.source==='counter'?time:'记录于 '+new Date(r.createdAt).toLocaleDateString('zh-CN')}${r.id===state.active?' · 进行中':''}</small>${r.note?`<span class="note">${escape(r.note)}</span>`:''}</span><span class="record-value">${number(r.count)}<small>${p.unit}</small></span>${icon('arrow')}</button>`;
}
function renderHistory(){
  const p=$('#history-project').value,date=$('#history-date').value;
  const records=state.records.filter(r=>(!p||r.projectId===p)&&(!date||r.date===date)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
  $('#history-summary').textContent=`共 ${records.length} 条记录 · ${new Set(records.map(r=>r.date)).size} 个记录日`;
  let last='';$('#history-records').innerHTML=records.length?records.map(r=>{const header=last!==r.date?`<div class="date-heading">${escape(r.date)}${r.date===localDate()?' · 今天':''}</div>`:'';last=r.date;return header+recordHTML(r);}).join(''):emptyHTML('这里还没有记录','每一次计数与补录，都会成为你的念诵手记。');
}
function showPage(next){closePracticeMenu();page=['count','history','settings'].includes(next)?next:'count';$$('.page').forEach(el=>el.hidden=el.id!==`page-${page}`);$$('[data-page]').forEach(el=>{const active=el.dataset.page===page;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});history.replaceState(null,'',`#${page}`);window.scrollTo({top:0,behavior:'instant'});}
function openRecord(id){
  const record=state.records.find(r=>r.id===id);$('#record-form').reset();$('#record-id').value=record?.id||'';$('#record-project').innerHTML=projectOptions();$('#record-project').value=record?.projectId||selected().id;
  $('#record-date').max=localDate();$('#record-date').value=record?.date||localDate();$('#record-count').value=record?.count||'';$('#record-note').value=record?.note||'';
  $('#record-title').textContent=record?'编辑念诵记录':'补录念诵';$('#record-error').textContent='';$('#delete-record').hidden=!record;updateQuantityLabel();$('#record-dialog').showModal();
}
function updateQuantityLabel(){const project=state.projects.find(p=>p.id===$('#record-project').value);$('#quantity-label').firstChild.textContent=`${projectKind(project||{})==='sutra'?'已诵遍数':'数量'}（${project?.unit||'次'}）`;$('#record-count').placeholder=project?.unit==='遍'?'例如 1':'例如 108';}
function openProject(id,kind='custom'){
  const p=state.projects.find(p=>p.id===id),hasRecords=p&&state.records.some(r=>r.projectId===p.id);
  closePracticeMenu();$('#project-form').reset();$('#project-id').value=p?.id||'';$('#project-name').value=p?.name||'';$('#project-kind').value=p?projectKind(p):kind;$('#project-kind').disabled=!!hasRecords;$('#project-unit').value=p?.unit||(kind==='sutra'?'遍':kind==='chant'?'声':'次');$('#project-goal').value=p?.goal??(kind==='sutra'?1:kind==='chant'?108:0);$('#project-unit').disabled=!!hasRecords||$('#project-kind').value==='sutra';
  $('#project-title').textContent=p?'编辑念诵项目':'新增念诵项目';$('#project-error').textContent='';$('#unit-help').textContent=hasRecords?'已有记录的项目保持原类型和计数单位。目标设为 0 即不设目标。':$('#project-kind').value==='sutra'?'经文按完整诵读的遍数记录。目标可设为 0，不设每日目标。':'目标设为 0，则不显示进度目标。';$('#project-dialog').showModal();
}
function confirmAction(title,message,label,callback){$('#confirm-title').textContent=title;$('#confirm-message').textContent=message;$('#confirm-submit').textContent=label;$('#confirm-submit').onclick=async()=>{const button=$('#confirm-submit');button.disabled=true;try{const done=await callback();if(done!==false)$('#confirm-dialog').close();}finally{button.disabled=false;}};$('#confirm-dialog').showModal();}
document.addEventListener('click',event=>{
  if(!event.target.closest('.project-picker'))closePracticeMenu();
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.page)showPage(button.dataset.page);
  if(button.dataset.action==='manual')openRecord();
  if(button.hasAttribute('data-close'))button.closest('dialog').close();
  if(button.dataset.record)openRecord(button.dataset.record);
  if(button.dataset.editProject)openProject(button.dataset.editProject);
  if(button.dataset.practiceKind){pickerKind=button.dataset.practiceKind;renderPracticeMenu();}
  if(button.dataset.practiceChoice)selectPractice(button.dataset.practiceChoice);
});
$('#count-button').addEventListener('click',async()=>{const p=selected().id;const success=await mutate(s=>addTap(s,p));if(success){clearTimeout(countFeedbackTimer);$('#count-button').classList.add('pulse');countFeedbackTimer=setTimeout(()=>$('#count-button').classList.remove('pulse'),220);}});
$('#undo-button').addEventListener('click',async()=>{if(await mutate(s=>undoTap(s,selected().id)))toast('已撤销一次');});
$('#finish-button').addEventListener('click',async()=>{const r=activeRecord();if(!r)return;const count=r.count,unit=selected().unit;if(await mutate(s=>({...s,active:null})))toast(`本次 ${number(count)} ${unit}已记录，可开始下一次念诵`);});
$('#project-select').addEventListener('click',()=>$('#practice-menu').hidden?openPracticeMenu():closePracticeMenu());
$('#project-select').addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();openPracticeMenu();const options=$$('#practice-options [role="option"]');(event.key==='ArrowUp'?options.at(-1):options.find(p=>p.getAttribute('aria-selected')==='true')||options[0])?.focus();}});
$('#close-practice-menu').addEventListener('click',()=>closePracticeMenu(true));
$('#new-practice').addEventListener('click',()=>openProject(undefined,pickerKind));
$('#practice-options').addEventListener('keydown',event=>{
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
  const options=$$('#practice-options [role="option"]');if(!options.length)return;event.preventDefault();
  const i=options.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?options.length-1:(i+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;
  options.forEach((option,index)=>option.tabIndex=index===next?0:-1);options[next].focus();
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('#practice-menu').hidden){event.preventDefault();closePracticeMenu(true);}});
document.addEventListener('focusin',event=>{if(!$('#practice-menu').hidden&&!event.target.closest('.project-picker'))closePracticeMenu();});
window.addEventListener('resize',()=>{if(!$('#practice-menu').hidden)positionPracticeMenu();});
$('#record-project').addEventListener('change',updateQuantityLabel);
$('#record-form').addEventListener('submit',async event=>{
  event.preventDefault();const input={id:$('#record-id').value,projectId:$('#record-project').value,date:$('#record-date').value,count:$('#record-count').value,note:$('#record-note').value};
  try{saveRecord(state,input);$('#record-error').textContent='';}catch(error){$('#record-error').textContent=error.message;return;}
  const submit=event.submitter;submit.disabled=true;try{if(await mutate(s=>saveRecord(s,input))){$('#record-dialog').close();toast(input.id?'记录已更新':'念诵记录已保存');}else $('#record-error').textContent='未能保存，请关闭窗口查看页面提示。';}finally{submit.disabled=false;}
});
$('#delete-record').addEventListener('click',()=>{const id=$('#record-id').value;confirmAction('删除这条记录？','删除后会同步更新今日统计和累计数量。此操作无法撤销。','删除记录',async()=>{if(await mutate(s=>deleteRecord(s,id))){$('#record-dialog').close();toast('记录已删除');return true;}return false;});});
$('#add-project').addEventListener('click',()=>openProject());
$('#project-kind').addEventListener('change',()=>{
  const kind=$('#project-kind').value;$('#project-unit').value=kind==='sutra'?'遍':kind==='chant'?'声':'次';$('#project-unit').disabled=kind==='sutra';
  if(!$('#project-id').value)$('#project-goal').value=kind==='sutra'?1:kind==='chant'?108:0;
  $('#unit-help').textContent=kind==='sutra'?'经文按完整诵读的遍数记录。目标可设为 0，不设每日目标。':'目标设为 0，则不显示进度目标。';
});
$('#project-form').addEventListener('submit',async event=>{
  event.preventDefault();const input={id:$('#project-id').value,name:$('#project-name').value,goal:$('#project-goal').value,kind:$('#project-kind').value,unit:$('#project-unit').value};
  try{saveProject(state,input);$('#project-error').textContent='';}catch(error){$('#project-error').textContent=error.message;return;}
  const submit=event.submitter;submit.disabled=true;try{if(await mutate(s=>saveProject(s,input))){$('#project-dialog').close();toast('念诵项目已保存');}else $('#project-error').textContent='未能保存，请关闭窗口查看页面提示。';}finally{submit.disabled=false;}
});
$('#history-project').addEventListener('change',renderHistory);$('#history-date').addEventListener('change',renderHistory);$('#clear-filter').addEventListener('click',()=>{$('#history-project').value='';$('#history-date').value='';renderHistory();});
function download(content,filename){const blob=new Blob([content],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
$('#export-button').addEventListener('click',()=>{
  try{const raw=localStorage.getItem(STORAGE_KEY);if(corruptRaw){download(corruptRaw,`念念-原始数据-${localDate()}.json`);toast('原始文件已导出，请妥善保存');return;}
    const current=raw?validateState(JSON.parse(raw)):state;download(JSON.stringify({...current,exportedAt:new Date().toISOString()},null,2),`念念-备份-${localDate()}.json`);localStorage.setItem('nian-nian:last-backup',new Date().toISOString());render();toast('已生成备份，请保存到「文件」或其他安全位置');
  }catch(error){toast(`导出失败：${error.message}`);}
});
$('#import-button').addEventListener('click',()=>$('#import-file').click());
$('#import-file').addEventListener('change',async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  try{if(file.size>30*1024*1024)throw new Error('文件过大，请选择 30 MB 以内的念念备份。');const incoming=validateState(JSON.parse(await file.text()));incoming.active=null;
    confirmAction('恢复这份备份？',`备份包含 ${incoming.projects.length} 个项目、${incoming.records.length} 条记录。恢复将替换当前设备的全部念诵数据，不会合并；请先确认已导出当前记录。`,'替换并恢复',async()=>{const success=await mutate(()=>incoming,{replace:true});if(success)toast('备份已恢复');return success;});
  }catch(error){toast(error instanceof SyntaxError?'文件不是有效的 JSON 备份。':error.message);}
});
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY){try{if(event.newValue){state=validateState(JSON.parse(event.newValue));corruptRaw=null;storageBlocked=false;$('#storage-alert').hidden=true;render();}else storageWarning('记录已在另一个窗口被清除。请刷新页面，或先导出当前记录。');}catch{storageWarning('另一个窗口的数据无法读取，请先导出记录再恢复备份。');}}});
function updateDay(){if(lastDay!==localDate()){lastDay=localDate();render();}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateDay();});setInterval(updateDay,15000);
window.addEventListener('hashchange',()=>showPage(location.hash.slice(1)));
render();showPage(location.hash.slice(1));
if('serviceWorker' in navigator && window.isSecureContext){
  let offlineTimeout;
  navigator.serviceWorker.register('./sw.js').then(()=>Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>{offlineTimeout=setTimeout(()=>reject(new Error('Offline setup timed out.')),15000);})])).then(()=>{$('#offline-status').textContent='此设备已准备好离线使用。添加到主屏幕后，请从主屏幕图标打开一次并再次确认此提示。';}).catch(error=>{console.warn('念念离线准备失败：',error.name,error.message);$('#offline-status').textContent='离线缓存尚未准备好，请保持联网使用；网络恢复后，再重新打开应用。';}).finally(()=>clearTimeout(offlineTimeout));
}else $('#offline-status').textContent='当前为本地预览。iPhone 添加到主屏幕并离线使用，需要先通过 HTTPS 网址打开。';
