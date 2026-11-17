export const STORAGE_KEY = 'nian-nian:v1';
export const MAX_COUNT = 100000000;
export const PRACTICE_KINDS = {chant:'佛号念诵',sutra:'经文诵读',custom:'自定义功课'};
export const PRESETS = [
  {key:'amitabha',name:'南无阿弥陀佛',kind:'chant',unit:'声',goal:108},
  {key:'guanyin',name:'南无观世音菩萨',kind:'chant',unit:'声',goal:108},
  {key:'dizang',name:'南无地藏王菩萨',kind:'chant',unit:'声',goal:108},
  {key:'diamond',name:'金刚经',kind:'sutra',unit:'遍',goal:1},
  {key:'heart',name:'心经',kind:'sutra',unit:'遍',goal:1},
  {key:'dizang-sutra',name:'地藏经',kind:'sutra',unit:'遍',goal:1},
];
export function projectKind(project) {
  return Object.hasOwn(PRACTICE_KINDS,project.kind)?project.kind:project.unit==='遍'?'sutra':project.unit==='声'||project.name==='日常念诵'?'chant':'custom';
}
export function presetMatch(state,preset) {
  return state.projects.find(p=>p.presetKey===preset.key)||state.projects.find(p=>p.name===preset.name);
}
// Presets become saved projects only when chosen; opening the menu never changes data.
export function choosePractice(state,choice) {
  const next=structuredClone(state);
  let project;
  if(choice.startsWith('project:')) project=next.projects.find(p=>p.id===choice.slice(8));
  else if(choice.startsWith('preset:')) {
    const preset=PRESETS.find(p=>p.key===choice.slice(7));
    if(!preset)throw new Error('这项功课已不存在，请重新选择。');
    project=presetMatch(next,preset);
    if(!project){
      if(next.projects.length>=200)throw new Error('最多可保存 200 个项目。');
      const {key,...fields}=preset;project={id:uid(),...fields,presetKey:key};next.projects.push(project);
    }
  }
  if(!project)throw new Error('这项功课已不存在，请重新选择。');
  if(next.selected!==project.id){next.selected=project.id;next.active=null;}
  return next;
}
export function saveProject(state,input) {
  const next=structuredClone(state),name=String(input.name||'').trim(),goal=Number(input.goal);
  if(!name||name.length>40)throw new Error('请填写 1 到 40 个字的项目名称。');
  if(next.projects.some(p=>p.id!==input.id&&p.name===name))throw new Error('已有同名项目，请换一个名称。');
  if(!Number.isSafeInteger(goal)||goal<0||goal>MAX_COUNT)throw new Error('请填写有效的整数目标，0 表示不设目标。');
  const previous=input.id?next.projects.find(p=>p.id===input.id):null;
  if(input.id&&!previous)throw new Error('项目已不存在。');
  if(!previous&&next.projects.length>=200)throw new Error('最多可保存 200 个项目。');
  const locked=previous&&next.records.some(r=>r.projectId===previous.id);
  const kind=locked?projectKind(previous):input.kind,unit=locked?previous.unit:input.kind==='sutra'?'遍':input.unit;
  if(!Object.hasOwn(PRACTICE_KINDS,kind)||!['次','遍','声'].includes(unit))throw new Error('请选择有效的功课类型和计数单位。');
  if(previous)Object.assign(previous,{name,goal,kind,unit});
  else {const project={id:uid(),name,goal,kind,unit};next.projects.push(project);next.selected=project.id;next.active=null;}
  return next;
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y,m,d] = value.split('-').map(Number);
  const date = new Date(y,m-1,d,12);
  return y >= 1900 && localDate(date) === value;
}
export function uid() { return globalThis.crypto?.randomUUID?.() || `n${Date.now()}${Math.random().toString(36).slice(2)}`; }
export function initialState() {
  return {version:1, projects:[{id:uid(),name:'日常念诵',unit:'次',goal:108}],records:[],selected:null,active:null};
}
export function positiveCount(value) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > MAX_COUNT) throw new Error('请输入 1 到 100,000,000 之间的整数。');
  return n;
}
export function validateState(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.projects) || !raw.projects.length || raw.projects.length > 200 || !Array.isArray(raw.records) || raw.records.length > 100000) throw new Error('这不是有效的念念备份文件。');
  const projectIds = new Set(), recordIds = new Set();
  const shortText = (x, max) => typeof x === 'string' && x.trim().length > 0 && x.length <= max;
  const projects = raw.projects.map(p => {
    if (!p || !shortText(p.id,100) || projectIds.has(p.id) || !shortText(p.name,40) || !['次','遍','声'].includes(p.unit)) throw new Error('备份中的项目格式有误。');
    const goal = Number(p.goal);
    if (!Number.isSafeInteger(goal) || goal < 0 || goal > MAX_COUNT) throw new Error('备份中的每日目标无效。');
    if(p.kind!==undefined&&!Object.hasOwn(PRACTICE_KINDS,p.kind))throw new Error('备份中的功课类型无效。');
    if(p.presetKey!==undefined&&!PRESETS.some(item=>item.key===p.presetKey))throw new Error('备份中的预设功课无效。');
    projectIds.add(p.id); return {id:p.id,name:p.name.trim(),unit:p.unit,goal,kind:projectKind(p),...(p.presetKey?{presetKey:p.presetKey}:{})};
  });
  const records = raw.records.map(r => {
    if (!r || !shortText(r.id,100) || recordIds.has(r.id) || !projectIds.has(r.projectId) || !validDate(r.date) || !['counter','manual'].includes(r.source) || !shortText(r.createdAt,40) || !Number.isFinite(Date.parse(r.createdAt)) || typeof r.note !== 'string' || r.note.length > 200) throw new Error('备份中的记录格式有误。');
    recordIds.add(r.id); return {id:r.id,projectId:r.projectId,date:r.date,count:positiveCount(r.count),source:r.source,createdAt:r.createdAt,note:r.note};
  });
  return {version:1,projects,records,selected:projectIds.has(raw.selected)?raw.selected:projects[0].id,active:records.some(r=>r.id===raw.active && r.source==='counter')?raw.active:null};
}
export function sumFor(state, projectId, date) {
  return state.records.filter(r=>r.projectId===projectId && (!date || r.date===date)).reduce((n,r)=>n+r.count,0);
}
export function addTap(state, projectId, now = new Date()) {
  if (!state.projects.some(p=>p.id===projectId)) throw new Error('请先选择念诵项目。');
  const next=structuredClone(state), date=localDate(now);
  let record=next.records.find(r=>r.id===next.active && r.projectId===projectId && r.date===date && r.source==='counter');
  if (record) record.count=positiveCount(record.count+1);
  else {
    record={id:uid(),projectId,date,count:1,source:'counter',createdAt:now.toISOString(),note:''};
    next.records.push(record); next.active=record.id;
  }
  return next;
}
export function undoTap(state, projectId, now = new Date()) {
  const next=structuredClone(state);
  const record=next.records.find(r=>r.id===next.active && r.projectId===projectId && r.date===localDate(now) && r.source==='counter');
  if (!record) return next;
  if (record.count===1) { next.records=next.records.filter(r=>r.id!==record.id); next.active=null; }
  else record.count--;
  return next;
}
export function saveRecord(state, input, now = new Date()) {
  const next=structuredClone(state), count=positiveCount(input.count);
  if (!next.projects.some(p=>p.id===input.projectId)) throw new Error('请选择有效的念诵项目。');
  if (!validDate(input.date) || input.date > localDate(now)) throw new Error('请选择今天或之前的有效日期。');
  const note=String(input.note||'').trim();
  if (note.length>200) throw new Error('备注最多 200 个字。');
  if (input.id) {
    const record=next.records.find(r=>r.id===input.id);
    if (!record) throw new Error('这条记录已不存在，请刷新后再试。');
    Object.assign(record,{projectId:input.projectId,date:input.date,count,note});
    if (next.active===record.id) next.active=null;
  } else next.records.push({id:uid(),projectId:input.projectId,date:input.date,count,note,source:'manual',createdAt:now.toISOString()});
  return next;
}
export function deleteRecord(state,id) {
  const next=structuredClone(state); next.records=next.records.filter(r=>r.id!==id);
  if (next.active===id) next.active=null;
  return next;
}
