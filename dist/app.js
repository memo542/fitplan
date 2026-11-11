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
