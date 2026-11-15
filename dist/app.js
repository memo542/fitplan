const labels = { today: '今日概览', food: '饮食记录', training: '训练记录', week: '本周回顾', overview: '今日综合情况', advice: '今日建议', body: '身体数据', goals: '目标规划' };
function renderPage() {
  const requested = location.hash.slice(1);
  const page = Object.hasOwn(labels, requested) ? requested : 'today';
  document.querySelectorAll('.page').forEach(section => { section.hidden = section.id !== page; });
  document.querySelectorAll('nav a').forEach(link => {
    if (link.dataset.page === (['overview', 'advice'].includes(page) ? 'today' : page)) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.getElementById('breadcrumb').textContent = labels[page];
  document.title = labels[page] + ' · Fitplan';
}
document.getElementById('date').textContent = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date());
window.addEventListener('hashchange', () => { renderPage(); window.scrollTo(0, 0); });
renderPage();

const encouragements = [
  '不必每一天都满分，愿意记录就是新的起点。',
  '没记全也没关系，从这一餐继续。',
  '今天的你，不需要拿昨天的饭来惩罚自己。',
  '肌肉在努力，休息也有它的戏份。',
  '体重只是一个数字，你的努力不止一个维度。',
  '给计划留点弹性，生活又不是一张考试卷。'
];
let cheerIndex = 0;
document.getElementById('change-cheer').addEventListener('click', () => {
  cheerIndex = (cheerIndex + 1) % encouragements.length;
  document.getElementById('cheer-text').textContent = encouragements[cheerIndex];
});


const el = id => document.getElementById(id);
const sexValues = ['female','male','other','undisclosed'];
const positive = value => String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0;
function connectForm(config) {
 const status=el(config.status);
 try {
  const raw=localStorage.getItem(config.key);
  if(raw) {
   const data=JSON.parse(raw);
   if(!data || typeof data!=='object') throw Error();
   config.fields.forEach(([id,key,valid])=>{if(valid(data[key])) el(id).value=data[key]});
   status.textContent=config.fields.every(([id,,valid])=>valid(el(id).value))?'已读取本机保存的信息。':'请补全必填项后保存。';
  }
 } catch {status.textContent='读取失败，请重新填写。'}
 const changed=()=>{status.textContent='有未保存的修改。';if(config.after)config.after()};
 config.fields.forEach(([id])=>el(id).addEventListener('input',changed));
 el(config.form).addEventListener('submit',event=>{
  event.preventDefault();
  if(!config.fields.every(([id,,valid])=>valid(el(id).value))) {status.textContent='请完整填写必填项，数值必须大于零。';return}
  const data={version:1,updatedAt:new Date().toISOString()};
  config.fields.forEach(([id,key])=>{data[key]=el(id).value});
  try {localStorage.setItem(config.key,JSON.stringify(data));status.textContent='已保存，刷新后仍保留。'}catch{status.textContent='保存失败，浏览器存储不可用。'}
 });
 el(config.clear).addEventListener('click',()=>{
  if(!window.confirm('确定清除已保存的信息？'))return;
  try{localStorage.removeItem(config.key);config.fields.forEach(([id])=>el(id).value='');status.textContent='已清除。';if(config.after)config.after()}catch{status.textContent='清除失败，请重试。'}
 });
 if(config.after)config.after();
}
connectForm({form:'profile-form',key:'fitplan.profile.v1',status:'profile-status',clear:'clear-profile',fields:[['profile-height','height',positive],['profile-weight','weight',positive],['profile-sex','sex',v=>sexValues.includes(v)]],after:()=>{el('cycle-note').hidden=el('profile-sex').value!=='female'}});

const goalKey = 'fitplan.goals.v1';
const goalKinds = ['fat-loss', 'muscle-gain', 'maintain', 'explore'];
const interestIds = ['shape', 'strength', 'endurance', 'mobility'];
const goalStatus = el('goal-status');
try {
 const raw = localStorage.getItem(goalKey);
 if (raw) {
  const data = JSON.parse(raw);
  if (!data || !goalKinds.includes(data.kind)) throw Error('Invalid goal');
  el('goal-kind').value = data.kind;
  if (positive(data.weight)) el('goal-weight').value = data.weight;
  const interests = Array.isArray(data.interests) ? data.interests : [];
  interestIds.forEach(id => { el('interest-' + id).checked = interests.includes(id); });
  goalStatus.textContent = '已读取保存的目标，可以随时调整。';
 }
} catch { goalStatus.textContent = '目标读取失败，请检查后重新填写。'; }
['goal-kind','goal-weight',...interestIds.map(id=>'interest-'+id)].forEach(id => {
 el(id).addEventListener('input', () => { goalStatus.textContent = '有未保存的修改。'; });
});
el('goal-form').addEventListener('submit', event => {
 event.preventDefault();
 if (!goalKinds.includes(el('goal-kind').value)) { goalStatus.textContent='请先选择主要方向。'; return; }
 const weight=el('goal-weight').value.trim();
 if (weight !== '' && !positive(weight)) { goalStatus.textContent='目标体重可留空；填写时必须是大于零的数值。'; return; }
 const data={version:2, kind:el('goal-kind').value, weight:weight === '' ? null : Number(weight), interests:interestIds.filter(id=>el('interest-'+id).checked), updatedAt:new Date().toISOString()};
 try { localStorage.setItem(goalKey,JSON.stringify(data)); goalStatus.textContent='目标规划已保存，按你的节奏慢慢来。'; }
 catch { goalStatus.textContent='保存失败，浏览器存储不可用。'; }
});
el('clear-goal').addEventListener('click', () => {
 if(!window.confirm('清除主要方向、目标体重和改善方向？右侧自定义目标会保留。')) return;
 try {
  localStorage.removeItem(goalKey); el('goal-kind').value=''; el('goal-weight').value='';
  interestIds.forEach(id=>el('interest-'+id).checked=false);
  goalStatus.textContent='已清除，自定义目标仍保留。';
 } catch { goalStatus.textContent='清除失败，请重试。'; }
});

function connectCustom(type) {
 const key='fitplan.'+type+'.custom.v1',status=el(type+'-custom-status'),list=el(type+'-custom-list');
 let items=[];
 try{const raw=localStorage.getItem(key);if(raw){const parsed=JSON.parse(raw);if(!Array.isArray(parsed)||!parsed.every(i=>i&&typeof i.id==='string'&&typeof i.name==='string'&&typeof i.value==='string'&&typeof i.unit==='string'))throw Error();items=parsed}}catch{status.textContent='已有自定义数据无法读取，请检查后再添加。'}
 function persist(next){try{localStorage.setItem(key,JSON.stringify(next));items=next;render();return true}catch{status.textContent='保存失败，请重试。';return false}}
 function render(){
  list.replaceChildren();
  if(!items.length){const empty=document.createElement('li');empty.textContent='还没有自定义项目，按需添加就好。';empty.className='custom-empty';list.append(empty)}
  for(const item of items){
   const row=document.createElement('li'),text=document.createElement('span'),button=document.createElement('button');
   text.textContent=item.name+'：'+item.value+(item.unit?' '+item.unit:'');
   button.type='button';button.textContent='删除';button.setAttribute('aria-label','删除 '+item.name);
   button.addEventListener('click',()=>{if(window.confirm('删除“'+item.name+'”？')&&persist(items.filter(i=>i.id!==item.id)))status.textContent='已删除。'});
   row.append(text,button);list.append(row);
  }
 }
 el(type+'-custom-form').addEventListener('submit',event=>{
  event.preventDefault();
  const name=el(type+'-name').value.trim(),value=el(type+'-value').value.trim(),unit=el(type+'-unit').value.trim();
  if(!name||!value){status.textContent='请填写名称和数值。';return}
  if(items.some(i=>i.name===name)){status.textContent='已有同名项目，请先删除旧项或使用不同名称。';return}
  if(persist([...items,{id:crypto.randomUUID(),name,value,unit,recordedAt:new Date().toISOString()}])){
   el(type+'-custom-form').reset();status.textContent='已添加并保存。';
  }
 });
 render();
}
connectCustom('body');
connectCustom('goal');


// Manual journals: confirmed food and explicitly separated training states.
function localDay() {
 const d=new Date();
 return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function validDay(s) {
 if(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s))return false;
 const d=new Date(s+'T12:00:00');
 return !Number.isNaN(d.getTime()) && d.getFullYear()===Number(s.slice(0,4)) && d.getMonth()+1===Number(s.slice(5,7)) && d.getDate()===Number(s.slice(8,10));
}
function journalError(type,d) {
 if(!validDay(d.date))return '请选择有效日期。';
 if(typeof d.name!=='string'||!d.name.trim()||d.name.length>80)return '请填写食物或训练名称（最多80字）。';
 if(typeof d.note!=='string'||d.note.length>200)return '备注最多200字。';
 if(type==='food'){
  if(d.date>localDay())return '已吃过的记录不能选择未来日期。';
  if(!['早餐','午餐','晚餐','加餐'].includes(d.meal))return '请选择餐次。';
  if(!positive(d.amount)||!['克','毫升','份','个','碗','杯'].includes(d.unit))return '请填写大于零的份量并选择单位。';
 } else {
  if(!['planned','done'].includes(d.state))return '请选择计划或已完成。';
  if(d.state==='done'&&d.date>localDay())return '未来训练只能保存为计划。';
  for(const key of ['minutes','sets','reps','weight']){
   const v=d[key];
   if(typeof v!=='string')return '训练数据格式错误。';
   if(v!==''&&(!Number.isFinite(Number(v))||Number(v)<0||(key!=='weight'&&Number(v)===0)))return '选填数值须有效；时长、组数与次数须大于零。';
   if(['sets','reps'].includes(key)&&v!==''&&!Number.isInteger(Number(v)))return '组数和次数请填写整数。';
  }
 }
 return '';
}

function parseTrainingText(raw) {
 const text=raw.trim().normalize('NFKC');
 const result={name:'自由训练记录',minutes:'',sets:'',reps:'',weight:'',side:'',incline:'',speed:'',speedUnit:'',warnings:[]};
 let rest=text;
 const take=(regex,fn)=>{const m=rest.match(regex);if(m){fn(m);rest=rest.replace(m[0],' ')}};
 // Multiple activities and ranges are kept as raw text instead of merged into one exercise.
 if(/[\n;；]/.test(text)||/\d\s*[-~～至]\s*\d/.test(text)){
  result.warnings.push('包含多项内容或范围，暂保留文字，不合并估算。可拆成多条记录。');return result;
 }
 take(/(?:两边各|两侧各|每侧|单侧)/,()=>result.side='每侧');
 take(/(?:^|\s)(\d+(?:\.\d+)?)\s*(?:kg|公斤|千克)\b/i,m=>result.weight=m[1]);
 // Chinese unit may not form a word boundary.
 if(!result.weight)take(/(\d+(?:\.\d+)?)\s*(?:公斤|千克)/,m=>result.weight=m[1]);
 take(/(\d+(?:\.\d+)?)\s*(?:min(?:utes?)?|分钟|分)(?![a-z])/i,m=>result.minutes=m[1]);
 take(/(\d+)\s*[×xX*]\s*(\d+)/,m=>{result.reps=m[1];result.sets=m[2];result.warnings.push('“'+m[0]+'”按每组次数 × 组数整理，请确认。')});
 if(!result.sets)take(/(\d+)\s*组/,m=>result.sets=m[1]);
 if(!result.reps)take(/(?:每组)?\s*(\d+)\s*次/,m=>result.reps=m[1]);
 take(/坡度\s*(\d+(?:\.\d+)?)\s*(%|度)?/,m=>{result.incline=m[1]+(m[2]||'（单位未注明）');if(!m[2])result.warnings.push('坡度单位未注明，保留设备原始数值。')});
 take(/速度\s*(\d+(?:\.\d+)?)\s*(km\/h|公里\/小时|mph|m\/s)?/i,m=>{result.speed=m[1];result.speedUnit=m[2]||'';if(!m[2])result.warnings.push('速度单位未注明，不自动补充。')});
 const name=rest.replace(/[，,。]/g,' ').trim();
 if(name)result.name=name.slice(0,80);
 if(result.weight)result.warnings.push('负重保留原值，不推断单只、每手或总重量。');
 if(!result.minutes&&!result.sets&&!result.reps&&!result.weight&&!result.incline&&!result.speed)result.warnings.push('暂未提取数值，将按文字记录保存。');
 result.warnings.push('识别未覆盖的细节请以原文为准；暂不计算运动消耗。');
 return result;
}
let trainingInterpretation=null, trainingPreparedRaw=null;
function previewTraining(){
 const parts=['动作：'+el('training-name').value];
 for(const [id,label,unit] of [['minutes','时长','分钟'],['sets','组数','组'],['reps','每组次数','次'],['weight','负重','kg']]){
  const value=el('training-'+id).value;if(value!=='')parts.push(label+'：'+value+' '+unit);
 }
 if(trainingInterpretation){
  if(trainingInterpretation.side)parts.push('次数适用范围：'+trainingInterpretation.side);
  if(trainingInterpretation.incline)parts.push('坡度：'+trainingInterpretation.incline);
  if(trainingInterpretation.speed)parts.push('速度：'+trainingInterpretation.speed+' '+(trainingInterpretation.speedUnit||'（单位未注明）'));
  parts.push(...trainingInterpretation.warnings);
 }
 const box=el('training-preview');box.hidden=false;box.textContent=parts.join('\n');
}
function resetTrainingInput(){
 trainingInterpretation=null;trainingPreparedRaw=null;
 el('training-preview').hidden=true;el('training-details').open=false;
}
function loadTrainingInput(item){
 el('training-raw').value=item.raw||'';
 trainingPreparedRaw=item.raw||'';
 trainingInterpretation=item.interpretation||null;
 el('training-details').open=!item.raw;
 previewTraining();
}
el('training-parse').addEventListener('click',()=>{
 const raw=el('training-raw').value.trim();
 if(!raw){el('training-status').textContent='先随手写下训练内容，或展开详细信息手动填写。';return}
 trainingInterpretation=parseTrainingText(raw);trainingPreparedRaw=raw;
 for(const f of ['name','minutes','sets','reps','weight'])el('training-'+f).value=trainingInterpretation[f];
 previewTraining();el('training-status').textContent='已整理，请核对后点击保存记录。原文会一并保留。';
});
el('training-raw').addEventListener('input',()=>{
 trainingPreparedRaw=null;
 el('training-preview').hidden=true;
 el('training-status').textContent='原文已变更，请重新整理后保存。';
});
for(const f of ['name','minutes','sets','reps','weight'])el('training-'+f).addEventListener('input',()=>{if(trainingPreparedRaw!==null)previewTraining()});
 function connectJournal(type) {
 const key='fitplan.'+type+'.records.v1',form=el(type+'-form'),status=el(type+'-status'),list=el(type+'-list');
 const fields=type==='food'?['date','meal','name','amount','unit','note']:['date','state','name','minutes','sets','reps','weight','note'];
 let items=[],editing=null,blocked=false;
 function read(){
  const raw=localStorage.getItem(key);
  if(!raw)return [];
  const parsed=JSON.parse(raw);
  if(!Array.isArray(parsed)||!parsed.every(d=>d&&typeof d.id==='string'&&!journalError(type,d))||new Set(parsed.map(d=>d.id)).size!==parsed.length)throw Error('Invalid records');
  return parsed;
 }
 try{items=read()}catch{blocked=true;status.textContent='记录读取失败，已暂停写入以保护原数据。请保留数据并反馈，不要清空浏览器。';}
 el(type+'-date').value=localDay();el(type+'-filter').value=localDay();
 if(type==='food')el(type+'-date').max=localDay();
 function write(next){
  if(blocked)return false;
  try{localStorage.setItem(key,JSON.stringify(next));items=next;return true}
  catch{status.textContent='保存失败，输入已保留，请重试。';return false}
 }
 function reset(){
  form.reset();el(type+'-date').value=el(type+'-filter').value||localDay();
  if(type==='training')resetTrainingInput();   editing=null;el(type+'-mode').textContent='新增记录';el(type+'-cancel').hidden=true;
 }
 function button(label,action){const b=document.createElement('button');b.type='button';b.textContent=label;b.addEventListener('click',action);return b}
 function fresh(){try{items=read();return true}catch{blocked=true;status.textContent='无法读取记录，已暂停保存以保护数据。';return false}}
 function render(){
  list.replaceChildren();
  const rows=items.filter(d=>d.date===el(type+'-filter').value);
  el(type+'-summary').textContent=type==='food'?'已记录 '+rows.length+' 条；营养数据未知。':'计划 '+rows.filter(d=>d.state==='planned').length+' 条 · 已完成 '+rows.filter(d=>d.state==='done').length+' 条';
  if(!rows.length){const li=document.createElement('li');li.className='journal-empty';li.textContent=blocked?'记录暂时无法读取。':'这一天还没有记录，从一条开始就好。';list.append(li)}
  for(const item of rows){
   const li=document.createElement('li'),title=document.createElement('h3'),detail=document.createElement('p'),note=document.createElement('p'),actions=document.createElement('div');
   title.textContent=(type==='food'?item.meal:item.state==='planned'?'计划':'已完成')+' · '+item.name;
   detail.textContent=type==='food'?item.amount+' '+item.unit+' · 营养未知':
    [item.minutes?item.minutes+' 分钟':'时长未记录',item.sets?item.sets+' 组':'',item.reps?'每组 '+item.reps+' 次':'',item.weight!==''?'负重 '+item.weight+' kg':''].filter(Boolean).join(' · ');
   note.textContent=item.note;    if(type==='training'){     const meta=item.interpretation;     if(meta){if(meta.side)detail.textContent+=' · '+meta.side;if(meta.incline)detail.textContent+=' · 坡度 '+meta.incline;if(meta.speed)detail.textContent+=' · 速度 '+meta.speed+' '+(meta.speedUnit||'（单位未注明）');}     if(item.raw)note.textContent=(item.note?item.note+'\n':'')+'原文：'+item.raw;    }    actions.className='journal-actions';
   actions.append(button('修改',()=>{editing=item.id;fields.forEach(f=>el(type+'-'+f).value=item[f]);el(type+'-mode').textContent='修改记录';el(type+'-cancel').hidden=false;if(type==='training')loadTrainingInput(item);status.textContent='修改后请保存。';el(type==='training'?'training-raw':type+'-name').focus()}));
   if(type==='training'&&item.state==='planned')actions.append(button('确认已完成',()=>{
    if(item.date>localDay()){status.textContent='未来计划不能确认完成，请先修改为实际日期。';return}
    if(!window.confirm('确认这条训练已经完成？'))return;
    if(!fresh())return;
    if(!items.some(d=>d.id===item.id)){status.textContent='记录已变化，请刷新查看。';render();return}
    if(write(items.map(d=>d.id===item.id?{...d,state:'done',updatedAt:new Date().toISOString()}:d))){if(editing===item.id)reset();status.textContent='已确认完成。';render()}
   }));
   actions.append(button('删除',()=>{
    if(!window.confirm('删除这条记录？'))return;
    if(!fresh())return;
    if(write(items.filter(d=>d.id!==item.id))){if(editing===item.id)reset();status.textContent='已删除。';render()}
   }));
   li.append(title,detail,note,actions);list.append(li);
  }
 }
 form.addEventListener('submit',event=>{
  event.preventDefault();
  if(blocked){status.textContent='记录不可读取，暂不能保存，请反馈问题。';return}
  if(type==='training'&&el('training-raw').value.trim()&&trainingPreparedRaw!==el('training-raw').value.trim()){status.textContent='请先点击“整理一下”并核对结果，再保存。';return}   const draft=Object.fromEntries(fields.map(f=>[f,el(type+'-'+f).value.trim()]));
  const error=journalError(type,draft);if(error){status.textContent=error;return}
  if(!fresh())return;
  if(editing&&!items.some(d=>d.id===editing)){status.textContent='原记录已删除，请取消修改后重新添加。';return}
  if(!editing&&items.some(d=>fields.every(f=>d[f]===draft[f])&&(type!=='training'||(d.raw||'')===el('training-raw').value.trim()))){status.textContent='已有完全相同的记录，请核对，避免重复保存。';return}
  const record={...draft,...(type==='training'?{raw:el('training-raw').value.trim(),interpretation:trainingInterpretation}:{}),id:editing||crypto.randomUUID(),updatedAt:new Date().toISOString()};
  const next=editing?items.map(d=>d.id===editing?record:d):[...items,record];
  if(write(next)){el(type+'-filter').value=draft.date;reset();status.textContent='已保存到当前浏览器。';render()}
 });
 el(type+'-cancel').addEventListener('click',()=>{reset();status.textContent='已取消修改。'});
 el(type+'-filter').addEventListener('change',render);
 window.addEventListener('storage',event=>{if(event.key===key){if(fresh())render()}});
 render();
}

connectJournal('training');


// FOOD ESTIMATION: cited energy data, explicit app portion assumptions.
const foodSourceBase='https://www.fao.org/4/y5432e/';
const foodCatalog=[
 {id:'rice',name:'白米饭（熟）',aliases:['白米饭','米饭'],energy:123,code:'B077',page:'y5432e07.htm',unit:'碗',portions:{碗:200,份:200,勺:15}},
 {id:'egg',name:'水煮鸡蛋（水波蛋数据近似）',aliases:['水煮鸡蛋','水煮蛋','煮鸡蛋','鸡蛋'],energy:150,code:'N005',page:'y5432e0h.htm',unit:'个',portions:{个:50,颗:50,只:50}},
 {id:'fried-egg',name:'煎鸡蛋',aliases:['煎鸡蛋','煎蛋','荷包蛋'],energy:256,code:'N004',page:'y5432e0h.htm',unit:'个',portions:{个:46,颗:46,只:46}},
 {id:'milk',name:'全脂纯牛奶',aliases:['全脂牛奶','纯牛奶','牛奶'],energy:66,code:'M030',page:'y5432e0g.htm',unit:'盒',portions:{盒:258,杯:258,瓶:258},density:1.032},
 {id:'skim-milk',name:'脱脂牛奶',aliases:['脱脂牛奶'],energy:35,code:'M028',page:'y5432e0g.htm',unit:'盒',portions:{盒:260,杯:260},density:1.04},
 {id:'yogurt',name:'原味无糖酸奶',aliases:['原味无糖酸奶','无糖酸奶','原味酸奶','酸奶'],energy:68,code:'M041',page:'y5432e0g.htm',unit:'盒',portions:{盒:150,杯:150,勺:15}},
 {id:'low-yogurt',name:'低脂无糖酸奶',aliases:['低脂无糖酸奶'],energy:49,code:'M040',page:'y5432e0g.htm',unit:'盒',portions:{盒:150,杯:150}},
 {id:'fruit-yogurt',name:'水果酸奶',aliases:['水果酸奶'],energy:94,code:'M039',page:'y5432e0g.htm',unit:'盒',portions:{盒:150,杯:150}},
 {id:'apple',name:'苹果（可食部分）',aliases:['苹果'],energy:54,code:'E005',page:'y5432e0a.htm',unit:'个',portions:{个:130,颗:130,块:20,片:15}},
 {id:'bread',name:'白吐司面包',aliases:['白吐司','吐司','白面包','面包'],energy:242,code:'B025',page:'y5432e07.htm',unit:'片',portions:{片:26,块:26,份:52}},
 {id:'wholebread',name:'全麦面包',aliases:['全麦面包','全麦吐司'],energy:233,code:'B027',page:'y5432e07.htm',unit:'片',portions:{片:28,块:28,份:56}},
 {id:'potato',name:'水煮土豆（去皮）',aliases:['水煮土豆','煮土豆'],energy:66,code:'A018',page:'y5432e06.htm',unit:'份',portions:{份:150,个:150,块:25}},
 {id:'noodle',name:'熟鸡蛋面（无浇头）',aliases:['鸡蛋面'],energy:128,code:'B103',page:'y5432e07.htm',unit:'碗',portions:{碗:200,份:200}}
];
function chineseQuantity(s){
 if(s==='半')return .5;
 if(/^[0-9]+(?:[.][0-9]+)?$/.test(s))return Number(s);
 const digits={零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
 if(s in digits)return digits[s];
 if(s.includes('十')){const [x,y]=s.split('十');return (x?digits[x]:1)*10+(y?digits[y]:0)}
 return NaN;
}
function estimateFood(raw){
 return raw.normalize('NFKC').split(/[，,、；;\n]+|以及|还有/).map(t=>t.trim()).filter(Boolean).map(original=>{
  const unknown=reason=>({name:original,raw:original,unknown:true,reason});
  if(/没吃|未吃|不吃|不含|不要/.test(original))return unknown('包含否定描述，未计入热量。');
  if(/[0-9]\s*[-~至]\s*[0-9]|几|少许|一点|口/.test(original))return unknown('份量表达暂不能可靠换算，可改写为半碗、一块等。');
  const candidates=foodCatalog.flatMap(f=>f.aliases.filter(alias=>original.includes(alias)).map(alias=>({f,alias}))).sort((a,b)=>b.alias.length-a.alias.length);
  if(!candidates.length)return unknown('尚无匹配的食物数据。');
  const {f,alias}=candidates[0];
  // Reject composite dishes and unsupported preparations instead of treating them as plain ingredients.
  let text=original.replace(alias,'');
  if(candidates.some(c=>c.f.id!==f.id&&!alias.includes(c.alias)))return unknown('多种食物请用逗号分开，避免份量混用。');
  if(/炒|炸|红烧|奶茶|蛋糕|夹心|酱|糖|奶粉|生米|生蛋|干面/.test(text))return unknown('该做法或配料尚无匹配数据，未套用普通食物热量。');
  const q=text.match(/([0-9]+(?:[.][0-9]+)?|半|[一二两三四五六七八九十]+)\s*(小|大)?\s*(千克|公斤|kg|毫升|ml|克|g|碗|盒|杯|瓶|份|个|颗|只|片|块|勺)/i);
  let grams,basis;
  if(q){
   const count=chineseQuantity(q[1]),size=q[2]||'',unit=q[3].toLowerCase();
   const leftover=text.replace(q[0],'').replace(/早餐|午餐|晚餐|加餐|早上|中午|晚上|今天|我|吃了|喝了|吃|喝|的|约|大约|大概|左右|了|想|准备|打算|请问|多少热量|热量|卡路里|[?？。\s]/g,'');
   if(leftover)return unknown('描述还有未识别的数量或配料，请简写为食物和份量。');
   if(!Number.isFinite(count)||count<=0)return unknown('份量须大于零。');
   if(['克','g'].includes(unit)){grams=count;basis='按输入重量 '+count+' 克';}
   else if(['千克','公斤','kg'].includes(unit)){grams=count*1000;basis='按输入重量换算';}
   else if(['ml','毫升'].includes(unit)){
    if(!f.density)return unknown('该食物暂无体积与重量换算参考，请使用克或常见份量。');
    grams=count*f.density;basis='体积按默认密度 '+f.density+' g/ml 近似换算';
   }else{
    if(!f.portions[unit])return unknown('该食物暂不支持此份量单位，请改用克或'+f.unit+'。');
    const factor=size==='小'?.75:size==='大'?1.25:1;
    grams=count*f.portions[unit]*factor;
    basis='应用份量假设：1'+unit+'≈'+f.portions[unit]+'克'+(size?'；'+size+'份按 '+factor+' 倍':'')+'，不是实测重量';
   }
  }else{
   const leftover=text.replace(/早餐|午餐|晚餐|加餐|今天|我|吃了|喝了|吃|喝|想|准备|打算|了|的|请问|多少热量|热量|[?？。\s]/g,'');
   if(leftover)return unknown('暂无法解析描述，请使用食物名称和常见份量。');
   grams=f.portions[f.unit];basis='未写份量，默认1'+f.unit+'≈'+grams+'克（可修改）';
  }
  if(!Number.isFinite(grams)||grams<=0||grams>10000)return unknown('份量异常，请核对。');
  return {foodId:f.id,name:f.name,raw:original,grams:Math.round(grams*10)/10,kcalPer100:f.energy,kcal:grams*f.energy/100,source:foodSourceBase+f.page,code:f.code,basis,unknown:false};
 });
}
function foodTotals(records){
 let total=0,unknown=0;
 for(const record of records)for(const item of record.items){if(item.unknown)unknown++;else total+=item.grams*item.kcalPer100/100}
 return {total:Math.round(total),unknown};
}
function connectFoodEstimator(){
 const key='fitplan.food.records.v1',status=el('food-natural-status');
 let mode='eaten',result=null,records=[],locked=false,lastSaved=null,editingId=null;
 const date=el('food-entry-date'),filter=el('food-filter'),meal=el('food-entry-meal'),input=el('food-raw');
 date.value=filter.value=localDay();date.max=localDay();
 function read(){
  const raw=localStorage.getItem(key);if(!raw)return [];
  const rows=JSON.parse(raw);if(!Array.isArray(rows))throw Error('invalid records');
  const converted=rows.map(d=>{
   if(!d||typeof d.id!=='string'||!validDay(d.date)||!['早餐','午餐','晚餐','加餐'].includes(d.meal))throw Error();
   if(!d.items){
    if(typeof d.name!=='string')throw Error();
    return {id:d.id,date:d.date,meal:d.meal,raw:d.name+' '+d.amount+' '+d.unit+(d.note?' '+d.note:''),items:[{unknown:true,name:d.name,raw:d.name+' '+d.amount+' '+d.unit,reason:'旧版手动记录保留原份量，未自动追溯计算热量。'}]};
   }
   if(!Array.isArray(d.items)||!d.items.length||!d.items.every(i=>i&&typeof i.name==='string'&&typeof i.unknown==='boolean'&&(i.unknown||(Number.isFinite(i.grams)&&i.grams>0&&Number.isFinite(i.kcalPer100)&&i.kcalPer100>=0))))throw Error();
   return d;
  });
  if(new Set(converted.map(d=>d.id)).size!==converted.length)throw Error();
  return converted;
 }
 function refresh(){try{records=read();locked=false;return true}catch{locked=true;status.textContent='记录读取失败，已停止写入以保护原数据。请反馈，不要清除浏览器。';return false}}
 function write(next){if(locked)return false;try{localStorage.setItem(key,JSON.stringify(next));records=next;renderRecords();return true}catch{status.textContent='保存失败，结果仍保留，请重试。';return false}}
 function make(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
 function totalText(rows){const t=foodTotals(rows);if(!rows.some(d=>d.items.some(i=>!i.unknown)))return '热量待估 · '+t.unknown+'项未计入';return (t.unknown?'已识别部分约 ':'已记录约 ')+t.total+' 千卡'+(t.unknown?' · '+t.unknown+'项未计入':'')}
 function showItems(container,items,recordId){
  items.forEach((item,index)=>{
   const card=make('div',undefined,'food-estimate-item');card.append(make('strong',item.name));
   if(item.unknown){card.append(make('p',item.reason+' 不按零热量处理。'));container.append(card);return}
   const label=make('label','估计份量 '),grams=make('input');grams.type='number';grams.className='gram-edit';grams.min='0.1';grams.max='10000';grams.step='any';grams.value=item.grams;grams.setAttribute('aria-label',item.name+'克数');
   label.append(grams,make('span','克'));card.append(label,make('p','约 '+Math.round(item.grams*item.kcalPer100/100)+' 千卡'));
   const details=make('details'),summary=make('summary','查看估算依据'),link=make('a','FAO 食物表 · '+item.code);
   link.href=item.source;link.target='_blank';link.rel='noopener noreferrer';
   details.append(summary,make('p',item.basis+'；按 '+item.kcalPer100+' 千卡/100克计算。'),link);card.append(details);
   grams.addEventListener('change',()=>{
    const value=Number(grams.value);
    if(!Number.isFinite(value)||value<=0||value>10000){status.textContent='克数须大于零且不超过10000。';grams.value=item.grams;return}
    if(recordId){
     if(!refresh())return;
     const current=records.find(d=>d.id===recordId);if(!current){status.textContent='原记录已删除，请重新查看。';renderRecords();return}
     const next=records.map(d=>d.id===recordId?{...d,items:d.items.map((i,j)=>j===index?{...i,grams:value,kcal:value*i.kcalPer100/100,basis:'用户调整的重量'}:i)}:d);
     if(write(next)){status.textContent='份量已更新，热量已重新计算。';if(result&&lastSaved===recordId){result.items=next.find(d=>d.id===recordId).items;renderResult()}}
    }else{
     item.grams=value;item.kcal=value*item.kcalPer100/100;item.basis='用户调整的重量';renderResult();
    }
   });
   container.append(card);
  });
 }
 function renderResult(){
  const box=el('food-estimate-result');box.replaceChildren();
  if(!result){el('food-query-save').hidden=true;return}
  box.append(make('h3',lastSaved?'已记录本次摄入':'查询结果 · 未计入摄入'),make('p',totalText([result]),'food-total'));
  showItems(box,result.items,lastSaved);
  el('food-query-save').hidden=mode!=='query'||Boolean(lastSaved);
 }
 function renderRecords(){
  const rows=records.filter(d=>d.date===filter.value),list=el('food-list');list.replaceChildren();
  el('food-summary').textContent=rows.length?totalText(rows):'暂无记录';
  if(!rows.length)list.append(make('li','这一天还没有饮食记录。','journal-empty'));
  for(const record of rows){
   const li=make('li');li.append(make('h3',record.meal),make('p',record.raw),make('p',totalText([record])));
   showItems(li,record.items,record.id);
   const edit=make('button','修改描述');edit.type='button';edit.addEventListener('click',()=>{setMode('eaten');editingId=record.id;input.value=record.raw;date.value=record.date;meal.value=record.meal;el('food-estimate-submit').textContent='重新估算并保存修改';el('food-cancel-edit').hidden=false;status.textContent='原记录会在保存成功后替换，取消不会修改数据。';input.focus()});li.append(edit);
   const del=make('button','删除本次记录');del.type='button';
   del.addEventListener('click',()=>{
    if(!window.confirm('删除这次饮食记录？')||!refresh())return;
    if(write(records.filter(d=>d.id!==record.id))){if(editingId===record.id)setMode('eaten');status.textContent='已删除。';if(lastSaved===record.id){lastSaved=null;result=null;renderResult()}}
   });
   li.append(del);list.append(li);
  }
  const today=records.filter(d=>d.date===localDay()),total=el('today-food-total');
  if(total)total.textContent=today.length?totalText(today):'待记录';
 }
 function saveResult(day){
  if(!validDay(day)||day>localDay()){status.textContent='实际摄入请选择今天或过去日期。';return false}
  if(!result||!refresh())return false;
  if(editingId&&!records.some(d=>d.id===editingId)){status.textContent='原记录已删除，请取消修改后重试。';return false}
  const duplicate=records.find(d=>d.id!==editingId&&d.date===day&&d.meal===meal.value&&d.raw===result.raw);
  if(duplicate&&editingId){status.textContent='修改结果与另一条记录相同，原记录尚未修改。';return false}
  if(duplicate){lastSaved=duplicate.id;result={...duplicate};status.textContent='已有同日期、同餐次的相同记录，没有重复计入。';renderResult();return true}
  const saved={...result,id:editingId||crypto.randomUUID(),date:day,meal:meal.value};
  if(write(editingId?records.map(d=>d.id===editingId?saved:d):[...records,saved])){editingId=null;el('food-cancel-edit').hidden=true;el('food-estimate-submit').textContent=mode==='query'?'查询热量':'估算并记录';lastSaved=saved.id;filter.value=day;renderRecords();status.textContent='已自动估算并计入 '+day+'。';renderResult();return true}
  return false;
 }
 function setMode(value){
  mode=value;editingId=null;el('food-cancel-edit').hidden=true;result=null;lastSaved=null;renderResult();
  el('food-eaten-mode').setAttribute('aria-pressed',String(value==='eaten'));
  el('food-query-mode').setAttribute('aria-pressed',String(value==='query'));
  el('food-estimate-submit').textContent=value==='eaten'?'估算并记录':'查询热量';
  el('food-mode-help').textContent=value==='eaten'?'点击记录即表示已经吃过，自动计入所选日期。':'只查询，不保存摄入；点击“我吃了”才记入今天。';
  date.disabled=value==='query';status.textContent='';
 }
 el('food-cancel-edit').addEventListener('click',()=>{setMode('eaten');status.textContent='已取消修改。';});
el('food-eaten-mode').addEventListener('click',()=>setMode('eaten'));
 el('food-query-mode').addEventListener('click',()=>setMode('query'));
 input.addEventListener('input',()=>{result=null;lastSaved=null;renderResult()});
 el('food-natural-form').addEventListener('submit',event=>{
  event.preventDefault();const raw=input.value.trim();if(!raw){status.textContent='写下食物名称和大概份量即可。';return}
  if(mode==='eaten'&&/想吃|准备吃|打算吃|计划吃|想喝|准备喝/.test(raw)){setMode('query');status.textContent='这是想吃的内容，已切换为查询，不计入摄入。';}
  result={raw,items:estimateFood(raw)};lastSaved=null;
  if(!result.items.length){status.textContent='没有可识别的输入。';return}
  if(mode==='eaten'){if(!saveResult(date.value))renderResult()}else{renderResult();status.textContent='估算完成，尚未计入摄入。'}
 });
 el('food-query-save').addEventListener('click',()=>{if(result&&!lastSaved)saveResult(localDay())});
 filter.addEventListener('change',()=>{if(refresh())renderRecords()});
 window.addEventListener('storage',event=>{if(event.key===key&&refresh()){result=null;lastSaved=null;renderResult();renderRecords()}});
 if(refresh())renderRecords();
}
connectFoodEstimator();

