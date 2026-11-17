const labels = { today: '今日概览', food: '饮食记录', training: '训练记录', week: '成长足迹', overview: '今日综合情况', advice: '今日建议', body: '身体数据', goals: '目标规划' };
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
function renderMacroGuide(){
 el('macro-guide').textContent=macroGuideText(Object.fromEntries(['age','height','weight','activity','sex'].map(k=>[k,el('profile-'+k).value])));
}
function dailyEnergyEstimate(profile){
 const age=Number(profile.age),height=Number(profile.height),weight=Number(profile.weight),level=profile.activity,sex=profile.sex;
 if(!Number.isInteger(age)||age<19||!['0','1','2','3'].includes(level)||!['male','female'].includes(sex))return null;
 const coefficients=sex==='male'?[[753.07,6.50,14.10],[581.47,8.30,14.94],[1004.82,6.52,15.91],[-517.88,15.61,19.11]]:[[584.90,5.72,11.71],[575.77,6.60,12.14],[710.25,6.54,12.34],[511.83,9.07,12.56]];
 const [base,h,w]=coefficients[Number(level)];
 const kcal=base-age*(sex==='male'?10.83:7.01)+height*h+weight*w;
 if(!Number.isFinite(kcal)||kcal<=0||height<=0||weight<=0)return null;
 return kcal;
}
function macroGuideText(profile){
 const kcal=dailyEnergyEstimate(profile);
 if(kcal===null)return "补全适用的基础资料后可查看每日参考范围（一般健康、非孕非哺乳成人，19岁起）。";
 const range=(low,high,unit)=>Math.round(kcal*low/unit)+'–'+Math.round(kcal*high/unit)+' 克';
 return '维持体重参考约 '+Math.round(kcal)+' 千卡/天。蛋白质 '+range(.10,.35,4)+'，碳水 '+range(.45,.65,4)+'，脂肪 '+range(.20,.35,9)+'。适用于一般健康、非孕非哺乳成人。';
}
function connectForm(config) {
 const status=el(config.status);
 try {
  const raw=fitplanStorage.getItem(config.key);
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
  try {
   const day=el('measure-day').value;
   if(!validDay(day)||day>localDay()){status.textContent='请选择今天或更早的测量日期。';return}
   const old=JSON.parse(fitplanStorage.getItem(config.key));
   data.weights={...weightHistory(old),[day]:Number(data.weight)};
   const latest=Object.keys(data.weights).sort().at(-1);
   data.weight=String(data.weights[latest]);
   fitplanStorage.setItem(config.key,JSON.stringify(data));status.textContent='已保存，刷新后仍保留。'}catch{status.textContent='保存失败，浏览器存储不可用。'}
 });
 el(config.clear).addEventListener('click',()=>{
  if(!window.confirm('确定清除基础信息和所有历史体重吗？'))return;
  try{fitplanStorage.removeItem(config.key);config.fields.forEach(([id])=>el(id).value='');status.textContent='已清除。';if(config.after)config.after()}catch{status.textContent='清除失败，请重试。'}
 });
 if(config.after)config.after();
}
connectForm({form:'profile-form',key:'fitplan.profile.v1',status:'profile-status',clear:'clear-profile',fields:[['profile-age','age',v=>positive(v)&&Number.isInteger(Number(v))],['profile-activity','activity',v=>['0','1','2','3'].includes(v)],['profile-height','height',positive],['profile-weight','weight',positive],['profile-sex','sex',v=>sexValues.includes(v)]],after:()=>{renderMacroGuide();el('cycle-note').hidden=el('profile-sex').value!=='female'}});

const goalKey = 'fitplan.goals.v1';
const goalKinds = ['fat-loss', 'muscle-gain', 'maintain', 'explore'];
const interestIds = ['shape', 'strength', 'endurance', 'mobility'];
const goalStatus = el('goal-status');
try {
 const raw = fitplanStorage.getItem(goalKey);
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
 try { fitplanStorage.setItem(goalKey,JSON.stringify(data)); renderGoalSummary(); goalStatus.textContent='目标规划已保存，按你的节奏慢慢来。'; }
 catch { goalStatus.textContent='保存失败，浏览器存储不可用。'; }
});
el('clear-goal').addEventListener('click', () => {
 if(!window.confirm('清除主要方向、目标体重和改善方向？右侧自定义目标会保留。')) return;
 try {
  fitplanStorage.removeItem(goalKey); el('goal-kind').value=''; el('goal-weight').value='';
  interestIds.forEach(id=>el('interest-'+id).checked=false);
  renderGoalSummary(); goalStatus.textContent='已清除，自定义目标仍保留。';
 } catch { goalStatus.textContent='清除失败，请重试。'; }
});

function renderGoalSummary(){
 let label='待设置';
 try {
  const kind=JSON.parse(fitplanStorage.getItem(goalKey))?.kind;
  const option=Array.from(el('goal-kind').options).find(item=>item.value && item.value===kind);
  if(option)label=option.textContent;
 } catch { label='暂时无法读取'; }
 el('today-goal').textContent=label;
 el('overview-goal').textContent='当前目标：'+label+'。';
}
renderGoalSummary();
window.addEventListener('storage',event=>{if(event.key===goalKey)renderGoalSummary()});

function connectCustom(type) {
 const key='fitplan.'+type+'.custom.v1',status=el(type+'-custom-status'),list=el(type+'-custom-list');
 let items=[];
 try{const raw=fitplanStorage.getItem(key);if(raw){const parsed=JSON.parse(raw);if(!Array.isArray(parsed)||!parsed.every(i=>i&&typeof i.id==='string'&&typeof i.name==='string'&&typeof i.value==='string'&&typeof i.unit==='string'))throw Error();items=parsed}}catch{status.textContent='已有自定义数据无法读取，请检查后再添加。'}
 function persist(next){try{fitplanStorage.setItem(key,JSON.stringify(next));items=next;render();return true}catch{status.textContent='保存失败，请重试。';return false}}
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
 take(/(\d+(?:\.\d+)?)\s*(?:kg|公斤|千克)(?![a-z])/i,m=>result.weight=m[1]);
 // Chinese unit may not form a word boundary.
 if(!result.weight)take(/(\d+(?:\.\d+)?)\s*(?:公斤|千克)/,m=>result.weight=m[1]);
 take(/(\d+(?:\.\d+)?)\s*(?:min(?:utes?)?|分钟|分)(?![a-z])/i,m=>result.minutes=m[1]);
 take(/(\d+)\s*[×xX*]\s*(\d+)/,m=>{result.reps=m[1];result.sets=m[2];result.warnings.push('“'+m[0]+'”按每组次数 × 组数整理，请确认。')});
 if(!result.sets)take(/(\d+)\s*组/,m=>result.sets=m[1]);
 if(!result.reps)take(/(?:每组)?\s*(\d+)\s*次/,m=>result.reps=m[1]);
 take(/坡度\s*(\d+(?:\.\d+)?)\s*(%|度)?/,m=>{result.incline=m[1]+(m[2]||'（单位未注明）');if(!m[2])result.warnings.push('坡度单位未注明，保留设备原始数值。')});
 take(/速度\s*(\d+(?:\.\d+)?)\s*(km\/h|公里\/小时|mph|m\/s)?/i,m=>{result.speed=m[1];result.speedUnit=m[2]||'';if(!m[2])result.warnings.push('速度单位未注明，不自动补充。')});
 take(/(半|\d+(?:\.\d+)?)\s*(?:小时|hours?)/i,m=>result.minutes=String(Number(result.minutes)+(m[1]==='半'?.5:Number(m[1]))*60));
 take(/(\d+(?:\.\d+)?)\s*(公里|千米|km|米)(?![a-z/])/i,m=>result.distance=m[1]+m[2]);
 const name=rest.replace(/[，,。]/g,' ').trim();
 if(name)result.name=name.slice(0,80);
 if(result.weight)result.warnings.push('负重保留原值，不推断单只、每手或总重量。');
 if(!result.minutes&&!result.sets&&!result.reps&&!result.weight&&!result.incline&&!result.speed&&!result.distance)result.warnings.push('暂未提取数值，将按文字记录保存。');
 result.warnings.push('识别未覆盖的细节请以原文为准；可选运动库条目估算消耗。');
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
  if(trainingInterpretation.distance)parts.push('距离：'+trainingInterpretation.distance);
  if(trainingInterpretation.speed)parts.push('速度：'+trainingInterpretation.speed+' '+(trainingInterpretation.speedUnit||'（单位未注明）'));
  parts.push(...trainingInterpretation.warnings);
 }
 const box=el('training-preview');box.hidden=false;box.textContent=parts.join('\n');
}
// Herrmann et al., 2024 Adult Compendium, https://pacompendium.com/adult-compendium/
// Official activity code, MET value, original activity description (ages 19–59).
const activityCatalog = [
["01003",14,"Bicycling, mountain, uphill, vigorous"],
["01004",16,"Bicycling, mountain, competitive racing"],
["01008",8.5,"Bicycling, BMX"],
["01009",8.5,"Bicycling, mountain, general"],
["01010",4,"Bicycling, <10 mph, leisure, to work or for pleasure (Taylor Code 115)"],
["01011",6.8,"Bicycling, to/from work, self selected pace"],
["01013",5.8,"Bicycling, on dirt or farm road, moderate pace"],
["01014",7,"Bicycling, general"],
["01015",4.3,"Bicycling, self-selected easy pace"],
["01016",7,"Bicycling, self-selected moderate pace"],
["01017",9,"Bicycling, self-selected vigorous pace"],
["01018",3.5,"Bicycling, leisure 5.5 mph"],
["01019",5.8,"Bicycling, leisure, 9.4 mph"],
["01020",6.8,"Bicycling, 10-11.9 mph, leisure, slow, light effort"],
["01030",8,"Bicycling, 12-13.9 mph, leisure, moderate effort"],
["01040",10,"Bicycling, 14-15.9 mph, racing or leisure, fast, vigorous effort"],
["01050",12,"Bicycling, 16-19 mph, racing/not drafting or >19 mph drafting, very fast, racing general"],
["01060",16.8,"Bicycling, >20 mph, racing, not drafting"],
["01065",8.5,"Bicycling, 12 mph, seated, hands on brake hoods or bar drops, 80 rpm"],
["01066",9,"Bicycling, 12 mph, standing, hands on brake hoods, 60 rpm"],
["01070",5,"Unicycling"],
["01080",6.8,"E-bike (electrically assisted) without electronic support"],
["01084",6,"E-bike (electrically assisted) with light electronic support"],
["01088",4,"E-bike (electrically assisted) with high electronic support"],
["01200",6.8,"Bicycling, stationary, general"],
["01210",3.5,"Bicycling, stationary, 25-30 watts, very light to light effort"],
["01214",4,"Bicycling, stationary, 50 watts, light effort"],
["01216",5,"Bicycling, stationary, 60 watts, light to moderate effort"],
["01218",5.8,"Bicycling, stationary, 70-80 watts"],
["01220",6,"Bicycling, stationary, 90-100 watts,  moderate to vigorous"],
["01224",6.8,"Bicycling, stationary, 101-125 watts"],
["01228",8,"Bicycling, stationary, 126-150 watts"],
["01232",10.3,"Bicycling, stationary, 151-199 watts"],
["01236",10.8,"Bicycling, stationary, 200-229 watts, vigorous"],
["01240",12.5,"Bicycling, stationary, 230-250 watts, very vigorous"],
["01244",13.8,"Bicycling, stationary, 270-305 watts, very vigorous"],
["01248",16.3,"Bicycling, stationary, >325 watts, very vigorous"],
["01252",5.5,"Bicycling, concentric only, 100 W"],
["01254",11,"Bicycling, concentric only, 200 W"],
["01262",2.3,"Bicycling, eccentric only, 100 to 149 W"],
["01264",4,"Bicycling, eccentric only, 200 W"],
["01270",9,"Bicycling, stationary, RPM/Spin bike class"],
["01290",8.8,"Bicycling, interactive virtual cycling, indoor cycle ergometer"],
["01305",8.8,"Bicycling, high intensity interval training"],
["02000",7.3,"Aerobic, general"],
["02001",5.5,"Aerobic, step, with 4-inch step"],
["02002",7.3,"Aerobic, step, with 6 – 8 inch step"],
["02003",9,"Aerobic, step, with 10 – 12 inch step"],
["02004",7.8,"Bench step class, general"],
["02005",4.8,"Aerobic dance, low impact, moderate effort"],
["02006",8,"Aerobic dance, high impact, vigorous effort"],
["02007",10,"Aerobic dance wearing 10-15 lb weights"],
["02008",5,"Army type obstacle course exercise, boot camp training program"],
["02020",7.5,"Calisthenics (e.g., pushups, sit ups, pull-ups, jumping jacks, burpees, battling ropes), vigorous effort"],
["02022",3.8,"Calisthenics (e.g., pushups, sit ups, pull-ups, lunges), moderate effort"],
["02024",2.8,"Calisthenics (e.g., curl ups, abdominal crunches, plank),  light effort"],
["02030",3.5,"Calisthenics, light or moderate effort, general (e.g., back exercises), going up & down from floor (Taylor Code 150)"],
["02032",6,"Circuit training, body weight exercises"],
["02034",3.5,"Circuit training, light effort"],
["02035",5,"Circuit training, moderate effort"],
["02040",7.5,"Circuit training, including kettlebells, some aerobic movement with minimal rest, general, vigorous intensity"],
["02045",3.5,"Curves™ exercise routines in women"],
["02048",5,"Elliptical trainer, moderate effort"],
["02049",9,"Elliptical trainer, vigorous effort"],
["02050",6,"Resistance (weight lifting – free weight, nautilus or universal-type), power lifting or body building, vigorous effort (Taylor Code 210)"],
["02052",5,"Resistance (weight) training, squats, deadlift, slow or explosive effort"],
["02054",3.5,"Resistance (weight) training, multiple exercises, 8-15 reps at varied resistance"],
["02055",5.8,"Resistance Training, circuit, reciprocal supersets, peripheral heart action training"],
["02056",3,"Body weight resistance exercises (e.g., squat, lunge, push-up, crunch), general"],
["02057",6.5,"Body weight resistance exercises (e.g., squat, lunge, push-up, crunch), high intensity"],
["02058",9.8,"Kettlebell swings"],
["02060",5.5,"Health club exercise, general (Taylor Code 160)"],
["02061",5,"Health club exercise classes, general, gym/weight training combined in one visit"],
["02062",7.8,"Health club exercise, conditioning classes"],
["02064",3.8,"Home exercise, general"],
["02065",9.3,"Stair treadmill ergometer, general"],
["02068",11,"Rope skipping exercise, general"],
["02069",9,"Jumping rope, Digi-Jump Machine, 120 jumps/minute"],
["02070",7.3,"Rowing, stationary ergometer, general, vigorous effort"],
["02071",5,"Rowing, stationary ergometer, general, <100 watts,  moderate effort"],
["02072",7.5,"Rowing, stationary, 100 to 149 watts, vigorous effort"],
["02073",11,"Rowing, stationary, 150 to 199 watts, vigorous effort"],
["02074",14,"Rowing, stationary, ≥ 200 watts, very vigorous effort"],
["02078",11,"Shuttle running, forward/backward/lateral"],
["02080",6.8,"Ski machine, general"],
["02082",10.5,"Ski ergometer, cross country, double poling, slow to moderate speed"],
["02084",18,"Ski ergometer, cross country, double poling, fast to maximum speed"],
["02085",10.5,"Slide board exercise, general"],
["02090",6,"Slimnastics, jazzercise"],
["02101",2.3,"Stretching, mild"],
["02103",1.8,"Pilates, traditional, mat"],
["02105",2.8,"Pilates, general"],
["02107",8.5,"Pound, combination of Pilates and body movements with drumming"],
["02108",4.5,"Pole dancing, exercise class"],
["02110",6.8,"Teaching exercise classes (e.g., aerobic, water)"],
["02112",2.8,"Therapeutic exercise ball, Fitball exercise"],
["02114",9.5,"Therapeutic exercise ball, Fitball exercise, high intensity"],
["02115",2.8,"Upper body exercise, arm ergometer, general, light"],
["02116",2,"Arm Ergometer, hand bike, 15W"],
["02117",2.8,"Arm Ergometer, hand bike, 25-30W"],
["02118",3.5,"Arm Ergometer, hand bike, 45W"],
["02119",4.3,"Upper body exercise, stationary bicycle – Airdyne (arms only) 40 rpm, moderate intensity"],
["02120",5.3,"Water aerobics, water calisthenics, water exercise"],
["02135",1.3,"Whirlpool, sitting"],
["02140",2.5,"Video, exercise workouts, TV conditioning programs (e.g., yoga, stretching, seated), light effort"],
["02143",4,"Video, exercise workouts, TV conditioning programs (e.g., cardio-resistance training), moderate"],
["02145",6,"Video, exercise workouts, TV conditioning programs (e.g., cardio-resistance training), vigorous"],
["02150",2.3,"Yoga, Hatha"],
["02153",8,"Yoga, Hatha, high intensity"],
["02155",3,"Yoga, Hot"],
["02160",4,"Yoga, Power"],
["02170",2,"Yoga, Nadisodhana"],
["02175",2.3,"Yoga, General"],
["02180",3.5,"Yoga, Surya Namaskar"],
["02185",2.7,"Yoga, Vinyasa"],
["02200",5.3,"Native New Zealander PA, (e.g., Haka Powhiri, Poi, Moteatea, etc.), general moderate effort"],
["02205",6.8,"Native New Zealander PA, general, vigorous effort"],
["02210",7,"High intensity interval exercise,  moderate effort"],
["02214",11,"High intensity interval exercise,  burpees, mountain climbers, squat jumps, Tabata, vigorous effort"],
["02225",2.3,"Balance Exercise Assist Robot (BEAR), simulated skiing, tennis, rodeo"],
["02230",5.8,"Hooping (formerly known as hula® hooping)"],
["02240",9,"Impulse Training System, Inertial Exercise Trainer"],
["02280",7.9,"Virtual Reality Fitness,  Supernatural™ “Flow”, “Boxing” vigorous intensity"],
["02284",9.3,"ExerCube, workout series"],
["02288",13,"Blackbox Immersive virtual reality exergaming system, vigorous intensity"],
["02300",3,"Wand exercise, Life-Build-Line"],
["02310",6.5,"Zumba, group class"],
["02315",5.5,"Zumba, home video"],
["02340",2.8,"Sit to stand exercise, 6-12 times/min"],
["02344",4,"Sit to stand exercise, 18-24 times/min"],
["03005",6,"Afro-Cuban salsa (Cuban cha-cha-cha, mambo, Afro rumba, contratiempo son steps, orisha/santo movements)"],
["03010",5,"Ballet, modern, or jazz general, rehearsal or class"],
["03011",6.3,"Ballet exercises (plie, tendus, jetes, rond de Jambes, fondus, grand battement, grand adage, sautes, temp Leve’s)"],
["03012",6.8,"Ballet, modern, or jazz, performance, vigorous effort"],
["03014",4.8,"Tap"],
["03025",4.5,"Ethnic or cultural dancing (e.g. Greek, Middle Eastern, hula, salsa, merengue, bamba y plena,  flamenco, belly, and swing)"],
["03028",5.5,"Chinese square dance, Ballet & Tibetan dance"],
["03029",7.3,"Chinese square dance, aerobic dance"],
["03030",5.5,"Ballroom dancing, fast (Taylor Code 125)"],
["03031",9.8,"Nightclub or folk dancing, vigorous effort (e.g., nightclub, disco, folk, line dancing, Irish step dancing, polka, contra)"],
["03033",5,"Folk dancing, moderate effort"],
["03038",11.3,"Ballroom dancing, competitive, general"],
["03039",13,"Ballroom dance, DanceSport competition (modern waltz, tango, Viennese waltz, slow fox, quick step, samba, chacha, rumba, paso doble, jive)"],
["03040",3,"Ballroom, slow, examples: waltz, foxtrot, slow dancing, samba tango, rumba, 19th century dance, mambo, cha cha"],
["03042",6,"Ballroom Dance, Recreational (Waltz, Foxtrot, Cha-cha, Swing)"],
["03050",5.5,"Anishinaabe Jingle dancing, brisk pace, other traditional American Indian dancing performed by women, moderate effort"],
["03060",3.5,"Caribbean dance (Abakua, Beguine, Bellair, Bongo, Brukin’s, Caribbean Quadrills, Dinki  Mini, Gere, Gumbay, Ibo, Jonkonnu, Kumina,  Oreisha, Jambu)"],
["03070",3.8,"Contemporary dancing, general"],
["03072",4.3,"Contemporary dancing, nightclub"],
["03075",8.5,"Flamenco dance"],
["03078",4.5,"Jazz dancing, general"],
["03080",10.3,"Musical Theater, Singing/dancing"],
["03085",5.8,"Polynesian dance, Hawaiian hula slow, Maori haka, Tongan"],
["03086",7,"Polynesian dance, Hawaiian hula fast, Samoan sasa, Fijian style fast, Filipino Tinikling"],
["03087",8.8,"Polynesian dance, Samoan slap, Tahitian"],
["03090",4.8,"Salsa Dancing, with partner"],
["03091",6.3,"Salsa dancing, to a video"],
["03093",5.5,"Square Dancing, American Western, country"],
["04001",3.5,"Fishing, general"],
["04005",4.5,"Fishing, crab fishing"],
["04007",4,"Fishing, catching fish with hands"],
["04010",4.3,"Fishing related, digging worms, with shovel"],
["04020",4,"Fishing from river bank and walking"],
["04030",2,"Fishing from boat or canoe, sitting"],
["04040",3.5,"Fishing from river bank, standing (Taylor Code 660)"],
["04050",6,"Fishing in stream, in waders (Taylor Code 670)"],
["04060",2,"Fishing, ice, sitting"],
["04061",1.8,"Fishing, jig or line, standing, general"],
["04062",3.5,"Fishing, dip net, setting net and retrieving fish, general"],
["04063",3.8,"Fishing, set net, setting net and retrieving fish, general"],
["04064",3,"Fishing, fishing wheel, setting net and retrieving fish, general"],
["04065",2.3,"Fishing with a spear, standing"],
["04070",2.5,"Hunting, bow and arrow or crossbow"],
["04080",6,"Hunting, deer, elk, large game (Taylor Code 170)"],
["04081",9.8,"Hunting large game, dragging carcass"],
["04083",4,"Hunting large marine animals"],
["04085",2.5,"Hunting, large game from a hunting stand, limited walking"],
["04086",2,"Hunting large game from a car, plane, or boat"],
["04090",2.5,"Hunting, duck, wading"],
["04095",3,"Hunting flying fox, squirrel"],
["04100",5,"Hunting, general"],
["04110",6,"Hunting, pheasants or grouse (Taylor Code 680)"],
["04115",3.3,"Hunting birds"],
["04120",5,"Hunting, rabbit, squirrel, prairie chick, raccoon, small game (Taylor Code 690)"],
["04123",3.3,"Hunting pigs, wild"],
["04124",2,"Trapping game, general"],
["04125",9.5,"Hunting – hiking with hunting gear"],
["04130",2.5,"Pistol shooting or trap shooting, standing"],
["04140",2.3,"Rifle exercises, shooting, lying down"],
["04145",2.5,"Rifle exercises, shooting, kneeling or standing"],
["04150",2.8,"Foraging, 0-9.9kg backpack"],
["04152",3,"Foraging, 10-15kg backpack"],
["04160",1,"Sitting in boat, passenger"],
["04164",1.5,"Standing in boat"],
["04168",3.3,"Activities in a boat, lifting, lowering"],
["05010",3.3,"Cleaning, sweeping carpet or floors, general"],
["05011",2.3,"Cleaning, sweeping, slow, light effort"],
["05012",3.8,"Cleaning, sweeping, fast, moderate effort"],
["05020",3.5,"Cleaning  heavy or major (e.g., wash car, clean garage), moderate effort"],
["05021",3.5,"Cleaning, mopping, standing, moderate effort"],
["05022",3.3,"Cleaning windows, washing windows, general"],
["05023",2.5,"Mopping, standing, light effort"],
["05024",4.5,"Polishing floors, standing, walking slowly, using electric polishing machine"],
["05025",2.8,"Multiple household tasks all at once, light effort"],
["05026",3.3,"Multiple household tasks all at once, moderate effort"],
["05027",4.3,"Multiple household tasks all at once, vigorous effort"],
["05030",3.3,"Cleaning, house or cabin, general, moderate effort"],
["05032",2.5,"Dusting or polishing furniture, general"],
["05035",3.3,"Kitchen activity, general, (e.g., cooking, washing dishes, cleaning up) moderate effort"],
["05040",2.5,"Cleaning, general (straightening up, changing linen, carrying out trash), light effort"],
["05041",2,"Wash dishes, standing or in general (not broken into stand/walk components)"],
["05042",2,"Wash dishes, clearing dishes from table, walking, light effort"],
["05043",3,"Vacuuming, general, moderate effort"],
["05044",3,"Butchering animals, small"],
["05045",6,"Butchering animals, large, vigorous effort"],
["05046",2.3,"Cutting and smoking fish, drying fish or meat"],
["05048",4,"Tanning hides, general"],
["05049",3.5,"Cooking or food preparation, moderate effort"],
["05050",2,"Cooking or food preparation – standing or sitting or in general (not broken into stand/walk components), manual appliances, light effort"],
["05051",2.3,"Cooking or food preparation, walking"],
["05052",2.3,"Serving food, setting/cleaning table, implied walking or standing"],
["05053",2.5,"Feeding household animals"],
["05054",3.5,"carrying groceries, on level ground, walking"],
["05055",2.5,"Putting away groceries (e.g. carrying groceries, carrying packages)"],
["05056",5.3,"Carrying groceries upstairs"],
["05057",3,"Cooking Indian bread or other food on an outside stove"],
["05060",3.3,"Food shopping with or without a grocery cart; carrying a 10 lb bag; standing or walking"],
["05065",2.3,"Non-food shopping, with or without cart, standing or walking"],
["05070",1.8,"Ironing"],
["05080",1.3,"Knitting, sewing, light effort, wrapping presents, sitting"],
["05082",2.8,"Sewing with a machine"],
["05090",2.3,"Laundry, fold or hang clothes, put clothes in washer or dryer, packing suitcase, washing clothes by hand,  implied standing, light effort"],
["05091",2,"Laundry, fold or hang clothes, sitting"],
["05092",4,"Laundry,  moderate effort"],
["05095",2,"Laundry,  putting away clothes, gathering clothes to pack, putting away laundry, implied walking"],
["05100",3,"Making bed, changing linens"],
["05110",5,"Maple syruping/sugar bushing (including carrying buckets, carrying wood)"],
["05120",5.8,"Moving furniture, household items, carrying boxes"],
["05121",5,"Moving, lifting light loads"],
["05125",4.8,"Organizing a room"],
["05130",3.5,"Scrubbing floors, on hands and knees, scrubbing bathroom, bathtub, moderate effort"],
["05131",2,"Scrubbing floors, on hands and knees, scrubbing bathroom, bathtub, light effort"],
["05132",6.5,"Scrubbing floors, on hands and knees, scrubbing bathroom, bathtub, vigorous effort"],
["05140",3,"Sweeping garage, sidewalk, or outside house"],
["05146",3.8,"Standing, packing/unpacking boxes, occasional lifting lightweight household items, loading or unloading items into a car, moderate effort"],
["05147",3,"Implied walking, putting away household items, moderate effort"],
["05148",2,"Watering  plants"],
["05149",2.5,"Building a fire inside"],
["05150",9,"Moving household items upstairs, carrying boxes or furniture"],
["05160",2,"Standing, light effort tasks (pump gas, change light bulb, etc.)"],
["05165",3.5,"Walking, moderate effort tasks, non-cleaning (readying to leave, shut/lock doors, close windows, etc."],
["05170",2.3,"Sitting, playing with child(ren), light effort, only active periods"],
["05171",2.8,"Standing, playing with child(ren), light effort, only active periods"],
["05175",3.5,"Walking/running, playing with child(ren), moderate effort, only active periods"],
["05180",5.8,"Walking/running, playing with child(ren), vigorous effort, only active periods"],
["05181",3,"Walking and carrying small child, child weighing 15 lbs or more"],
["05182",2.5,"Walking and carrying small child, child weighing less than 15 lbs"],
["05183",2,"Standing, holding child"],
["05184",2.5,"Child care, infant, general"],
["05185",2,"Child care: sitting or kneeling, dressing, bathing, grooming, feeding, occasional lifting of child-light effort, general"],
["05186",3.5,"Child care: standing, dressing, bathing, grooming, feeding, occasional lifting of child- light effort"],
["05188",1.5,"Reclining with baby"],
["05189",2,"Breastfeeding, sitting or reclining"],
["05190",2.5,"Sit, playing with animals, light, only active period"],
["05191",2.8,"Stand, playing with animals, light effort, only active periods"],
["05192",2.8,"Walk or run, playing with animals, general, light effort, only active periods"],
["05193",4,"Walk/run, playing with animals, moderate effort, only active periods"],
["05194",5,"Walk/run, playing with animals, vigorous effort, only active periods"],
["05195",3.5,"Standing, bathing dog"],
["05197",2.3,"Animal care, household animals, general"],
["05200",3,"Elder care, disabled adult, bathing, dressing, moving into and out of bed, only active periods"],
["05205",1.8,"Elder care, disabled adult, feeding, combing hair, light effort, only active periods"],
["05300",1.3,"Handwashing"],
["06010",3,"Airplane repair"],
["06020",4,"Automobile body work"],
["06030",3.3,"Automobile repair, light or moderate effort"],
["06040",3,"Carpentry, general, workshop (Taylor Code 620)"],
["06050",6,"Carpentry, outside house, (Taylor Code 640)"],
["06052",3.8,"Carpentry, outside house, building a fence"],
["06060",3.3,"Carpentry, finishing, varnishing, or refinishing cabinets or furniture"],
["06070",6,"Carpentry, sawing hardwood, planing and drilling wood, moderate-to-vigorous effort"],
["06072",4,"Carpentry, home remodeling tasks, moderate effort"],
["06074",2.3,"Carpentry, home remodeling tasks, light effort"],
["06080",5,"Caulking, chinking log cabin"],
["06090",4.5,"Caulking, except log cabin"],
["06100",5,"Cleaning gutters"],
["06110",5,"Excavating garage"],
["06120",5,"Hanging storm windows"],
["06122",5,"Hanging sheet rock inside house"],
["06124",3,"Hammering nails"],
["06126",2.5,"Home repair, general, light effort"],
["06127",4.5,"Home repair, general, moderate effort"],
["06128",6,"Home repair, general, vigorous effort"],
["06130",4.5,"Laying or removing carpet"],
["06140",3.8,"Laying tile or linoleum"],
["06144",3,"Repairing appliances"],
["06150",5,"Painting, outside home (Taylor Code 650)"],
["06160",3.3,"Painting inside house, wallpapering, scraping paint"],
["06165",4.5,"Painting (Taylor Code 630)"],
["06167",3,"Plumbing, general"],
["06170",3,"Put on and removal of tarp – sailboat"],
["06180",6,"Roofing"],
["06190",4.5,"Sanding floors with a power sander"],
["06200",4.5,"Scraping and painting sailboat or powerboat"],
["06205",2,"Sharpening tools"],
["06210",5,"Spreading dirt with a shovel"],
["06220",4.5,"Washing and waxing hull of sailboat or airplane"],
["06225",2,"Washing and waxing car"],
["06230",4.5,"Washing fence, painting fence, moderate effort"],
["06240",3.3,"Wiring, tapping-splicing"],
["07009",1,"Lying quietly and watching television"],
["07011",1,"Lying quietly, doing nothing, lying in bed awake, listening to music (not talking or reading)"],
["07020",1,"Sit, watch television"],
["07021",1,"Sitting quietly, general"],
["07022",1.5,"Sitting quietly, fidgeting, general, fidgeting hands"],
["07023",1.8,"Sitting, fidget feet"],
["07024",1.3,"Sitting smoking"],
["07025",1.5,"Sitting, listening to music (not talking or reading) or watching a movie in a theater"],
["07026",1.3,"Sitting at a desk, resting head in hands"],
["07030",1,"Sleeping"],
["07040",1.3,"Standing quietly (standing in a line)"],
["07041",1.5,"Standing (fidgeting)"],
["07045",1.3,"Standing watching television"],
["07050",1.5,"Reclining, writing"],
["07060",1.3,"Reclining, talking or talking on phone"],
["07070",1.3,"Reclining, reading"],
["07075",1,"Meditating"],
["08009",4.1,"Carrying, loading or stacking wood, loading/unloading or carrying lumber, light-to- moderate effort"],
["08010",5.5,"Carrying, loading or stacking wood, loading/unloading or carrying lumber, moderate effort"],
["08019",4.5,"Chopping wood, splitting logs, moderate effort"],
["08020",6.5,"Chopping wood, splitting logs, vigorous effort"],
["08025",3.5,"Clearing light brush, thinning garden, moderate effort"],
["08030",6.3,"Clearing land, haul brush, undergrowth, or ground, vigorous effort"],
["08040",5,"Digging sandbox, shoveling sand"],
["08045",3.5,"Digging, spading, filling garden, composting, light-to-moderate effort"],
["08050",5,"Digging, spading, filling garden, composting (Taylor Code 590)"],
["08052",7.3,"Digging, spading, filling garden, composting, vigorous effort"],
["08055",2.8,"Driving tractor"],
["08057",8.3,"Felling trees, large size"],
["08058",5.3,"Felling trees, small-medium size"],
["08060",5.8,"Gardening with heavy power tools, using chain saw, tilling a garden"],
["08066",2,"gardening, general"],
["08070",4,"Irrigation channels, opening and closing ports"],
["08080",6.3,"Laying crushed rock or gravel"],
["08090",5,"Laying sod"],
["08095",5.5,"Mowing lawn, general, walking, moderate effort"],
["08100",2.5,"Mowing lawn, riding mower (Taylor Code 550)"],
["08110",6,"Mowing lawn, hand mower, vigorous effort (Taylor Code 570)"],
["08120",5,"Mowing lawn, walk, power mower,  moderate or vigorous effort"],
["08125",4.5,"Mowing lawn, power mower, light or moderate effort (Taylor Code 590)"],
["08130",2.5,"Operating snow blower, walking"],
["08135",2.6,"Planting, potting, transplanting seedlings or plants, light effort"],
["08140",4.3,"Planting seedlings, shrubs, stooping, moderate effort"],
["08145",4.3,"Planting crops or garden, stooping, moderate effort"],
["08150",4.5,"Planting trees"],
["08160",4,"Raking lawn or leaves, moderate effort"],
["08165",4,"Raking lawn (Taylor Code 600)"],
["08170",4,"Raking roof with snow rake"],
["08180",3,"Riding snow blower"],
["08190",4,"Sacking grass, leaves"],
["08192",5.5,"Shoveling dirt or mud"],
["08195",5.3,"Shoveling snow, by hand, moderate effort"],
["08200",6,"Shoveling snow, by hand (Taylor Code 610)"],
["08202",7.5,"Shoveling snow, by hand, vigorous effort"],
["08210",3.8,"Trimming shrubs or trees, manual cutter"],
["08215",3.3,"Trimming shrubs or trees, power cutter, using leaf blower, edger, moderate effort"],
["08220",3,"Walking, applying fertilizer or seeding a lawn, push applicator"],
["08230",4,"Watering lawn or garden, standing or walking"],
["08239",3.8,"Weeding, cultivating garden, light-to-moderate effort"],
["08240",4.5,"Weeding, cultivating garden, moderate effort (Taylor Code 580)"],
["08241",5,"Weeding, cultivating garden, using hoe moderate-to-vigorous effort"],
["08245",3.8,"Gardening, general, moderate effort"],
["08246",3.5,"Picking fruit or coffee from trees, moderate effort"],
["08248",4.5,"Harvesting Produce, Picking fruit off trees, gleaning fruits, picking fruits/vegetables, climbing ladder to pick fruit, vigorous effort"],
["08250",3,"Implied walking/standing – picking up yard, light, picking flowers or vegetables"],
["08251",3,"Walking, gathering gardening tools"],
["08255",4.8,"Wheel barrow, pushing garden cart or wheelbarrow, general"],
["08256",6,"Wheel barrow, pushing large garden cart or heavy wheelbarrow up to 150kg"],
["08260",2.3,"Yardwork, general, light effort"],
["08261",4,"Yardwork, general, moderate effort"],
["08262",6,"Yardwork, general, vigorous effort"],
["09000",1.3,"Board game playing, sitting"],
["09005",2.5,"Casino gambling, standing"],
["09010",1.5,"Card playing, sitting"],
["09013",1.5,"Chess game, sitting"],
["09015",1.5,"Copying or filing documents, standing"],
["09020",1.8,"Drawing, writing, painting, standing"],
["09025",1,"Laughter, sitting"],
["09030",1,"Sitting: reading, book, newspaper, magazine"],
["09034",1.8,"sitting, typing or reading on a balance chair/stability ball"],
["09036",2,"watching tv, stepping during commercial breaks"],
["09040",1.3,"Sitting: writing, desk work, typing"],
["09050",1.3,"Standing:  talking in person, on the phone, computer, text messaging, writing"],
["09055",1.3,"Sitting: talking in person, on the phone, computer, or  text messaging, light effort"],
["09060",1.5,"Sitting – studying, general, including reading and/or writing, light effort"],
["09065",1.8,"Sitting – in class, general, including note-taking or class discussion"],
["09070",1,"Standing – reading"],
["09071",2.5,"Standing: miscellaneous"],
["09075",1.8,"Sitting: arts and crafts, carving wood, weaving, spinning wool, light effort"],
["09080",3,"Sitting: arts and crafts, carving wood, weaving, spinning wool, moderate effort"],
["09085",2.5,"Standing: arts and crafts, sand painting, carving, weaving, light effort"],
["09090",3.3,"Standing – arts and crafts, sand painting, carving, weaving, moderate effort"],
["09095",3.5,"Standing – arts and crafts, sand painting, carving, weaving, vigorous effort"],
["09100",1.5,"Retreat/family reunion activities involving sitting, relaxing, talking, eating"],
["09101",2.5,"Retreat/family reunion activities involving playing games with children"],
["09105",2,"Touring/traveling/vacation involving  riding in vehicle"],
["09106",3.5,"Touring/traveling/vacation involving walking"],
["09110",2.5,"Camping involving standing, walking, sitting, light-to-moderate effort"],
["09115",1.5,"Sitting at a sporting event, spectator"],
["10010",1.8,"Accordion, sitting"],
["10020",2.3,"Cello, sitting"],
["10030",2.3,"Conducting orchestra, standing"],
["10035",2.5,"Double bass, standing"],
["10040",3.8,"Drums, sitting"],
["10045",3,"Drumming (e.g., bongo, conga, benbe), moderate, sitting"],
["10048",8.3,"Drumming, concert/live show"],
["10050",2,"Flute, sitting"],
["10060",1.8,"Horn, standing"],
["10070",2.3,"Piano, sitting"],
["10074",2,"Playing musical instruments, general"],
["10077",2,"Organ, sitting"],
["10080",3.5,"Trombone, standing"],
["10090",2.5,"Trumpet, standing"],
["10100",2.5,"Violin, sitting"],
["10110",1.8,"Woodwind instruments, sitting"],
["10115",1.8,"Brass instruments, sitting"],
["10120",2,"Guitar, classical, folk, sitting"],
["10125",3,"Guitar, rock and roll band, standing"],
["10130",4,"Marching band, baton twirling, walking, moderate pace, general"],
["10131",5.5,"Marching band, playing an instrument, walking, brisk pace, general"],
["10135",3.5,"Marching band, drum major, walking"],
["11000",2,"Active workstation, Pedal desk, balance chair/ball, General, light effort"],
["11001",3.5,"Active workstation, Pedal desk (40 watts)"],
["11002",5.3,"Active workstation, Pedal desk (80 watts)"],
["11003",2,"Active workstation, treadmill desk, walking slowly 1.0 mph or less"],
["11004",2.8,"Active workstation, treadmill desk, walking 1.0 – 2.0 mph"],
["11006",3,"Airline flight attendant"],
["11008",4.8,"Apple Harvesting"],
["11010",4,"Bakery, general, moderate effort"],
["11015",2,"Bakery, light effort"],
["11020",2.3,"Bookbinding"],
["11030",6,"Building road, driving heavy machinery"],
["11035",2,"Building road, directing traffic, standing"],
["11038",2.5,"Carpentry, general, light effort"],
["11040",4.3,"Carpentry, general, moderate effort"],
["11042",7,"Carpentry, general, heavy or vigorous effort"],
["11050",8,"Carrying heavy loads (e.g., bricks, tools)"],
["11060",8,"Carrying moderate loads up stairs, moving  boxes, 25-49 lbs"],
["11070",4,"Chambermaid, hotel housekeeper, making bed, cleaning bathroom, pushing cart"],
["11072",4.3,"Cleaning, vacuuming a commercial space"],
["11080",5.3,"Coal mining, drilling coal, rock"],
["11090",5,"Coal mining, erecting supports"],
["11100",5.5,"Coal mining, general"],
["11110",6.3,"Coal mining, shoveling coal, by hand"],
["11115",2.5,"Cook, chef"],
["11120",4,"Construction, outside, remodeling, new structures (e.g., roof repair, miscellaneous)"],
["11124",2.3,"Construction, rebar, bar bending/fixing"],
["11125",2.3,"Custodial work, light effort (e.g., cleaning sink and toilet, dusting, vacuuming, light cleaning)"],
["11126",3.8,"Custodial work, moderate effort (e.g., buffing floors with electric buffer, feathering or sweeping arena floors, mopping, taking out the trash, vacuuming)"],
["11130",3.3,"Electrical work (e.g., hook up wire, tapping, splicing); plumbing moved to 11516"],
["11135",1.8,"Engineer (e.g., mechanical or electrical)"],
["11145",7.8,"Farming, vigorous effort (e.g., baling hay, cleaning barn), includes former code 11200"],
["11146",4.8,"Farming, moderate effort (e.g., feeding animals, chasing cattle by walking and/or horseback, spreading manure, harvesting crops)"],
["11147",2,"Farming, light effort, (e.g., cleaning animal sheds, preparing animal feed)"],
["11170",2.8,"Farming, driving tasks (e.g., driving tractor or harvester)"],
["11180",3.5,"Farming, feeding small animals"],
["11190",4.3,"Farming, feeding cattle, horses"],
["11191",4.3,"Farming, hauling water for animals, fetching water from a well or stream"],
["11192",4.5,"Farming, taking care of animals (e.g.,  grooming, brushing, shearing sheep, assisting with birthing, medical care, branding), general"],
["11195",3.8,"Farming, rice, planting, grain milling activities"],
["11210",3.5,"Farming, milking by hand, cleaning pails, moderate effort"],
["11220",1.3,"Farming, milking by machine, light effort"],
["11222",3,"Farming, milking Cows, full milking process, modern milking parlor with milking machines"],
["11240",8,"Fire fighter, general"],
["11244",6.8,"Firefighter, rescue victim, automobile  accident, using pike pole"],
["11245",8,"Firefighter, raising and climbing ladder with full gear, simulated fire suppression"],
["11246",9,"Firefighter, hauling hoses on ground, carrying/hoisting equipment, breaking down  walls etc., wearing full gear"],
["11247",3.5,"Fishing, commercial, light effort"],
["11248",5,"Fishing, commercial, moderate effort"],
["11250",17.5,"Forestry, ax chopping, very fast, 1.25 kg axe, 51 blows/min, extremely vigorous effort"],
["11260",5,"Forestry, ax chopping, slow, 1.25 kg axe, 19 blows/min, moderate effort"],
["11262",8,"Forestry, ax chopping, fast, 1.25 kg axe, 35 blows/min, vigorous effort"],
["11264",5,"Forestry, moderate effort (e.g., sawing wood with power saw, weeding, hoeing)"],
["11266",8.5,"Forestry, vigorous effort (e.g., barking, felling, or trimming trees, carrying or stacking logs, planting seeds, sawing lumber by hand )"],
["11370",4.8,"Furriery"],
["11375",3.8,"Garbage collector, walking, dumping bins into truck, street cleaning"],
["11378",1.8,"Hairstylist (e.g., plaiting hair, manicure, make-up artist)"],
["11380",7.3,"Horse grooming, including feeding, cleaning stalls, bathing, brushing, clipping, longeing and exercising horses."],
["11381",4.3,"Horse, feeding, watering, cleaning stalls, implied walking and lifting loads"],
["11383",4.5,"Horseback riding, working, cutting cows"],
["11390",7.8,"Horse racing, Jockey, canter"],
["11400",6.3,"Horse racing, Jockey, trotting"],
["11410",2.3,"Horse racing, Jockey, walking"],
["11413",3,"Kitchen maid"],
["11415",4,"Lawn keeper, yardwork, general"],
["11416",3,"Lawn keeper, weeding, gas powered"],
["11418",3.3,"Laundry worker"],
["11420",3,"Locksmith"],
["11430",3,"Machine tooling (e.g., machining, working  sheet metal, machine fitter, operating lathe,  welding) light-to-moderate effort"],
["11450",5,"Machine tooling, operating punch press, moderate effort"],
["11472",1.8,"Manager, property"],
["11475",2.8,"Manual or unskilled labor, general, light effort"],
["11476",4.5,"Manual or unskilled labor, general, moderate effort"],
["11477",6.5,"Manual or unskilled labor, general, vigorous effort"],
["11480",4.3,"Masonry, concrete, moderate effort"],
["11482",2.5,"Masonry, concrete, light effort"],
["11485",5.5,"Massage therapist, standing"],
["11486",2.3,"Mail carrier, walking to deliver mail"],
["11487",1.5,"Mail delivery, motorbike"],
["11488",3.5,"Mail delivery, Electronically Assisted Bicycle"],
["11490",7.5,"Moving, carrying, or pushing heavy objects, 75 lbs or more, only active time (e.g., desks, moving van work)"],
["11493",8.5,"Mining, general services, drilling, mining support jobs (mechanical, welding, pipe installation, general construction)"],
["11495",12,"Skindiving or SCUBA diving as a frogman, Navy Seal"],
["11500",2.5,"Operating heavy-duty equipment, automated, not driving"],
["11510",3.5,"Orange grove work, picking fruit"],
["11514",3.3,"Painting, house, furniture, moderate effort"],
["11516",3,"Plumbing activities"],
["11520",2,"Printing, paper industry worker, standing"],
["11524",3.8,"Police Officer, Walking"],
["11525",2.5,"Police, directing traffic, standing"],
["11526",2,"Police, driving a squad car, sitting"],
["11527",1.3,"Police, riding in a squad car, sitting"],
["11528",4,"Police, making an arrest, standing"],
["11529",9,"Counter terrorism maneuvers, clearing building"],
["11530",2,"Shoe repair, general"],
["11540",7.3,"Shoveling, digging ditches"],
["11550",8.8,"Shoveling, more than 16 lbs/minute, deep digging, vigorous effort"],
["11560",5,"Shoveling, less than 10 lbs/minute, moderate effort"],
["11570",6.5,"Shoveling, 10 to 15 lbs/minute, vigorous effort"],
["11580",1.5,"Sitting tasks, light effort (e.g., office work, chemistry lab work, light assembly repair, watch repair, reading, desk  work)"],
["11582",1.3,"Sitting, computer work"],
["11583",1.3,"Standing workstation, typing, computer work"],
["11585",1.3,"Sitting meetings, light effort, general, and/or with talking involved (e.g., eating at a business meeting)"],
["11590",2.5,"Sitting tasks, moderate effort (e.g. pushing heavy levers, riding mower/forklift, crane  operation)"],
["11593",2.8,"Sitting, teaching stretching or yoga, or light effort exercise classes"],
["11600",1.8,"Standing tasks, light effort (e.g., bartending, store clerk, assembling, filing, duplicating,  librarian, putting up a Christmas tree, standing and talking at work, changing clothes when teaching physical education)"],
["11610",3.3,"Standing, light/moderate effort (e.g., assemble/repair heavy parts, welding, stocking  parts, auto repair, packing boxes, nursing patient care, laundry)"],
["11615",4.5,"Standing, moderate effort, lifting items continuously, 10 – 20 lbs, with limited walking  or resting"],
["11620",3.8,"Standing, moderate effort, intermittent lifting 50 lbs, hitch or twisting ropes"],
["11630",4.5,"Standing, moderate/heavy tasks (e.g., lifting more than 50 lbs, masonry, painting, paper  hanging)"],
["11650",2.3,"Patient care, healthcare activites"],
["11660",3.5,"Patient care, room cleaning/preperation"],
["11708",5.3,"Steel mill, moderate effort (e.g., fettling, forging, tipping molds)"],
["11710",8.3,"Steel mill, vigorous effort (e.g., hand rolling, merchant mill rolling, removing slag, tending furnace)"],
["11720",2.3,"Tailoring, cutting fabric"],
["11730",2.5,"Tailoring, general"],
["11740",1.8,"Tailoring, hand sewing"],
["11750",2.5,"Tailoring, machine sewing"],
["11760",3.5,"Tailoring, pressing"],
["11763",2,"Tailoring, weaving, light effort (e.g., finishing operations, washing, dyeing, inspecting cloth, counting yards, paperwork)"],
["11765",4,"Tailoring, weaving, moderate effort (e.g., spinning and weaving operations, delivering boxes of yarn to spinners, loading of warp beam, pinwinding, conewinding, warping, cloth clutting)"],
["11766",6.5,"Truck driving, loading and unloading truck, tying down load, standing, walking and carrying heavy loads"],
["11767",2,"Truck driving, delivery truck, taxi, shuttlebus, school bus"],
["11770",1.3,"Typing, electric, manual or computer"],
["11780",6.3,"Using heavy power tools such as pneumatic tools (e.g., jackhammers, drills, etc.)"],
["11790",7.8,"Using heavy tools (not power) such as shovel, pick, tunnel bar, spade"],
["11791",2,"Walking on job, less than 2.0 mph, very slow speed, in office or lab area"],
["11792",3.8,"Walking on job, 2.8 to 3.4 mph, in office, moderate speed, not carrying anything"],
["11793",4.8,"Walking on job, 3.5 to 3.9 mph, in office, brisk speed, not carrying anything"],
["11795",3.5,"Walking on job, 2.5 mph, slow speed, carrying light objects less than 25 lbs"],
["11796",3,"Walking, gathering things at work, ready to leave"],
["11797",3.8,"Walking, 2.5 mph, slow speed, carrying heavy objects more than 25 lbs"],
["11800",4.5,"Walking, 3.0 mph, moderately and carrying light objects less than 25 lbs"],
["11805",3.8,"Walking, pushing a wheelchair"],
["11810",4.5,"Walking, 3.5 mph, briskly and carrying objects less than 25 lbs"],
["11820",4,"Walking or walk downstairs or standing, carrying objects about 25 to 49 lbs"],
["11830",5.5,"Walking or walk downstairs or standing, carrying objects about 50 to 74 lbs"],
["11840",7,"Walking or walk downstairs or standing, carrying objects about 75 to 99 lbs"],
["11850",7.3,"Walking or walk downstairs or standing, carrying objects about 100 lbs or more"],
["11860",2.3,"Warehouse/Shipping Center, Loading/Unloading boxes"],
["11862",4.3,"Warehouse/Shipping Center, Moving boxes (~5kg)"],
["11870",3,"Working in scene shop, theater actor, backstage employee"],
["11880",3.5,"Soldiers, military marching, unloaded, 1.5 to 2.5 mph"],
["11882",4,"Soldiers, military marching, 1.5 to 2.5 mph, 10 to 30 kg load"],
["11884",5,"Airborne Shuffle, 2.5 to 3.5 mph, 20-30 kg load"],
["11886",6.3,"Soldiers, military loaded marching, varying terrain, 25-40 kg load"],
["11887",6,"Soldiers, walking, 2.8 mph, 5% grade, up to 21.5 kg load"],
["11888",8.5,"Soldiers, walking, 2.8 mph, 10% grade, up to 21.5 kg load"],
["11889",11,"Soldiers, walking, 2.8 mph, 15% grade, up to 21.5 kg load"],
["11892",6,"Military activities, arterial field preparation, digging defensive positions"],
["12010",6,"Jog/walk combination (jogging component of less than 10 minutes) (Taylor Code 180)"],
["12020",7.5,"Jogging, general, self-selected pace"],
["12025",4.8,"Jogging, in place"],
["12026",3.3,"Jogging 2.6 to 3.7 mph"],
["12027",4.5,"Jogging on a mini-tramp"],
["12028",6.5,"Running, 4 to 4.2 mph (13 min/mile)"],
["12029",7.8,"Running 4.3 to 4.8 mph"],
["12030",8.5,"Running, 5.0 to 5.2 mph (12 min/mile)"],
["12045",9,"Running, 5.5 -5.8 mph"],
["12050",9.3,"Running, 6-6.3 mph (10 min/mile)"],
["12060",10.5,"Running, 6.7 mph (9 min/mile)"],
["12070",11,"Running, 7 mph (8.5 min/mile)"],
["12080",11.8,"Running, 7.5 mph (8 min/mile)"],
["12090",12,"Running, 8 mph (7.5 min/mile)"],
["12100",12.5,"Running, 8.6 mph (7 min/mile)"],
["12110",13,"Running, 9 mph (6.5 min/mile)"],
["12115",14.8,"Running, 9.3 to 9.6 mph"],
["12120",14.8,"Running, 10 mph (6 min/mile)"],
["12130",16.8,"Running, 11 mph (5.5 min/mile)"],
["12132",18.5,"Running, 12 mph (5.0 min/mile)"],
["12134",19.8,"Running, 13 mph (4.6 min/mile)"],
["12135",23,"Running, 14 mph (4.3 min/mile)"],
["12140",9.3,"Running, cross country"],
["12145",10.5,"Running, self-selected pace"],
["12150",8,"Running (Taylor Code 200)"],
["12170",15,"Running, stairs, up"],
["12180",10,"Running, on a track, team practice"],
["12184",18,"Running, on track, 500-1500m, competitive"],
["12186",19.3,"Running, on track, 2000-3000m, competitive"],
["12190",8,"Running, training, pushing a wheelchair or baby carrier"],
["12200",13.3,"Running, marathon"],
["12255",10.3,"Running uphill, 4.5mph, 5% incline"],
["12260",13.3,"Running uphill, 6.0 mph, 5% incline"],
["12265",15.5,"Running uphill, 7.0 mph, 5% incline"],
["12325",17.5,"Running uphill, 5.0 to 5.9 mph, 15% incline"],
["12335",8.8,"Running uphill, 0.6 to 0.79 mph, 30% incline"],
["12337",10.3,"Running uphill, 0.8 to 0.99 mph, 30% incline"],
["12339",11.8,"Running uphill, 1.0 to 1.19 mph, 30% incline"],
["12341",13.5,"Running uphill, 1.2 to 1.39 mph, 30-40% incline"],
["12343",14.8,"Running uphill, 1.4 to 1.59 mph, 30% incline"],
["12345",16.3,"Running uphill, >1.6mph, 10-30% incline"],
["12350",16,"Running, hilly terrain, ±100m change in elevation"],
["12352",5.8,"Running downhill, 5.0 to 5.9 mph, -10% to -15%"],
["12353",7.5,"Running downhill, 6.0 to 6.9 mph, -10% to -15%"],
["12355",9,"Running downhill, 7.0 to 8.9 mph, -10% to -15%"],
["12358",9.3,"Running downhill, 6.0 to 7.9 mph, -3% to -9%"],
["12361",13.8,"Running downhill, 8.0 to 10.5 mph, -3% to -9%"],
["12405",5.3,"Running/jogging, curved treadmill, 3.0 to 3.9 mph"],
["12408",6.5,"Running/jogging, curved treadmill, 4.0 to 4.9 mph"],
["12410",11,"Running curved treadmill, 5.0 to 5.9 mph"],
["12412",12,"Running curved treadmill, 7.0 to 7.9 mph"],
["12414",14,"Running curved treadmill, 8.0 to 8.9 mph"],
["12416",16.8,"Running curved treadmill, 9.0 to 9.9 mph"],
["12508",8.5,"Running, 5.0 – 5.9 mph, 1.0 to 3.0 kg backpack"],
["12510",9.5,"Running, 6.0 – 6.9 mph, 1.0 to 3.0 kg backpack"],
["12512",9.8,"Running, 7.0 – 7.9 mph, 1.0 to 3.0 kg backpack"],
["12514",12,"Running, 8.0 – 8.9 mph, 1.0 to 3.0 kg backpack"],
["12555",7.8,"Running, barefoot, 3.5-5.9 mph"],
["12560",12,"Running, barefoot, 6.0-7.9 mph"],
["12565",13.5,"Running, barefoot, 8.0-8.9 mph"],
["12585",8,"Running, jogging stroller, indoors, 5 mph"],
["12588",9,"Running, jogging stroller, indoors, 6 mph"],
["12593",10,"Running, jogging stroller, outdoors, 5 mph"],
["12595",11.5,"Running, jogging stroller, outdoors, 6 mph"],
["12600",11.5,"Skipping, 5.5-6.0 mph"],
["12620",13,"Triathlon, Running"],
["13000",2.3,"Getting ready for bed, general, standing"],
["13009",2.3,"Sitting on toilet, eliminating while standing or  squatting"],
["13010",1.5,"Bathing, sitting"],
["13020",2.8,"Dressing, undressing, standing or sitting"],
["13030",1.5,"Eating, sitting"],
["13035",2,"Talking and eating or eating only, standing"],
["13036",1.5,"Taking medication, sitting or standing"],
["13040",2,"Grooming, washing hands, shaving, brushing  teeth, putting on make-up, sitting or standing"],
["13045",2.5,"Hairstyling, standing"],
["13046",1.3,"Having hair or nails done by someone else,  sitting"],
["13050",2,"Showering, toweling off, standing"],
["14010",5.8,"Active, vigorous effort"],
["14020",3,"General, moderate effort"],
["14030",1.8,"Passive, light effort, kissing, hugging"],
["15000",5.5,"Alaska Native Games, Eskimo Olympics, general"],
["15010",4.3,"Archery (non-hunting)"],
["15020",7,"Badminton, competitive (Taylor Code 450)"],
["15025",9,"Badminton, competitive, match play"],
["15030",5.5,"Badminton, social singles and doubles, general"],
["15040",8,"Basketball, game (Taylor Code 490)"],
["15050",6,"Basketball, non-game, general (Taylor Code 480)"],
["15055",7.5,"Basketball, general"],
["15060",7,"Basketball, officiating (Taylor Code 500)"],
["15062",5.8,"Basketball, officiating"],
["15070",5,"Basketball, shooting baskets"],
["15072",9.3,"Basketball, drills, practice"],
["15080",2.5,"Billiards"],
["15090",3,"Bowling (Taylor Code 390)"],
["15092",3.8,"Bowling, indoor, bowling alley"],
["15100",12.3,"Boxing, in ring, general"],
["15110",5.8,"Boxing, punching bag"],
["15113",7,"Boxing, punching bag, 60 b/min"],
["15115",8.5,"Boxing, punching bag, 120 b/min"],
["15118",10.8,"Boxing, punching bag, 180 b/min"],
["15120",7.8,"Boxing, sparring"],
["15125",9.3,"Boxing, simulated boxing round, exercise"],
["15130",7,"Broomball"],
["15135",5.8,"Children’s games, adults playing (e.g., hopscotch, 4-square, dodge ball, playground apparatus, t-ball,  tetherball, marbles, jacks, arcade games), moderate effort"],
["15138",6,"Cheerleading, gymnastic moves, competitive"],
["15140",4,"Coaching, football, soccer, basketball, baseball, swimming, etc."],
["15142",8,"Coaching, actively playing sport with players"],
["15150",4.8,"Cricket, batting, bowling, fielding"],
["15160",3.3,"Croquet"],
["15170",4,"Curling"],
["15180",2.5,"Darts, wall or lawn"],
["15190",6,"Drag racing, pushing or driving a car"],
["15192",8.5,"Auto racing, open wheel"],
["15195",7.8,"Futsal"],
["15200",6,"Fencing, general"],
["15203",9.8,"Fencing, epee, competitive"],
["15205",10.5,"Floorball"],
["15210",8,"Football, competitive"],
["15230",8,"Football, touch, flag, general (Taylor Code 510)"],
["15232",4,"Football, touch, flag, light effort"],
["15235",2.5,"Football or baseball, playing catch"],
["15240",3,"Frisbee playing, general"],
["15250",8,"Frisbee, ultimate"],
["15252",3.8,"Frisbee golf"],
["15255",4.5,"Golf, general"],
["15265",4.3,"Golf, walking, carrying clubs"],
["15270",3.5,"Golf, miniature, driving range"],
["15285",4.5,"Golf, walking, pulling clubs"],
["15290",3.5,"Golf, using power cart (Taylor Code 070)"],
["15300",3.8,"Gymnastics, general"],
["15310",4,"Hacky sack"],
["15320",12,"Handball, general (Taylor Code 520)"],
["15330",8,"Handball, team"],
["15335",4,"High ropes course, multiple elements"],
["15340",3.5,"Hang gliding"],
["15350",7.8,"Hockey, field"],
["15360",8,"Hockey, ice, general"],
["15362",10,"Hockey, ice, competitive"],
["15370",5.5,"Horseback riding, general"],
["15380",4.5,"Horse grooming, maintenance, saddling tasks"],
["15390",5.8,"Horseback riding, trotting"],
["15395",7.3,"Horseback riding, canter or gallop"],
["15400",3.8,"Horseback riding, walking"],
["15402",9,"Horseback riding, jumping"],
["15403",6,"Horseback riding, reining"],
["15406",2.1,"Horseback riding, simulator"],
["15408",1.8,"Horse cart, driving, standing or sitting"],
["15410",3,"Horseshoe pitching, quoits"],
["15420",12,"Jai alai"],
["15425",5.3,"Martial Arts, different types, slower pace, novice performers, practice"],
["15430",10.3,"Martial Arts, different types, moderate pace (e.g., judo, jujitsu, karate, kick boxing, tae kwon do, tai-bo, Muay Thai boxing)"],
["15432",14.3,"Taekwondo, combat simulation"],
["15433",11.3,"Judo"],
["15440",4,"Juggling"],
["15444",6.5,"Kendo, kihon-keiko style, moderate intensity"],
["15445",9.6,"Kendo, kirikaeshi style, high intensity"],
["15446",11.3,"Kendo, kakari keiko style, very high intensity"],
["15450",7,"Kickball"],
["15455",5.5,"Kung Fu Gymnastics"],
["15457",7.3,"Kickboxing"],
["15460",8,"Lacrosse"],
["15465",3.3,"Lawn bowling, bocce ball, outdoor"],
["15470",4,"Motocross, off-road motor sports, all-terrain vehicle, general"],
["15475",5.3,"Motorcycle racing, Supormoto racing"],
["15477",7,"Netball"],
["15480",9,"Orienteering"],
["15490",10,"Paddleball, competitive"],
["15500",6,"Paddleball, casual, general (Taylor Code 460)"],
["15503",1.8,"Paragliding, moderate altitude"],
["15506",6.5,"Prusik climbing"],
["15510",8,"Polo, on horseback"],
["15520",10,"Racquetball, competitive"],
["15525",10.3,"Race Walking, 3.1 m/s (6.9 mph)"],
["15527",13.8,"Race Walking, 3.7 m/s (8.3 mph)"],
["15528",15.5,"Race Walking, racing speed, 4.0 m/s (8.95 mph)"],
["15530",7,"Racquetball, general (Taylor Code 470)"],
["15533",8,"Rock or mountain climbing (Taylor Code 060), (formerly code 17120)"],
["15534",8.8,"Rock climbing, free boulder"],
["15535",7.3,"Rock climbing, ascending rock, high difficulty"],
["15536",10.5,"Rock climbing, speed climbing, very difficult"],
["15537",5.8,"Rock climbing, ascending or traversing rock, low-to-moderate difficulty"],
["15538",10.5,"Rock climbing, treadwall, 4-6 m/min"],
["15539",10.5,"Rock climbing, treadwall, 7-10 m/min"],
["15540",5,"Rock climbing, rappelling,"],
["15542",4,"Rodeo sports, general, light effort"],
["15544",5.5,"Rodeo sports, general, moderate effort"],
["15546",7,"Rodeo sports, general, vigorous effort"],
["15550",12.3,"Rope jumping, fast pace, 120-160 skips/min"],
["15551",11.8,"Rope jumping, moderate pace, general, 100 to 120 skips/min, 2 foot skip, plain bounce"],
["15552",8.3,"Rope jumping, slow pace, < 100 skips/min, 2 foot skip, rhythm bounce"],
["15554",10,"Rope jumping, double under or more"],
["15560",8.3,"Rugby, union, team, competitive"],
["15562",6.3,"Rugby, touch, non-competitive"],
["15570",3,"Shuffleboard"],
["15580",5,"Skateboarding, general, moderate effort"],
["15582",6,"Skateboarding, competitive, vigorous effort"],
["15590",7,"Skating, roller (Taylor Code 360)"],
["15591",7.5,"Roller blading, in-line skating, 14.4 km/h (9.0 mph), recreational pace"],
["15592",9.8,"Roller blading, in-line skating, 17.7 km/h (11.0 mph), moderate pace, exercise training"],
["15593",12.3,"Roller blading, in-line skating, 21.0 to 21.7 km/h (13.0 to 13.6 mph), fast pace, exercise training"],
["15594",15.5,"Rollerblading, in-line skating, 24.0 km/h (15.0 mph), maximal effort"],
["15595",6.8,"Skateboard, longboard, 13.3 km/h, slow speed"],
["15596",8.3,"Skateboard, longboard, 16.2 km/h, typical speed"],
["15597",10.5,"Skateboard, longboard, 18.4 km/h, fast speed"],
["15600",3.5,"Skydiving, base-jumping, bungee jumping"],
["15605",9.5,"Soccer, competitive"],
["15610",7,"Soccer, casual, general (Taylor Code 540)"],
["15615",3.5,"Walking football/soccer"],
["15620",5,"Softball or baseball, fast or slow pitch, general, moderate effort (Taylor Code 440)"],
["15625",4,"Softball, practice"],
["15630",4,"Softball, officiating"],
["15640",6,"Softball, pitching"],
["15645",3.3,"Sports spectator, very excited, emotional, physically moving"],
["15650",12,"Squash (Taylor Code 530)"],
["15652",7.3,"Squash, general"],
["15660",4,"Table tennis, ping pong (Taylor Code 410)"],
["15670",3.3,"Tai chi, qi gong, general"],
["15672",1.5,"Tai chi, qi gong, sitting, light effort"],
["15674",6,"Tai chi chuan, Yang style"],
["15675",6.8,"Tennis, general, moderate effort"],
["15676",8,"Tennis, general, competitive"],
["15680",6,"Tennis, doubles (Taylor Code 430)"],
["15685",4.5,"Tennis, doubles"],
["15690",8,"Tennis, singles (Taylor Code 420)"],
["15695",5,"Tennis, hitting balls, non-game play, moderate effort"],
["15700",6.3,"Trampoline, recreational"],
["15702",10.3,"Trampoline, competitive"],
["15710",4,"Volleyball (Taylor Code 400)"],
["15711",6,"Volleyball, competitive, in gymnasium"],
["15720",3,"Volleyball, non-competitive, 6 – 9 member team, general"],
["15725",8,"Volleyball, beach, in sand"],
["15730",6,"Wrestling, competitive (one match = 5 minutes)"],
["15731",7,"Wallyball, general"],
["15732",4,"Track and field (e.g., shot, discus, hammer throw)"],
["15733",6,"Track and field (e.g., high jump, long jump, triple jump, javelin, pole vault)"],
["15734",10,"Track and field (e.g., steeplechase, hurdles)"],
["16002",6.8,"Bicycling for transportation, moderate effort"],
["16004",9.3,"Bicycling for transportation, high effort"],
["16005",6.8,"E-bike (electrically assisted) for transportation"],
["16010",2,"Automobile or light truck (not a semi) driving"],
["16015",1.3,"Riding in a car or truck"],
["16016",1.3,"Riding in a bus or train"],
["16020",1.8,"Flying airplane or helicoptor"],
["16030",2.8,"Motor scooter, motorcycle"],
["16035",6.3,"Pulling rickshaw"],
["16040",6,"Pushing plane in and out of hangar"],
["16050",2.5,"Truck, semi, tractor, ≥1 ton, or bus, driving"],
["16060",3.5,"Walking for transportation, 2.8-3.2 mph, level, moderate pace, firm surface"],
["17010",7,"Backpacking (Taylor Code 050)"],
["17011",3.5,"Walking with a day pack, level ground, assumed in the city"],
["17012",7.8,"Backpacking,  hiking with a daypack, organized walking with daypack"],
["17016",4,"Carrying 5 to 14 lb (2.3 to 6.4 kg) load (e.g. suitcase, boxes, groceries), level ground, moderate pace"],
["17018",4.5,"Carrying 15 – 155 lb (6.8 – 70.4 kg) load (e.g. suitcase, boxes, furniture), level ground or downstairs, slow pace"],
["17019",6.5,"Carrying 50 to 150 pound load (e.g., equine or bovine feed, fence pipes, furniture), level ground, moderate pace"],
["17021",2.3,"Carrying ~10 lb child, slow walking"],
["17025",8.3,"Carrying load upstairs, general"],
["17026",5.5,"Carrying load, 1 to 15 lb load, upstairs"],
["17027",6,"Carrying load, 16 to 24 lb load, upstairs"],
["17028",8,"Carrying load, 25 to 49 lb load, upstairs"],
["17029",10,"Carrying load, 50 to 74 lb load, upstairs"],
["17030",12,"Carrying load, >74 lb load, upstairs"],
["17031",3.8,"Loading  and/or unloading a car, implied walking"],
["17032",5,"Climbing hills, no load, 5 to 20% grade, very slow pace"],
["17033",3.8,"Climbing hills, 15-50 lb load, 1 to 2% grade, slow pace"],
["17034",5.3,"Climbing hills, no load, 1 to 5% grade, moderate-to-brisk pace"],
["17035",7,"Climbing hills, no load, 6 to 10% grade, moderate-to-brisk pace"],
["17036",8.8,"Climbing hills, no load, 11 to 20% grade, slow-to-moderate pace"],
["17037",10,"Climbing hills, no load, 4.0 to 5.0 mph, 3 to 5% grade, very fast pace"],
["17038",8.5,"Climbing hills, no load, steep grade (30%), slow pace (less than 1.2 mph)"],
["17039",15.5,"Climbing hills, no load, very steep grade (30-40%), 1.2 to 1.8 mph"],
["17040",16.3,"Climbing hills, no load, steep grade (10-40%), 1.8 to 5.0 mph"],
["17045",6.5,"Climbing hills, 10 to 20 lb load, 5 to 10% grade, moderate"],
["17050",7.5,"Climbing hills, 21 to 40 lb load, 3 to 10% grade, moderate-to-brisk pace"],
["17060",10,"Climbing hills, 20+ pound load, 5 to 20% grade, moderate to brisk pace"],
["17070",3.5,"Descending stairs"],
["17076",4.5,"Hauling water, head hauling, walking on flat surface"],
["17080",6,"Hiking, cross country (Taylor Code 040)"],
["17081",3.8,"Hiking slowly or ambling through fields and hillsides, no load"],
["17082",5.3,"Hiking or walking at a normal pace through fields and hillsides, no load"],
["17085",2.5,"Bird watching, walking and stopping"],
["17088",4.5,"Marching, moderate speed, military, no pack"],
["17090",8,"Marching rapidly, military, no pack"],
["17100",3.8,"Pushing or pulling stroller with child or walking with children, 2.5 to 3.1 mph"],
["17105",3.8,"Pushing a wheelchair, non-occupational"],
["17110",6.5,"Race walking"],
["17130",8,"Stair climbing, using or climbing up ladder (Taylor Code 030)"],
["17131",6.8,"Stair climbing, general"],
["17133",4.5,"Stair climbing, slow pace"],
["17134",9.3,"Stair climbing, fast pace, one step at a time"],
["17136",7.5,"Stair climbing, two steps at a time"],
["17138",7.5,"Stair climbing, ascending and descending stairs"],
["17140",4.5,"Using crutches, level ground, general"],
["17142",7,"Using crutches, fast pace"],
["17145",4.3,"Using medical knee scooter"],
["17150",2.3,"Walking, household"],
["17151",2.3,"Walking, less than 2.0 mph, level, strolling, very slow"],
["17152",2.8,"Walking, 2.0 to 2.4 mph, level, slow pace, firm surface"],
["17160",3.5,"Walking for pleasure (Taylor Code 010)"],
["17161",2.5,"Walking from house to car or bus, from car or bus to go places, from car or bus to and from the worksite"],
["17162",2.5,"Walking to neighbor’s house or family’s house for social reasons"],
["17165",3,"Walking the dog"],
["17170",3,"Walking, 2.5 mph, firm, level surface"],
["17180",3.3,"Walking, 2.5 mph, downhill"],
["17190",3.8,"Walking, 2.8 to 3.4 mph, level, moderate pace, firm surface"],
["17200",4.8,"Walking, 3.5 to 3.9 mph, level, brisk, firm surface, walking for exercise"],
["17220",5.5,"Walking, 4.0 to 4.4 mph (6.4 to 7.1 km/h), level, firm surface, very brisk pace"],
["17230",7,"Walking, 4.5 to 4.9 mph, level, firm surface, very, very brisk"],
["17231",8.5,"Walking, 5.0 to 5.5 mph (8.8 to 8.9 km/h), level, firm surface"],
["17250",3.5,"Walking, for pleasure, work break"],
["17255",4,"Walking, self-selected speed, indoor track or outdoors, firm surface"],
["17260",4.8,"Walking, grass track"],
["17262",4.5,"Walking, normal pace, plowed field or sand"],
["17270",4,"Walking, to work or class (Taylor Code 015)"],
["17280",2.5,"Walking, to and from an outhouse"],
["17302",4.3,"Walking, for exercise, 2.5 to 3.5 mph (4.0 to 5.6 km/h), with ski poles, Nordic walking, level, moderate pace"],
["17304",5.3,"Walking, for exercise, 3.6 to 4.4 mph (5.8 to 7.1 km/h), with ski poles, Nordic walking, level, moderate pace"],
["17305",8.5,"Walking, for exercise, 4.5 to 5.0 mph, with ski poles, Nordic walking, level, fast pace"],
["17310",8.8,"Walking, for exercise, with ski poles, Nordic walking, uphill, moderate pace"],
["17313",10.8,"Walking, for exercise, with ski poles, Nordic walking, level ground, carrying 20 to 30 lb load (9.0 to 15.0 kg)"],
["17315",12.3,"Walking, for exercise, with ski poles, Nordic walking, uphill, carrying 20 to 30 lb load (9.0 to 15.0 kg)"],
["17320",6,"Walking, backward, 3.5 mph, level"],
["17325",7.8,"Walking, backward, 3.5 mph, uphill, 5% grade"],
["17330",8,"Walking, Teabag walk, Monty Python Ministry of Silly Walks"],
["17332",3.5,"Walking, Putey walk, Monty Python Ministry of Silly Walks"],
["17340",2.1,"Walking, treadmill, less than 1.0 mph, 0% grade"],
["17343",2.3,"Walking, treadmill, 1.0 mph, 0% grade"],
["17346",2.8,"Walking, treadmill, 1.2 to 1.9 mph, 0% grade (1.9 to 3.1 km/h)"],
["17349",3,"Walking, treadmill, 2.0 to 2.4 mph (3.2 to 3.9 km/h), 0% grade"],
["17352",3.5,"Walking, treadmill, 2.5 to 2.9 mph (4.0 to 4.7 km/h), 0% grade"],
["17355",3.8,"Walking, treadmill, 3.0 to 3.4 mph (4.8 to 5.5 km/h), 0% grade"],
["17358",4.8,"Walking, treadmill, 3.5 to 3.9 mph (5.6 to 6.3 km/h), 0% grade"],
["17361",5.8,"Walking, treadmill, 4.0 to 4.4 mph (6.4 to 7.1 km/h), 0% grade"],
["17364",6.8,"Walking, treadmill, 4.5 to 4.9 mph (7.2 to 7.9 km/h), 0% grade"],
["17367",8.3,"Walking, treadmill, 5.0 to 5.5 mph (8.0 to 8.9 km/h), 0% grade"],
["17382",3.3,"Walking, treadmill, downhill (-3% to -12% grade), 2.8 to 3.1 mph"],
["17412",3.3,"Walking, treadmill, downhill (-5% to -25% grade), 2.8 mph, with Nordic Poles"],
["17434",4.8,"Walking, treadmill, 2.5 mph, 0% grade, 5 to 20 degrees C, 40 lb (18.2 kg) load"],
["17438",5.8,"Walking, treadmill, 2.5 mph, 0% grade, -10 to 0 degrees C, 40 lb (18.2 kg) load"],
["17455",8.3,"Walking, Curved treadmill, 3.0 to 5.0 mph, brisk pace"],
["17475",7.8,"Walking treadmill, backwards, 2.5 mph, +10% grade"],
["17492",1.5,"Walking, with a walker or step-to gait on treadmill, 0.7 mph (1.1 km/h), 0% grade"],
["18010",2.5,"Boating, power, driving"],
["18012",1.3,"Boating, power, passenger, light"],
["18020",4,"Canoeing, on camping trip (Taylor Code 270)"],
["18025",3.3,"Canoeing, harvesting wild rice, knocking rice off the stalks"],
["18030",7,"Canoeing, portaging"],
["18040",2.8,"Canoeing, rowing, 2.0-3.9 mph, light effort"],
["18050",5.8,"Canoeing, rowing, 4.0-5.9 mph, moderate effort"],
["18060",12.5,"Canoeing, rowing, kayaking, competition, > 6 mph, vigorous effort"],
["18070",3.5,"Canoeing, rowing, for pleasure, general (Taylor Code 250)"],
["18080",12,"Canoeing or rowing, in competition, crew or sculling (Taylor Code 260)"],
["18090",3,"Diving, springboard or platform"],
["18100",5,"Kayaking, moderate effort"],
["18104",13.5,"kayaking, competition"],
["18106",9,"kayaking, slalom, flat water"],
["18110",4,"Paddle boat"],
["18112",15.5,"Rowing, simulated crew in a water tank, single oar, 33 strokes/min,"],
["18114",15.5,"Rowing, single scull, ergometer, ergometer on slides, racing speed (32+ strokes/min, >10 mph)"],
["18120",3,"Sailing, boat and board sailing, windsurfing, ice sailing, general (Taylor Code 235)"],
["18130",4.5,"Sailing, in competition, general"],
["18132",9.3,"Sailing, in competition, high effort"],
["18140",3.3,"Sailing, Sunfish/Laser/Hobby Cat, Keel boats, ocean sailing, yachting, leisure"],
["18142",2,"Sailing, dingy"],
["18150",6,"Skiing, water or wake boarding (Taylor Code 220)"],
["18160",7,"Jet skiing, driving, in water"],
["18180",15.8,"Skindiving, fast"],
["18190",11.8,"Skindiving, moderate"],
["18200",7,"Skindiving, scuba diving, general (Taylor Code 310)"],
["18202",5.3,"Scuba diving, general, light effort"],
["18204",5.8,"Scuba diving, general, moderate effort"],
["18206",5.5,"Scuba diving, professional diver"],
["18208",6.8,"Scuba diving, recreational diver"],
["18210",5,"Snorkeling (Taylor Code 320)"],
["18220",3,"Surfing, body or board, general"],
["18221",6.8,"Surfboard, paddling"],
["18222",5,"Surfing, body or board, competitive"],
["18224",6.5,"Stand up paddle boarding, general"],
["18225",2.8,"Stand up Paddleboard, standing, 10-19 strokes/min"],
["18226",3.8,"Stand up Paddleboard, standing, 20-29 strokes/min"],
["18227",5,"Stand up Paddleboard, standing, 30-39 strokes/min"],
["18228",9.8,"Stand up Paddleboard, standing, 40-49 strokes/min"],
["18229",11,"Stand up Paddleboard, standing, 50-69 strokes/min"],
["18230",9.8,"Swimming laps, freestyle, fast, vigorous effort"],
["18240",5.8,"Swimming laps, freestyle, slow, recreational"],
["18250",9.5,"Swimming, backstroke, training or competition"],
["18255",4.8,"Swimming, backstroke, recreational"],
["18260",10.3,"Swimming, breaststroke, general, training or  competition"],
["18265",5.3,"Swimming breaststroke, recreational"],
["18270",13.8,"Swimming, butterfly, general"],
["18280",10.5,"Swimming, crawl, fast speed, ~75 yards/minute,  vigorous effort"],
["18285",10.5,"Swimming, open water, 5k"],
["18290",8,"Swimming, crawl, medium speed, ~50 yards/minute, vigorous effort"],
["18292",5.8,"Swimming, crawl, slow speed, 30-45 yards/minute, moderate effort"],
["18294",14.5,"Swimming, crawl, elite swimmers, competition, >90 yards/minute"],
["18300",6,"Swimming, lake, ocean, river (Taylor Codes 280,  295)"],
["18310",6,"Swimming, leisurely, not lap swimming, general"],
["18320",7,"Swimming, sidestroke, general"],
["18330",8,"Swimming, synchronized"],
["18340",9.8,"Swimming, treading water, fast, vigorous effort"],
["18350",3.5,"Swimming, treading water, moderate effort,  general"],
["18352",2.3,"Tubing, floating on a river, general"],
["18355",5.5,"Water aerobics, water calisthenics, general"],
["18356",3.8,"Water aerobics, resistance exercises"],
["18358",7.5,"Water aerobics, high intensity"],
["18360",10,"Water polo"],
["18365",3,"Water volleyball"],
["18366",9.8,"Water jogging, vigorous effort"],
["18367",2.5,"Water walking, light effort, slow pace"],
["18368",4.8,"Water walking, moderate effort, moderate pace"],
["18369",6.8,"Water walking, vigorous effort, brisk pace"],
["18370",5,"Whitewater rafting, kayaking, or canoeing"],
["18374",6.5,"Water running, 30 steps/min, slow"],
["18375",7.5,"Water running, 40 steps/min, moderate"],
["18376",8.5,"Water running, 50 steps/min, fast"],
["18377",9.8,"Water running, 60 steps/min, very fast"],
["18380",5,"Windsurfing, not pumping for speed"],
["18385",11,"Windsurfing or kitesurfing, crossing trial"],
["18390",14,"Windsurfing, competition, pumping for speed"],
["18404",2.8,"Aquatic cycling, 25 W, 40-50 RPM"],
["18408",4.8,"Aquatic cycling, 25 W, 60-70 RPM"],
["18412",3.8,"Aquatic cycling, 50 W, 40-50 RPM"],
["18416",6,"Aquatic cycling,  50 W, 60-70 RPM"],
["18420",5,"Aquatic cycling, 75 W, 40-50 RPM"],
["18424",6.3,"Aquatic cycling, 75 W, 60-70 RPM"],
["18428",6.3,"Aquatic cycling, 100 W, 40-50 RPM"],
["18432",7.5,"Aquatic cycling, 100 W, 60-70 RPM"],
["18436",8.5,"Aquatic cycling, 80-89 RPM"],
["18440",10.3,"Aquatic cycling, 90+ RPM"],
["19005",7.5,"Dog sledding, mushing"],
["19006",2.5,"Dog sledding, passenger"],
["19010",6,"Moving icehouse, set up/drill holes"],
["19011",2,"Ice fishing"],
["19018",14,"Skating, ice dancing"],
["19020",5.5,"Skating, ice, 9 mph or less"],
["19030",7,"Skating, ice, general (Taylor Code 360)"],
["19040",9,"Skating, ice, rapidly, more than 9 mph but not competitive"],
["19045",9,"Skating Treadmill, 6 – 6.9 mph, 2% grade"],
["19046",10,"Skating Treadmill, 7 – 7.9 mph, 2% grade"],
["19047",10.5,"Skating Treadmill, 8 – 8.9 mph, 2% grade"],
["19048",11,"Skating Treadmill, 9 – 9.9 mph, 2% grade"],
["19050",13.8,"Skating, speed, competitive"],
["19060",7,"Ski jumping, climb up carrying skis"],
["19075",7,"Skiing, general"],
["19080",6.8,"Skiing, cross country, 2.5 mph, slow or light effort, ski walking"],
["19090",8.5,"Skiing, cross country, 4.0-4.9 mph, moderate speed and effort, general"],
["19100",11.3,"Skiing, cross country, 5.0-7.9 mph, brisk speed, vigorous effort"],
["19110",14,"Skiing, cross country, elite skier, >8.0-11.9 mph, racing"],
["19112",16,"Skiing, cross country, 12-16 mph, elite skier, racing"],
["19115",9.5,"Skiing, cross-country skiing high-intensity training"],
["19130",15.5,"Skiing, cross country, hard snow, uphill, maximum, snow mountaineering"],
["19135",13.3,"Skiing, cross-country, skating"],
["19140",13.5,"Skiing, cross-country, biathlon, skating technique"],
["19142",12.8,"Biathlon training, 5 degree incline, 8 km/h (5 mph), with/without rifle"],
["19144",15.8,"Biathlon training, 5 degree incline, 10.7 km/h (6.6 mph), with/without rifle"],
["19146",9.3,"Skiing, slalom"],
["19150",4.3,"Skiing, downhill, alpine or snowboarding, light effort, active time only"],
["19160",6.3,"Skiing, downhill, alpine or snowboarding, moderate effort, general, active time only"],
["19170",8,"Skiing, downhill, alpine or snowboarding, vigorous effort, active time only"],
["19174",7.3,"Skiing, Alpine skiing high-intensity training"],
["19180",7,"Sledding, tobogganing, bobsledding, luge (Taylor Code 370)"],
["19190",5.3,"Snow shoeing, moderate effort"],
["19192",10,"Snow shoeing, vigorous effort"],
["19200",3.8,"Snowmobiling, driving, moderate pace, flat land"],
["19201",7.5,"snowboarding, recreational, moderate pace, mountain"],
["19202",2,"Snowmobiling, passenger, light"],
["19252",5.3,"Snow shoveling, by hand, moderate effort"],
["19254",7.5,"Snow shoveling, by hand, vigorous effort"],
["19260",2.5,"Snow blower, walking and pushing"],
["19300",12.5,"Skiing, roller, elite racers"],
["19305",5.5,"Rollerskiing, 10 – 12.9 km/h, no incline"],
["19310",6.8,"Rollerskiing, 13 – 16.9 km/h, no incline"],
["19315",8.3,"Rollerskiing, 17 – 19.9 km/h, no incline"],
["19320",10.5,"Rollerskiing, 20 – 23.9 km/h, no incline"],
["19325",15,"Rollerskiing, 24 – 27.9 km/h, no incline"],
["19330",12.5,"Rollerskiing, 10-15 km/h, 2-5 degree incline"],
["19335",14.3,"Rollerskiing, 16-22 km/h, 2-5 degree incline"],
["19340",12.3,"Rollerskiing, 6-9 km/h, 6-10 degree incline"],
["19345",16,"Rollerskiing, >10 km/h, 6-10 degree incline"],
["19400",9,"Mountaineering, downhill climbing, walking down with rope"],
["19405",10.3,"Mountaineering, downhill climbing/cross-country skiing"],
["20000",1,"Sitting in church, in service, attending a ceremony, sitting quietly"],
["20001",2,"Sitting, playing an instrument at church"],
["20005",1.8,"Sitting in church, talking or singing, attending a ceremony, sitting, active participation"],
["20010",1.5,"Sitting, reading religious materials at home"],
["20015",1.3,"Standing quietly in church, attending a ceremony"],
["20020",2,"Standing, singing in church, attending a ceremony, standing, active participation"],
["20025",1.3,"Kneeling in church or at home, praying"],
["20030",1.3,"Standing, talking in church"],
["20035",2,"Walking in church"],
["20036",2,"Walking, less than 2.0 mph, very slow"],
["20037",3.8,"Walking, 2.8 to 3.4 mph, moderate speed, not carrying anything"],
["20038",4.8,"Walking, 3.5 to 3.9 mph, brisk speed, not carrying anything"],
["20039",2,"Walk/stand combination for religious purposes, usher"],
["20040",5,"Praise with dance or run, spiritual dancing in church"],
["20045",2.3,"Serving food at church"],
["20046",2,"Preparing food at church"],
["20047",3.3,"Washing dishes, cleaning kitchen at church"],
["20050",1.5,"Eating at church"],
["20055",2,"Eating/talking at church or standing eating, American Indian Feast days"],
["20060",3.3,"Cleaning church"],
["20061",4,"General yard work at church"],
["20065",3.8,"Standing , moderate effort (e.g., lifting heavy objects, assembling at fast rate)"],
["20095",4.5,"Standing, moderate-to-heavy effort, manual labor, lifting ≥ 50 lbs, heavy maintenance"],
["20100",1.3,"Typing, electric, manual, or computer"],
["21000",1.3,"sitting, meeting, general, and/or with talking involved"],
["21005",1.5,"Sitting, light office work, in general"],
["21010",2.5,"Sitting, moderate work"],
["21015",1.8,"Standing, light work (filing, talking, assembling)"],
["21016",2,"Sitting, child care, only active periods"],
["21017",3.5,"Standing, child care, only active periods"],
["21018",3.5,"Walk/run play with children, moderate, only active periods"],
["21019",5.8,"Walk/run play with children, vigorous, only active periods"],
["21020",3.3,"Standing, light/moderate work (e.g., pack boxes, assemble/repair, set up chairs/furniture)"],
["21025",3.5,"Standing, moderate (e.g., lifting 50 lbs., assembling at fast rate)"],
["21030",4.5,"Standing, moderate/heavy work"],
["21035",1.3,"Typing, electric, manual, or computer"],
["21040",2.3,"Walking, less than 2.0 mph, very slow"],
["21045",3.8,"Walking, 2.8 to 3.4 mph, moderate speed, not carrying anything"],
["21050",4.8,"Walking, 3.5 to 3.9 mph, brisk speed, not carrying anything"],
["21055",3.5,"Walking, 2.5 mph slowly and carrying objects less than 25 pounds"],
["21060",4.5,"Walking, 3.0 mph moderately and carrying objects less than 25 pounds, pushing something"],
["21065",4.5,"Walking, 3.5 mph, briskly and carrying objects less than 25 pounds"],
["21070",3,"Walk/stand combination, for volunteer purposes"],
["22040",1.3,"Seated, video game, handheld controller (inactive)"],
["22120",1.5,"Video game, handheld controller (light effort)"],
["22160",2.3,"Video game, light effort (Wii Fit, yoga, bowling, etc.)"],
["22200",3,"Active video game, motion sensing game/using upper body (light to moderate effort)"],
["22240",4,"Active video game, motion sensing game/using total body (moderate effort)"],
["22280",5,"Active video game, motion sensing game/using total body (moderate-to-vigorous effort)"],
["22320",7.5,"Active video game, motion sensing game/using total body, exergames, workouts, dancing (vigorous effort)"],
["22360",9.8,"Conditioning/exercise virtual reality fitness, vigorous intensity"],
];

const activityGroups='骑行 体能与力量 舞蹈 钓鱼与狩猎 家务 房屋维修 静态活动 园艺 其他活动 演奏乐器 职业活动 跑步 个人护理 性活动 体育运动 交通出行 步行 水上运动 冬季运动 宗教活动 志愿活动 电子游戏'.split(' ');
const activityTerms={骑行:'bicycl',单车:'bicycl',动感单车:'stationary',力量:'resistance',深蹲:'squat',卧推:'resistance',举重:'weight lifting',俯卧撑:'push',仰卧起坐:'sit-up',瑜伽:'yoga',普拉提:'pilates',有氧:'aerobic',划船机:'rowing',椭圆机:'elliptical',跳绳:'rope',羽毛球:'badminton',篮球:'basketball',足球:'soccer',排球:'volleyball',乒乓球:'table tennis',网球:'tennis',拳击:'boxing',跳舞:'danc',游泳:'swimming',自由泳:'freestyle',蛙泳:'breaststroke',蝶泳:'butterfly',仰泳:'backstroke',滑雪:'ski',跑步:'running',慢跑:'jogging',快走:'walking',散步:'walking',爬山:'hiking',楼梯:'stair',拉伸:'stretch',高尔夫:'golf',攀岩:'climbing',太极:'tai chi'};
Object.assign(activityTerms,{骑车:'bicycl',自行车:'bicycl',爬坡:'grade',健走:'walking',哑铃:'resistance',杠铃:'resistance',平板支撑:'plank',蛙式:'breaststroke',舞蹈:'danc',徒步:'hiking'});
const courtLabels={'15020':'竞技羽毛球','15025':'羽毛球比赛','15030':'休闲羽毛球单双打','15040':'篮球比赛','15070':'投篮练习'};
Object.assign(courtLabels,{'01015':'骑行 · 轻松','01016':'骑行 · 中等','01017':'骑行 · 高强度','02048':'椭圆机 · 中等','02049':'椭圆机 · 高强度','02050':'大强度抗阻训练','02052':'负重深蹲或硬拉','02054':'多动作抗阻训练 · 每组8至15次','02056':'自重力量 · 一般','02057':'自重力量 · 高强度','12020':'慢跑 · 自选速度','12025':'原地慢跑','12150':'跑步 · 一般','17200':'平地快走 · 约5.6至6.3公里/小时','17131':'爬楼梯','18230':'自由泳 · 快速','18240':'自由泳 · 休闲慢速','18310':'休闲游泳'});
const groupSelect=el('activity-group'),activitySelect=el('activity-choice');
groupSelect.add(new Option('全部分类',''));
activityGroups.forEach((name,i)=>groupSelect.add(new Option(name,String(i+1))));
function populateActivities(selected=''){
 const group=groupSelect.value,query=el('activity-search').value.trim().toLowerCase();
 const term=activityTerms[query]||query;
 activitySelect.replaceChildren(new Option('请选择活动',''));
 for(const [code,met,description] of activityCatalog){
  const category=Number(code.slice(0,2));
  if(group && Number(group)!==category)continue;
  if(query && !code.includes(query) && !description.toLowerCase().includes(term) && !(courtLabels[code]||'').includes(query) && !activityGroups[category-1].includes(query))continue;
  activitySelect.add(new Option((courtLabels[code]||activityGroups[category-1])+' · '+met+' MET · '+description+' · '+code,code));
 }
 activitySelect.value=selected;
 if(!activitySelect.value)activitySelect.selectedIndex=0;
 describeActivity();
}
function describeActivity(){
 const row=activityCatalog.find(r=>r[0]===activitySelect.value);
 el('activity-description').textContent=row?row[2]+' · '+row[1]+' MET':(activitySelect.length-1)+' 条可选活动';
}
function activityRecord(minutes){
 const row=activityCatalog.find(r=>r[0]===activitySelect.value);
 if(!row)return null;
 const entry={code:row[0],met:row[1],description:row[2]};
 try{
  const profile=JSON.parse(fitplanStorage.getItem('fitplan.profile.v1'));
  if(profile && +profile.age>=19 && +profile.age<=59 && positive(profile.weight) && positive(minutes))
   entry.kcal=Math.round(row[1]*Number(profile.weight)*Number(minutes)/60);
 }catch{}
 return entry;
}
groupSelect.addEventListener('change',()=>populateActivities());
el('activity-search').addEventListener('input',()=>populateActivities());
activitySelect.addEventListener('change',()=>{
 describeActivity();
 const row=activityCatalog.find(r=>r[0]===activitySelect.value);
 if(row&&!el('training-raw').value.trim())el('training-name').value=row[2].slice(0,80);
});
populateActivities();

function resetTrainingInput(){
 groupSelect.value="";el("activity-search").value="";populateActivities();
 trainingInterpretation=null;trainingPreparedRaw=null;
 el('training-preview').hidden=true;el('training-details').open=false;
}
function loadTrainingInput(item){
 groupSelect.value='';el('activity-search').value='';populateActivities(item.activity?.code||'');
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
 const keyword=Object.keys(activityTerms).sort((a,b)=>b.length-a.length).find(word=>raw.includes(word));
 groupSelect.value='';el('activity-search').value=keyword||'';populateActivities();
 el('activity-picker').open=Boolean(keyword);
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
  const raw=fitplanStorage.getItem(key);
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
  try{fitplanStorage.setItem(key,JSON.stringify(next));items=next;return true}
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
  if(type==='training'){
   const today=items.filter(item=>item.date===localDay());
   el('today-training').textContent=today.length?'已完成 '+today.filter(item=>item.state==='done').length+' 项':'待记录';
   const summary=el('overview-training');
   summary.replaceChildren();
   for(const item of today){
    const row=document.createElement('li');
    row.textContent=(item.state==='done'?'已完成 · ':'计划 · ')+item.name;
    summary.append(row);
   }
   if(!today.length)summary.textContent='今天还没有训练记录。';
  }
  const rows=items.filter(d=>d.date===el(type+'-filter').value);
  el(type+'-summary').textContent=type==='food'?'已记录 '+rows.length+' 条；营养数据未知。':'计划 '+rows.filter(d=>d.state==='planned').length+' 条 · 已完成 '+rows.filter(d=>d.state==='done').length+' 条';
  if(!rows.length){const li=document.createElement('li');li.className='journal-empty';li.textContent=blocked?'记录暂时无法读取。':'这一天还没有记录，从一条开始就好。';list.append(li)}
  for(const item of rows){
   const li=document.createElement('li'),title=document.createElement('h3'),detail=document.createElement('p'),note=document.createElement('p'),actions=document.createElement('div');
   title.textContent=(type==='food'?item.meal:item.state==='planned'?'计划':'已完成')+' · '+item.name;
   detail.textContent=type==='food'?item.amount+' '+item.unit+' · 营养未知':
    [item.minutes?item.minutes+' 分钟':'时长未记录',item.sets?item.sets+' 组':'',item.reps?'每组 '+item.reps+' 次':'',item.weight!==''?'负重 '+item.weight+' kg':''].filter(Boolean).join(' · ');
   note.textContent=item.note;    if(type==='training'){ if(item.activity){detail.textContent+=' · '+item.activity.description+' · '+item.activity.met+' MET';if(Number.isFinite(item.activity.kcal))detail.textContent+=' · '+(item.state==='planned'?'计划预计':'活动期间估算')+item.activity.kcal+' 千卡';}    const meta=item.interpretation;     if(meta){if(meta.distance)detail.textContent+=' · '+meta.distance;if(meta.side)detail.textContent+=' · '+meta.side;if(meta.incline)detail.textContent+=' · 坡度 '+meta.incline;if(meta.speed)detail.textContent+=' · 速度 '+meta.speed+' '+(meta.speedUnit||'（单位未注明）');}     if(item.raw)note.textContent=(item.note?item.note+'\n':'')+'原文：'+item.raw;    }    actions.className='journal-actions';
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
  if(type==='training'&&!draft.name&&activitySelect.value)draft.name=activitySelect.selectedOptions[0].textContent.slice(0,80);
  const error=journalError(type,draft);if(error){status.textContent=error;return}
  if(!fresh())return;
  if(editing&&!items.some(d=>d.id===editing)){status.textContent='原记录已删除，请取消修改后重新添加。';return}
  if(!editing&&items.some(d=>fields.every(f=>d[f]===draft[f])&&(type!=='training'||(d.raw||'')===el('training-raw').value.trim()))){status.textContent='已有完全相同的记录，请核对，避免重复保存。';return}
  const record={...draft,...(type==='training'?{raw:el('training-raw').value.trim(),interpretation:trainingInterpretation,activity:activityRecord(draft.minutes)}:{}),id:editing||crypto.randomUUID(),updatedAt:new Date().toISOString()};
  const next=editing?items.map(d=>d.id===editing?record:d):[...items,record];
  if(write(next)){el(type+'-filter').value=draft.date;reset();status.textContent='已保存到当前浏览器。';render()}
 });
 el(type+'-cancel').addEventListener('click',()=>{reset();status.textContent='已取消修改。'});
 el(type+'-filter').addEventListener('change',render);
 window.addEventListener('storage',event=>{if(event.key===key){if(fresh())render()}});
 render();
}





function renderDayDetails(){
 const day=localDay();
 let foods,training,goal,profile;
 try{
  const read=(key,empty)=>JSON.parse(fitplanStorage.getItem('fitplan.'+key+'.v1'))??empty;
  foods=read('food.records',[]).filter(r=>r.date===day);
  training=read('training.records',[]).filter(r=>r.date===day);
  goal=read('goals',{}).kind;profile=read('profile',{});
 }catch{
  for(const id of ['daily-macros','daily-exercise','daily-reference','advice-context','tip-meal','tip-move','tip-water','tip-rest'])
   el(id).textContent='记录暂时无法读取。';
  return;
 }
 el('today-record-count').textContent=foods.length+training.length?'今天已记 '+(foods.length+training.length)+' 条':'尚未开始记录';
 const sums=[0,0,0];let known=0,unknown=0;
 for(const row of foods){
  for(const item of row.items||[{}]){
   const macro=macrosPer100[item.code];
   if(item.unknown||!macro||!positive(item.grams)){unknown++;continue}
   macro.forEach((per100,i)=>sums[i]+=per100*item.grams/100);known++;
  }
 }
 el('daily-macros').textContent=(known?['蛋白质','碳水','脂肪'].map((label,i)=>label+' '+Number(sums[i].toFixed(1))+' 克').join(' · '):'等待可估算的食物记录')+(unknown?'（另有 '+unknown+' 项待估）':'');
 el('daily-reference').textContent=macroGuideText(profile);
 const energy=energyDay(day,profile,foods,training);
 el('overview-burn').textContent=el('today-burn').textContent=energy.total==null?'待估算':'约 '+energy.total+' 千卡';
 el('overview-split').textContent=energy.detail;
 el('overview-balance').textContent=energy.balance;
 const done=training.filter(r=>r.state==='done'),plans=training.filter(r=>r.state==='planned');
 const timed=done.filter(r=>positive(r.minutes)),estimated=done.filter(r=>Number.isFinite(r.activity?.kcal));
 const minutes=timed.reduce((sum,r)=>sum+Number(r.minutes),0),kcal=estimated.reduce((sum,r)=>sum+r.activity.kcal,0);
 el('daily-exercise').textContent=['已完成 '+done.length+' 项','待执行 '+plans.length+' 项',
  timed.length?'已记时 '+Number(minutes.toFixed(1))+' 分钟':'',estimated.length?'活动期间约 '+kcal+' 千卡':'',
  done.length>estimated.length?(done.length-estimated.length)+' 项消耗待估':''].filter(Boolean).join(' · ');
 const goalName={'fat-loss':'减脂','muscle-gain':'增肌',maintain:'维持',explore:'探索'}[goal]||'尚未设定';
 el('advice-context').textContent='当前目标：'+goalName+'。今天记了 '+foods.length+' 条饮食、完成 '+done.length+' 项活动，还有 '+plans.length+' 项计划。';
 const mealTips={'muscle-gain':'下一餐可以挑一种你喜欢的蛋白质来源，比如豆腐、鸡蛋或鱼，再搭配平常吃的主食。','fat-loss':'下次打饭可以先选喜欢的蔬菜和蛋白质食物，再按饥饿感选主食。',maintain:'下一餐可以沿用平常吃得舒服的搭配，看看饱腹感如何。',explore:'下一餐可以尝试一种新搭配，记下喜欢的口感。'};
 el('tip-meal').textContent=(unknown?'今天还有食物待估，已知热量只是部分摄入。':!foods.length?'从下一顿开始，写下食物和大致份量就好。':'')+(done.length?'今天有已完成训练，下次吃饭时可以留意自己的饥饿感。':'')+(mealTips[goal]||'选一顿方便记录的饭，吃完再记也可以。');
 el('tip-move').textContent=plans.length?'今天还有「'+plans[0].name+'」等安排。看看精力和时间，完成后再标记，也可以改天做。':done.length?'今天已完成「'+done[0].name+'」。如果感觉累，可以到这里收工。':'今天的安排由你选。想活动时，可以先挑一项喜欢的运动；想休息也可以。';
 el('tip-water').textContent=done.length?'活动告一段落，可以把水杯放到手边，按口渴程度补水。':'把水杯放在下次吃饭或学习时容易拿到的位置。';
 el('tip-rest').textContent=done.length?'休息前可以记一句今天练完的感受，方便下次调整。':'看看明早几点起床，给睡前放松留一点时间。';
}
window.addEventListener('load',renderDayDetails);
window.addEventListener('hashchange',renderDayDetails);
window.addEventListener('storage',renderDayDetails);
window.addEventListener('focus',renderDayDetails);

// FOOD ESTIMATION: cited energy data, explicit app portion assumptions.
const foodSourceBase='https://www.fao.org/4/y5432e/';
const foodCatalog=[
 {"id":"B097","name":"方便面（熟面近似）","aliases":["康师傅方便面","方便面","泡面"],"energy":99,"code":"B097","page":"y5432e07.htm","unit":"桶","portions":{"桶":350}},
 {"id":"E012","name":"香蕉","aliases":["香蕉"],"energy":103,"code":"E012","page":"y5432e0a.htm","unit":"根","portions":{"根":128}},
 {"id":"E070","name":"橙子","aliases":["橙子"],"energy":40,"code":"E070","page":"y5432e0a.htm","unit":"个","portions":{"个":150}},
 {"id":"C046","name":"生菜","aliases":["生菜"],"energy":9,"code":"C046","page":"y5432e08.htm","unit":"份","portions":{"份":100}},
 {"id":"D026","name":"生花菜","aliases":["生花菜"],"energy":22,"code":"D026","page":"y5432e09.htm","unit":"份","portions":{"份":100}},
 {"id":"H070","name":"水浸金枪鱼（沥干）","aliases":["水浸金枪鱼"],"energy":124,"code":"H070","page":"y5432e0d.htm","unit":"份","portions":{"份":100}},
 {"id":"B065","name":"燕麦粥","aliases":["燕麦粥"],"energy":52,"code":"B065","page":"y5432e07.htm","unit":"碗","portions":{"碗":200}},
 {"id":"B068","name":"清煮意面","aliases":["清煮意面","水煮意面"],"energy":119,"code":"B068","page":"y5432e07.htm","unit":"份","portions":{"份":200}},
 {"id":"E089","name":"红李子","aliases":["红李子","李子"],"energy":37,"code":"E089","page":"y5432e0a.htm","unit":"个","portions":{"个":60}},
 {"id":"E093","name":"葡萄干","aliases":["葡萄干"],"energy":307,"code":"E093","page":"y5432e0a.htm","unit":"份","portions":{"份":30}},
 {"id":"D028","name":"生芹菜","aliases":["生芹菜"],"energy":15,"code":"D028","page":"y5432e09.htm","unit":"份","portions":{"份":100}},
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
const macrosPer100={"B077":[2.3,28,0.2],"B025":[8.2,47.2,2],"B027":[10.1,38.9,2.9],"B103":[4.8,23.7,1.5],"M030":[3.3,4.7,3.8],"M028":[3.6,5,0.1],"M041":[4.7,4.7,3.4],"M040":[5.9,5.8,0.2],"M039":[4.9,12.4,2.8],"N005":[12.3,0.3,11.2],"N004":[16.3,0.3,21.3],"E005":[0.3,12.3,0.1],"A018":[2.6,13,0.2],"B097":[2.6,13.5,3.8],"E012":[1.3,23.6,0.4],"E070":[1,7.9,0.1],"C046":[0.9,0.4,0.1],"D026":[2.2,2,0.2],"H070":[24.8,0,2.6],"B065":[1.6,8.5,1.1],"B068":[4,24.6,0.3],"E089":[0.6,7.5,0.1],"E093":[2.3,71.1,0.9],"D028":[0.6,2.2,0.1]};
// FAO 每100克可食部分。末两列为可调整的默认单位和克数。
const additionalFoods=[
 ["D122","煮西兰花","09",32,4.7,0.7,0.3,"份",150],
 ["D123","煮抱子甘蓝","09",32,3.5,2.2,0.3,"份",150],
 ["D019","煮甜椒","09",22,1.7,3.2,0.1,"份",150],
 ["D020","生甜椒","09",21,1.6,2.9,0.1,"份",150],
 ["D022","煮胡萝卜","09",35,0.9,5.6,0.1,"份",150],
 ["D002","生胡萝卜","09",33,0.9,5.3,0.2,"份",150],
 ["D025","煮花菜","09",22,2.2,2,0.2,"份",150],
 ["D027","煮芹菜","09",17,0.7,2.4,0.1,"份",150],
 ["D037","煮甜玉米","09",116,3.3,21.4,1.3,"份",150],
 ["D041","黄瓜","09",11,0.8,1.2,0.1,"份",150],
 ["D049","煮茄子","09",24,1.2,2.9,0.3,"份",150],
 ["D115","熟金针菇","09",39,1.9,7.1,0.2,"份",150],
 ["D048","生金针菇","09",39,1.9,7.1,0.2,"份",150],
 ["C036","煮卷心菜","08",30,1.6,4.6,0.3,"份",150],
 ["C019","生卷心菜","08",24,1.3,2.8,0.1,"份",150],
 ["C018","煮紫甘蓝","08",27,2,2.5,0.3,"份",150],
 ["C045","球生菜","08",12,1,1.1,0.2,"份",150],
 ["C069","水煮冷冻菠菜","08",25,3.1,0.4,0.8,"份",150],
 ["G003","煮蚕豆","0c",48,6.9,2,0.5,"份",150],
 ["G005","煮四季豆","0c",22,1.5,2.2,0.2,"份",150],
 ["G012","煮红腰豆","0c",86,7.9,9.1,0.5,"份",150],
 ["G014","煮黄豆","0c",142,13.5,1.4,7.7,"份",150],
 ["G007","煮豇豆","0c",30,3.3,1.6,0.3,"份",150],
 ["G037","煮扁豆","0c",76,6.8,9.5,0.4,"份",150],
 ["G040","煮荷兰豆","0c",41,3.3,5.2,0.2,"份",150],
 ["G041","煮青豌豆","0c",61,4.8,6.4,0.4,"份",150],
 ["G052","原味豆腐","0c",25,1.9,3.6,0.4,"份",150],
 ["A011","煮木薯","06",117,0.6,27.5,0.4,"份",150],
 ["A036","烤红薯","06",129,1.4,30.1,0.2,"份",150],
 ["A034","煮红薯","06",91,1.4,20.5,0.2,"份",150],
 ["A019","烤土豆","06",108,3,17.2,2.8,"份",150],
 ["K039","烤鸡胸肉","0f",158,28.4,0,4.8,"份",100],
 ["K040","去皮烤鸡腿","0f",209,28.3,0,10.6,"份",100],
 ["K041","带皮烤鸡腿","0f",240,26.4,0,15,"份",100],
 ["K050","烤鸭","0f",368,18.5,0,33.1,"份",100],
 ["K010","烤瘦牛排","0f",192,32.7,0,6.7,"份",100],
 ["K030","烤牛肉肠","0f",256,18.3,5.3,18.2,"份",100],
 ["K148","炖牛肉","0f",295,27.8,0,20.6,"份",100],
 ["K146","炖牛肋排","0f",459,21.6,0,42,"份",100],
 ["K147","土豆炖牛肉","0f",84,9,7.2,2,"份",100],
 ["H026","清蒸鳕鱼","0d",84,18.6,0,0.9,"份",100],
 ["H034","清蒸鲻鱼","0d",134,22,0,5,"份",100],
 ["H060","清蒸笛鲷","0d",122,24.2,0,2.7,"份",100],
 ["H084","清蒸金枪鱼","0d",208,25.2,0.3,11.8,"份",100],
 ["H085","烤金枪鱼","0d",206,24.9,0.3,11.7,"份",100],
 ["H069","油浸金枪鱼","0d",220,24.4,0,13.7,"份",100],
 ["H051","油浸沙丁鱼","0d",227,21.8,0,15.7,"份",100],
 ["J047","水煮青蟹","0e",109,24.2,0.1,1.2,"份",100],
 ["J013","熟龙虾","0e",97,22,0,0.9,"份",100],
 ["J042","熟章鱼","0e",77,17.3,0.1,0.7,"份",100],
 ["J017","生牡蛎","0e",73,12.2,0.6,2.4,"份",100],
 ["J049","水煮斑节虾","0e",115,26.3,0,0.9,"份",100],
 ["J043","熟扇贝","0e",78,14.5,1.9,1.3,"份",100],
 ["J027","炸鱿鱼","0e",205,23.5,6.8,9.4,"份",100],
 ["E010","鲜杏","0a",37,0.8,7.4,0.1,"份",100],
 ["E121","牛油果","0a",212,1.9,0.4,22.6,"份",100],
 ["E048","蔓越莓","0a",55,0.4,10.8,0.7,"份",100],
 ["E069","榴莲","0a",140,2.5,28.3,1.6,"份",100],
 ["E032","无花果","0a",45,1.4,8.1,0.3,"份",100],
 ["E036","黑葡萄","0a",66,1.2,14.9,0.1,"份",100],
 ["E035","青葡萄","0a",64,0.7,14.8,0.1,"份",100],
 ["E037","西柚","0a",26,0.9,4.8,0.2,"份",100],
 ["E042","番石榴","0a",31,0.7,3.5,0.5,"份",100],
 ["E049","猕猴桃","0a",49,0.9,9.4,0.6,"份",100],
 ["E051","柠檬","0a",16,0.6,1.8,0.2,"份",100],
 ["E052","青柠","0a",18,0.8,1.8,0.2,"份",100],
 ["E059","荔枝","0a",72,1.1,16.2,0.1,"份",100],
 ["E061","橘子","0a",41,0.9,8,0.2,"份",100],
 ["E064","芒果","0a",58,1,12.6,0.2,"份",100],
 ["F002","巴旦木","0b",599,19.5,4.8,54.7,"份",25],
 ["F007","巴西坚果","0b",690,14.4,2.4,68.5,"份",25],
 ["F011","盐焗腰果","0b",633,16.7,26.3,51.3,"份",25],
 ["F043","夏威夷果","0b",734,7.6,4.5,76.2,"份",25],
 ["F048","盐味混合坚果","0b",639,20.8,13.1,55.3,"份",25],
 ["F062","生花生","0b",568,24.7,8.9,47.1,"份",25],
 ["F052","盐烤花生","0b",636,25.1,14.1,52.8,"份",25],
 ["F054","生开心果仁","0b",572,19.7,6.8,50.6,"份",25],
 ["F055","生南瓜籽","0b",565,29.4,19.8,40.4,"份",25],
 ["E009","杏干","0a",212,4.3,44.4,0.2,"份",25],
 ["E029","椰枣干","0a",293,2,67.2,0.2,"份",25],
 ["E030","无花果干","0a",263,3.6,54.5,0.7,"份",25],
 ["B018","燕麦麸","07",361,17.3,50.3,7,"份",30],
 ["B041","玉米片","07",376,6.7,84.5,1,"份",30],
 ["B051","蒜香面包","07",406,9.7,52.6,17.4,"份",30],
 ["B091","法棍","07",258,8.4,52.8,1,"份",30],
 ["B089","玛德琳","07",383,6.1,39.1,22.8,"份",30],
 ["B011","黄油酥饼","07",493,5.9,62.1,24.9,"份",30],
 ["M008","切达奶酪","0g",402,25.4,0.1,33.8,"份",30],
 ["M012","马苏里拉奶酪","0g",301,26,0.1,22,"份",30],
 ["M010","茅屋奶酪","0g",146,15.3,0.4,9.3,"份",30],
 ["M051","酸奶油","0g",351,2.4,2.1,37.7,"份",30],
 ["Q037","原味薯片","0j",520,6.4,47.6,32.1,"份",30],
 ["Q036","爆米花","0j",479,9.1,53.3,24.4,"份",30],
 ["Q003","芝士蛋糕","0j",343,6.4,30.2,22.2,"份",150],
 ["Q014","芝士汉堡","0j",261,13.6,21.4,13.3,"份",150],
 ["Q013","培根汉堡","0j",254,12.1,21.8,13.1,"份",150],
 ["Q016","原味汉堡","0j",225,10.7,22.4,10.2,"份",150],
 ["Q018","千层面","0j",135,7.5,12.3,5.7,"份",150],
 ["Q034","夏威夷披萨","0j",246,13.4,24.6,10.1,"份",150],
 ["A013","薯条","06",250,4,26.2,13.9,"份",150],
 ["M020","香草冰淇淋","0g",195,4.1,20,11.2,"份",150],
 ["P003","黄油","0i",727,0.8,1,81.4,"勺",10],
 ["P022","酥油","0i",868,0.4,0.8,97.6,"勺",10],
 ["Q078","无添加糖花生酱","0j",622,27.7,8.1,51.6,"勺",10],
 ["M023","甜炼乳","0g",334,8.3,55.3,9.3,"勺",10],
 ["M026","羊奶","0g",50,3.1,3.6,2.6,"杯",200],
 ["G053","豆浆","0c",61,1.3,8.8,2.2,"杯",200]
];
for(const [code,name,page,energy,protein,carbs,fat,unit,grams] of additionalFoods){
 foodCatalog.push({id:code,name,aliases:[name],energy,code,page:"y5432e"+page+".htm",unit,portions:{[unit]:grams}});
 macrosPer100[code]=[protein,carbs,fat];
}
const campusSource='https://www.cfs.gov.hk/english/programme/programme_rafs/programme_rafs_n_01_01_nvic.html';
const campusFoods=[
 ['鸡丝炒饭',200,26,7.1,8.2],['牛肉炒饭',200,25,6.7,7.6],['菠萝鸡粒炒饭',200,25,6.2,7.8],
 ['咖喱牛腩饭',160,18,7.7,6.3],['萝卜牛腩饭',130,19,7.5,2.7],['沙爹牛肉饭',120,20,4.7,2.5],
 ['时蔬牛肉饭',110,19,4.9,1.6],['时蔬肉片饭',120,20,4.6,2.3],['玉米肉粒饭',130,22,5.2,2.3],
 ['焗猪扒饭',190,21,7.4,8.8],['番茄牛肉饭',120,21,4.6,1.8],['滑蛋虾仁饭',130,22,4.3,2.2],
 ['鱼香茄子饭',150,19,3.5,5.9],['香菇蒸鸡饭',160,25,6.1,4.4],['叉烧饭',200,26,7.3,7.1],
 ['烧肉饭',200,23,7.8,8.6],['白切鸡饭',180,25,6.4,5.5],['豉油鸡饭',180,25,6.4,5.7]
];
for(const [name,energy,carbs,protein,fat] of campusFoods){
 const code='HK-'+name;
 foodCatalog.push({id:code,code,name,aliases:[name,name.replace(/饭$/,'盖饭')],energy,source:campusSource,unit:'份',portions:{份:350,碗:350,盒:350}});
 macrosPer100[code]=[protein,carbs,fat];
}
for(const [id,name,aliases,kj,protein,carbs,fat,unit,grams] of [
 [277,'油条',['油条'],1627,6.9,51,17.6,'根',70],[269,'花卷',['花卷'],908,6.4,45.6,1,'个',85],
 [1291,'方便面（按干品净重）',['干方便面','方便面干重','方便面面饼'],1983,9.5,61.6,21.1,'包',100],
 [1296,'红烧牛肉方便面（干品含调味料，同类近似）',['红烧牛肉方便面','康师傅红烧牛肉方便面'],1887,10.2,62.6,17.9,'桶',100]
]){
 const code='CN-'+id;
 foodCatalog.push({id:code,code,name,aliases,energy:kj/4.184,source:'https://nlc.chinanutri.cn/fq/foodinfo/'+id+'.html',unit,portions:{[unit]:grams,份:grams,...(id===1296?{包:100}:{})}});
 macrosPer100[code]=[protein,carbs,fat];
}
foodCatalog.push({id:'CN-272',code:'CN-272',name:'馒头（均值）',aliases:['白馒头','馒头'],energy:947/4.184,source:'https://nlc.chinanutri.cn/fq/foodinfo/272.html',unit:'个',portions:{个:100,份:100}});
macrosPer100['CN-272']=[7,47,1.1];
// TFDA open dataset 8543. Per 100 g: kcal, protein, carbohydrate, fat.
const tfndRows=[
["R2300301","冷冻芋泥包","冷凍芋泥包",263,6.6,51.1,3.6],
["R2300501","冷冻芝麻包","冷凍芝麻包",341,7.2,51.7,11.7],
["R2100401","担仔面","擔仔麵",124,4.4,11.9,6.5],
["C2300101","生鲜莲子","生鮮蓮子",141,9.3,25.6,0.5],
["Q4200201","洋芋片","洋芋片",553,5.2,55.8,34.3],
["Q0700201","泡芙(巧克力)","泡芙(巧克力)",590,10.3,46.2,40.4],
["R2100201","泡面(牛肉口味)","泡麵(牛肉口味)",473,9.6,53.6,24.5],
["R2700201","冷冻葱油饼","冷凍蔥油餅",258,9.1,48.5,3.1],
["R2200301","冷冻猪肉韭菜水饺","冷凍豬肉韭菜水餃",229,8.4,23,11.5],
["C2350101","糖渍莲子","糖漬蓮子",230,5.7,51.4,0.1],
["R2600201","冷冻披萨(黑胡椒火腿)","冷凍披薩(黑胡椒火腿)",210,9.3,27.7,6.8],
["R2200401","冷冻猪肉蟹黄水饺","冷凍豬肉蟹黃水餃",223,7.8,26,9.8],
["Q6400501","姜糖","薑糖",359,0.3,84,2.5],
["Q6900301","红豆球","紅豆球",351,7.1,78.4,1],
["Q6900401","绿豆球","綠豆球",346,6.2,77.9,1.1],
["R2200501","冷冻香菇鸡肉水饺","冷凍香菇雞肉水餃",221,9.5,22.7,10.2],
["R2200701","冷冻鲔鱼水饺","冷凍鮪魚水餃",196,9,20.8,8.5],
["C1710201","盐酥带壳花生(熟)","鹽酥帶殼花生(熟)",531,28.2,28.1,38.1],
["P1000501","义式乳酪酱","義式乳酪醬",216,8.8,6.9,17],
["P1301101","法式香蒜酱","法式香蒜醬",791,1.1,3.8,85.7],
["J3100801","台湾蚬","台灣蜆",51,8.9,9.8,1.4],
["J5100101","海蜇皮","海蜇皮",19,4.4,2.2,0],
["B0400301","芋心甘薯","芋心甘薯",122,1.1,28.5,0.1],
["E9300101","过沟菜蕨","過溝菜蕨",27,3.1,3.2,0.8],
["E3850101","梅乾菜","梅乾菜",105,5.5,20.8,1.1],
["E7100101","黄栉瓜","黃櫛瓜",15,1.5,2.7,0.1],
["J0413401","锯尾鲷","鋸尾鯛",93,19,0.3,1.4],
["J0413901","大目鲔","大目鮪",103,23.9,0,0.1],
["J0404404","日本花鲈((11月)","日本花鱸((11月)",99,20.5,0.1,1.3],
["J0404405","日本花鲈((12月)","日本花鱸((12月)",101,19.6,0.4,1.9],
["E6100101","丝瓜花","絲瓜花",31,3.9,4.8,0.3],
["A0351501","菠菜条","菠菜條",356,11.8,74.4,1.2],
["E3201001","油菜心","油菜心",31,3.2,4,0.8],
["J0403107","鲻(12月·雌鱼)","鯔(12月,雌魚)",149,21.8,0.2,6.2],
["E9900401","厥子","厥子",23,2.3,3.9,0.2],
["E9900601","龙延草","龍延草",79,3.9,12.7,2.3],
["D0430101","百香果汁","百香果汁",73,0.9,18.6,0.4],
["J0402101","银鱼","銀魚",69,14.3,0.9,0.9],
["B0400601","黄肉甘薯","黃肉甘薯",121,1.3,27.8,0.2],
["J0400601","魩仔鱼(加工·大)","魩仔魚(加工,大)",97,20.7,1.1,1],
["J0413601","鳞网带鰆切片","鱗網帶鰆切片",272,17.3,0,22],
["J0402201","白肉鲑鱼切片","白肉鮭魚切片",151,22.6,0.3,6.1],
["A0600201","糯高梁","糯高梁",362,10.7,75.7,1],
["G1500201","鲍鱼菇","鮑魚菇",22,1.7,4,0.2],
["J0800201","扁鱼干","扁魚干",354,66.3,1.1,7.9],
["J0707101","鲔鱼肚","鮪魚肚",106,23.4,0,0.7],
["G2000101","洋菇","洋菇",25,3,3.8,0.2],
["G2000201","冷冻洋菇","冷凍洋菇",39,3.8,4.3,1.5],
["J0405401","棕点石斑鱼","棕點石斑魚",115,19.1,0,3.7],
["J0409501","青嘴龙占鱼","青嘴龍占魚",128,22.7,0,3.4],
["J0408901","叶唇笛鲷","葉唇笛鯛",118,19.9,0,3.7],
["J2101201","蓝对虾","藍對蝦",95,20.9,0,0.6],
["H0705102","绿豆","綠豆",344,22.8,63,1.1],
["H0710101","绿豆仁","綠豆仁",339,24.6,59.6,1.3],
["J3101201","菲律宾帘蛤","菲律賓簾蛤",37,7.5,4.1,0.5],
["B0100204","山药(大刺)","山藥(大刺)",85,3.5,17.1,0.1],
["J0401005","虱目鱼(12月)","虱目魚(12月)",192,21.4,0.1,11.2],
["J0401001","虱目鱼(2月)","虱目魚(2月)",180,19.8,1.3,10.6],
["E3201101","油菜","油菜",12,1.4,1.6,0.2],
["E8700101","山苏菜","山蘇菜",26,3,4.4,0.2],
["J0403106","鲻(12月·雄鱼)","鯔(12月,雄魚)",137,21.1,0.9,5.2],
["E1400201","冷冻麻竹笋","冷凍麻竹筍",17,0.8,3.8,0],
["E1800101","嫩茎莴苣","嫩莖萵苣",16,1,3.1,0.2],
["J0409904","真鲷(8月)","真鯛(8月)",176,20.6,1.7,9.8],
["J0415304","银鲳(8月)","銀鯧(8月)",101,17.7,1.6,2.9],
["E9900101","美国空心菜","美國空心菜",22,2.2,3.5,0.3],
["A0351801","刀削面","刀削麵",267,8.4,56.2,0.9],
["E9900201","香芫荽","香芫荽",23,2.4,3.9,0.2],
["J0414901","旗鱼切片","旗魚切片",111,26,0.8,0],
["E0510101","乾百合鳞片","乾百合鱗片",304,11.8,68.4,0.7],
["F0410101","乾麒麟菜","乾麒麟菜",189,1.2,46.7,0.5],
["F0400101","麒麟菜","麒麟菜",41,0.9,9.9,0],
["J0416401","低眼无齿芒鱼片(芒加鱼边)","低眼無齒芒魚片(芒加魚邊)",76,14.2,0,1.7],
["J0407001","布氏鲳鰺(去皮)","布氏鯧鰺(去皮)",192,20.3,0,11.7],
["H0450101","红豆罐头(糖渍)","紅豆罐頭(糖漬)",232,8,49.5,0.3],
["H0305101","花豆","花豆",328,21.2,59,1.7],
["H0350101","花豆罐头(糖渍)","花豆罐頭(糖漬)",203,7.6,43.5,0],
["J2100401","胭脂虾","胭脂蝦",114,13.8,0.7,6.1],
["J0400901","日本银带鲱(加工)","日本銀帶鯡(加工)",111,21.5,1.2,2.1],
["H0800101","豇豆(荚)","豇豆(莢)",35,2.4,6.2,0.1],
["H1300101","鹊豆荚","鵲豆莢",31,2.4,5.1,0.3],
["K0121101","鸡铁蛋","雞鐵蛋",288,26.6,5.9,17.5],
["K0120101","鸡卤蛋(市售)","雞滷蛋(市售)",191,15.7,6.4,11.4],
["K0400101","鸽蛋","鴿蛋",96,10.2,2.5,5.7],
["B0100209","山药(尖石原生种)","山藥(尖石原生種)",65,3.1,12.4,0.1],
["K0100101","鸡蛋(白壳)","雞蛋(白殼)",139,12.9,1.3,9.2],
["K0123201","荷包蛋(加油1小匙)","荷包蛋(加油1小匙)",192,13,1.6,14.9],
["K0123101","荷包蛋(不加油)","荷包蛋(不加油)",162,14,1.4,11.2],
["L0324101","中脂凝态发酵乳(草莓)","中脂凝態發酵乳(草莓)",102,3.7,15.7,2.7],
["L0316101","低脂浓稠发酵乳","低脂濃稠發酵乳",73,2.3,13.6,1.1],
["D2400501","黑李","黑李",57,0.7,14.7,0.2],
["A0550301","米苔目","米苔目",121,0.6,29.6,0.1],
["D4000101","人心果","人心果",83,0.6,20.5,0.8],
["D1100203","金钻凤梨","金鑽鳳梨",50,0.5,13.2,0.1],
["D0900101","酪梨(绿皮)","酪梨(綠皮)",65,1.6,7.9,3.7],
["A05010","胚芽粳米平均值","胚芽粳米平均值",362,8.2,76.8,1.6],
["A05011","发芽粳米平均值","發芽粳米平均值",355,7.8,74,2.3],
["A05005","白粳糯米平均值","白粳糯米平均值",358,8.3,77.4,0.8],
["L01021","全脂鲜乳平均值","全脂鮮乳平均值",63,3.1,4.8,3.6],
["K01113","鸡皮蛋平均值","雞皮蛋平均值",127,12.5,3,8.1],
["D3400201","红柑","紅柑",42,0.8,10.6,0.1],
["E7400201","黄番茄","黃番茄",23,0.9,5.3,0],
["D3200401","加拉苹果","加拉蘋果",55,0.2,15,0.1],
["D3300201","白樱桃","白櫻桃",69,0.7,18.4,0.1],
["D0300101","安石榴","安石榴",67,1.7,16.8,0.1],
["E1700101","白芦笋","白蘆筍",25,1.8,4.9,0.2],
["E1700201","绿芦笋","綠蘆筍",22,1.3,4.5,0.2],
["D18001","莲雾平均值(粉红色种)","蓮霧平均值(粉紅色種)",35,0.4,9,0.2],
["D11002","凤梨平均值(杂交种)","鳳梨平均值(雜交種)",53,0.7,13.6,0.1],
["E3201205","土植青江菜(10月取样)","土植青江菜(10月取樣)",12,1.4,1.6,0.2],
["E3201201","土植青江菜(1月取样)","土植青江菜(1月取樣)",10,1.3,1.6,0],
["A0410201","玉米胚芽","玉米胚芽",366,7,80.3,0.9],
["R2800101","韭菜盒子","韭菜盒子",217,7.5,19.5,12.1],
["P1300901","花生酱","花生醬",657,24,17.9,54.3],
["R6700401","天妇罗","天婦羅",176,12.4,21,4.7],
["R2800201","大饼包小饼(红豆)","大餅包小餅(紅豆)",376,8.3,48.5,16.5],
["Q4200301","鱼酥","魚酥",564,8.3,50.3,36.6],
["R2700401","烧饼","燒餅",323,9.1,51.1,9.1],
["R0900201","冷冻花生汤圆","冷凍花生湯圓",350,5.2,47.1,15.6],
["R5900201","冷冻咕咾肉","冷凍咕咾肉",184,6.4,18.3,9.5],
["R6100201","冷冻虱目鱼丸","冷凍虱目魚丸",206,13.7,11,11.9],
["R5400201","冷冻贡丸","冷凍貢丸",244,16.6,0,20.3],
["R6700601","冷冻花枝羹","冷凍花枝羹",126,11.4,9.4,4.7],
["R6700201","冷冻鱼卵卷","冷凍魚卵卷",115,12.9,15.5,0.2],
["Q6200201","黑芝麻糖","黑芝麻糖",536,8.5,57,30.4],
["Q6200101","白芝麻糖","白芝麻糖",521,8.4,62.9,26.2],
["C1610201","黑芝麻(熟)","黑芝麻(熟)",599,17.3,20.6,54.4],
["R6400101","冷冻蚵卷","冷凍蚵捲",213,6.9,7,17.5],
["Q1000201","土司(含全谷粉)","土司(含全穀粉)",292,10,49.2,6.1],
["O0100301","柳橙汁(非原汁)","柳橙汁(非原汁)",50,0.1,12.3,0.1],
["O0100801","葡萄柚汁(非原汁)","葡萄柚汁(非原汁)",41,0.2,9.7,0.2],
["P1500301","蒸肉粉(五香)","蒸肉粉(五香)",350,10.3,74.8,1.1],
["C1705301","带膜花生仁(生)","帶膜花生仁(生)",516,23.6,28.4,38.1],
["P1500401","热狗粉","熱狗粉",355,8.3,78.4,0.9],
["G1300203","杏鲍菇(小)","杏鮑菇(小)",47,3.2,9.2,0.3],
["G1200201","天喜菇","天喜菇",26,4.5,2.5,0.5],
["J0405501","鞍带石斑鱼片","鞍帶石斑魚片",155,19.1,0.2,8.2],
["J3100101","竹蛏(冷冻)","竹蟶(冷凍)",42,9,1.2,0.3],
["Q1000301","红豆土司","紅豆土司",319,9.2,47.7,10.2],
["A1100101","红藜","紅藜",379,12.1,66.8,6.7],
["D3300101","樱桃","櫻桃",75,1.2,19.1,0.3],
["I04061","二节翅平均值","二節翅平均值",226,18.1,0,16.4],
["R4701001","冷冻豆腐","冷凍豆腐",131,12.9,3.9,7.1],
["R4700901","传统豆腐","傳統豆腐",88,8.5,6,3.4],
["R4701201","嫩豆腐","嫩豆腐",53,4.9,1.6,3],
["Q8100601","柠檬果乾","檸檬果乾",344,0.8,84.6,0.2],
["R4800101","素肉","素肉",210,23.9,6,10.1],
["O0901601","抹茶粉","抹茶粉",361,23.4,63,6.4],
["E9920101","小麦草粉","小麥草粉",314,34,41.9,7.4],
["P0102201","花椒粒","花椒粒",368,10.3,53.6,12.5],
["E5800402","青花菜(2021年取样)","青花菜(2021年取樣)",38,3.4,6.5,0.4],
["P1100202","无蛋沙拉酱(2021年取样)","無蛋沙拉醬(2021年取樣)",631,0.3,22.9,59.8],
["D0800102","北蕉(5月取样)","北蕉(5月取樣)",92,1.6,23.7,0.2],
["I01101","牛肉火锅片平均值","牛肉火鍋片平均值",250,19.1,0,18.7],
["D0800104","北蕉(11月取样)","北蕉(11月取樣)",90,1.6,23.4,0.1],
["K0120802","鸡卤蛋黄(浸泡隔夜)","雞滷蛋黃(浸泡隔夜)",382,17.4,2.6,33.6],
["B0100205","山药(中国长品)","山藥(中國長品)",74,2.5,15.5,0.1],
["I0520801","鸭舌","鴨舌",187,16,0,13.2],
["J0411301","黑斑海绯鲤","黑斑海緋鯉",97,18.8,0,1.8],
["J0415801","双线须鳎","雙線鬚鰨",92,19.9,0.3,0.8],
["J0407701","蓝圆鰺","藍圓鰺",114,24,0,1.3],
["J0402901","狗母鱼(蛇鲻)","狗母魚(蛇鯔)",103,20.8,0.1,1.6],
["B0100213","山药(高田)","山藥(高田)",71,3.1,14,0.1],
["Q6900201","羊乳片","羊乳片",410,23.4,56.6,10],
["A0320405","高筋面粉(2021年取样)","高筋麵粉(2021年取樣)",362,13.8,72.2,1.3],
["E3000104","甘蓝(圆球形)(2021年取样)","甘藍(圓球形)(2021年取樣)",20,0.8,4.6,0],
["R5100201","切片火腿(牛肉)","切片火腿(牛肉)",121,15.9,9.4,2.2],
["R5300402","鸡肉香肠(小)","雞肉香腸(小)",459,13.9,15.9,37.7],
["I9900101","虎皮蛙","虎皮蛙",94,21.1,0.6,0.4],
["J2100601","相模後海螯虾","相模後海螯蝦",79,17.9,0,0.3],
["J2101601","螳螂虾","螳螂蝦",67,14.7,0,0.5],
["J0403901","石狗公","石狗公",80,18.3,0,0.2],
["P1004201","辣豆瓣酱","辣豆瓣醬",100,4.5,13.1,3.3],
["C0205101","松子仁(生)","松子仁(生)",678,16.6,9.4,69.5],
["P1003201","辣椒酱","辣椒醬",83,2.6,11.5,2.9],
["D0800601","李林蕉(2007年取样)","李林蕉(2007年取樣)",102,1.4,26.3,0.3],
["D3200402","津经蜜苹果","津經蜜蘋果",56,0.2,15.1,0.2],
["D2700201","富有甜柿(大雪山)","富有甜柿(大雪山)",57,0.4,15.1,0.1],
["P0101801","辣椒粉","辣椒粉",387,14.7,59.1,14.1],
["P0200201","沙茶粉","沙茶粉",507,14.9,47,28.8],
["I0102101","板腱","板腱",166,19.8,0.2,9],
["R5100101","叉烧肉","叉燒肉",253,17.2,16.5,13.1],
["G0110102","乾木耳(黑耳仔)","乾木耳(黑耳仔)",338,21.4,69.6,1.2],
["G0250101","银耳罐头","銀耳罐頭",48,0.1,12,0.1],
["G0700101","柳松菇","柳松菇",36,3.7,6,0.3],
["J0403201","鲻(含皮)","鯔(含皮)",155,20.6,0,7.4],
["H1700101","树豆(白)","樹豆(白)",325,22.1,59.4,0.8],
["D4600101","菠萝蜜","菠蘿蜜",108,1,28.4,0.2],
["D20004","甜瓜平均值(网纹洋香瓜)","甜瓜平均值(網紋洋香瓜)",37,0.9,9.3,0],
["D31001","印度枣平均值(大)","印度棗平均值(大)",43,1.1,10.7,0.1],
["D20002","甜瓜平均值(东洋系脆瓜)","甜瓜平均值(東洋系脆瓜)",37,1,8.9,0.2],
["P1200101","味噌","味噌",215,10.6,33.1,4.5],
["P0300101","岩盐","岩鹽",2,0,0.4,0.1],
["E0420101","萝卜乾","蘿蔔乾",58,2.2,10.8,1.2],
["E0200101","胡萝卜","胡蘿蔔",37,1,8.5,0.2],
["E0200103","澳洲胡萝卜(细长型)","澳洲胡蘿蔔(細長型)",34,1.7,7.5,0.1],
["L0207201","脱脂奶粉(即溶)","脫脂奶粉(即溶)",360,38,48.8,1],
["P1400201","奶精粉","奶精粉",544,2.2,59.5,33],
["Q2200101","巧克力冰淇淋","巧克力冰淇淋",192,4.2,19.9,10.6],
["E2400201","紫洋葱","紫洋蔥",32,0.9,7.3,0.1],
["E2100201","青蒜","青蒜",33,2.1,6.4,0.3],
["E2100101","大蒜","大蒜",122,6.7,26.4,0.2],
["I0320601","猪血","豬血",29,6.3,0.5,0.3],
["I0320801","猪肝","豬肝",137,20.8,1.7,5.3],
["R5200201","片状肉乾(猪肉)","片狀肉乾(豬肉)",329,30,41,5],
["D32001","苹果平均值(青皮)","蘋果平均值(青皮)",49,0.3,13,0.2],
["D32004","苹果平均值(混色)","蘋果平均值(混色)",51,0.2,13.9,0.1],
["I01201","牛肚平均值","牛肚平均值",56,11.4,0.1,0.8],
["I04021","里肌肉平均值","里肌肉平均值",109,24.2,0,0.6],
["L0116101","低脂强化鲜乳(维生素E强化)","低脂強化鮮乳(維生素E強化)",41,3,4.2,1.3],
["O0901101","杏仁茶冲泡包","杏仁茶沖泡包",399,3.5,84.7,5.2],
["L0154201","中脂调味保久乳(布丁)","中脂調味保久乳(布丁)",61,1.6,9.8,1.7],
["E3200701","水植小白菜(1月取样)","水植小白菜(1月取樣)",13,1.5,2.1,0.1],
["E3200801","有机小白菜(1月取样)","有機小白菜(1月取樣)",9,1.8,0.8,0.2],
["E3200603","土植小白菜(4月取样)","土植小白菜(4月取樣)",13,1.1,2.2,0.2],
["I0321601","猪肾","豬腎",82,15,1.7,1.9],
["R5100601","条状火腿(猪肉)","條狀火腿(豬肉)",145,16.2,11.5,3.8],
["J3500701","软翅仔","軟翅仔",70,14.7,0.8,0.8],
["J0702101","鲻鱼精囊","鯔魚精囊",89,17.3,0,1.7],
["J3100501","绿壳菜蛤","綠殼菜蛤",96,17.8,2.6,2.2],
["Q1000901","葡萄乾奶酥面包","葡萄乾奶酥麵包",306,8.4,50.4,7.9],
["D1500101","土芭乐","土芭樂",39,0.7,10,0.1],
["Q4200101","玉米饼乾(原味)","玉米餅乾(原味)",504,7.6,63.8,24.3],
["J0412701","福氏鹦哥鱼(去皮)","福氏鸚哥魚(去皮)",84,19.6,0.2,0],
["J0409906","真鲷(11月)","真鯛(11月)",105,20.3,0,2],
["Q1001201","双胞胎面包","雙胞胎麵包",341,8.4,59.6,7.7],
["J0500101","长体油胡瓜鱼(柳叶鱼)(裹粉未炸)","長體油胡瓜魚(柳葉魚)(裹粉未炸)",171,12.9,19,4.9],
["J2100902","白对虾(小)","白對蝦(小)",96,21.4,0,0.5],
["J0415305","银鲳(12月)","銀鯧(12月)",126,19.1,0.2,5],
["M1000102","人造奶油(2021年取样)","人造奶油(2021年取樣)",722,0.1,1.7,81.7],
["P1100102","沙拉酱(2021年取样)","沙拉醬(2021年取樣)",630,1.9,16.8,61.7],
["E23001","青葱平均值","青蔥平均值",28,1.4,6,0.2],
["E30001","甘蓝平均值","甘藍平均值",23,1.3,4.8,0.1],
["D1900201","皇宫西瓜","皇宮西瓜",32,0.7,8.1,0.1],
["I03214","猪骨汤平均值","豬骨湯平均值",8,0.9,0,0.4],
["D0200103","木瓜(8月取样)","木瓜(8月取樣)",33,0.5,8.8,0],
["I04062","三节翅平均值","三節翅平均值",210,18.3,0,14.6],
["J2600101","蟹脚肉","蟹腳肉",53,11.6,1.2,0.3],
["B0500301","槟榔心芋","檳榔心芋",121,1.3,28.1,0],
["J0415001","刺鲳(去皮)","刺鯧(去皮)",95,18.8,0.1,1.6],
["G1200301","白蚝菇","白蠔菇",33,2.2,6.4,0.3],
["G0200201","白毛木耳","白毛木耳",45,1.2,10.6,0.1],
["G0600101","白精灵菇","白精靈菇",36,2.1,6.9,0.4],
["J0400301","日本鳗鲡鱼片(蒲烧)","日本鰻鱺魚片(蒲燒)",276,25,0.9,18.7],
["J0416201","翻车魨腹肉","翻車魨腹肉",47,10.2,0.7,0.4],
["J0413001","金钱鱼","金錢魚",196,19.3,0,12.6],
["J0409201","星鸡鱼","星雞魚",99,20.6,0.4,1.2],
["O0901301","综合坚果谷物冲泡包","綜合堅果穀物沖泡包",453,13.3,65.4,15.4],
["O0900201","咖啡冲泡包(二合一)","咖啡沖泡包(二合一)",491,6.8,63.6,23.3],
["P1100401","和风沙拉酱","和風沙拉醬",129,2.1,26.3,1.7],
["J0412901","蓝点鹦哥鱼","藍點鸚哥魚",86,20.1,0.6,0.1],
["Q4100301","卷心酥","捲心酥",490,6.1,71.7,19.9],
["Q4200401","零食泡面","零食泡麵",484,11.3,61.3,21.5],
["A0355101","面筋","麵筋",643,42.5,0,53],
["A0300101","小麦","小麥",362,14.1,69.2,2.6],
["L0500401","乾酪粉","乾酪粉",484,40.4,3.1,34],
["L1154101","中脂调味保久羊乳(巧克力)","中脂調味保久羊乳(巧克力)",59,1.1,10.3,1.5],
["E6400101","胡瓜","胡瓜",14,0.7,2.9,0.1],
["E6400201","花胡瓜","花胡瓜",13,0.9,2.4,0.2],
["C0510101","糖炒栗子","糖炒栗子",210,4.2,46.3,0.8],
["A0352101","卫生油面","衛生油麵",163,5.5,31.2,1.8],
["O0600501","沙士(低糖)","沙士(低糖)",43,0,10.9,0],
["E0700101","金针菜嫩茎","金針菜嫩莖",24,0.7,5.3,0.2],
["E7800101","苜蓿芽","苜蓿芽",20,3.2,2.5,0.2],
["E8200101","葵花芽","葵花芽",26,2.5,4.3,0.4],
["I0110103","牛梅花肉火锅片","牛梅花肉火鍋片",120,20.3,0.9,3.7],
["I0500301","太空鸭(去皮)","太空鴨(去皮)",102,20.1,0,1.8],
["I0210401","小羊腰脊肉","小羊腰脊肉",143,26.5,0,3.3],
["O0701201","乌龙茶(去冰·全糖)","烏龍茶(去冰,全糖)",36,0.1,8.8,0],
["O0701101","乌龙茶(去冰·半糖)","烏龍茶(去冰,半糖)",21,0.1,5.2,0],
["O0701001","乌龙茶(去冰·微糖)","烏龍茶(去冰,微糖)",16,0.1,3.8,0],
["P1001701","沙茶酱","沙茶醬",729,10.2,10.4,71.8],
["P1001801","素沙茶酱","素沙茶醬",670,7.5,11.4,66],
["P1004101","豆瓣酱","豆瓣醬",178,14.2,12.2,8.1],
["A0320202","低筋面粉","低筋麵粉",364,8.1,78.2,1.2],
["F0810201","乾裙带菜根","乾裙帶菜根",201,6.2,46.1,0.6],
["F0210101","紫菜","紫菜",268,28.1,47.9,0.9],
["J0410001","黄鳍棘鲷","黃鰭棘鯛",136,19.2,0.6,6],
["J0402001","香鱼","香魚",147,18.5,0,7.5],
["P1002801","黑胡椒酱","黑胡椒醬",117,2.5,25.5,0.5],
["P0101901","姜黄粉","薑黃粉",358,14.6,69,2.7],
["J0401004","虱目鱼(9月)","虱目魚(9月)",208,22,0,12.7],
["B0900201","熟莲藕","熟蓮藕",50,1.1,11,0.1],
["I0404501","去皮去骨鸡腿(肉鸡)","去皮去骨雞腿(肉雞)",165,19.8,0,8.9],
["H1150701","DHA豆奶","DHA豆奶",44,1.7,8,0.5],
["I0421001","鸡皮(肉鸡)","雞皮(肉雞)",442,11.7,0,43.4],
["J0403102","鲻(4月)","鯔(4月)",133,20.4,0.9,5],
["J4100201","仿刺参","仿刺參",36,8.2,0.8,0.1],
["J0700701","鲣鱼卵","鰹魚卵",184,21.5,0.6,10.2],
["J0600701","鱼浆(旗鱼)","魚漿(旗魚)",110,16.8,7.8,1.3],
["E3800501","抱子芥菜","抱子芥菜",21,2.1,3.8,0.1],
["D4500101","黄金果","黃金果",44,0.9,11,0.2],
["I1000101","山猪肉","山豬肉",466,11.9,0,46],
["J3501101","雪螺","雪螺",40,8.9,0,0.3],
["J0403103","鲻(8月)","鯔(8月)",224,17.3,0,16.7],
["G0110103","乾川耳","乾川耳",321,12.7,71.5,1],
["C1610102","白芝麻(熟)2022年取样)","白芝麻(熟)2022年取樣)",601,21.7,21.2,52.4],
["D2310101","龙眼乾","龍眼乾",276,5.1,70.9,0.5],
["D1200101","释迦","釋迦",104,2.2,26.6,0.1],
["Q9100202","豆干片(沙茶)","豆干片(沙茶)",464,16.2,36.4,28.2],
["Q9100101","豆干丁(五香)","豆干丁(五香)",383,35.4,19.6,18.1],
["Q0900201","海绵蛋糕(圆形)","海綿蛋糕(圓形)",344,5.1,40.2,18.1],
["O0901401","豆浆粉","豆漿粉",434,37.4,32.5,17.1],
["H1150301","鸡蛋豆浆","雞蛋豆漿",56,1.9,9.2,1.3],
["R2800301","水煎包","水煎包",166,4.3,25.2,5.4],
["R2800501","猪肉馅饼","豬肉餡餅",327,6.2,23.1,23.3],
["A0950102","荞麦面(湿)","蕎麥麵(濕)",155,6.3,28.6,1.5],
["A0352201","金门黄面","金門黃麵",158,6.4,31.9,0.5],
["G0200101","银耳","銀耳",22,0.5,4.8,0.2],
["G1600201","华翠菇","華翠菇",29,2.5,5.1,0.2],
["H0610101","黑豆胚芽","黑豆胚芽",174,19.2,11.8,7.1],
["C1410101","咖啡豆(曼特宁)","咖啡豆(曼特寧)",437,13.9,65.1,14.9],
["H1150401","咸豆浆","鹹豆漿",37,3.5,1.7,1.8],
["D0800401","北蕉(3天)","北蕉(3天)",84,1.4,21.3,0.3],
["D0800501","北蕉(7天)","北蕉(7天)",68,1.3,17.1,0.2],
["F9900201","寿司海苔片","壽司海苔片",278,46.5,32.1,3.7],
["F0110101","红毛苔","紅毛苔",265,39.9,36.9,1.9],
["F0910101","凤尾藻","鳳尾藻",224,17.9,41.2,2],
["E6300103","栗子南瓜","栗子南瓜",86,1.4,20.7,0.2],
["K0320101","鹌鹑卤蛋","鵪鶉滷蛋",200,16.2,11.1,14.3],
["R6800401","旗鱼松","旗魚鬆",481,31.3,37.4,22.9],
["R6800501","鲑鱼松","鮭魚鬆",452,29,35.3,21.6],
["J0600601","鲨鱼皮","鯊魚皮",58,13.5,0,0.1],
["O9900301","椰奶","椰奶",49,0.2,7.4,2.1],
["O0901001","植物燕麦奶","植物燕麥奶",437,11.9,67.5,13.2],
["P0400401","鲣鱼粉","鰹魚粉",240,21.9,35.8,1],
["D19004","西瓜平均值(黄肉小瓜)","西瓜平均值(黃肉小瓜)",29,0.7,7.3,0],
["D24001","李子平均值(青皮黄肉)","李子平均值(青皮黃肉)",48,0.7,11.7,0.4],
["D24002","李子平均值(红皮红肉)","李子平均值(紅皮紅肉)",39,0.6,9.6,0.3],
["J0404401","日本花鲈(2月)","日本花鱸(2月)",95,20.1,1.9,1],
["J0404402","日本花鲈((3月)","日本花鱸((3月)",100,20,0.5,1.6],
["J0400603","魩仔鱼(加工)","魩仔魚(加工)",105,23,0,0.8],
["H0900201","莱豆仁(去膜)","萊豆仁(去膜)",137,7.4,24.7,1.4],
["P1301201","无糖黑芝麻酱","無糖黑芝麻醬",612,20.7,17.7,56],
["J0403101","鲻(2月)","鯔(2月)",137,20.4,1.6,5.5],
["D1500204","泰国芭乐","泰國芭樂",38,0.8,9.7,0.1],
["R2201501","熟水饺(高丽菜水饺)","熟水餃(高麗菜水餃)",199,7.4,19.7,10.1],
["Q0900701","黑森林蛋糕","黑森林蛋糕",277,4.2,25,17.8],
["C1750501","盐酥花生仁","鹽酥花生仁",557,28.8,29.6,35.9],
["O0100901","凤梨汁(非原汁)","鳳梨汁(非原汁)",48,0.3,11.3,0.2],
["Q4900101","沙其马","沙其馬",487,5.6,60.2,24.8],
["Q2100101","仙草冻","仙草凍",19,0.9,3.7,0.1],
["Q4300101","雪饼","雪餅",487,5.8,72.3,19.4],
["D3600102","香吉士(进口)","香吉士(進口)",47,0.7,11.4,0.5],
["R2900301","冷冻·水晶饺","冷凍,水晶餃",190,2.8,36.8,3.5],
["A0501104","发芽粳米(台粳9号)","發芽粳米(台粳9號）",353,8.2,74.1,1.9],
["A0352301","冷冻乌龙面","冷凍烏龍麵",129,3.4,28.2,0.3],
["J2101101","草对虾","草對蝦",100,22,1,0.7],
["E0200201","黄胡萝卜","黃胡蘿蔔",42,1.1,9.4,0.3],
["G1300201","杏鲍菇(大)","杏鮑菇(大)",37,2.4,7.5,0.1],
["I0321901","猪小肠","豬小腸",156,12.5,0.6,11.4],
["I0321801","猪大肠","豬大腸",198,6.6,1.9,18.9],
["I0320101","猪心","豬心",128,13.6,1,7.8],
["J0600401","鱼翅唇","魚翅唇",47,9.9,0,0.6],
["Q8100301","芒果乾","芒果乾",371,0.6,90,1],
["Q8100201","芒果青","芒果青",223,0.6,54.2,0.4],
["F0310101","发菜","髮菜",302,10.3,69.5,0.5],
["F9900101","洋菜","洋菜",306,0.3,78.3,0],
["F0210102","熟紫菜","熟紫菜",294,18.1,62.4,0.4],
["J0402301","红肉鲑鱼切片","紅肉鮭魚切片",248,24.3,0,16],
["J0414301","康氏马加鰆切片(去皮)","康氏馬加鰆切片(去皮)",193,18.7,0,12.5],
["G1200101","秀珍菇","秀珍菇",28,3.3,4.6,0.1],
["G1250101","秀珍菇罐头","秀珍菇罐頭",27,1.7,4.7,0.5],
["J2100201","北方长额虾(加工)","北方長額蝦(加工)",122,19.9,2.7,4.1],
["J0404201","尖嘴鲈(去皮)","尖嘴鱸(去皮)",98,20.6,0.1,1.2],
["G2050101","洋菇罐头","洋菇罐頭",27,2.9,4.3,0.3],
["G2300101","猴头菇","猴頭菇",30,2.1,5.9,0.2],
["J3101301","环文蛤","環文蛤",46,8.7,3.7,1],
["J3100202","带壳真牡蛎(生蚝)","帶殼真牡蠣(生蠔)",59,9.8,6.7,1.9],
["A0400101","白玉米","白玉米",66,3.4,11.4,0.6],
["H0720101","绿豆粉","綠豆粉",344,21.7,62.9,1.5],
["H0105101","白凤豆(台湾)","白鳳豆(台灣)",348,27.4,56.4,2.8],
["H0105102","白凤豆(进口)","白鳳豆(進口)",325,20.1,60,1.3],
["G1010101","乾姬松茸","乾姬松茸",294,34,46.7,2.7],
["K0500102","鹅蛋","鵝蛋",179,10,3.2,15],
["B0100212","山药(青森)","山藥(青森)",94,2.6,19.9,0.2],
["A0200101","小米","小米",370,11.3,71.7,3.7],
["I0404302","棒棒腿(肉鸡)","棒棒腿(肉雞)",159,16.8,0.3,9.7],
["I0404201","清腿(土鸡)","清腿(土雞)",142,20.4,0,6.1],
["I0404202","清腿(肉鸡)","清腿(肉雞)",173,16.6,0,11.3],
["K0111601","鸡水煮蛋白","雞水煮蛋白",61,13.6,1.5,0.2],
["K0111801","鸡水煮蛋黄","雞水煮蛋黃",343,15.5,2.9,30.5],
["K0150101","煎蛋(不加油)","煎蛋(不加油)",161,13.5,4.9,11.3],
["K0150201","炒蛋(加油3大匙)","炒蛋(加油3大匙)",215,12.9,4.6,16.1],
["I0500401","土番鸭","土番鴨",111,20.9,0,2.4],
["I9900201","蛇肉","蛇肉",85,19,0,0.4],
["I0600101","鹅肉","鵝肉",187,15.6,2.4,13.4],
["L0308101","脱脂稀释发酵乳","脫脂稀釋發酵乳",68,1.1,15.8,0.1],
["L0318301","脱脂浓稠发酵乳(草莓)","脫脂濃稠發酵乳(草莓)",68,2.3,13.8,0.4],
["L0114101","中脂强化鲜乳(脂肪酸调整)","中脂強化鮮乳(脂肪酸調整)",59,2,8.6,2],
["C1210101","玉桂西瓜子","玉桂西瓜子",492,31.1,23.8,34.4],
["J0415601","大口鰜切片(含皮)","大口鰜切片(含皮)",166,14.7,0,11.5],
["G0210101","乾银耳","乾銀耳",310,9.3,70.8,1.2],
["J0700601","鰆鱼卵","鰆魚卵",193,23.5,0.2,10.2],
["G0950101","腌渍香菇","醃漬香菇",50,3,10.6,0.1],
["A0352001","意面","意麵",290,10.1,60.1,1],
["J0408001","斯氏长鳍乌鲂","斯氏長鰭烏魴",97,22.4,0,0.1],
["J0405001","青星九刺鮨","青星九刺鮨",83,19.3,0.5,0.1],
["D28002","脆桃平均值","脆桃平均值",44,0.9,11.1,0.1],
["E74006","小番茄平均值(橙色系)","小番茄平均值(橙色系)",31,1.1,6.9,0.2],
["G13002","杏鲍菇平均值","杏鮑菇平均值",41,2.7,8.3,0.2],
["J3101101","波纹横帘蛤","波紋橫簾蛤",48,9.2,4.6,1],
["L0204101","部份脱脂奶粉","部份脫脂奶粉",420,32.8,46.1,11.6],
["L0217201","脱脂强化奶粉(钙&维生素A强化)","脫脂強化奶粉(鈣&維生素A強化)",360,38,48.8,1],
["L0211101","全脂强化奶粉(纤维强化)","全脂強化奶粉(纖維強化)",500,25.6,39.5,27],
["L0102101","全脂鲜乳(1月取样)","全脂鮮乳(1月取樣)",62,2.9,4.7,3.6],
["L0102102","全脂鲜乳(4月取样)","全脂鮮乳(4月取樣)",62,2.9,4.6,3.6],
["Q2102201","烤布丁","烤布丁",138,4.7,13.8,7.1],
["E75001","甜椒平均值(青皮)","甜椒平均值(青皮)",29,1,5.9,0.4],
["E75006","红辣椒平均值","紅辣椒平均值",80,3.6,16.4,0.9],
["L0314201","中脂浓稠发酵乳(无糖&纤维强化)","中脂濃稠發酵乳(無糖&纖維強化)",74,3.2,10.4,2.2],
["L0324201","中脂凝态发酵乳(芦荟)","中脂凝態發酵乳(蘆薈)",90,1.7,15.1,2.5],
["L0224101","部份脱脂调味奶粉(巧克力)","部份脫脂調味奶粉(巧克力)",406,14.1,71.9,6.9],
["M1200101","玉米油","玉米油",883,0,0.1,99.8],
["M1100101","大豆油","大豆油",884,0,0,100],
["I0520101","鸭血","鴨血",29,6,0,0.3],
["R5100901","腊肉(五花肉)","臘肉(五花肉)",525,18.4,2.4,49],
["M1000301","人造奶油(低热量)","人造奶油(低熱量)",94,2.5,29.6,10.6],
["Q2300101","花生仁汤","花生仁湯",108,2.8,12.7,5.1],
["M1900101","南瓜籽油","南瓜籽油",883,0,0,99.9],
["O0900301","咖啡冲泡包(三合一)","咖啡沖泡包(三合一)",437,4.8,83,9.5],
["E3200201","荷叶白菜","荷葉白菜",14,1.4,2.5,0.1],
["E3200401","黑叶白菜(短梗)","黑葉白菜(短梗)",15,1.3,2.9,0],
["E1400101","麻竹笋","麻竹筍",21,2.1,3.7,0.2],
["E3010201","甘蓝乾","甘藍乾",180,7.2,38.9,1.1],
["E3000201","紫色甘蓝","紫色甘藍",28,1.5,5.9,0.2],
["E5000101","菠菜","菠菜",18,2.2,2.4,0.3],
["E3700101","山芹菜","山芹菜",27,2.8,0.4,2.2],
["E4600101","茼蒿","茼蒿",16,1.7,2.2,0.3],
["J0400401","灰海鳗","灰海鰻",97,20.5,0,1],
["J0414804","鲭鱼(烤·150度·20分)","鯖魚(烤,150度,20分)",396,19.1,0,34.8],
["J0414805","鲭鱼(烤·150度·30分)","鯖魚(烤,150度,30分)",536,19.9,0,50],
["J0414806","鲭鱼(烤·180度·10分)","鯖魚(烤,180度,10分)",373,20.2,0,31.8],
["A0500201","粳米(台中189号)","粳米(台中189號)",356,7.5,78.1,0.6],
["E3400201","红凤菜","紅鳳菜",22,2.1,3.5,0.4],
["J3700201","咸小卷","鹹小卷",98,20.1,1.9,1.3],
["J4100101","白海参","白海參",32,7.4,0,0.1],
["B0320101","木薯粉","木薯粉",362,0.1,87.3,0.2],
["J0405301","斑点九刺鮨(含皮)","斑點九刺鮨(含皮)",84,19.4,0,0.1],
["J0403401","斑鱵","斑鱵",91,20.6,0.3,0.3],
["P1000201","牛肉酱","牛肉醬",507,17,22.2,38.9],
["P1100501","凯撒沙拉酱","凱撒沙拉醬",337,1.4,17.3,29.1],
["P0201101","椰浆","椰漿",208,1.1,0,23.1],
["Q4100601","营养口粮","營養口糧",424,6.8,79.7,8.7],
["Q4100701","苏打饼乾(蔬菜)","蘇打餅乾(蔬菜)",512,7.8,64.5,24.7],
["R9900201","陈年绍兴酒","陳年紹興酒",133,1.8,19.1,0],
["Q9900301","起酥片","起酥片",404,6.7,33.8,26.9],
["A0950101","荞麦面(乾)","蕎麥麵(乾)",355,12.7,70.6,1.7],
["D3700401","黄皮葡萄柚","黃皮葡萄柚",37,0.7,9.2,0.2],
["C0905101","原味榛果","原味榛果",672,13,17.2,66.5],
["E7400603","橙蕃茄","橙蕃茄",32,1.2,7,0.2],
["E38004","芥菜平均值","芥菜平均值",19,1.5,3.5,0.2],
["E33001","结球白菜平均值","結球白菜平均值",17,1.2,2.9,0.3],
["E37002","芹菜平均值","芹菜平均值",15,0.8,3.1,0.1],
["D2000301","新世纪哈密瓜","新世紀哈密瓜",39,0.7,10.1,0],
["D2100101","土芒果","土芒果",54,0.6,13.8,0.3],
["R5100801","培根","培根",372,13.5,0,35.6],
["R5300501","热狗","熱狗",257,13.3,10.2,18.1],
["H0705101","毛绿豆","毛綠豆",346,22.1,63.6,1.2],
["H0505101","红云豆(大红豆)","紅雲豆(大紅豆)",328,20.2,60.4,1.4],
["D1100201","甘蔗凤梨","甘蔗鳳梨",57,0.7,15.1,0.1],
["D1100204","牛奶凤梨","牛奶鳳梨",60,0.8,15.4,0.3],
["D2400305","桃接李(大)","桃接李(大)",38,0.6,9.2,0.3],
["D2400102","翡翠李","翡翠李",48,0.7,11.4,0.5],
["D2400301","加州红李(台湾)","加州紅李(台灣)",45,0.3,10.6,0.6],
["E3300104","包心白菜","包心白菜",14,1.2,2.6,0.1],
["E2700101","九层塔","九層塔",27,2.9,4.4,0.3],
["J0401102","虱目鱼(2022年取样)","虱目魚(2022年取樣)",243,20.1,1.4,17.4],
["D3000102","西洋梨(红皮)","西洋梨(紅皮)",53,0.3,13.9,0.2],
["D3000101","西洋梨(青皮)","西洋梨(青皮)",62,0.3,16.5,0.2],
["D3000203","新世纪梨","新世紀梨",42,0.4,10.7,0.2],
["K02141","鸭咸蛋平均值","鴨鹹蛋平均值",185,13.3,1.1,14.1],
["K01503","蒸蛋平均值","蒸蛋平均值",64,5.3,2.2,4.6],
["D3400205","柠檬柑","檸檬柑",48,1.1,12.2,0.1],
["D3400202","茂谷柑","茂谷柑",44,0.6,11.5,0.1],
["D3400204","高墙桶柑","高牆桶柑",45,0.8,11.8,0],
["J0700503","鲻鱼卵(加工)(2022年取样)","鯔魚卵(加工)(2022年取樣)",425,38.9,4.4,28.7],
["G01101","乾木耳平均值","乾木耳平均值",333,13.8,74.7,0.7],
["G08001","香菇平均值","香菇平均值",39,3,7.6,0.1],
["L0132101","全脂保久乳","全脂保久乳",62,3,5.1,3.4],
["L0134101","中脂保久乳","中脂保久乳",48,3.2,4.8,1.8],
["D0800103","北蕉(9月取样)","北蕉(9月取樣)",65,1.3,16.6,0],
["J21008","日本对虾平均值","日本對蝦平均值",97,21.3,0.4,0.7],
["D0800101","北蕉(2月取样)","北蕉(2月取樣)",93,1.3,24.6,0],
["J0401501","鲤","鯉",91,14.5,2.1,3.2],
["J0600301","鲨鱼翅","鯊魚翅",186,43.5,0,0],
["D3100301","台湾土枣","台灣土棗",87,0.9,23.1,0.1],
["A0500401","白籼糯米(台中糯70号籼米)","白秈糯米(台中糯70號秈米)",361,7.9,78.4,0.9],
["D3500101","文旦","文旦",34,0.7,8.4,0.1],
["R4700902","传统豆腐(2022年取样)","傳統豆腐(2022年取樣)",96,9.6,1.9,5.5],
["L1132101","保久羊乳","保久羊乳",59,3,4.5,3.3],
["L1154201","中脂调味保久羊乳(果汁)","中脂調味保久羊乳(果汁)",75,2.9,9.5,2.8],
["D1100101","突目1号凤梨","突目1號鳳梨",56,0.6,14.5,0.2],
["A0500102","籼米(台中籼10号)","秈米(台中秈10號)",358,7.4,78.5,0.7],
["I0210201","法式羊排","法式羊排",260,18.8,0,20],
["I0200301","山羊後腿肉火锅片","山羊後腿肉火鍋片",170,18.9,0.1,9.9],
["I0321401","猪大骨汤","豬大骨湯",7,1,0.4,0.3],
["D2400201","红肉李(大)","紅肉李(大)",41,0.5,10,0.3],
["D2400306","桃接李(小)","桃接李(小)",36,0.7,8.6,0.3],
["G9000401","富珍茸","富珍茸",37,3,6.8,0.4],
["G1100101","酒杯菇","酒杯菇",50,4.6,9,0.3],
["G9000101","松茸白菇","松茸白菇",38,5.1,5.3,0.5],
["R4701101","小三角油豆腐","小三角油豆腐",160,12.7,0,13.3],
["R4701301","鸡蛋豆腐","雞蛋豆腐",79,6.9,2.7,4.6],
["A0400601","冷冻玉米粒","冷凍玉米粒",174,3.1,22.5,8.2],
["I0104101","牛前胸肉","牛前胸肉",331,14.8,0,29.6],
["I0300201","猪下肩瘦肉","豬下肩瘦肉",131,20.1,0,5],
["I0300401","猪肩胛肉","豬肩胛肉",295,16.5,0,24.8],
["Q0300401","蕃薯饼","蕃薯餅",331,3.9,54.9,10.6],
["R3000401","棺材板","棺材板",264,7,19.7,17.5],
["H1100201","带荚毛豆","帶莢毛豆",120,12.9,15,1.7],
["H0900101","莱豆仁","萊豆仁",112,7.8,20.1,0.4],
["R6100501","冷冻鳕鱼丸","冷凍鱈魚丸",99,8.5,10.7,2.4],
["R6600601","冷冻虾饺","冷凍蝦餃",273,11.4,13.5,19.3],
["I0620101","鹅心","鵝心",241,14.5,0,19.9],
["I0620201","鹅肝","鵝肝",123,20.5,0.6,3.9],
["A1000201","糙薏仁","糙薏仁",387,13.7,65.9,7.4],
["C1910201","调味南瓜子(带壳)","調味南瓜子(帶殼)",564,25.9,19.5,47.2],
["L0500201","切片乾酪(低脂)","切片乾酪(低脂)",241,21.7,8.8,13],
["E3800402","雪里蕻","雪裡蕻",20,1.5,3.8,0.2],
["E3000103","甘蓝(圆球形)","甘藍(圓球形)",24,1.4,4.9,0.2],
["E5300403","有机本岛莴苣(7月取样)","有機本島萵苣(7月取樣)",17,1.5,2.7,0.3],
["E5300501","水植波士顿莴苣","水植波士頓萵苣",8,1.2,0.7,0.2],
["E5300104","萝美莴苣","蘿美萵苣",13,1,2.3,0.2],
["E6200103","冬瓜(2022年取样)","冬瓜(2022年取樣)",21,0.4,5.1,0],
["L0146101","低脂强化保久乳(寡糖强化)","低脂強化保久乳(寡糖強化)",46,3.2,6,1],
["L0328101","脱脂凝态发酵乳(纤维强化)","脫脂凝態發酵乳(纖維強化)",84,4.1,15.9,0.5],
["E5600202","水植蕹菜(4月取样)","水植蕹菜(4月取樣)",24,2.2,4.3,0.1],
["E5600301","有机蕹菜(4月取样)","有機蕹菜(4月取樣)",26,1.9,4.7,0.3],
["E5600103","土植蕹菜(7月取样)","土植蕹菜(7月取樣)",17,1.9,2.8,0.1],
["J0408701","单斑笛鲷","單斑笛鯛",106,20.7,0,1.9],
["B0520101","芋头粉","芋頭粉",333,0.1,83.1,0],
["D1900202","红铃西瓜","紅鈴西瓜",34,0.8,8.5,0.1],
["A0600101","高梁","高梁",372,11,73.6,3],
["J0412108","台湾鲷鱼片(微波)","台灣鯛魚片(微波)",140,24.9,1.4,3.7],
["J0412107","台湾鲷鱼片(清蒸)","台灣鯛魚片(清蒸)",112,19.3,2.2,3.3],
["D2100301","黑香芒果","黑香芒果",66,0.8,16.9,0.3],
["D2100401","四季芒果","四季芒果",60,0.6,15.6,0.2],
["D2100407","莲花芒果","蓮花芒果",47,0.4,12.2,0.2],
["J0401901","长体油胡瓜鱼","長體油胡瓜魚",104,15,0,4.4],
["J0400801","日本银带鲱","日本銀帶鯡",101,21,0,1.3],
["J0404801","鳜","鱖",89,17.7,0,1.5],
["D1700801","无子红葡萄(含皮)","無子紅葡萄(含皮)",72,0.5,19.2,0.1],
["A0550102","细米粉","細米粉",355,0.4,87.2,0.6],
["D1700701","美国绿葡萄(含皮)","美國綠葡萄(含皮)",87,0.6,22.7,0.4],
["D02001","木瓜平均值","木瓜平均值",38,0.6,9.9,0.1],
["B01002","山药平均值","山藥平均值",85,2.8,17.8,0.1],
["D3000206","丰水梨","豐水梨",36,0.5,9.4,0.1],
["D3000204","新兴梨","新興梨",44,0.2,11.9,0.1],
["D3000205","横山梨","橫山梨",47,0.4,12.4,0.1],
["J2200601","凤尾虾仁","鳳尾蝦仁",64,13.4,0.3,0.8],
["J3700101","小卷干","小卷干",246,53.2,4.7,2.1],
["J0700401","鲻鱼卵","鯔魚卵",256,26.3,3.2,15.9],
["J0700502","鲻鱼卵(加工)","鯔魚卵(加工)",233,36.6,18.7,8.5],
["I0420102","鸡心(肉鸡)(2021年取样)","雞心(肉雞)(2021年取樣)",204,14.4,1.2,15.8],
["J0411901","花身副丽鱼","花身副麗魚",112,17.7,1.1,4.1],
["D0800701","南华蕉","南華蕉",124,1.1,33.2,0.1],
["D20001","甜瓜平均值(光皮洋香瓜)","甜瓜平均值(光皮洋香瓜)",30,0.9,7.2,0.1],
["D1900402","金兰西瓜","金蘭西瓜",24,0.6,6,0],
["B0700301","小马铃薯(珍珠马铃薯)","小馬鈴薯(珍珠馬鈴薯)",59,1.7,12.8,0],
["J0412002","台湾鲷鱼片(生)","台灣鯛魚片(生)",110,18.2,2.5,3.6],
["D1500201","牛乳芭乐","牛乳芭樂",33,0.5,8.5,0.1],
["D2100201","肯特芒果","肯特芒果",49,0.5,12.7,0.2],
["J0416301","犬牙南极鱼切片","犬牙南極魚切片",282,12.1,0,25.5],
["D2800102","甜蜜桃","甜蜜桃",39,0.9,9.6,0.2],
["D1701001","金香葡萄(含皮)","金香葡萄(含皮)",60,0.6,16,0.1],
["J0413801","白带鱼","白帶魚",162,19.6,0,8.7],
["P1004601","麻婆酱","麻婆醬",190,2.9,23.1,9.5],
["C0405101","生核桃","生核桃",667,15.4,11.2,67.9],
["P1301001","洋葱面包酱","洋蔥麵包醬",276,1,9.5,26.1],
["P0500501","素食高汤","素食高湯",17,0.3,4,0],
["P1100201","无蛋沙拉酱","無蛋沙拉醬",479,1.8,19,44],
["G0800103","花菇","花菇",52,3.6,10.7,0.1],
["G0800101","香菇(大)","香菇(大)",37,3,7.1,0.2],
["G0810101","乾香菇","乾香菇",333,23.3,66.6,1.4],
["P0101601","荳蔻粉","荳蔻粉",448,6.7,50.6,26.2],
["P0500101","高汤块(排骨)","高湯塊(排骨)",363,12.5,24.5,23.9],
["G1400301","珊瑚菇","珊瑚菇",33,4,5.2,0.2],
["A0352601","蚵仔面线","蚵仔麵線",307,11.3,62.3,1.4],
["P1000901","麻酱","麻醬",643,20.8,21.3,52.8],
["Q0100401","冷藏广式萝卜糕","冷藏廣式蘿蔔糕",111,2.2,20.4,2.3],
["Q0100301","冷藏广式芋头粿","冷藏廣式芋頭粿",109,2.1,21.5,1.6],
["H1120101","黄豆粉","黃豆粉",401,37.4,32.2,16.7],
["R4700202","五香豆干","五香豆干",197,19.3,6.2,10.6],
["J0404701","条纹狼鲈","條紋狼鱸",147,21.4,0,6.2],
["J0412001","红色吴郭鱼","紅色吳郭魚",108,18.3,1.3,3.3],
["A0500101","籼米(台中在来2号)","秈米(台中在來2號)",355,8.2,76.3,1],
["D1500205","无子芭乐","無子芭樂",33,0.7,8.6,0],
["D1500203","珍珠芭乐","珍珠芭樂",42,0.7,10.6,0.2],
["J0402403","大西洋鲑鱼切片(尾段)","大西洋鮭魚切片(尾段)",204,20.7,0,12.8],
["J0402404","大西洋鲑鱼生鱼片","大西洋鮭魚生魚片",222,19.6,0,15.3],
["D3930101","红甘蔗汁","紅甘蔗汁",63,0.5,15.9,0.5],
["D2800204","莺哥桃","鶯哥桃",42,1,10.5,0.2],
["D2800101","水蜜桃","水蜜桃",40,0.9,9.9,0.1],
["J0411101","鮸","鮸",104,23.3,0,0.5],
["J3500301","阿根廷鱿","阿根廷魷",71,12.4,0.4,2],
["J3501501","蜗牛肉","蝸牛肉",78,16.7,0,0.7],
["A0501103","发芽粳米(台粳71号)","發芽粳米(台粳71號)",357,7.4,73.9,2.8],
["D3700101","青皮葡萄柚","青皮葡萄柚",33,0.8,8.3,0.1],
["D2100205","圣心芒果","聖心芒果",50,0.5,12.9,0.2],
["J2100802","日本对虾(小)","日本對蝦(小)",96,20.9,1.8,0.8],
["R6800101","鱼肉脯","魚肉脯",157,21.9,0,12.4],
["D0700101","红龙果(白肉)","紅龍果(白肉)",51,0.9,12.4,0.4],
["D0700201","红龙果(红肉)","紅龍果(紅肉)",50,1.1,12.3,0.2],
["R5100401","切片火腿(鸡肉)","切片火腿(雞肉)",148,15.3,10,5.3],
["I0322001","猪空肠","豬空腸",186,10.9,8.6,15.4],
["I0321201","熟猪肚","熟豬肚",137,16,2.7,7.5],
["I0502101","樱桃鸭胸肉片","櫻桃鴨胸肉片",227,16.7,4.7,17.2],
["J2200701","须赤虾仁","鬚赤蝦仁",80,17.1,0,0.7],
["D2000201","美浓瓜","美濃瓜",37,1.1,8.8,0.2],
["I0100301","沙朗牛排","沙朗牛排",162,20.4,1.5,8.3],
["I0106201","腓力牛排","腓力牛排",184,20.6,0.1,10.7],
["J0408301","赤鳍笛鲷","赤鰭笛鯛",88,20.4,0,0.1],
["P1300501","柚子果酱","柚子果醬",268,0.6,64.5,0.8],
["R5300401","鸡肉香肠(大)","雞肉香腸(大)",283,22.4,11.8,16.3],
["I0420601","鸡胸骨汤","雞胸骨湯",9,1.5,0.2,0.3],
["E17002","绿芦笋平均值","綠蘆筍平均值",22,2.7,3.5,0.2],
["J0400602","魩仔鱼(加工·小)","魩仔魚(加工,小)",151,31.8,0.9,1.7],
["J0400902","日本银带鲱鱼干(丁香鱼脯)","日本銀帶鯡魚干(丁香魚脯)",275,51.8,1.7,6],
["J0700301","鮸鱼卵(加工)","鮸魚卵(加工)",184,21.9,3.6,10.1],
["J3500401","泡鱿鱼","泡魷魚",50,11.3,3,0.2],
["B0500102","芋头(2021年取样)","芋頭(2021年取樣)",107,1.1,24.8,0],
["J0412003","台湾鲷鱼片(生)(2021年)","台灣鯛魚片(生)(2021年)",109,17.9,1.5,3.7],
["P1400102","液体奶精(2021年)","液體奶精(2021年)",242,2.2,4.2,24],
["J0410101","黑棘鲷(去皮)","黑棘鯛(去皮)",136,20.3,0.6,5.5],
["J0402501","麦奇鈎吻鲑(去皮)","麥奇鈎吻鮭(去皮)",160,20.9,0,7.8],
["D2000403","秋香洋香瓜","秋香洋香瓜",34,1,8.4,0],
["D2000202","黄香瓜","黃香瓜",30,0.6,7.5,0.2],
["J0410801","眼斑拟石首鱼","眼斑擬石首魚",95,19.7,0.9,1.2],
["J0402401","大西洋鲑鱼(台湾养殖)","大西洋鮭魚(台灣養殖)",155,23.6,0,6],
["D3800301","柠檬汁(黄皮)","檸檬汁(黃皮)",30,0.5,7.2,0.3],
["D4130102","可可椰子汁(进口)","可可椰子汁(進口)",19,0.2,5,0],
["D4130101","可可椰子汁(屏东)","可可椰子汁(屏東)",17,0.1,4.7,0],
["H1200201","豌豆荚","豌豆莢",41,2.9,7.1,0.2],
["H1200101","豌豆仁","豌豆仁",123,9.2,21.7,0.3],
["H1200501","冷冻豌豆仁","冷凍豌豆仁",96,6.1,17.1,0.6],
["A0500901","胚芽籼米(台中籼10号)","胚芽秈米(台中秈10號)",363,8.3,76.1,2.1],
["I0322201","猪後脚","豬後腳",293,19.5,0,23.2],
["D1800101","红宝石莲雾","紅寶石蓮霧",33,0.3,8.1,0.3],
["D0800201","北蕉(0天·绿皮)","北蕉(0天,綠皮)",90,1.3,23.3,0.3],
["D0800301","北蕉(1天)","北蕉(1天)",87,1.4,22.2,0.3],
["E3600101","明日叶","明日葉",57,1.4,11.9,0.8],
["E3200901","珍珠小白菜","珍珠小白菜",11,1.5,1.7,0.1],
["E7500503","糯米椒","糯米椒",28,1.2,5.6,0.3],
["R5100902","腊肉(腿肉)","臘肉(腿肉)",377,26.7,6.4,27.2],
["I0406101","二节翅(土鸡)","二節翅(土雞)",228,19.8,0,15.9],
["I0310301","猪颈肉","豬頸肉",284,17.2,0.8,23.3],
["I0804101","鸵鸟沙朗肉排","鴕鳥沙朗肉排",97,20.9,6.1,0.8],
["I0320301","猪皮","豬皮",491,22.1,0,44],
["E3300102","迷你竹笋白菜","迷你竹筍白菜",19,1.3,3.8,0.1],
["I0102201","牛去骨肩胛小排","牛去骨肩胛小排",233,16.9,1.2,17.9],
["A0120101","大麦仁粉","大麥仁粉",389,7.1,85,1.3],
["D15002","芭乐平均值(白肉)","芭樂平均值(白肉)",38,0.7,9.8,0.1],
["D41301","可可椰子汁平均值","可可椰子汁平均值",18,0.1,4.9,0],
["E75005","青辣椒平均值","青辣椒平均值",33,1.3,6.9,0.3],
["D27002","甜柿平均值","甜柿平均值",57,0.5,15.2,0.1],
["J0404901","白缘星鱠","白緣星鱠",101,19.9,0,1.8],
["K0300101","鹌鹑蛋","鵪鶉蛋",172,12.7,1.2,13],
["K0100201","土鸡蛋","土雞蛋",129,12.9,1.7,8.1],
["J32002","干贝(乾)平均值","干貝(乾)平均值",242,53.7,10.8,1.4],
["K0120102","鸡卤蛋(现煮)","雞滷蛋(現煮)",178,16.6,3.1,11.1],
["K0150303","蒸蛋(电锅)","蒸蛋(電鍋)",80,5.8,1.3,6],
["K0150302","蒸蛋(微波炉)","蒸蛋(微波爐)",82,6.4,1.8,6],
["C0110202","蒜味甘扁桃仁","蒜味甘扁桃仁",603,23.3,18,53.6],
["L0224201","部份脱脂调味奶粉(果汁)","部份脫脂調味奶粉(果汁)",430,19.8,61.4,12.3],
["L0102107","全脂鲜乳(12月取样)","全脂鮮乳(12月取樣)",64,3.2,5.2,3.4],
["L0124201","中脂调味乳(多谷类)","中脂調味乳(多穀類)",67,2.4,7.6,3.1],
["C2110201","甘草葵瓜子(带壳)","甘草葵瓜子(帶殼)",527,26.8,25.8,39.3],
["A0100101","大麦仁","大麥仁",365,8.6,77.1,1.6],
["L0500301","刨丝乾酪","刨絲乾酪",323,25.1,4.4,22.6],
["L0314301","中脂浓稠发酵乳(草莓)","中脂濃稠發酵乳(草莓)",89,3.1,13,2.7],
["Q2102301","黄布丁","黃布丁",110,2.3,17.3,3.5],
["M1600101","花生油","花生油",883,0,0,99.9],
["M9900301","中链脂肪酸油","中鏈脂肪酸油",883,0,0,99.9],
["M2200101","油茶油","油茶油",883,0,0,99.9],
["M1550101","调合芝麻油","調合芝麻油",884,0.1,0,100],
["M0100101","牛油(未精炼)","牛油(未精煉)",642,0,4.2,71.9],
["M2500201","葵花籽油(多种维生素强化)","葵花籽油(多種維生素強化)",883,0,0,99.9],
["C0500101","栗子(生)","栗子(生)",264,4.6,57.9,1.4],
["O0901501","姜茶冲泡包","薑茶沖泡包",399,0.3,98.7,0.3],
["J0407501","乌鲳","烏鯧",94,20.4,0,0.8],
["J0404501","日本花鲈(含皮)","日本花鱸(含皮)",111,19.2,0.8,3.2],
["P0100401","五香粉","五香粉",363,8.7,68.1,8.9],
["P0200601","油葱酥","油蔥酥",518,7.4,57.1,28.8],
["J0407401","泰勃圆鰺","泰勃圓鰺",113,22.8,1.4,1.7],
["J0413201","杜氏刺尾鲷","杜氏刺尾鯛",137,19.1,0.6,6.2],
["K0122101","鸡水波蛋","雞水波蛋",147,11.6,0.8,10.7],
["P0100101","八角","八角",360,4.9,76.2,3.9],
["P0101301","黑胡椒粉","黑胡椒粉",372,11.6,67.7,6.7],
["P1002301","烤肉酱","烤肉醬",157,5.2,32.1,0.8],
["P1001901","黄芥茉酱","黃芥茉醬",74,4.1,6.2,3.7],
["P0101701","蒜粉","蒜粉",332,18.1,71.9,0.4],
["P0500401","低脂高汤","低脂高湯",2,0.3,0.3,0],
["P0500201","高汤块(鸡肉)","高湯塊(雞肉)",340,14.7,14.5,24.8],
["P1002101","金桔酱","金桔醬",84,0.5,19.5,0.4],
["P1004301","红麴酱","紅麴醬",163,4.6,35,0.5],
["P1000601","炸酱","炸醬",398,14.6,6.7,34.7],
["P0200101","七味唐辛子","七味唐辛子",463,15.8,45.8,24.1],
["R3000301","蚵仔煎","蚵仔煎",192,4.9,19.7,10.4],
["R8100101","冲泡浓汤(海鲜)","沖泡濃湯(海鮮)",355,11.2,62,6.9],
["E53001","不结球莴苣平均值","不結球萵苣平均值",16,1.1,2.8,0.3],
["E7500601","长辣椒(红皮)","長辣椒(紅皮)",48,2.4,9.3,0.7],
["E7500603","朝天椒(圆果)","朝天椒(圓果)",103,4.9,21.9,0.5],
["A0400701","玉米笋","玉米筍",31,2.2,5.8,0.3],
["J3100401","虾夷海扇蛤","蝦夷海扇蛤",70,13.7,2.3,1.2],
["J0707102","旗鱼肚","旗魚肚",99,22.5,2.9,0.4],
["E8400101","豌豆芽","豌豆芽",25,4.8,2.5,0.3],
["E5200201","藤三七","藤三七",21,1.6,3.2,0.5],
["J0403104","鲻(11月·雄鱼)","鯔(11月,雄魚)",129,21.3,0,4.2],
["J0403105","鲻(11月·雌鱼)","鯔(11月,雌魚)",141,21.5,0,5.5],
["E4900101","紫苏","紫蘇",71,5.5,11.9,1.2],
["E2000101","槟榔嫩茎","檳榔嫩莖",31,2.2,5.6,0.4],
["E2900101","水菜(日本种)","水菜(日本種)",11,1.2,1.6,0.2],
["J0410401","大黄鱼","大黃魚",142,16.8,0.2,7.8],
["J0401003","虱目鱼(8月)","虱目魚(8月)",124,23.7,0.5,2.6],
["J0404403","日本花鲈((8月)","日本花鱸((8月)",95,19,1.5,1.6],
["E9600101","薄荷","薄荷",55,3,10.9,0.6],
["D1900501","嘉宝瓜","嘉寶瓜",40,0.8,10,0.2],
["E4300101","香桩","香樁",99,4.3,19.4,1.5],
["B0920101","莲藕粉","蓮藕粉",365,0.1,88.3,0.1],
["J0411801","尼罗口孵非鲫(含皮)","尼羅口孵非鯽(含皮)",125,19.4,0,4.7],
["I0420801","鸡脚(肉鸡)","雞腳(肉雞)",209,20.7,1.2,13.3],
["I0420101","鸡心(肉鸡)","雞心(肉雞)",190,13.3,0.1,14.8],
["I0402101","里肌肉(土鸡)","里肌肉(土雞)",112,24.8,0,0.6],
["E7210101","枸杞子","枸杞子",347,12.3,77.8,1.3],
["E6010101","洛神花乾","洛神花乾",306,9,71.2,0.6],
["I0300501","猪肩胛排","豬肩胛排",191,17.9,0,12.7],
["I0302101","猪後腿外腱肉","豬後腿外腱肉",184,19,0.8,11.4],
["D2500101","枇杷","枇杷",38,0.3,9.8,0.2],
["I0321701","猪脾脏","豬脾臟",79,15,2,1.6],
["I0802101","鸵鸟菲力肉排","鴕鳥菲力肉排",105,22.8,0.8,0.8],
["D0800801","红皮蕉(2004年取样)","紅皮蕉(2004年取樣)",98,1.3,25.5,0.2],
["D0200101","木瓜(2月取样)","木瓜(2月取樣)",31,0.7,7.7,0.1],
["D2400302","加州红李(进口)","加州紅李(進口)",60,0.8,15.3,0.3],
["D3200403","秋香苹果","秋香蘋果",45,0.3,12.3,0],
["D3200101","青龙苹果","青龍蘋果",52,0.3,13.8,0.2],
["E0100101","牛蒡","牛蒡",84,2.5,19.1,0.4],
["A0110101","大麦片","大麥片",365,8.6,76.7,1.8],
["E0600101","芋茎","芋莖",20,1.1,3.4,0.5],
["E2300102","山东大葱","山東大蔥",31,1.3,6.7,0.1],
["E2300104","宜兰粉葱","宜蘭粉蔥",27,1.6,5.4,0.2],
["J0800101","小鱼干","小魚干",335,69.2,0,4.4],
["J0415101","刺鲳(含皮)","刺鯧(含皮)",155,17.8,0,8.7],
["R6800301","鱼肉松","魚肉鬆",470,28.2,43.8,20.2],
["E3200604","土植小白菜(7月取样)","土植小白菜(7月取樣)",10,1,1.8,0.1],
["A0450101","玉米粒罐头","玉米粒罐頭",90,2.3,16.9,1.4],
["E3200703","水植小白菜(7月取样)","水植小白菜(7月取樣)",12,0.9,2.4,0.1],
["J2100701","中国对虾","中國對蝦",84,19.3,1,0.2],
["J2101701","日本龙虾","日本龍蝦",93,21.5,1,0.1],
["E3000301","甘蓝芽","甘藍芽",33,2.7,5.4,0.6],
["E3000102","甘蓝(扁圆形)","甘藍(扁圓形)",21,1.1,4.3,0.2],
["I0310402","猪绞肉(90%瘦肉率)","豬絞肉(90％瘦肉率)",205,18.5,0,14],
["I0310401","猪绞肉(70%瘦肉率)","豬絞肉(70％瘦肉率)",218,19,0,15.2],
["I0320201","猪白管","豬白管",93,14.1,0,3.6],
["A0351901","拉面","拉麵",292,9.1,62.1,0.8],
["E1410101","麻竹笋干","麻竹筍干",177,15.8,32,1.2],
["E3300101","烟台白菜","煙台白菜",14,1.3,2.2,0.3],
["E3300201","白菜芽","白菜芽",54,2.6,11.5,0.3],
["L0320101","高脂凝态发酵乳(纤维强化)","高脂凝態發酵乳(纖維強化)",95,3.2,11.9,3.8],
["L0217301","脱脂强化奶粉(钙&维生素C·E强化)","脫脂強化奶粉(鈣&維生素C,E強化)",360,32.8,55.4,0.7],
["D3000103","西洋梨(黄皮)","西洋梨(黃皮)",44,0.2,11.8,0.1],
["D3000202","大雪梨","大雪梨",42,0.3,11.1,0.1],
["J0404301","尖嘴鲈(含皮)","尖嘴鱸(含皮)",107,19.6,0,2.6],
["M2000201","高油酸红花籽油","高油酸紅花籽油",880,0,0.4,99.6],
["M2500301","高油酸葵花籽油","高油酸葵花籽油",883,0,0,99.9],
["M2200201","熟油茶油","熟油茶油",883,0,0,99.9],
["D2200201","冷冻荔枝","冷凍荔枝",28,0.4,7.2,0.1],
["J0408601","马拉巴笛鲷","馬拉巴笛鯛",86,20.2,0,0],
["J0402601","麦奇鈎吻鲑(含皮)","麥奇鈎吻鮭(含皮)",147,20.1,0.4,6.8],
["J0404601","白鲈","白鱸",76,17.7,1,0.1],
["J0404001","环纹蓑鮋","環紋簑鮋",79,18.4,0,0.1],
["Q6400301","枇杷糖","枇杷糖",394,0.2,98,0.1],
["Q6400201","莲藕糖","蓮藕糖",395,0.2,97.8,0.4],
["P0100901","洋香菜片","洋香菜片",312,24.4,47.7,7.5],
["P0201001","糖粉","糖粉",399,0,99.3,0.2],
["P0900301","虾油","蝦油",56,7.4,6.4,0.1],
["E62001","冬瓜平均值","冬瓜平均值",11,0.4,2.4,0.1],
["E63001","南瓜平均值","南瓜平均值",74,1.9,17.3,0.2],
["J04099","真鲷平均值(去皮)","真鯛平均值(去皮)",110,20.6,0.2,2.5],
["J04153","银鲳平均值(去皮)","銀鯧平均值(去皮)",115,17.7,0.2,4.4],
["Q0700101","可颂","可頌",452,7.3,47.1,26.1],
["Q0800201","铜锣烧","銅鑼燒",332,3.4,57.2,9.9],
["Q0900301","提拉米苏(圆形)","提拉米蘇(圓形)",328,4.4,21.1,25.1],
["J0414001","正鲣","正鰹",149,23.1,0,5.6],
["R9900301","白葡萄酒","白葡萄酒",90,0.1,14.2,0],
["R9900302","红葡萄酒","紅葡萄酒",93,0.1,14.8,0],
["B0600101","豆薯","豆薯",31,0.7,6.8,0.1],
["J0414201","高丽马加鰆","高麗馬加鰆",119,19.4,0.3,4],
["C0810101","原味腰果","原味腰果",566,16.4,35.2,43.7],
["C0110201","甘扁桃仁(熟)","甘扁桃仁(熟)",588,21.9,23.2,49.8],
["C0210101","原味松子仁","原味松子仁",680,14.5,13,69],
["C1710101","红土带壳花生(熟)","紅土帶殼花生(熟)",555,31.2,19.5,43.9],
["M0300101","鸡油","雞油",891,0,0,99.8],
["E7500301","甜椒(黄皮)","甜椒(黃皮)",28,0.8,6,0.3],
["E7500501","角椒","角椒",22,0.9,4.7,0.2],
["E7500103","高山甜椒(青皮)","高山甜椒(青皮)",30,0.9,6,0.6],
["M1000101","人造奶油(维生素强化)","人造奶油(維生素強化)",725,0.1,0,82],
["N0100401","黑砂糖","黑砂糖",365,0.6,94.4,0],
["E6500401","野苦瓜","野苦瓜",30,1.7,5.3,0.6],
["A0550501","免煮饭","免煮飯",168,3.2,37,0.3],
["E6500301","珍珠苦瓜","珍珠苦瓜",19,0.7,4.2,0.1],
["I0620401","鹅肠","鵝腸",63,9.2,0.7,2.6],
["I0322501","猪脚筋","豬腳筋",72,14.4,0,1.1],
["I0404101","骨腿(土鸡)","骨腿(土雞)",130,21.7,0,4.1],
["E3200501","千宝菜","千寶菜",20,1.7,3.6,0.2],
["E6300102","台湾南瓜","台灣南瓜",49,1.7,11.1,0.2],
["E6300104","菊花南瓜","菊花南瓜",76,3.8,16.8,0.1],
["D2400304","香水李","香水李",36,0.7,8.8,0.3],
["D2400401","黄肉李","黃肉李",35,0.4,8.9,0.2],
["J0415901","单角革单棘魨(去皮)","單角革單棘魨(去皮)",79,17.2,0,0.6],
["K0213101","鸭皮蛋","鴨皮蛋",158,12.8,2.7,11.4],
["D0500201","奇异果","奇異果",56,1.1,14,0.3],
["D0500101","金黄奇异果","金黃奇異果",59,0.8,15,0.3],
["A05002","粳米平均值","粳米平均值",354,7,77.8,0.7],
["E3200102","蚵仔白菜(2022年取样)","蚵仔白菜(2022年取樣)",13,1.4,1.8,0.3],
["H1800101","翼豆","翼豆",31,2.5,4.7,0.4],
["B0100210","山药(宜兰原生种)","山藥(宜蘭原生種)",140,4.8,29.1,0.2],
["K0100501","鸡蛋(高次亚麻油酸)","雞蛋(高次亞麻油酸)",139,12.4,2.8,9.4],
["H1150601","豆浆优酪乳","豆漿優酪乳",70,2,12.9,1.2],
["H1150501","黑豆浆","黑豆漿",39,1.1,7.4,0.6],
["H0550101","甘纳豆","甘納豆",333,6.6,74.5,1],
["A05013","糙粳米平均值","糙粳米平均值",362,8.2,75.1,2.5],
["E0400201","樱桃萝卜","櫻桃蘿蔔",11,0.6,2.3,0],
["J3501001","泥螺","泥螺",95,21.5,0.3,0.3],
["D2100203","凯特芒果","凱特芒果",50,1.1,12.5,0.2],
["D3000201","幸水梨","幸水梨",34,0.4,9,0],
["J3100901","大文蛤","大文蛤",21,4.4,1.5,0.2],
["J0401201","虱目鱼腹肉(虱目鱼肚)","虱目魚腹肉(虱目魚肚)",342,17.4,0,29.6],
["A1000101","薏仁","薏仁",378,14.1,66.2,6],
["D2800203","福寿桃","福壽桃",47,0.9,11.9,0.2],
["J3500601","尖锁管","尖鎖管",100,20.2,2.4,1.5],
["J3500102","真乌贼(小)","真烏賊(小)",53,10.5,6.6,0.9],
["D1700501","美国紫葡萄(含皮)","美國紫葡萄(含皮)",80,0.4,21.9,0],
["D1700301","美国绿葡萄","美國綠葡萄",64,0.5,16.8,0.2],
["G2300301","猴头菇罐头","猴頭菇罐頭",29,1,6.5,0.1],
["H1105101","黄豆","黃豆",389,35.6,33,15.7],
["K0200201","红面番鸭蛋","紅面番鴨蛋",198,13.1,0,15.6],
["K0100601","鸡蛋(高亚麻油酸)","雞蛋(高亞麻油酸)",133,13,0.8,8.4],
["I0100101","去骨牛小排","去骨牛小排",290,17.1,0,24],
["Q0500401","蛋黄酥","蛋黃酥",461,11.4,44.5,26.4],
["Q0500601","萝卜酥","蘿蔔酥",427,7.5,52.3,20.9],
["R5900301","猪脚冻","豬腳凍",145,16.6,2,7.8],
["H1410101","盐酥蚕豆","鹽酥蠶豆",456,26.9,46.3,20.9],
["H0205101","米豆","米豆",349,21.7,62.2,2.4],
["R4400401","花瓜罐头","花瓜罐頭",89,2.9,18.8,0.2],
["R4900101","花生面筋罐头","花生麵筋罐頭",206,11,15.5,11.1],
["A0500301","越光米","越光米",340,7.6,73.3,1],
["I0322101","猪前脚","豬前腳",252,21.9,0,17.6],
["R2200201","冷冻猪肉水饺","冷凍豬肉水餃",208,8.1,22.1,9.7],
["R6600701","冷冻燕饺","冷凍燕餃",321,12.8,14.5,23.6],
["R2201101","冷冻猪肉馄饨","冷凍豬肉餛飩",240,11.1,20.5,12.6],
["R6600101","冷冻花枝饺","冷凍花枝餃",177,12.4,19.2,5.6],
["R0500301","冷冻筒仔米糕","冷凍筒仔米糕",212,6.5,33.6,5.8],
["R6300501","冷冻旗鱼块","冷凍旗魚塊",178,15.3,14.7,6.5],
["I0400201","肉鸡","肉雞",248,16.1,0,19.9],
["I0400401","烤鸡","烤雞",233,22.8,3.6,14.2],
["J0406401","鬼头刀鱼片","鬼頭刀魚片",78,17.2,0,0.5],
["D1700201","巨峰葡萄","巨峰葡萄",64,0.5,16.6,0.3],
["D1700901","黑美人葡萄(含皮)","黑美人葡萄(含皮)",66,0.5,17.4,0.1],
["D1700302","意大利葡萄","意大利葡萄",52,0.5,13.7,0.1],
["K0100801","鸡蛋(高维生素A&E)","雞蛋(高維生素A&E)",134,12.1,0,9],
["K0321101","鹌鹑铁蛋","鵪鶉鐵蛋",439,28.8,20.4,26.9],
["K0113101","鸡皮蛋","雞皮蛋",132,12.8,3.6,8.5],
["D1400101","草莓","草莓",39,1,9.3,0.2],
["A0500502","白粳糯米(台粳糯1号粳米)","白粳糯米(台粳糯1號粳米)",358,8.2,76.8,1.1],
["E0400101","白萝卜","白蘿蔔",16,0.7,3.3,0.1],
["I0308101","猪去皮腹脇肉","豬去皮腹脇肉",360,14.9,0.5,32.9],
["I0304101","猪大里肌","豬大里肌",212,19.2,0,14.4],
["I0304201","猪大排","豬大排",214,19.1,0,14.7],
["J0411501","花身鯻","花身鯻",157,19.5,0,8.2],
["K0311101","鹌鹑水煮蛋","鵪鶉水煮蛋",163,12.3,0,12.1],
["K0110101","温泉蛋","溫泉蛋",127,12.9,3.8,7.8],
["K0106201","乌骨鸡蛋白","烏骨雞蛋白",47,10.6,1.7,0],
["E1100201","桂竹笋片","桂竹筍片",17,1,3.3,0.2],
["E1500101","绿竹笋","綠竹筍",25,1.7,4.7,0.2],
["J0700201","圆鳕鱼卵(加工)","圓鱈魚卵(加工)",84,11.2,0,4.4],
["D1500202","世纪芭乐","世紀芭樂",40,0.7,10.3,0.1],
["A0800101","燕麦","燕麥",406,10.9,67.4,10.2],
["D3100401","红枣","紅棗",227,3.2,59.5,0.3],
["D3100402","黑枣","黑棗",230,2.7,60.9,0.2],
["D1700101","美国红葡萄","美國紅葡萄",69,0.4,17.7,0.4],
["D1200201","凤梨释迦","鳳梨釋迦",102,1.5,26,0.4],
["E7400402","试交二号小番茄","試交二號小番茄",30,0.7,7.2,0],
["J0409701","平鲷","平鯛",175,31.8,0,4.4],
["J0405201","斑点九刺鮨(去皮)","斑點九刺鮨(去皮)",82,18.8,0.9,0.2],
["A0500206","粳米(台农71号)","粳米(台農71號)",357,7.9,77.8,0.6],
["A0501301","糙粳米(台粳71号)","糙粳米(台粳71號)",360,9,73.6,2.6],
["B0100202","山药(大汕1号)","山藥(大汕1號)",80,2.4,17,0.1],
["J3100201","真牡蛎","真牡蠣",49,9,1.8,1.2],
["J3200202","小干贝(乾)","小干貝(乾)",228,48.9,6.1,2.2],
["D3100201","珍珠蜜枣","珍珠蜜棗",46,1.1,11.7,0],
["D3100102","蜜枣(圆形)","蜜棗(圓形)",44,0.9,11,0.1],
["J0403701","鳞马鞭鱼","鱗馬鞭魚",84,18.5,0,0.5],
["J0403001","鮟鱇","鮟鱇",68,14.9,0.6,0.5],
["E7400403","樱桃小番茄","櫻桃小番茄",34,0.9,8.1,0.1],
["A0520301","糙米粉","糙米粉",393,11.3,78.1,3.2],
["K0111101","鸡水煮蛋","雞水煮蛋",144,14,1.7,9.2],
["K0150301","蒸蛋(市售)","蒸蛋(市售)",32,3.6,3.4,1.8],
["K0313101","鹌鹑皮蛋","鵪鶉皮蛋",158,13.8,1.8,10.9],
["K0120801","鸡卤蛋黄(现煮)","雞滷蛋黃(現煮)",376,16.6,1.3,33.8],
["K0120103","鸡卤蛋(浸泡隔夜)","雞滷蛋(浸泡隔夜)",182,16.9,4.4,10.8],
["O0101001","蔓越莓汁(非原汁)","蔓越莓汁(非原汁)",45,0.9,10,0.1],
["D0100101","山竹","山竹",69,0.6,18.1,0.3],
["I0321403","猪肩骨汤","豬肩骨湯",8,1.1,0.2,0.3],
["I0321402","猪肋骨汤","豬肋骨湯",9,0.7,0,0.6],
["D19002","西瓜平均值(红肉小瓜)","西瓜平均值(紅肉小瓜)",33,0.8,8,0.1],
["O0900701","三合一麦片(野菜蘑菇)","三合一麥片(野菜蘑菇)",399,6.8,72.7,9],
["R4400601","腌辣椒","醃辣椒",53,1.9,10.6,0.3],
["I0404102","骨腿(肉鸡)","骨腿(肉雞)",196,14.4,1.7,14.9],
["I0400101","土鸡","土雞",196,19,0,12.7],
["A0500701","红糯米","紅糯米",362,9.9,72.6,2.8],
["B9930101","粉粿","粉粿",65,0,15.5,0.1],
["J0700801","腌渍鲑鱼卵","醃漬鮭魚卵",218,24.9,6.7,10.2],
["D2300101","龙眼","龍眼",72,1.1,18,0.4],
["D2000101","太阳洋香瓜","太陽洋香瓜",32,1.2,7.8,0],
["D2000406","蓝宝石洋香瓜","藍寶石洋香瓜",34,1.1,8.2,0],
["P1400101","液体奶精","液體奶精",262,3.9,2.5,26.3],
["L0102104","全脂鲜乳(9月取样)","全脂鮮乳(9月取樣)",64,2.8,5.3,3.6],
["M0200201","高油酸猪油","高油酸豬油",893,0,0,100],
["M9900201","调合植物油","調合植物油",887,0,0,100.3],
["M0900101","奶油(固态·不加盐)","奶油(固態,不加鹽)",733,0.6,0.9,82.7],
["A0551101","糯米浆","糯米漿",51,0.8,10.2,0.8],
["D22001","荔枝平均值","荔枝平均值",65,1,16.5,0.2],
["D38003","柠檬汁平均值","檸檬汁平均值",31,0.5,7,0.4],
["D08001","北蕉平均值","北蕉平均值",85,1.5,22.1,0.1],
["C0710101","开心果","開心果",601,22.4,20.1,52.7],
["C0810102","蜜汁腰果","蜜汁腰果",600,17.6,34.3,43.6],
["C0210102","蜜汁松子仁","蜜汁松子仁",697,14.9,19,62.4],
["P1003401","糖醋酱","糖醋醬",131,1.9,25.1,2.6],
["P0300201","低钠盐","低鈉鹽",11,0,2.8,0],
["P1003301","葱酱","蔥醬",149,2.2,19.5,6.8],
["P0700801","黑豆油膏","黑豆油膏",146,7.8,28.6,0.1],
["Q1000801","菠萝面包","菠蘿麵包",378,9.2,51.5,15],
["Q1000401","奶酥面包","奶酥麵包",377,9.1,49.8,15.7],
["R2300101","冷冻叉烧包","冷凍叉燒包",266,8.8,47,4.8],
["Q0300301","绿豆凸","綠豆凸",394,6.9,55.8,15.9],
["Q0600701","凤眼糕","鳳眼糕",379,3.8,89,0.8],
["Q0500101","太阳饼","太陽餅",460,5.3,63.6,20.5],
["J04044","日本花鲈平均值","日本花鱸平均值",98,19.9,0.9,1.5],
["A0510401","米胚芽","米胚芽",391,17,52.9,12.7],
["I0500201","番鸭","番鴨",229,18.2,0,16.7],
["J2300201","虾米","蝦米",264,57.1,0,2.2],
["Q0500501","凤梨酥","鳳梨酥",484,4.2,62,24.4],
["R0300201","糯米饭团","糯米飯糰",335,5.9,38.3,17.6],
["R6100401","冷冻旗鱼丸","冷凍旗魚丸",160,12.8,12,6.7],
["R6400201","冷冻鱼卷","冷凍魚捲",126,13.8,17.1,0.3],
["A0350301","馄饨皮","餛飩皮",271,8.3,58.2,0.5],
["I0321001","胆肝","膽肝",252,31.2,13.9,7.9],
["I0520501","鸭赏","鴨賞",304,31.1,5.3,17.6],
["L0338101","脱脂保久稀释发酵乳","脫脂保久稀釋發酵乳",46,0.1,11,0.1],
["I0108101","牛後腿肉","牛後腿肉",122,19.4,3.7,4.3],
["A0350201","春卷皮","春捲皮",241,8.3,50.4,0.7],
["I0108201","牛後腿股肉","牛後腿股肉",153,20.6,0.8,7.2],
["I0302201","猪後腿肉","豬後腿肉",123,20.4,0.4,4],
["I0310201","猪颊肉","豬頰肉",182,17.5,1.4,11.9],
["M2100101","核桃油","核桃油",883,0,0,99.9],
["C1750201","糖渍花生仁","糖漬花生仁",382,14.2,28.8,23.3],
["R2201301","温州馄饨","溫州餛飩",145,6.5,11.9,7.9],
["R5400101","冷冻珍珠丸","冷凍珍珠丸",225,9.5,20.9,11.5],
["C1720101","花生粉","花生粉",516,28.5,33,33.8],
["R6200401","冷冻虾饼","冷凍蝦餅",127,9.6,17.3,2.1],
["R2200101","冷冻牛肉水饺","冷凍牛肉水餃",215,8.9,23.1,9.7],
["R6600201","冷冻香菇饺","冷凍香菇餃",233,12.3,11.5,15.3],
["R6600401","冷冻雪螺饺","冷凍雪螺餃",204,11.6,16.7,10],
["Q6310201","巧克力牛奶软糖","巧克力牛奶軟糖",422,3.4,76.7,11.3],
["Q6300201","水果QQ软糖","水果QQ軟糖",343,6.8,78.3,0.2],
["Q6300101","水果软糖","水果軟糖",411,1.3,82.6,8.4],
["R5400301","冷冻鸡肉丸","冷凍雞肉丸",202,10.5,12.3,12.3],
["Q0800301","冷冻马蹄条","冷凍馬蹄條",194,4.2,40.1,1.9],
["R2400101","冷冻白馒头","冷凍白饅頭",279,7.4,57,2.4],
["R0600201","鸭血糕","鴨血糕",193,6.7,39.1,1.1],
["R0800101","甜酒酿","甜酒釀",163,5,34.8,0.4],
["A0550901","糙米浆","糙米漿",71,1.3,11.6,2.2],
["Q2104101","豆花(花生)","豆花(花生)",60,2,10.9,0.9],
["R4701401","麻油辣腐乳","麻油辣腐乳",107,9,4.8,5.8],
["R4700701","豆枣","豆棗",420,11.7,50,19.2],
["J04010","虱目鱼平均值(去皮)","虱目魚平均值(去皮)",179,21.8,0.2,9.5],
["H1250101","豌豆仁罐头","豌豆仁罐頭",123,7.2,22.1,0.9],
["J2200801","龙虾卵(调味)","龍蝦卵(調味)",64,6.7,5.2,1.8],
["B0500201","小芋头(山芋)","小芋頭(山芋)",113,2.3,22.8,1.2],
["E1500201","带壳熟绿竹笋","帶殼熟綠竹筍",25,2,4.9,0.1],
["E5700101","萝卜叶","蘿蔔葉",14,1.7,2,0.2],
["E2400101","白洋葱","白洋蔥",42,1,10,0.1],
["J0409001","松鲷","松鯛",98,18.2,0.1,2.3],
["J0410301","多鳞四指马鮁","多鱗四指馬鮁",146,19,0,7.2],
["J0412105","台湾鲷鱼片(烤·230°C·10分钟)","台灣鯛魚片(烤,230℃,10分鐘)",127,21.3,1.5,4],
["J0412106","台湾鲷鱼片(烤·230°C·20分钟)","台灣鯛魚片(烤,230℃,20分鐘)",142,24.6,2.5,4.1],
["G0710101","乾柳松菇","乾柳松菇",286,23.5,53.5,1.9],
["G0100101","木耳","木耳",38,0.9,8.8,0.1],
["J0800401","柴鱼片","柴魚片",383,76.5,2.6,6.2],
["J0409101","三线矶鲈","三線磯鱸",130,19,0.6,5.4],
["J0414101","花腹鲭","花腹鯖",138,23.9,0.1,4],
["J0405701","横纹九刺鮨","橫紋九刺鮨",85,19.3,0,0.3],
["G1300202","杏鲍菇(中)","杏鮑菇(中)",40,2.5,8.2,0.2],
["G0300101","草菇","草菇",36,3.8,5.9,0.3],
["E04001","白萝卜平均值","白蘿蔔平均值",18,0.5,3.9,0.1],
["E02001","胡萝卜平均值","胡蘿蔔平均值",39,1.1,8.9,0.1],
["D28001","水蜜桃平均值","水蜜桃平均值",39,0.9,9.7,0.2],
["D3000302","梨山蜜梨","梨山蜜梨",47,0.3,12.7,0],
["A0501201","糙籼米","糙秈米",359,7.3,73.6,3.2],
["I04024","去皮清肉平均值","去皮清肉平均值",119,23.3,0,2.1],
["I04041","骨腿平均值","骨腿平均值",163,18,0.2,9.5],
["D2700203","国产甜柿","國產甜柿",47,0.4,12.7,0.1],
["D3200601","金冠苹果","金冠蘋果",49,0.4,13,0.1],
["J0411802","尼罗口孵非鲫(含皮)(2022年取样)","尼羅口孵非鯽(含皮)(2022年取樣)",122,20.4,3,3.9],
["E1300101","茭白笋","茭白筍",20,1.3,4,0.2],
["E3700202","芹菜(黄梗)","芹菜(黃梗)",18,0.8,3.8,0.2],
["E3700301","西洋芹菜","西洋芹菜",11,0.4,2.2,0.2],
["I0308301","猪腹脇排","豬腹脇排",267,18.7,0,20.7],
["I0304401","僧帽肌","僧帽肌",209,20.4,0,13.5],
["E2600301","韮菜黄","韮菜黃",16,1.5,2.9,0.1],
["E2600101","韮菜花","韮菜花",24,1.8,4.6,0.2],
["J0402405","大西洋鲑鱼腹肉","大西洋鮭魚腹肉",349,16.4,0,31],
["J0414801","鲭鱼(炒)","鯖魚(炒)",410,16.7,0.1,37.6],
["R6800201","鲭鱼肉脯","鯖魚肉脯",685,33.8,1.5,60.4],
["E7500602","朝天椒(长果)","朝天椒(長果)",90,3.4,17.9,1.3],
["E7500502","长辣椒(青皮)","長辣椒(青皮)",49,1.9,10.3,0.4],
["J0200201","双髻鲨","雙髻鯊",117,27.4,0,0.1],
["E6600101","隼人瓜","隼人瓜",23,0.7,5.2,0.1],
["E7600101","黄秋葵","黃秋葵",36,2.1,7.5,0.1],
["E8300101","绿豆芽","綠豆芽",24,2.3,4.1,0.2],
["E8000101","黄豆芽","黃豆芽",34,5.4,2.5,1.2],
["D1900203","黑美人西瓜","黑美人西瓜",36,0.9,9.1,0.1],
["C1750401","蛋酥花生仁","蛋酥花生仁",606,21.1,31.8,43.8],
["E74004","小番茄平均值(红色系)","小番茄平均值(紅色系)",33,0.9,7.4,0.2],
["G08101","乾香菇平均值","乾香菇平均值",321,20.9,64.9,1.6],
["O0700401","咖啡(三合一)","咖啡(三合一)",39,0.9,8.2,0.3],
["A0550801","保久米浆","保久米漿",62,1,11.3,1.5],
["O0701601","奶茶(三合一)","奶茶(三合一)",42,0.5,9.5,0.3],
["D3400303","圆果金柑汁(绿皮)","圓果金柑汁(綠皮)",32,0.9,8,0.1],
["D3200102","翠玉青苹果","翠玉青蘋果",46,0.3,12.2,0.1],
["O0200201","仙草蜜","仙草蜜",35,0,8.8,0],
["R9901101","鸡精","雞精",34,8.6,0,0],
["O0901701","可可粉","可可粉",464,20.8,43.8,22.8],
["E0300101","根菾菜根","根菾菜根",34,1.3,7.8,0.1],
["P1002501","甜辣酱","甜辣醬",116,1,28.1,0],
["P1002601","甜面酱","甜麵醬",216,4.5,44,2.4],
["D0800901","李林蕉(2012年取样)","李林蕉(2012年取樣)",111,1.5,29.2,0.1],
["D0801001","红皮蕉(2012年取样)","紅皮蕉(2012年取樣)",93,1.3,24,0.3],
["P1300601","桑葚果酱","桑葚果醬",227,0.9,54.9,0.4],
["D2100202","海顿芒果","海頓芒果",60,0.4,15.7,0.2],
["E5100201","黄金菾菜","黃金菾菜",18,2.4,2.6,0.2],
["C1610202","黑芝麻(熟)(2022年取样)","黑芝麻(熟)(2022年取樣)",591,20.7,21.1,51.8],
["G1300101","杏香菇","杏香菇",26,2.7,4.6,0.1],
["G0400101","鸡腿菇","雞腿菇",36,2.1,7.5,0.1],
["J0414802","鲭鱼(炸)","鯖魚(炸)",555,17.2,0.1,53.4],
["J0414808","鲭鱼(煮)","鯖魚(煮)",375,14.9,0.4,34.5],
["J2101801","正樱虾(生)","正櫻蝦(生)",88,17.9,0,1.3],
["J2101901","正樱虾(熟)","正櫻蝦(熟)",97,19.6,0,1.4],
["J3200101","干贝(冷冻)","干貝(冷凍)",57,12.7,1.7,0.4],
["B0700101","红马铃薯(粉红珍珠马铃薯)","紅馬鈴薯(粉紅珍珠馬鈴薯)",66,1.6,14.4,0],
["J0403601","金鳞鱼","金鱗魚",85,19.5,1.3,0.1],
["J0403301","斑鳍飞鱼","斑鰭飛魚",94,22,0.2,0.1],
["R0400201","硷粽","鹼粽",133,2.1,26.8,1.7],
["R2700101","葱油饼","蔥油餅",305,8.3,46.9,9.3],
["R2600101","披萨(夏威夷)","披薩(夏威夷)",270,12,35.9,8.7],
["O0701701","乌龙奶茶(去冰·微糖)","烏龍奶茶(去冰,微糖)",59,0.2,8.1,2.9],
["O0702201","珍珠奶茶(去冰·全糖)","珍珠奶茶(去冰,全糖)",94,0.2,17.9,2.4],
["O0702101","珍珠奶茶(去冰·半糖)","珍珠奶茶(去冰,半糖)",84,0.2,14.5,2.7],
["E3500101","豆瓣菜","豆瓣菜",21,2.2,3.2,0.3],
["E9100101","假人蔘","假人蔘",32,1.6,2.2,2.2],
["E9700101","蕺菜","蕺菜",46,3.2,7.7,0.9],
["D2800301","蟠桃","蟠桃",45,0.9,11.3,0.2],
["J04006","魩仔鱼平均值(加工)","魩仔魚平均值(加工)",124,26.2,1,1.3],
["J04024","大西洋鲑鱼平均值(去皮)","大西洋鮭魚平均值(去皮)",221,20.2,0,14.9],
["P1003601","姜蓉酱","薑蓉醬",65,1,9.4,2.6],
["P1002401","排骨酱","排骨醬",221,2.3,43.1,4.4],
["G0100201","冷冻木耳","冷凍木耳",51,0.9,12.4,0.1],
["I0200201","山羊前腿肉片","山羊前腿肉片",123,21.3,0,3.5],
["I0700101","火鸡肉","火雞肉",141,21.1,0,5.6],
["L0400101","淡炼乳","淡煉乳",136,6.5,9.1,8.3],
["A0352401","锅烧面","鍋燒麵",120,4.5,24.6,0.4],
["I0322301","猪蹄膀","豬蹄膀",331,17.1,0,28.6],
["I0320501","猪舌","豬舌",185,18.5,0,11.8],
["L0124501","中脂调味乳(维生素强化)","中脂調味乳(維生素強化)",59,2,8.6,1.9],
["E3200601","土植小白菜(1月取样)","土植小白菜(1月取樣)",10,1.1,1.5,0.2],
["P1400301","奶精粉(低脂)","奶精粉(低脂)",450,2.1,75.2,15.7],
["J0416001","单角革单棘魨(含皮)","單角革單棘魨(含皮)",76,17.9,0,0],
["R4100301","冷冻甘薯条","冷凍甘薯條",182,1.8,29,6.5],
["A0500204","粳米(台粳8号)","粳米(台粳8號)",355,6.9,78.8,0.4],
["E0400102","白萝卜(长形)","白蘿蔔(長形)",19,0.4,4.4,0.1],
["E0400301","青萝卜","青蘿蔔",33,1.8,7,0.1],
["K0108201","乌骨鸡蛋黄","烏骨雞蛋黃",344,15.5,1.4,30.6],
["K0314101","鹌鹑咸蛋","鵪鶉鹹蛋",171,13.7,1.9,12.3],
["E1600101","熟箭竹笋","熟箭竹筍",20,2.1,2.9,0.3],
["E2400301","黄洋葱","黃洋蔥",42,1,9.5,0.2],
["J0414501","台湾马加鰆","臺灣馬加鰆",180,20.2,0,10.4],
["J0401401","草鱼(含皮)","草魚(含皮)",91,17.2,0.8,2],
["L0106101","低脂鲜乳","低脂鮮乳",43,3.1,5,1.3],
["E3200704","水植小白菜(10月取样)","水植小白菜(10月取樣)",12,1.1,1.8,0.3],
["E3200804","有机小白菜(10月取样)","有機小白菜(10月取樣)",13,1.3,1.9,0.2],
["D30001","西洋梨平均值","西洋梨平均值",53,0.3,14.1,0.2],
["Q6100501","代可可脂白巧克力","代可可脂白巧克力",562,8.6,53.8,34.7],
["C1610101","白芝麻(熟)","白芝麻(熟)",626,20.3,15.7,58.7],
["Q6100401","糖衣牛奶巧克力","糖衣牛奶巧克力",481,4.8,73.6,18.6],
["Q6200501","牛轧糖","牛軋糖",477,9.7,60.8,21.7],
["Q6200601","核枣糕","核棗糕",425,2.5,71.1,14.6],
["Q0900401","蜂蜜蛋糕(原味)","蜂蜜蛋糕(原味)",346,6.5,47.4,14.5],
["P1001601","羊肉炉酱","羊肉爐醬",130,7.3,8.9,7.2],
["C2110202","盐酥葵瓜子(带壳)","鹽酥葵瓜子(帶殼)",575,25.9,17.8,49.3],
["O0700301","拿铁咖啡(无糖)","拿鐵咖啡(無糖)",43,3,3.4,2],
["O0701501","鲜奶茶(无糖)","鮮奶茶(無糖)",27,2,1.4,1.4],
["J0409301","密点少棘胡椒鲷","密點少棘胡椒鯛",94,19.5,0,1.2],
["J3500901","象牙凤螺","象牙鳳螺",78,16.9,3.6,0.7],
["D3400301","长果金柑","長果金柑",56,1,14.1,0.2],
["Q1000601","蜜糖甜甜圈(波/摩堤)","蜜糖甜甜圈(波/摩堤)",396,2,50.6,20.7],
["R6400301","冷冻虾卷","冷凍蝦捲",156,10.3,16,5.7],
["R6200201","冷冻花枝排","冷凍花枝排",187,5.5,24.9,7.3],
["E4000101","芫荽","芫荽",26,2.3,4.5,0.3],
["L0104101","中脂鲜乳","中脂鮮乳",48,3.1,4.8,1.9],
["Q9900201","冰淇淋粉(香草)","冰淇淋粉(香草)",430,15.9,65.3,11.7],
["E3201403","有机青江菜(7月取样)","有機青江菜(7月取樣)",21,1.9,3.5,0.2],
["A0410101","乾玉米粒","乾玉米粒",373,10.9,72.2,3.9],
["E3200605","土植小白菜(10月取样)","土植小白菜(10月取樣)",11,1.1,1.7,0.2],
["L0214301","部份脱脂强化奶粉(纤维&钙强化)","部份脫脂強化奶粉(纖維&鈣強化)",375,35.9,48.9,3.7],
["L0204301","部份脱脂低乳糖奶粉","部份脫脂低乳糖奶粉",416,34.6,45.6,10.4],
["E3800101","大心芥菜","大心芥菜",13,1,2.5,0],
["E3800201","大芥菜","大芥菜",19,0.8,3.4,0.5],
["L0308201","脱脂稀释发酵乳(钙强化)","脫脂稀釋發酵乳(鈣強化)",72,1,16.9,0.1],
["L0312101","全脂浓稠发酵乳","全脂濃稠發酵乳",90,4.1,11.3,3.2],
["E5300402","有机本岛莴苣(4月取样)","有機本島萵苣(4月取樣)",19,1.1,3.5,0.3],
["E5300601","结球莴苣","結球萵苣",13,0.7,2.8,0.1],
["I0406102","二节翅(肉鸡)","二節翅(肉雞)",223,16.4,0.6,17],
["E1000101","孟宗竹笋","孟宗竹筍",40,4,7.3,0.1],
["E1100101","熟桂竹笋","熟桂竹筍",21,2.1,3.5,0.2],
["E3201402","有机青江菜(4月取样)","有機青江菜(4月取樣)",15,1.4,2.5,0.2],
["E3800301","包心芥菜","包心芥菜",17,1,2.7,0.5],
["E5300203","土植本岛莴苣(4月取样)","土植本島萵苣(4月取樣)",17,0.9,3.3,0.2],
["E5300302","水植本岛莴苣(4月取样)","水植本島萵苣(4月取樣)",15,1,2.7,0.2],
["E5600101","土植蕹菜(1月取样)","土植蕹菜(1月取樣)",22,2,3.5,0.3],
["E5600201","水植蕹菜(1月取样)","水植蕹菜(1月取樣)",27,2.7,4.5,0.3],
["J0400701","盐渍小鳞脂眼鲱(咸馧仔)","鹽漬小鱗脂眼鯡(鹹馧仔)",228,17.4,0.3,17],
["J0407801","双带鰺","雙帶鰺",118,22.6,0,2.4],
["A0550103","浊水米粉","濁水米粉",357,5.3,81.1,1.3],
["A0320303","中筋面粉","中筋麵粉",361,11.5,74.1,1.3],
["E5800201","冷冻花椰菜","冷凍花椰菜",21,1.3,4.5,0.1],
["J0406101","多鳞沙鮻","多鱗沙鮻",90,18.6,0.6,1.2],
["D2600101","笔柿","筆柿",69,0.6,18.3,0.1],
["K0100301","乌骨鸡蛋","烏骨雞蛋",160,12.7,2.4,11.6],
["B0100208","山药(白皮削)","山藥(白皮削)",75,2.5,15.7,0.1],
["K0100701","初卵鸡蛋","初卵雞蛋",136,12.3,1.4,9.2],
["E1200101","乌壳绿竹笋","烏殼綠竹筍",21,1.8,3.8,0.2],
["L0126101","低脂调味乳(木瓜)","低脂調味乳(木瓜)",61,1.8,10.5,1.3],
["L0124301","中脂调味乳(果汁)","中脂調味乳(果汁)",54,1.6,8.4,1.6],
["E3201404","有机青江菜(10月取样)","有機青江菜(10月取樣)",9,1.3,1.1,0.2],
["E3201401","有机青江菜(1月取样)","有機青江菜(1月取樣)",10,1.5,1.5,0],
["J0407201","杜氏鰤","杜氏鰤",115,21.9,0.2,2.4],
["R4100401","冷冻马铃薯条","冷凍馬鈴薯條",151,2.2,25.5,4.5],
["L0118301","脱脂强化鲜乳(铁强化)","脫脂強化鮮乳(鐵強化)",41,4.2,5.6,0.2],
["L0110201","高脂强化鲜乳(寡醣强化)","高脂強化鮮乳(寡醣強化)",69,3.2,5.1,4.1],
["E3900201","芥蓝芽","芥藍芽",26,2.2,4.5,0.3],
["E3800401","芥菜","芥菜",18,1.6,3.2,0.1],
["D3830102","莱姆汁","萊姆汁",34,0.3,8.1,0.5],
["A0500203","粳米(台粳2号)","粳米(台粳2號)",357,7.2,78.7,0.5],
["A0400501","糯玉米","糯玉米",172,4.7,33.4,1.9],
["D3100101","印度枣(长形)","印度棗(長形)",43,1.2,10.4,0.2],
["E7400103","桃太郎番茄","桃太郎番茄",17,0.7,4,0],
["E7400303","绿番茄","綠番茄",25,0.9,5.4,0.1],
["D2700202","甜柿(进口)","甜柿(進口)",57,0.6,15.3,0.1],
["D2700501","柿饼","柿餅",196,1.7,52.2,0.2],
["E3201302","水植青江菜(4月取样)","水植青江菜(4月取樣)",14,1.4,2.4,0.2],
["E3201303","水植青江菜(7月取样)","水植青江菜(7月取樣)",14,1.7,2.2,0.1],
["P1001501","牛排酱","牛排醬",130,2.5,30.1,0],
["P1003701","蘑菇酱","蘑菇醬",58,1.5,7.7,2.4],
["C2005101","爱玉子","愛玉子",407,12.2,63.7,12.5],
["P0200301","豆酥","豆酥",540,30.1,19.2,38.1],
["P1004001","豆酥酱","豆酥醬",671,12.2,10.4,64.5],
["J0414812","鲭鱼(腌制)(2022年取样)","鯖魚(醃製)(2022年取樣)",262,17,9.8,21],
["K0100202","土鸡蛋(2022年取样)","土雞蛋(2022年取樣)",137,12.2,1.8,9.3],
["D21002","芒果平均值(西洋种)","芒果平均值(西洋種)",50,0.6,13,0.2],
["R2300401","冷冻豆沙包","冷凍豆沙包",247,7.4,51.8,1.1],
["Q0600801","米粩","米粩",442,2.6,76.9,13.7],
["Q4100401","蛋卷(芝麻)","蛋捲(芝麻)",549,6.8,55.5,33.3],
["R2201201","冷冻菜肉馄饨","冷凍菜肉餛飩",236,9.1,13.3,16.3],
["R6600301","冷冻蛋饺","冷凍蛋餃",183,12.1,2.1,14.1],
["R6300401","冷冻花枝块","冷凍花枝塊",180,11.3,17,7.5],
["Q6400601","巧克力夹心糖","巧克力夾心糖",403,0.7,93.7,2.8],
["C0120101","杏仁霜","杏仁霜",530,9.7,47.1,36.4],
["Q6400101","太妃糖","太妃糖",438,2.7,75.6,13.9],
["R2300801","冷冻牛肉包子","冷凍牛肉包子",269,10.8,46.1,4.6],
["R2300701","冷冻叉烧包子","冷凍叉燒包子",267,7.1,46,6.1],
["R4400501","冷冻洋葱圈","冷凍洋蔥圈",281,4,41.4,11],
["H1200301","高山大豌豆荚","高山大豌豆莢",49,2.4,9.9,0],
["C1210102","酱油西瓜子","醬油西瓜子",509,29.5,22.5,37.7],
["A0850101","燕麦奶","燕麥奶",44,1,8.1,0.8],
["Q9900101","布丁粉","布丁粉",419,2.7,86.1,7.1],
["O0100201","芭乐汁(非原汁)","芭樂汁(非原汁)",45,0.1,11,0.1],
["R0600101","猪血糕","豬血糕",194,8.6,37.8,0.9],
["O0101201","苹果汁(非原汁)","蘋果汁(非原汁)",47,0.1,10.9,0.4],
["P0100701","西洋芹菜片","西洋芹菜片",315,24.4,49.9,6.8],
["D3500201","白柚","白柚",37,0.6,9.6,0.1],
["Q1001101","餐包","餐包",365,7.2,50.5,14.9],
["R5300301","小巧香肠","小巧香腸",362,15.1,11.9,28.2],
["R5100501","条状火腿(牛肉·黑胡椒)","條狀火腿(牛肉,黑胡椒)",113,18.9,4.1,2.3],
["O0702301","奶茶冲泡包(三合一)","奶茶沖泡包(三合一)",452,1.7,82.3,12.9],
["P0101101","白胡椒粉","白胡椒粉",342,3.7,78.8,1.1],
["P1100101","沙拉酱","沙拉醬",645,1.9,11.4,65.7],
["P0500301","高汤(猪大骨)","高湯(豬大骨)",49,4.2,6.6,0.7],
["P1000701","素食炸酱","素食炸醬",391,13.9,4.5,35.3],
["P1001001","速食乾面麻酱包","速食乾麵麻醬包",676,13.2,11.8,64],
["P1001301","蕃茄义大利面酱","蕃茄義大利麵醬",70,3.2,8.9,2.5],
["Q4100501","煎饼","煎餅",444,6.3,78.3,11.7],
["Q0700501","松饼","鬆餅",257,3.2,55.1,2.6],
["Q2100201","咖啡冻","咖啡凍",75,0.1,18.1,0.2],
["A0320601","杂粮中筋面粉","雜糧中筋麵粉",361,13.1,72,2.3],
["D3400101","椪柑","椪柑",40,0.8,10,0.2],
["I0304301","猪小排","豬小排",287,18,0,23.3],
["A0500205","粳米(台粳9号)","粳米(台粳9號)",353,6.6,78.2,0.6],
["E7400501","黄金小蕃茄","黃金小蕃茄",31,0.8,6.8,0.2],
["D1900204","凤光西瓜","鳳光西瓜",27,0.7,6.5,0.2],
["E3200602","土植小白菜(3月取样)","土植小白菜(3月取樣)",12,1.6,1.9,0.1],
["I0110101","牛五花肉火锅片","牛五花肉火鍋片",430,15.7,0,40.3],
["I0110102","牛纽约客火锅片","牛紐約客火鍋片",263,20.1,0,19.6],
["I0110104","牛嫩肩里肌火锅片","牛嫩肩里肌火鍋片",188,20,1.8,11.4],
["D3800201","莱姆","萊姆",38,0.5,7.7,1],
["E7400302","黑柿番茄","黑柿番茄",23,0.4,5.6,0.1],
["D2000405","香华洋香瓜","香華洋香瓜",30,0.7,7.7,0],
["G0350101","草菇罐头","草菇罐頭",31,3.3,5.4,0.1],
["B0820101","荸荠粉","荸薺粉",365,0.4,87.8,0.2],
["J0416101","克氏兔头魨","克氏兔頭魨",77,17.8,0,0.1],
["J0403108","鲻切片","鯔切片",170,21.2,0,8.8],
["J0700101","油鱼卵(加工)","油魚卵(加工)",445,46.6,0,27.3],
["J0401301","草鱼切片","草魚切片",166,21.4,2.1,8.3],
["J0600101","圆鳕鱼鳃肉","圓鱈魚鰓肉",84,14.5,3.9,2.5],
["H0405101","红豆","紅豆",328,20.9,61.5,0.6],
["J0404101","深海鳞角鱼","深海鱗角魚",80,17.7,0,0.5],
["J0408201","希氏姬鲷","希氏姬鯛",91,21.1,0.5,0.1],
["K0108101","鸡蛋黄(白壳)","雞蛋黃(白殼)",330,16,1.6,28.9],
["K0214102","鸭熟咸蛋","鴨熟鹹蛋",185,13.7,0.8,13.8],
["A0550401","粿仔条","粿仔條",193,0.5,45,1.2],
["H1000301","冷冻菜豆(荚)","冷凍菜豆(莢)",57,3.4,10.8,0.1],
["K0106102","鸡蛋白(黄壳)","雞蛋白(黃殼)",52,11.6,1.2,0.2],
["K0108102","鸡蛋黄(黄壳)","雞蛋黃(黃殼)",286,14.5,5.6,24.7],
["E2500101","红葱头","紅蔥頭",75,3.4,16.4,0.3],
["E3200803","有机小白菜(7月取样)","有機小白菜(7月取樣)",11,1.3,1.7,0.1],
["D3500301","西施蜜柚","西施蜜柚",40,0.8,10.1,0.2],
["E3000401","冷冻甘蓝","冷凍甘藍",20,1.3,4.2,0.1],
["E3700201","芹菜(青梗)","芹菜(青梗)",12,0.8,2.4,0.1],
["J0414803","鲭鱼(烤·150度·10分)","鯖魚(烤,150度,10分)",412,16.5,0,37.8],
["J0406801","大甲鰺","大甲鰺",105,21.2,0.4,1.6],
["J3100601","绿壳菜蛤干(淡菜)","綠殼菜蛤干(淡菜)",263,43.7,23.9,8.5],
["E0500101","百合鳞片","百合鱗片",137,3.8,32.3,0.1],
["E8900101","石莲花","石蓮花",11,0.4,2.2,0.1],
["J0409903","真鲷(5月)","真鯛(5月)",87,20,0,0.1],
["E9200101","野苦瓜嫩梢","野苦瓜嫩梢",77,5.7,12.2,1.7],
["E4100101","红梗珍珠菜","紅梗珍珠菜",37,2.6,5.6,1],
["E4600301","昭和草","昭和草",26,2.2,3.8,0.7],
["J0415303","银鲳(5月)","銀鯧(5月)",105,16.4,0,3.9],
["J0200301","鲨鱼切片","鯊魚切片",106,24.8,0,0],
["J4100401","红海参","紅海參",33,7.5,0,0.1],
["D2000203","嘉玉甜瓜","嘉玉甜瓜",43,1.3,10.4,0.1],
["A0510201","高纤米","高纖米",363,8.3,75.2,2.5],
["J0406201","日本马头鱼","日本馬頭魚",85,18.7,0,0.6],
["E2300101","青葱","青蔥",22,1.5,4.2,0.3],
["P0200401","咖哩粉","咖哩粉",417,13.9,58.5,14.1],
["P0100301","山葵粉","山葵粉",387,10.1,72.9,6.1],
["E3200802","有机小白菜(4月取样)","有機小白菜(4月取樣)",14,1.3,2.4,0.2],
["E3010101","脱水甘蓝","脫水甘藍",341,6.9,82.6,0.1],
["A0500501","白粳糯米(台中189号粳米)","白粳糯米(台中189號粳米)",359,8.4,78,0.5],
["P0200901","蒜头酥","蒜頭酥",452,11.7,61.2,17.8],
["P0900101","红辣椒油","紅辣椒油",899,0,0.1,99.8],
["E5300102","红叶莴苣(荷兰种)","紅葉萵苣(荷蘭種）",16,1.4,2.5,0.3],
["E5300101","奶油莴苣(日本种)","奶油萵苣(日本種)",16,1.1,2.6,0.3],
["I0404301","棒棒腿(土鸡)","棒棒腿(土雞)",143,21,0,5.9],
["E70001","蒲瓜平均值","蒲瓜平均值",18,0.5,4,0.1],
["J21009","白对虾平均值","白對蝦平均值",99,21.3,0,0.9],
["Q2200301","红豆牛奶冰棒","紅豆牛奶冰棒",155,3.5,24.3,4.9],
["Q2104201","传统豆花(未加糖)","傳統豆花(未加糖)",39,3.2,2.1,1.9],
["Q8100401","芭乐果乾","芭樂果乾",347,1.1,85.2,0.2],
["K01206","卤蛋白平均值","滷蛋白平均值",75,16.7,4.6,0.2],
["K01121","茶叶蛋平均值","茶葉蛋平均值",141,13.7,2.2,9.1],
["K01201","卤蛋平均值","滷蛋平均值",171,16.4,4.6,11.1],
["K01081","鸡蛋黄平均值","雞蛋黃平均值",308,15.2,3.6,26.8],
["J0409901","真鲷(1月)","真鯛(1月)",100,20.1,0.7,1.6],
["J0409902","真鲷(3月)","真鯛(3月)",101,20.8,0.7,1.3],
["I0520601","鸭翅","鴨翅",170,22.8,0,8.1],
["I0520701","鸭头","鴨頭",199,16.5,0,14.3],
["B0400401","红肉甘薯","紅肉甘薯",114,1.8,25.4,0.2],
["J0415302","银鲳(3月)","銀鯧(3月)",120,17.6,0.7,5],
["P1400202","奶精粉(2021年)","奶精粉(2021年)",550,2.1,57.6,34.6],
["J0409801","阿部牙鲷","阿部牙鯛",124,18.9,0,4.8],
["J2200101","大头虾仁","大頭蝦仁",40,8.8,0,0.2],
["J2200201","明虾仁","明蝦仁",52,11.9,0,0.1],
["P1300201","巧克力酱(液体)","巧克力醬(液體)",277,2,65.4,0.8],
["P1100301","千岛沙拉酱","千島沙拉醬",515,1,16.7,49.3],
["G9000201","金喜菇","金喜菇",39,2.7,7.7,0.2],
["G0500101","松茸","松茸",36,3.1,5.9,0.5],
["Q0500201","牛舌饼","牛舌餅",411,5.7,67.4,13.2],
["Q0300201","月饼(枣泥)","月餅(棗泥)",419,6,57.9,18.2],
["A0550701","米浆(散装)","米漿(散裝)",62,0.6,13.7,0.5],
["R4700401","豆腐皮","豆腐皮",209,25.3,2.4,11],
["I0108301","牛後腿腱子心","牛後腿腱子心",139,19.8,0,6],
["I0120101","牛肚(瘤胃)","牛肚(瘤胃)",44,7.5,0,1.4],
["I0120102","牛肚切片(瘤胃)","牛肚切片(瘤胃)",67,15.3,0.3,0.2],
["C1700201","冷冻带壳花生(熟)","冷凍帶殼花生(熟)",344,17.2,13.3,27.4],
["Q0300101","芋仔饼","芋仔餅",354,4.6,56.6,12.1],
["A0320404","高筋面粉","高筋麵粉",362,12.9,73.1,1.2],
["H1100301","冷冻毛豆仁","冷凍毛豆仁",135,12.5,9.8,6.1],
["A0520401","白糯米粉","白糯米粉",360,4.5,82.3,0.4],
["I0406201","三节翅(土鸡)","三節翅(土雞)",198,19,0,13],
["I0406202","三节翅(肉鸡)","三節翅(肉雞)",222,17.7,0,16.3],
["L0116201","低脂强化鲜乳(寡醣强化)","低脂強化鮮乳(寡醣強化)",46,3.1,5.5,1.3],
["L0130101","高脂保久乳","高脂保久乳",71,3.1,3.4,5.1],
["J0401701","胡鲶","鬍鯰",194,16.3,0,13.8],
["M2400101","椰子油","椰子油",883,0,0,99.9],
["M0100201","牛油(精炼)","牛油(精煉)",885,0,0.6,99.1],
["E7500201","甜椒(红皮)","甜椒(紅皮)",33,0.8,7.1,0.5],
["E7500401","甜椒(橙皮)","甜椒(橙皮)",35,0.9,7.7,0.3],
["M1500101","白芝麻油","白芝麻油",884,0.1,0,100],
["J0414601","鲔鱼生鱼片","鮪魚生魚片",100,23.3,0,0.1],
["Q2102101","鲜奶布丁","鮮奶布丁",110,3,13.1,5.1],
["L0204201","部份脱脂奶粉(即溶)","部份脫脂奶粉(即溶)",445,23.7,51.6,16.4],
["R5600101","猪肉脯","豬肉脯",441,33.4,20.3,25.1],
["R5300201","香肠","香腸",354,17,12.3,26.3],
["E5300204","土植本岛莴苣(7月取样)","土植本島萵苣(7月取樣)",23,1.4,4.4,0.3],
["E5300303","水植本岛莴苣(7月取样)","水植本島萵苣(7月取樣)",13,1.4,1.9,0.2],
["H01051","白凤豆平均值","白鳳豆平均值",337,23.8,58.2,2.1],
["L0314101","中脂浓稠发酵乳","中脂濃稠發酵乳",82,2.9,12.6,2.3],
["I0402102","里肌肉(肉鸡)","里肌肉(肉雞)",106,23.7,0,0.6],
["J0405901","日本红目大眼鲷","日本紅目大眼鯛",97,19.6,0,1.5],
["B0450101","油炸脱水甘薯","油炸脫水甘薯",525,2.3,61.2,30.1],
["J0403501","鳄形叉尾鹤鱵","鱷形叉尾鶴鱵",98,22.4,0.1,0.3],
["J3100701","西施舌","西施舌",53,8.9,5.4,1.6],
["J0414401","康氏马加鰆切片(含皮)","康氏馬加鰆切片(含皮)",176,19.3,1.5,10.4],
["D3400203","海梨桶柑","海梨桶柑",44,0.9,11,0.1],
["B0400101","冰心地瓜","冰心地瓜",119,1.3,27.5,0.1],
["B0900202","熟莲藕切片(水煮)","熟蓮藕切片(水煮)",73,0.8,16.9,0],
["H1110101","黄豆胚芽","黃豆胚芽",180,16.8,15.7,7],
["H0605201","黄仁黑豆","黃仁黑豆",253,20.6,40.3,2.1],
["J0410901","黄姑鱼","黃姑魚",89,19.4,0,0.7],
["J0414701","鲭鱼(生)","鯖魚(生)",417,14.4,0.2,39.4],
["B1000201","菱角仁(生)","菱角仁(生)",118,4.1,24.1,0.3],
["B1000101","菱角(生)","菱角(生)",76,1.9,16.1,0.3],
["D3200404","富士苹果","富士蘋果",49,0.2,13.1,0.1],
["D3200201","翠玉青苹果(带皮)","翠玉青蘋果(帶皮)",54,0.4,14.1,0.2],
["E2300103","日本甜葱","日本甜蔥",33,1,7.6,0.1],
["J2300301","金钩虾乾","金鉤蝦乾",257,54.6,0,2.6],
["J0400201","日本鳗鲡鱼片(生)","日本鰻鱺魚片(生)",254,18.1,0,19.6],
["C1605102","黑芝麻(生)","黑芝麻(生)",551,22.2,17.6,48.1],
["L0207101","脱脂奶粉","脫脂奶粉",361,36.2,51.2,0.9],
["L1200201","全脂羊奶粉(即溶)","全脂羊奶粉(即溶)",517,25.9,35.1,30.8],
["A1020101","薏仁粉","薏仁粉",395,10.9,80,3.5],
["E5600102","土植蕹菜(4月取样)","土植蕹菜(4月取樣)",20,1.7,3.5,0.2],
["M1300201","米油(粳米)","米油(粳米)",883,0,0,99.9],
["M1100301","大豆油(多种维生素强化)","大豆油(多種維生素強化)",883,0,0,99.9],
["E5910101","金针菜乾","金針菜乾",307,14.3,65.4,1.8],
["E5900101","金针菜","金針菜",40,2.4,7.4,0.5],
["C1750301","油炸花生仁","油炸花生仁",623,28.9,18,48.4],
["L0102103","全脂鲜乳(6月取样)","全脂鮮乳(6月取樣)",63,3.2,4.6,3.6],
["E6900101","越瓜","越瓜",18,0.6,4.1,0.1],
["E6950101","腌渍越瓜","醃漬越瓜",16,1.1,3,0.1],
["A0550601","白饭","白飯",183,3.1,41,0.3],
["J0411401","斑点鸡笼鲳","斑點雞籠鯧",97,21.9,0,0.3],
["J0413101","褐臭肚鱼","褐臭肚魚",164,19.9,0.6,8.8],
["E6200102","香芋冬瓜","香芋冬瓜",9,0.4,2,0],
["I0210301","去骨肩颈眼羊肉","去骨肩頸眼羊肉",198,17.8,0,13.5],
["I0900101","雉鸡","雉雞",124,24,0,2.4],
["I0120301","牛筋","牛筋",157,21.7,3.3,7.2],
["E4400101","茴香","茴香",24,2.2,4.1,0.2],
["E5400101","豌豆苗","豌豆苗",31,3.7,4.4,0.5],
["R5300601","德国香肠","德國香腸",275,15.9,4.6,21.4],
["J3101001","文蛤","文蛤",37,7.6,2.7,0.5],
["J3100301","黑齿牡蛎","黑齒牡蠣",55,9.7,3.1,1.5],
["E3850301","酸菜","酸菜",17,0.8,3.2,0.3],
["E9000101","青葙","青葙",50,2.5,7.7,1.6],
["E4200101","食茱萸","食茱萸",127,11.9,23.8,0.3],
["J0412501","蔷薇项鳍鱼(含皮)","薔薇項鰭魚(含皮)",93,17.9,0,1.8],
["L1104101","中脂鲜羊乳","中脂鮮羊乳",48,2.7,3.9,2.4],
["L0214201","部份脱脂强化奶粉(纤维&DHA强化)","部份脫脂強化奶粉(纖維&DHA強化)",476,23.2,47.3,22.1],
["E5300401","有机本岛莴苣(1月取样)","有機本島萵苣(1月取樣)",15,1.8,2.6,0],
["L0110101","高脂强化鲜乳(钙强化)","高脂強化鮮乳(鈣強化)",68,3.2,5.2,3.9],
["L0118201","脱脂强化鲜乳(寡醣强化)","脫脂強化鮮乳(寡醣強化)",36,3.1,5.2,0.4],
["E5600204","水植蕹菜(10月取样)","水植蕹菜(10月取樣)",23,2.2,3.8,0.3],
["E5600302","有机蕹菜(10月取样)","有機蕹菜(10月取樣)",19,1.7,3,0.4],
["J0405601","驼背鲈","駝背鱸",83,18.1,0,0.6],
["O0901201","芝麻糊冲泡包","芝麻糊沖泡包",458,9.3,70.7,15.4],
["M0200101","猪油","豬油",890,0,0,99.7],
["M2700101","橄榄油","橄欖油",884,0,0,100],
["E5800501","冷冻青花菜","冷凍青花菜",25,2.5,4.4,0.2],
["A0450201","玉米酱罐头","玉米醬罐頭",66,1.4,14,0.4],
["E3900101","芥蓝菜","芥藍菜",20,1.7,3.2,0.3],
["E5300201","土植本岛莴苣(1月取样)","土植本島萵苣(1月取樣)",17,1.6,2.5,0.4],
["E5300301","水植本岛莴苣(1月取样)","水植本島萵苣(1月取樣)",14,1.6,2.1,0.2],
["E5600104","土植蕹菜(10月取样)","土植蕹菜(10月取樣)",17,1.8,2.6,0.3],
["B0720101","马铃薯粉","馬鈴薯粉",346,0.1,83.8,0.1],
["O0900901","面茶粉","麵茶粉",423,7.2,82.9,7],
["J0200202","双髻鲨腹肉","雙髻鯊腹肉",110,25.8,0,0],
["J0411001","黑或(或字加鱼边)","黑或(或字加魚邊)",149,17.9,1.2,8],
["J0402801","印度镰齿鱼","印度鐮齒魚",49,10.4,0.4,0.5],
["E5810101","花椰菜乾","花椰菜乾",291,16,62.5,0.6],
["E5800401","青花菜(1999年取样)","青花菜(1999年取樣)",28,3.7,4.4,0.2],
["J0407601","无斑圆鰺","無斑圓鰺",119,23.9,0,1.9],
["J0406501","鬼头刀","鬼頭刀",107,21.8,0,1.5],
["K01001","鸡蛋平均值","雞蛋平均值",135,12.7,1.6,8.9],
["K01061","鸡蛋白平均值","雞蛋白平均值",50,11.2,0.5,0.1],
["R5300701","冷冻小香肠","冷凍小香腸",249,14.8,7.4,17.8],
["Q6400401","苦茶糖","苦茶糖",396,0.1,98.5,0.2],
["E9930101","仙草","仙草",18,0.3,4.1,0.2],
["E1700204","绿芦笋(短型)","綠蘆筍(短型)",22,3.5,3,0.1],
["N0800101","黑糖蜜","黑糖蜜",280,0.2,72.4,0],
["O0100701","杨桃汁(非原汁)","楊桃汁(非原汁)",49,0,12,0.1],
["O0200101","蕃茄汁(非原汁)","蕃茄汁(非原汁)",22,0.7,4.4,0.2],
["D4300101","蛋黄果","蛋黃果",106,1.4,27.3,0.3],
["Q1001001","汉堡包","漢堡包",322,9.1,54.9,7.4],
["R4400301","韩式泡菜","韓式泡菜",35,2,5.8,0.4],
["R2700301","冷冻蛋饼皮","冷凍蛋餅皮",231,5.7,43.7,3.7],
["R8100201","玉米浓汤调理包","玉米濃湯調理包",369,4.4,74.7,5.9],
["A0352701","面线","麵線",350,11.7,72.4,1.5],
["A0550201","米粄条","米粄條",129,1.1,29.2,0.9],
["E5300202","土植本岛莴苣(3月取样)","土植本島萵苣(3月取樣)",18,0.3,3.8,0.3],
["E5600401","水蕹菜","水蕹菜",24,2.6,3.3,0.5],
["D3200301","美国五爪苹果","美國五爪蘋果",51,0.2,13.8,0.1],
["J0405002","青星九刺鮨鱼片","青星九刺鮨魚片",104,22.6,0,0.8],
["R5600201","猪肉酥","豬肉酥",513,33,31.6,28.3],
["D2000401","七股香洋香瓜","七股香洋香瓜",40,0.6,10.5,0.1],
["D4200101","香瓜茄","香瓜茄",24,0.4,6.2,0.1],
["D1500301","红心芭乐","紅心芭樂",42,0.8,10.7,0.1],
["E7510101","乾长辣椒(红皮)","乾長辣椒(紅皮)",382,19.9,47.6,17.2],
["D2100204","爱文芒果","愛文芒果",42,0.4,11,0.2],
["R0500401","筒仔米糕","筒仔米糕",246,6.6,35.5,8.6],
["R0100101","广东粥","廣東粥",81,4.9,9.1,2.8],
["R2200601","冷冻素食水饺","冷凍素食水餃",175,8.7,25.8,4.1],
["R3100101","冷冻可乐饼(奶汁)","冷凍可樂餅(奶汁)",114,3.6,19.8,2.3],
["J0410501","小黄鱼(去皮)","小黃魚(去皮)",100,20,0,1.6],
["J0409905","真鲷(9月)","真鯛(9月)",92,21.6,0,0],
["A0551001","糙籼米浆","糙秈米漿",68,0.9,11.4,2.1],
["E1900102","粉姜","粉薑",28,1,6.1,0.3],
["E0200102","向阳二号胡萝卜","向陽二號胡蘿蔔",44,0.6,10.6,0.1],
["E2800101","小麦苗","小麥苗",34,3.3,5.5,0.5],
["I0320401","猪耳","豬耳",219,24.2,0.9,12.8],
["I0320701","猪尾","豬尾",295,16.2,7.1,25],
["R4700101","佃煮黑豆","佃煮黑豆",271,10.5,43.5,6.2],
["H1150201","豆浆(无糖)","豆漿(無糖)",35,3.6,0.7,1.9],
["D2000102","状元瓜","狀元瓜",27,0.7,6.6,0.1],
["D2000302","新疆哈蜜瓜","新疆哈蜜瓜",28,0.7,6.9,0.1],
["R6700501","冷冻花枝浆","冷凍花枝漿",227,11.2,17.1,12.6],
["I0321501","猪软骨","豬軟骨",332,15.6,0,29.4],
["I0321301","猪油渣","豬油渣",837,17.4,0,84.5],
["R6700301","鱼板","魚板",128,10,17.6,2],
["R4100201","粉圆","粉圓",346,0.2,86.2,0],
["P0201501","山楂","山楂",345,1.9,78.7,2.5],
["B0100214","山药(白肉)","山藥(白肉)",69,2.1,14.4,0.1],
["I0300502","猪肩胛排(2021年取样)","豬肩胛排(2021年取樣)",244,17.8,0,18.7],
["J0407202","长鳍鰤鱼","長鰭鰤魚",114,22.8,2.7,1.9],
["K0112801","茶叶蛋黄(浸泡隔夜)","茶葉蛋黃(浸泡隔夜)",342,15.7,2.2,30.3],
["L0400201","加糖部份脱脂炼乳","加糖部份脫脂煉乳",318,7.5,56.2,7.8],
["L0322101","全脂凝态发酵乳","全脂凝態發酵乳",97,3.1,13.6,3.3],
["L0200101","全脂奶粉","全脂奶粉",504,26.4,37,28.2],
["L0102105","全脂鲜乳(10月取样)","全脂鮮乳(10月取樣)",64,3,4.8,3.7],
["L0318401","脱脂浓稠发酵乳(啤酒酵母)","脫脂濃稠發酵乳(啤酒酵母)",34,2.1,6.4,0.1],
["I0322401","卤猪脚","滷豬腳",237,28.4,0,15.4],
["I0100102","带骨牛小排","帶骨牛小排",360,13.1,0.4,33.7],
["L0124101","中脂调味乳(巧克力)","中脂調味乳(巧克力)",63,1.9,9.2,2],
["M2600101","葡萄籽油","葡萄籽油",884,0,0,100],
["M1100201","大豆油(卵磷脂强化)","大豆油(卵磷脂強化)",880,0,0,99.6],
["B0800101","荸荠","荸薺",67,1.7,14.5,0.1],
["E8100101","黑豆芽","黑豆芽",69,7.4,8.3,2],
["A0320101","去筋面粉","去筋麵粉",355,0.2,85.7,0.1],
["I0420701","鸡睾丸","雞睪丸",71,10.6,0.2,2.8],
["J2200501","草虾仁","草蝦仁",44,9.7,0.9,0.3],
["J2102001","正樱虾(加工)","正櫻蝦(加工)",253,52.6,13.4,3.1],
["J0412201","台湾鲷鱼汤(水煮)","台灣鯛魚湯(水煮)",5,0.9,0,0.2],
["J0412103","台湾鲷鱼片(烤·190°C·10分钟)","台灣鯛魚片(烤,190℃,10分鐘)",111,19.7,1.8,3],
["J0412104","台湾鲷鱼片(烤·190°C·20分钟)","台灣鯛魚片(烤,190℃,20分鐘)",134,23,2.1,4],
["G0800102","香菇(小)","香菇(小)",26,2.4,4.9,0.1],
["G0810104","乾钮扣菇","乾鈕釦菇",325,24.6,60.9,2.7],
["J0413301","後刺尾鲷","後刺尾鯛",102,20.4,0,1.7],
["J0406901","日本竹筴鱼","日本竹筴魚",116,23,0,2],
["R4700801","百页豆腐","百頁豆腐",196,13.4,6.3,13.1],
["J0414902","旗鱼腹肉","旗魚腹肉",105,22.2,0,1.1],
["J0415201","星斑真鲳","星斑真鯧",214,15.6,0,16.3],
["H1000101","粉豆荚","粉豆莢",27,1.7,5,0.1],
["H1000201","敏豆荚","敏豆莢",30,1.7,5.3,0.2],
["R0700101","肉圆","肉圓",136,3.1,27.3,1.6],
["E5600203","水植蕹菜(7月取样)","水植蕹菜(7月取樣)",17,1.9,2.7,0.2],
["E2600201","韮菜","韮菜",23,1.9,3.9,0.4],
["I0420401","鸡胗(肉鸡)","雞胗(肉雞)",89,16.6,0.3,2],
["I0604201","熟鹅腿肉","熟鵝腿肉",292,18.5,0,23.6],
["R0700201","清蒸虾仁肉圆","清蒸蝦仁肉圓",152,4.6,16.7,7.4],
["Q0100101","冷藏宁波年糕","冷藏寧波年糕",220,3.9,49.7,0.6],
["E7500102","小甜椒(青皮)","小甜椒(青皮)",35,1.4,6.8,0.5],
["A0550101","埔里米粉","埔里米粉",358,0.5,87.7,0.5],
["I0402201","带骨去皮对切胸(肉鸡)","帶骨去皮對切胸(肉雞)",104,22.4,0,0.9],
["I0420501","冷冻烤鸡翅","冷凍烤雞翅",217,18.8,3.6,14.2],
["E7300201","圆茄子","圓茄子",21,1,4.5,0],
["D2100405","金兴芒果","金興芒果",41,0.6,10.6,0.1],
["D1100202","甜蜜蜜凤梨","甜蜜蜜鳳梨",42,1,10.6,0.1],
["J0408501","前鳞笛鲷","前鱗笛鯛",101,22,0.9,0.8],
["J0407301","范氏副叶鰺","范氏副葉鰺",108,20.9,2.1,2.1],
["J0408101","史氏红谐鱼","史氏紅諧魚",97,21.1,0,0.7],
["D1700601","美国黑葡萄(含皮)","美國黑葡萄(含皮)",63,0.6,16.4,0.2],
["D2400101","加州青李","加州青李",47,0.6,12,0.2],
["J2200401","海鲈虾仁","海鱸蝦仁",73,16.3,1.3,0.4],
["B0200301","红薯山药","紅薯山藥",92,2.8,19.6,0.1],
["D3000301","将军蜜梨","將軍蜜梨",50,0.4,13.3,0.1],
["A0810101","燕麦片","燕麥片",393,12.3,64.1,9.7],
["B0100203","山药(大汕3号)","山藥(大汕3號)",73,2.6,15,0.1],
["J4100501","黑乌参","黑烏參",29,6.5,0,0.1],
["I0310101","猪肝连","豬肝連",220,14.6,0,17.5],
["R5100301","切片火腿(猪肉)","切片火腿(豬肉)",147,16.5,9,4.9],
["R5300101","牛肉香肠","牛肉香腸",298,20.7,7.8,20.4],
["R5100701","酱肘子","醬肘子",134,19,0,6.6],
["A0501302","糙粳米(台粳9号)","糙粳米(台粳9號)",364,7.4,76.6,2.3],
["P1500501","面包粉","麵包粉",370,14.4,74.6,1.5],
["R6700101","冷冻蟹味棒","冷凍蟹味棒",118,9.3,18.6,0.7],
["R5500201","冷冻鸡块","冷凍雞塊",228,15.3,12.6,12.9],
["I0320901","腌燻猪肝","醃燻豬肝",167,26.8,4.2,4.7],
["R5200102","片状肉乾(牛肉·辣味)","片狀肉乾(牛肉,辣味)",335,38,29.9,7],
["H1600101","鹰嘴豆","鷹嘴豆",364,19.4,61,5.8],
["R4800201","冷冻素鸡块","冷凍素雞塊",206,14.2,19,8.1],
["Q6200301","花生糖","花生糖",562,17.9,43.3,35.3],
["Q6800201","酵母菌咀嚼锭","酵母菌咀嚼錠",391,23.6,61.4,5.6],
["Q1000101","土司","土司",289,9.5,48.6,6.3],
["Q0900601","蜂蜜蛋糕(起司)","蜂蜜蛋糕(起司)",352,7.4,39.9,18.1],
["Q0900101","乳酪蛋糕","乳酪蛋糕",296,7,19.1,21.3],
["C0105101","甘扁桃仁片(生)","甘扁桃仁片(生)",564,27.3,17,47.8],
["E6500101","苦瓜(白皮)","苦瓜(白皮)",19,0.9,4.1,0.1],
["I0620301","鹅胗","鵝胗",95,17.4,2.8,2.3],
["E8600101","萝卜芽","蘿蔔芽",24,2.1,3.9,0.4],
["F07001","海带平均值","海帶平均值",20,0.8,4.3,0.1],
["O0701901","乌龙奶茶(去冰·全糖)","烏龍奶茶(去冰,全糖)",75,0.2,12.3,2.8],
["O0701801","乌龙奶茶(去冰·半糖)","烏龍奶茶(去冰,半糖)",62,0.2,9.6,2.6],
["D2100404","金蜜芒果","金蜜芒果",64,0.6,16.3,0.4],
["E7400602","黄金圣女小番茄","黃金聖女小番茄",31,1,7,0.1],
["I0404401","鸡排(土鸡)","雞排(土雞)",158,18.9,0,8.6],
["I0404402","鸡排(肉鸡)","雞排(肉雞)",208,15.3,0,15.8],
["M1500201","黑芝麻油","黑芝麻油",881,0.1,0.2,99.7],
["M1800101","芥花油","芥花油",883,0,0,99.9],
["E7500101","甜椒(青皮)","甜椒(青皮)",23,0.8,4.9,0.3],
["J2101501","隆脊管鞭虾","隆脊管鞭蝦",96,22.1,0.6,0.2],
["M1400101","亚麻仁油","亞麻仁油",820,0.2,6.9,92.8],
["E6450101","腌渍花胡瓜","醃漬花胡瓜",83,3,18.1,0.5],
["E8500101","荞麦芽","蕎麥芽",20,1.9,3.4,0.2],
["D2800202","玫瑰桃","玫瑰桃",51,1.2,12.8,0.1],
["P0800401","鱼露","魚露",64,10.2,5.3,0.2],
["J0410601","小黄鱼(含皮)","小黃魚(含皮)",156,19.4,0,8.1],
["J0412401","蔷薇项鳍鱼(去皮)","薔薇項鰭魚(去皮)",96,17.3,0,2.4],
["D0600101","红毛丹","紅毛丹",73,1,17.9,0.7],
["I0100202","牛肋条(2021年取样)","牛肋條(2021年取樣)",358,15.7,0.3,32.3],
["A0750101","黑麦汁","黑麥汁",52,0.3,12.6,0],
["P0600201","糯米醋","糯米醋",17,0.1,4.1,0],
["P0600701","乌醋","烏醋",37,0.5,8.7,0],
["F0810101","乾裙带菜","乾裙帶菜",225,22.9,40.8,0.7],
["A0351601","锅烧意面","鍋燒意麵",479,10,58.5,22.8],
["I0402402","去皮清肉(肉鸡)","去皮清肉(肉雞)",117,23.3,0.6,1.9],
["J3300101","牡蛎干","牡蠣干",243,41,26.2,7.5],
["P1004701","虾酱","蝦醬",99,19.6,1.3,1.7],
["P1000301","肉燥","肉燥",397,9.5,4.2,38],
["F0700103","海带梗","海帶梗",17,0.8,3.7,0.1],
["F0700105","海带丝","海帶絲",22,0.7,5,0.1],
["J04050","青星九刺鮨平均值","青星九刺鮨平均值",94,20.9,0,0.5],
["F0710101","乾海带","乾海帶",220,10,47.3,1.1],
["J0409401","金线鱼","金線魚",119,20.9,0,3.3],
["J0416501","秋刀鱼","秋刀魚",277,18.8,4.1,21.8],
["J0406001","血斑异大眼鲷","血斑異大眼鯛",93,20.6,0,0.6],
["J0410701","白姑鱼","白姑魚",97,18.8,0,1.8],
["J3600101","乌贼精囊","烏賊精囊",43,9.8,6.4,0.2],
["F0500101","礁膜","礁膜",16,0.3,3.7,0.1],
["F0700104","海带结","海帶結",17,0.8,3.6,0.1],
["J0405801","大口黑鲈","大口黑鱸",130,20.7,0,4.6],
["M1300101","米油(籼米)","米油(秈米)",883,0.1,0,99.9],
["M1650101","调合花生油","調合花生油",884,0,0,100],
["M1700101","油菜籽油","油菜籽油",883,0,0,99.9],
["E6800201","棱角丝瓜","稜角絲瓜",20,0.9,4.1,0.2],
["E6200101","冬瓜","冬瓜",13,0.4,2.7,0.1],
["O0900101","即溶咖啡粉","即溶咖啡粉",363,16.6,71.2,1.3],
["O0200601","龟苓茶","龜苓茶",33,0,8.3,0],
["E0800101","草石蚕","草石蠶",75,1.7,18,0],
["O0702901","乳酸饮料","乳酸飲料",45,0.2,10.9,0],
["E3850201","榨菜","榨菜",25,1.3,4.6,0.4],
["P0700301","黑豆酱油","黑豆醬油",114,7.5,20.6,0.2],
["E6800101","丝瓜","絲瓜",19,1.1,3.9,0.1],
["A0510101","加钙米","加鈣米",355,7.4,77.7,0.7],
["E7100201","绿栉瓜","綠櫛瓜",13,2.2,1.8,0],
["I0520401","鸭肠","鴨腸",94,13.8,0,3.9],
["I0120401","卤牛筋","滷牛筋",119,21.1,2.6,2.8],
["J0406301","白马头鱼","白馬頭魚",91,19.2,0.1,1],
["E6250101","腌渍冬瓜","醃漬冬瓜",24,2.5,4.1,0.2],
["R6900201","茄汁鲭鱼罐头","茄汁鯖魚罐頭",116,17.6,2.8,3.8],
["A0501001","胚芽粳米(台粳10号)","胚芽粳米(台粳10號）",360,7.3,77.2,1.7],
["E5800601","青花菜笋","青花菜筍",32,3,5.1,0.5],
["I04042","清腿平均值","清腿平均值",157,18.5,0,8.7],
["I04043","棒棒腿平均值","棒棒腿平均值",151,18.9,0,7.8],
["I0500101","太空鸭","太空鴨",319,16,0,27.8],
["I0504101","鸭腿","鴨腿",282,14.4,3.4,24.5],
["I0402301","带骨带皮对切胸(肉鸡)","帶骨帶皮對切胸(肉雞)",219,19.3,0,15.1],
["H0750301","宽粉","寬粉",349,0.1,86.9,0.1],
["C1700101","带壳花生(生鲜)","帶殼花生(生鮮)",331,15.3,12.2,27.2],
["I0602101","鹅胸肉","鵝胸肉",120,23.5,0.2,2.2],
["I0604101","鹅腿肉","鵝腿肉",130,21.7,0,4.2],
["K0200101","鸭蛋","鴨蛋",187,13.1,0.2,14.4],
["B0400501","金时地瓜","金時地瓜",138,1.6,31.3,0.4],
["B0400201","菱角牛奶地瓜","菱角牛奶地瓜",133,1.9,29.9,0.3],
["O0700201","无糖咖啡饮料","無糖咖啡飲料",4,0.2,0.5,0.1],
["O0100401","柳橙汁(100%)","柳橙汁(100%)",48,0.6,10.7,0.3],
["O0101301","苹果汁(100%)","蘋果汁(100%)",51,0.1,12.2,0.2],
["D0400101","百香果","百香果",64,2.2,11.2,1.9],
["R4400101","台式泡菜","台式泡菜",59,0.9,13.1,0.3],
["R4400201","黄金泡菜","黃金泡菜",111,2.4,12.5,5.7],
["R0300301","寿司(豆皮寿司)","壽司(豆皮壽司)",194,6.3,31.7,4.7],
["L0102108","全脂鲜乳(7月取样)","全脂鮮乳(7月取樣)",65,3.7,4.2,3.7],
["B0700202","马铃薯(2022年取样)","馬鈴薯(2022年取樣)",70,2.3,14.9,0],
["P1500601","酵母粉","酵母粉",347,46.3,40.4,0],
["P0101001","洋葱粉","洋蔥粉",357,8.1,82.1,1.8],
["A0320702","杂粮高筋面粉","雜糧高筋麵粉",360,14.3,69.6,2.8],
["I0210101","绵羊肉切片","綿羊肉切片",198,18.8,0,13],
["J04031","鲻平均值(去皮)","鯔平均值(去皮)",152,20.6,0.3,7.1],
["E3201202","土植青江菜(3月取样)","土植青江菜(3月取樣)",11,0.4,2.3,0.2],
["A0500208","粳米(高雄142号)","粳米(高雄142號)",353,7,77.7,0.6],
["D0200104","木瓜(11月取样)","木瓜(11月取樣)",44,0.4,11.8,0.1],
["D1900101","华宝大西瓜(花莲)","華寶大西瓜(花蓮)",33,0.7,8.4,0.1],
["D1600101","杨桃(2月取样)","楊桃(2月取樣)",29,0.4,7.6,0.1],
["D1600103","杨桃(5月取样)","楊桃(5月取樣)",34,0.6,8.7,0.1],
["D1600105","杨桃(11月取样)","楊桃(11月取樣)",31,0.4,8,0],
["D1300101","桑葚","桑葚",32,1.1,7,0.4],
["D1330101","桑葚汁","桑葚汁",25,0.8,5.9,0.2],
["D0900201","酪梨(室温存放0天)","酪梨(室溫存放0天)",80,1.5,7.1,5.9],
["E7400601","金女小番茄","金女小番茄",30,1.1,6.6,0.1],
["E7400401","圣女小番茄","聖女小番茄",34,1.1,6.9,0.5],
["J0415701","鲽鱼切片","鰈魚切片",201,13.2,0,16.1],
["D3600103","澳洲甜橙(进口)","澳洲甜橙(進口)",46,0.9,11.6,0.1],
["D2400303","加州蜜李(进口)","加州蜜李(進口)",66,1.3,17.1,0.1],
["J3500101","真乌贼(大)","真烏賊(大)",61,13.9,0.8,0.3],
["N0700101","蜂蜜(冬蜜)","蜂蜜(冬蜜)",315,0.1,81.5,0.1],
["N0600101","枫糖","楓糖",258,0.1,66.6,0.1],
["P0400301","鲜鸡精","鮮雞精",267,10.8,33.3,10.1],
["P0800201","鲜味露","鮮味露",75,20.1,0,0.1],
["P1003501","蕃茄酱","蕃茄醬",114,1.6,26.7,0.1],
["P1002201","海鲜酱","海鮮醬",228,1.8,50.3,2.2],
["J35001","真乌贼平均值","真烏賊平均值",57,12.2,3.7,0.6],
["J0410201","黑棘鲷(含皮)","黑棘鯛(含皮)",165,19.5,0,9],
["P0200801","椰子粉","椰子粉",629,7.2,27.8,60.3],
["P0201201","黄耆水","黃耆水",14,0.9,2.9,0],
["E9800101","芦荟","蘆薈",4,0.1,0.2,0.4],
["J2500101","红蟳","紅蟳",122,20.9,6.5,3.6],
["J3500501","台湾锁管","台灣鎖管",72,16,1.6,0.4],
["E6500201","苦瓜(青皮)","苦瓜(青皮)",20,0.9,4.2,0.1],
["I0420901","鸡膝软骨(肉鸡)","雞膝軟骨(肉雞)",107,20.4,0.5,2.2],
["I0810201","鸵腩肉","鴕腩肉",144,21.2,0.7,5.9],
["J0405101","斑带石斑鱼","斑帶石斑魚",90,20.2,0,0.5],
["K0206101","鸭蛋白","鴨蛋白",47,10.8,1.4,0],
["K0208101","鸭蛋黄","鴨蛋黃",347,15.8,2,30.8],
["K0106101","鸡蛋白(白壳)","雞蛋白(白殼)",48,10.7,0,0.1],
["M0200102","猪油(2022年取样)","豬油(2022年取樣)",892,0,0,99.8],
["K0108301","鸡蛋黄(高维生素E)","雞蛋黃(高維生素E)",314,16.2,5.4,27],
["K0113201","土鸡皮蛋","土雞皮蛋",122,12.2,2.3,7.6],
["K0214103","鸭熟咸蛋(薄盐)","鴨熟鹹蛋(薄鹽)",185,13.7,3.5,13.8],
["K0112102","茶叶蛋(浸泡隔夜)","茶葉蛋(浸泡隔夜)",145,13.8,0.9,9.4],
["K01208","卤蛋黄平均值","滷蛋黃平均值",378,17,1.9,33.7],
["L1200101","全脂羊奶粉","全脂羊奶粉",510,26.7,34.8,29.8],
["L0500101","切片乾酪","切片乾酪",309,18.3,5.9,23.7],
["E9900701","面包果","麵包果",61,1,11.2,1.8],
["L0124601","中脂调味乳(纤维&维生素E强化)","中脂調味乳(纖維&維生素E強化)",65,2.4,9.3,2.1],
["L0124401","中脂调味乳(钙强化)","中脂調味乳(鈣強化)",67,2.3,8.9,2.6],
["R6600501","冷冻鱼饺","冷凍魚餃",277,12.5,12.9,19.5],
["A0400401","双色水果玉米","雙色水果玉米",105,3.1,17.5,2.6],
["E6300101","日本南瓜","日本南瓜",86,0.6,20.8,0.4],
["D0200201","青木瓜","青木瓜",29,0.6,7.2,0.1],
["I0300101","猪下肩肉","豬下肩肉",200,18.1,0,13.6],
["A0351301","红萝卜面","紅蘿蔔麵",352,12.1,73.8,1],
["E6700101","白皮蛇瓜","白皮蛇瓜",19,1.4,3.2,0.3],
["Q6900101","乳酸球","乳酸球",474,3.8,66.1,21.6],
["R3000201","冷冻春卷","冷凍春捲",272,5.1,31.5,13.9],
["D3700201","红宝石葡萄柚(古坑)","紅寶石葡萄柚(古坑)",37,0.7,8.9,0.3],
["A0352801","鸡丝面","雞絲麵",463,9.4,55,22.8],
["Q0100201","冷藏甜年糕","冷藏甜年糕",242,2.3,57.2,0.4],
["D2200101","玉荷苞荔枝","玉荷苞荔枝",68,1.2,17.3,0.2],
["D2200102","黑叶仔荔枝","黑葉仔荔枝",62,0.9,15.8,0.2],
["K0100401","鸡蛋(高DHA)","雞蛋(高DHA)",132,12.5,1.8,8.6],
["B0100201","山药(二刺)","山藥(二刺)",89,2.7,18.9,0.1],
["K0112101","茶叶蛋(市售)","茶葉蛋(市售)",138,13.5,3.5,8.7],
["D36001","甜橙平均值(普遍系)","甜橙平均值(普遍系)",46,0.8,11.3,0.2],
["K0214801","鸭咸蛋黄","鴨鹹蛋黃",533,23.6,1.3,47.6],
["K0214101","鸭生咸蛋","鴨生鹹蛋",187,12.5,0,14.7],
["K0100901","鸡蛋(高维生素E)","雞蛋(高維生素E)",143,12.8,1.4,9.7],
["A0500801","黑籼糯米","黑秈糯米",357,10.1,70.1,3.5],
["R5200101","片状肉乾(牛肉)","片狀肉乾(牛肉)",335,30.3,41.8,5.2],
["I0120201","牛肚(蜂巢胃)","牛肚(蜂巢胃)",107,19,0,2.8],
["E0200301","冷冻胡萝卜","冷凍胡蘿蔔",13,0.5,3,0.1],
["P0700401","淡色酱油","淡色醬油",78,7.1,11.5,0.4],
["P0102101","罗勒片","羅勒片",289,23.3,46.1,5.8],
["O0101101","柠檬汁(非原汁)","檸檬汁(非原汁)",33,0.8,7.1,0.1],
["C1705201","去膜花生仁(生)","去膜花生仁(生)",558,28.8,19.1,45.4],
["L1000201","木瓜牛奶","木瓜牛奶",42,1.7,7.7,0.6],
["Q0400101","车轮饼(红豆)","車輪餅(紅豆)",187,2.1,42.3,1.1],
["Q0400201","车轮饼(菜脯)","車輪餅(菜脯)",183,1.4,31.6,5.7],
["J0401601","鱅","鱅",145,18.7,0,7.2],
["D3400302","圆果金柑","圓果金柑",32,0.7,7.6,0.2],
["A0352501","长面线","長麵線",310,10.7,64.3,1.1],
["J0412801","横纹鹦哥鱼(含皮)","橫紋鸚哥魚(含皮)",81,18.9,0,0],
["C2110101","原味葵瓜子(去壳)","原味葵瓜子(去殼)",586,22,18.7,51.9],
["J0401101","虱目鱼(含皮)","虱目魚(含皮)",200,21.8,0,11.9],
["J0413501","大眼金梭鱼","大眼金梭魚",157,21.8,0,7.1],
["P1004401","韭花酱","韭花醬",29,2.1,4.5,0.3],
["P1002701","朝鲜酱","朝鮮醬",106,1.6,19.7,2.3],
["G2410101","乾竹笙","乾竹笙",312,17.5,64.1,2],
["A0200201","糯小米","糯小米",360,12.5,72.5,1.5],
["P1300801","黑芝麻面包酱","黑芝麻麵包醬",667,10.6,27,57.4],
["G1700101","滑菇","滑菇",27,2.6,4.7,0.2],
["R2900101","冷冻烧卖","冷凍燒賣",188,9.9,15.3,9.7],
["R2301101","小笼包","小籠包",242,9.6,15.9,15.5],
["R4700203","小方豆干","小方豆干",161,17.4,3.5,8.6],
["R4700501","日式炸豆皮","日式炸豆皮",388,19.2,4.9,32.4],
["E74001","大番茄平均值(红色系)","大番茄平均值(紅色系)",19,0.8,4.1,0.1],
["E74003","大番茄平均值(绿色系)","大番茄平均值(綠色系)",22,0.7,5,0.1],
["I0210501","绵羊腹胁肉火锅片","綿羊腹脅肉火鍋片",252,16.9,2.5,20],
["I0200101","山羊带皮羊肉块","山羊帶皮羊肉塊",164,20.3,3.4,8.6],
["P1300701","白芝麻面包酱","白芝麻麵包醬",685,20,15.3,60.4],
["B0100207","山药(台农2号)","山藥(台農2號)",95,3.2,19.9,0.1],
["D2800201","白油桃","白油桃",37,0.6,9.3,0.1],
["J0406602","海鲡鱼片","海鱺魚片",260,19.3,0,19.7],
["D2100402","玉文芒果","玉文芒果",62,0.5,16.1,0.3],
["G0810102","乾花菇","乾花菇",317,17,67.4,1.1],
["P1002001","山葵酱","山葵醬",338,1.1,70.2,5.9],
["P0100601","肉桂粉","肉桂粉",343,4.2,78.8,2.9],
["G1000101","姬松茸","姬松茸",40,4,6.9,0.4],
["G0410101","鸡腿菇(乾)","雞腿菇(乾)",298,20.1,59.8,1.4],
["R2300901","冷冻猪肉包子","冷凍豬肉包子",266,7.6,38.2,9.2],
["R2301001","冷冻猪肉汤包","冷凍豬肉湯包",235,10.1,16.3,14.3],
["A0400301","甜玉米","甜玉米",107,3.3,17.8,2.5],
["G2100101","白茯苓","白茯苓",316,1,79.9,0.2],
["G1650101","金针菇罐头","金針菇罐頭",24,1.7,4.5,0.2],
["J0402402","大西洋鲑鱼切片(中段)","大西洋鮭魚切片(中段)",174,20.7,0,9.5],
["G1900101","鸿喜菇","鴻喜菇",30,2.9,5.3,0.1],
["G0810103","乾白花菇","乾白花菇",310,18.7,64.5,1.1],
["J0408801","黄拟乌尾鮗","黃擬烏尾鮗",80,18.7,0.3,0.1],
["J0411601","花尾唇指翁(翁加鱼边)","花尾唇指翁(翁加魚邊)",116,19.8,0.6,3.4],
["Q8100101","甘薯蜜饯","甘薯蜜餞",347,0.9,84.3,0.6],
["H0605101","青仁黑豆","青仁黑豆",385,37,33.7,14.2],
["H0620101","黑豆粉","黑豆粉",431,36,39,17.6],
["R4700601","豆豉","豆豉",237,20.4,12.8,11.5],
["F0800101","裙带菜","裙帶菜",36,3,5.9,0.6],
["F0700102","海带茸","海帶茸",29,1.1,6.5,0],
["I0410101","鸡绞肉","雞絞肉",131,27.4,0,1.6],
["P1000801","海苔酱","海苔醬",223,6.4,49.3,0],
["P1300301","草莓果酱","草莓果醬",272,0.4,65,1.2],
["F0700101","海带卷","海帶卷",14,0.7,2.8,0.2],
["F0610101","乾海茸芯","乾海茸芯",254,8.4,59.1,0.2],
["J0412301","莫三比克口孵非鲫","莫三比克口孵非鯽",112,19.5,0,3.2],
["A0351201","油面条","油麵條",361,11.4,76.3,1.2],
["P0700901","薄盐黑豆酱油膏","薄鹽黑豆醬油膏",124,7.6,23.3,0.1],
["G1600101","金针菇","金針菇",37,2.6,7.2,0.3],
["C1705101","生鲜花生仁","生鮮花生仁",506,28.8,20.6,38.5],
["P0800101","味醂","味醂",220,0.5,54.5,0],
["D2100406","香水芒果","香水芒果",65,0.6,17.1,0.2],
["J0411701","尼罗口孵非鲫(去皮)","尼羅口孵非鯽(去皮)",113,20.4,0,2.9],
["J0407101","布氏鲳鰺(含皮)","布氏鯧鰺(含皮)",190,17.5,0,12.8],
["A0810201","即食燕麦片","即食燕麥片",406,11.9,67.9,9.6],
["B0420101","甘薯粉","甘薯粉",358,1,85.5,0.2],
["A0351101","乾面条","乾麵條",357,11.5,74.6,1.4],
["H1505101","红扁豆仁","紅扁豆仁",343,25.3,58.3,2.1],
["A0710101","黑麦片","黑麥片",359,7.8,77.3,1.2],
["I0402401","去皮清肉(土鸡)","去皮清肉(土雞)",121,23.4,0,2.3],
["D1600102","杨桃(4月取样)","楊桃(4月取樣)",32,0.7,8.1,0.1],
["I01001","牛小排平均值","牛小排平均值",325,15.1,0,28.9],
["D17003","绿葡萄平均值","綠葡萄平均值",58,0.5,15.3,0.2],
["D16001","杨桃平均值","楊桃平均值",32,0.5,8.2,0.1],
["J0405102","龙虎石斑鱼","龍虎石斑魚",122,20.6,1.2,3.8],
["A0500210","粳米(高雄139号)(2021年取样)","粳米(高雄139號)(2021年取樣)",352,5.7,79.2,0.5],
["D2000103","蜜世界洋香瓜","蜜世界洋香瓜",29,0.7,7.1,0.1],
["D2000402","天香洋香瓜","天香洋香瓜",44,0.8,11.6,0],
["D1800103","黑珍珠莲雾","黑珍珠蓮霧",39,0.4,10.2,0.1],
["D1800102","黑金刚莲雾","黑金剛蓮霧",34,0.5,8.8,0.1],
["D3800302","柠檬汁(绿皮)","檸檬汁(綠皮)",31,0.4,6.9,0.6],
["B9900101","西谷米","西谷米",371,0.1,89.7,0.1],
["C1800101","芡实","芡實",343,9.9,75.4,0.1],
["B0100101","淮山","淮山",363,5.3,82.4,0.3],
["D0900301","酪梨(室温存放3天)","酪梨(室溫存放3天)",84,1.4,6.3,6.8],
["A0900101","荞麦(甜荞)","蕎麥(甜蕎)",361,11,71.3,2.9],
["A0310101","小麦胚芽","小麥胚芽",417,31.4,47.9,11.6],
["E7400301","粉柿番茄","粉柿番茄",18,0.8,4,0],
["E7400101","牛番茄","牛番茄",19,0.7,4,0.1],
["E7400102","红番茄","紅番茄",20,0.9,4.4,0],
["I0300301","猪上肩肉","豬上肩肉",207,18.9,0,14],
["J2100501","日本玻璃虾","日本玻璃蝦",83,16.2,2,1.5],
["I0321101","猪肚","豬肚",152,12.4,0,11],
["E9400101","蔘须","蔘鬚",330,7,76.2,1.8],
["A0500207","粳米(高雄139号)","粳米(高雄139號)",357,6.1,78.5,1.2],
["R4700301","黑豆干","黑豆干",197,19,2.1,12.5],
["E1700202","澳洲绿芦笋(粗短型)","澳洲綠蘆筍(粗短型)",20,2.5,3.1,0.2],
["E1700203","绿芦笋(细短型)","綠蘆筍(細短型)",23,3.3,3.2,0.2],
["J3501201","九孔螺","九孔螺",73,15,5.8,1],
["J3200201","干贝(乾)","干貝(乾)",256,58.5,15.5,0.7],
["A0320505","全麦面粉","全麥麵粉",359,13,71.4,1.7],
["E3200301","葵扇白菜","葵扇白菜",14,1.6,2.4,0.1],
["E5000301","冷冻菠菜","冷凍菠菜",17,2.1,2.9,0],
["O0900801","糙米麸","糙米麩",387,7.8,81.4,3.3],
["E9900501","义大利茼蒿","義大利茼蒿",15,1.6,1.9,0.4],
["I0310202","猪颊肉(2022年取样)","豬頰肉(2022年取樣)",157,18.9,2.1,8.4],
["P0100201","小茴香粉","小茴香粉",411,19.5,37,25.8],
["P0101501","迷迭香粉","迷迭香粉",432,5.9,59.8,21.9],
["Q0200101","咸麻糬","鹹麻糬",248,8.7,43.2,4.5],
["Q6310101","牛奶软糖","牛奶軟糖",424,2.9,78,11.1],
["R2900201","冷冻水晶包","冷凍水晶包",211,4.8,30.4,7.8],
["J0415501","斑鳢","斑鱧",119,18.3,0,4.5],
["J3501401","蝾螺(加工)","蠑螺(加工)",65,14.8,11,0.2],
["J0412601","蓝猪齿鱼","藍豬齒魚",81,18.5,0.2,0.2],
["I0302301","猪後腿瘦肉","豬後腿瘦肉",120,21.1,0.3,3.4],
["L0214401","部份脱脂强化奶粉(脂肪酸调整)","部份脫脂強化奶粉(脂肪酸調整)",481,22.7,45.9,23.5],
["R5300203","蒟蒻香肠(蒜味)","蒟蒻香腸(蒜味)",289,19.4,19.3,14.9],
["L0318101","脱脂浓稠发酵乳","脫脂濃稠發酵乳",64,3,12.1,0.4],
["L0318201","脱脂浓稠发酵乳(低热量)","脫脂濃稠發酵乳(低熱量)",37,2,6.9,0.1],
["L0154101","中脂调味保久乳(巧克力)","中脂調味保久乳(巧克力)",60,1.9,9.3,1.7],
["M0900201","奶油(固态·加盐)","奶油(固態,加鹽)",699,0.7,3.7,77.5],
["M1000201","中脂人造奶油","中脂人造奶油",674,0,1.3,76.2],
["R5200301","条状肉乾(猪肉)","條狀肉乾(豬肉)",345,43.2,25.1,7.9],
["J0414810","鲭鱼(蒸)","鯖魚(蒸)",392,14.6,0.7,36.5],
["P1500101","炸排粉","炸排粉",344,11.9,70,1.8],
["P1500201","炸鸡粉","炸雞粉",333,8.3,71,1.7],
["O0702701","多多绿茶(全糖)","多多綠茶(全糖)",49,1.1,11,0.1],
["P1000101","干贝酱","干貝醬",558,16.7,8,51],
["G1500101","蚝菇","蠔菇",26,2.1,4.8,0.3],
["E2100301","蒜苗","蒜苗",54,2.2,12,0.1],
["E3200702","水植小白菜(4月取样)","水植小白菜(4月取樣)",13,1,2.4,0.2],
["L0118101","脱脂强化鲜乳(钙强化)","脫脂強化鮮乳(鈣強化)",42,3.5,6.3,0.3],
["B0500101","芋头","芋頭",128,2.5,26.4,1.1],
["A0350101","水饺皮","水餃皮",264,7.8,57,0.5],
["C0500202","栗子仁(生)","栗子仁(生)",176,3.7,38.7,0.7],
["C1320101","亚麻仁籽粉","亞麻仁籽粉",557,21.7,28.6,43.6],
["E5000201","菠菜(叶)","菠菜(葉)",24,3.9,2.5,0.4],
["E3201501","塔菇菜","塔菇菜",11,2.7,0.5,0.2],
["D1900401","小玉西瓜","小玉西瓜",34,0.8,8.7,0.1],
["G1200401","玫瑰菇","玫瑰菇",35,4.5,5.6,0.1],
["J0600501","翻车魨鱼皮","翻車魨魚皮",59,13.7,0,0.1],
["J2500201","蛙形蟹","蛙形蟹",72,16.6,2.8,0.1],
["R2500101","火腿蛋三明治","火腿蛋三明治",275,10.9,28.2,13.2],
["R0300101","三角饭团(肉松)","三角飯糰(肉鬆)",219,5.8,36.6,5.5],
["I0100201","牛肋条","牛肋條",225,18.6,1.1,16.1],
["Q2106101","羊羹","羊羹",289,3,67.6,0.7],
["R2100101","炒板条","炒板條",149,4.2,23.7,4.2],
["A0501002","胚芽粳米(台粳9号)","胚芽粳米(台粳9號)",363,9.1,76.5,1.5],
["I0106101","去骨纽约克牛排","去骨紐約克牛排",200,21.3,0,12],
["I0104201","牛修清前胸肉","牛修清前胸肉",120,22.3,0.9,2.8],
["R0200101","冷冻火腿炒饭","冷凍火腿炒飯",189,5,29.7,5.6],
["R2201001","冷冻冬菜虾仁馄饨","冷凍冬菜蝦仁餛飩",191,9.1,24.5,6.3],
["R0900301","冷冻猪肉汤圆","冷凍豬肉湯圓",281,6.5,36.6,12.1],
["R6200301","冷冻鲔排","冷凍鮪排",143,13.4,20.4,0.9],
["B0500401","冷冻芋头块","冷凍芋頭塊",147,2.2,24.9,4.3],
["J0415401","银鲳(含皮)","銀鯧(含皮)",124,16.8,1.1,5.8],
["R6100101","冷冻花枝丸","冷凍花枝丸",166,12.7,13,7],
["Q0800101","冷冻马拉糕","冷凍馬拉糕",320,7,44,12.9],
["G1900201","美白菇","美白菇",27,2.4,4.8,0.3],
["R4700201","豆干丝","豆干絲",170,18.3,4.8,8.6],
["Q4100101","方块酥","方塊酥",509,7.1,66.1,24.1],
["H1100101","毛豆仁","毛豆仁",129,14.6,12.5,3.3],
["I0400301","乌骨鸡","烏骨雞",212,17.9,0.9,15.1],
["I0300601","猪前腿外腱肉","豬前腿外腱肉",146,20.7,0,6.5],
["J0600201","鲷鱼下巴","鯛魚下巴",245,16.1,0,19.6],
["D2310201","带壳龙眼乾","帶殼龍眼乾",278,4.6,72.9,0.1],
["D1700401","美国红葡萄(含皮)","美國紅葡萄(含皮)",61,0.4,16.3,0.1],
["O0900601","麦片冲泡包(三合一)","麥片沖泡包(三合一)",409,11,74.3,7.5],
["H0610201","烘烤黑豆","烘烤黑豆",435,39,32.4,20.1],
["I0600201","茶鹅","茶鵝",352,15.6,0,32.5],
["C1750101","腌渍花生仁","醃漬花生仁",288,10.6,2.9,26],
["A0351401","通心面","通心麵",359,13.8,72.6,1.4],
["R0200201","冷冻虾仁炒饭","冷凍蝦仁炒飯",148,4.7,24.6,3.4],
["A0400201","紫玉米","紫玉米",168,4.5,34.4,1],
["R2200901","冷冻素食熟水饺","冷凍素食熟水餃",209,7.2,32.9,5.4],
["J0705101","鮟鱇鱼肝","鮟鱇魚肝",136,13.6,1.9,8.6],
["K0120602","鸡卤蛋白(浸泡隔夜)","雞滷蛋白(浸泡隔夜)",89,16.7,5.2,0.2],
["L0102106","全脂鲜乳(11月取样)","全脂鮮乳(11月取樣)",62,3.1,4.6,3.5],
["L0217401","脱脂强化奶粉(钙&铁强化)","脫脂強化奶粉(鈣&鐵強化)",360,35.6,52.3,0.7],
["L1100101","高脂鲜羊乳","高脂鮮羊乳",65,3.4,4.2,4],
["G2310101","乾猴头菇","乾猴頭菇",311,12.3,64.3,3.4],
["R2301201","冷冻素菜包子","冷凍素菜包子",234,8.6,41.4,3.8],
["R2300601","冷冻莲蓉包","冷凍蓮蓉包",292,7.9,52.8,5.5],
["G9000301","喜来菇","喜來菇",37,3.5,6.3,0.4],
["I0306101","猪小里肌","豬小里肌",139,21.1,0,5.4],
["R6900101","香笋鲔鱼罐头","香筍鮪魚罐頭",290,10,0,30],
["R2201401","猪肉锅贴","豬肉鍋貼",238,7.8,26.2,11.3],
["H0750101","高纤胚芽冬粉","高纖胚芽冬粉",370,0.6,90,0.2],
["J0800301","香鱼片","香魚片",307,36.1,39.1,0.7],
["J2101401","大管鞭虾","大管鞭蝦",88,19.8,0.6,0.3],
["J3500801","香螺","香螺",86,19.9,0,0.1],
["J2100801","日本对虾(大)","日本對蝦(大)",97,21.6,0,0.5],
["H0750201","冬粉","冬粉",351,0.1,87.5,0.1],
["I0404403","鸡排(肉鸡)(2021年取样)","雞排(肉雞)(2021年取樣)",251,14.9,0,20.8],
["B1000301","菱角(熟)","菱角(熟)",146,4.2,31,0.3],
["D0900401","酪梨(室温存放6天)","酪梨(室溫存放6天)",92,1.5,6.6,7.6],
["D2700301","牛心柿","牛心柿",62,0.5,16.5,0.2],
["J2300101","虾皮","蝦皮",155,33.6,2.7,1.3],
["J0406601","海鲡","海鱺",189,20.4,0,11.3],
["E0900101","球茎甘蓝","球莖甘藍",20,1.6,3.6,0.2],
["E1900101","嫩姜","嫩薑",21,0,4.8,0.3],
["E1900103","老姜","老薑",53,1.1,11.7,0.5],
["J3501301","鲍鱼","鮑魚",69,15.8,9.5,0.1],
["J0411201","鳞鳍叫姑鱼","鱗鰭叫姑魚",99,18.4,0.3,2.3],
["E3201204","土植青江菜(7月取样)","土植青江菜(7月取樣)",15,1.5,2.5,0.1],
["E3201304","水植青江菜(10月取样)","水植青江菜(10月取樣)",11,1.4,1.4,0.2],
["E3201301","水植青江菜(1月取样)","水植青江菜(1月取樣)",12,1.2,2.4,0],
["E3200101","蚵仔白菜","蚵仔白菜",13,1.6,1.1,0.5],
["E5300304","水植本岛莴苣(10月取样)","水植本島萵苣(10月取樣)",12,1.1,1.6,0.3],
["E5300404","有机本岛莴苣(10月取样)","有機本島萵苣(10月取樣)",15,1.3,2.3,0.3],
["A0520201","籼米粉","秈米粉",363,4.2,83.4,0.4],
["J0200401","鲨鱼烟","鯊魚煙",98,22.3,0,0.4],
["R4100101","芋圆","芋圓",214,0.9,52.1,0.2],
["I0100103","无骨牛小排(美牛)","無骨牛小排(美牛)",335,15.6,0.2,29.8],
["D1900301","无子西瓜","無子西瓜",33,0.9,8.2,0],
["E3400101","白凤菜","白鳳菜",27,2,4.8,0.4],
["E4700101","隼人瓜苗","隼人瓜苗",24,3.3,3.5,0.2],
["E7000101","蒲瓜(长形)","蒲瓜(長形)",19,0.5,4.2,0.1],
["J0414807","鲭鱼(烤·210度·10分)","鯖魚(烤,210度,10分)",472,19,0,43.4],
["O0900501","米浆粉","米漿粉",444,9.1,74.3,12.3],
["J2100101","罗氏沼虾","羅氏沼蝦",88,20.3,0.2,0.1],
["J0400101","魟鱼","魟魚",106,24.8,0,0.1],
["J0413701","鳞网带鰆(含皮)","鱗網帶鰆(含皮)",263,18,0,20.7],
["P1300401","葡萄果酱","葡萄果醬",261,0,60.9,1.9],
["P1004501","香椿酱","香椿醬",507,8.1,2.3,51.7],
["Q0100501","包馅甜麻糬(红豆)","包餡甜麻糬(紅豆)",329,10,65.7,2.9],
["A0500202","粳米(台南11号)","粳米(台南11號)",348,6.7,77.2,0.5],
["D21004","芒果平均值(新兴种)","芒果平均值(新興種)",56,0.6,14.4,0.2],
["D2400307","蜜枣李(进口)","蜜棗李(進口)",53,0.6,13.6,0.2],
["K0112601","茶叶蛋白(浸泡隔夜)","茶葉蛋白(浸泡隔夜)",58,12.9,0.4,0.1],
["L0217101","脱脂强化奶粉(抗氧化)","脫脂強化奶粉(抗氧化)",366,32.3,56.6,1],
["C1605101","白芝麻(生)","白芝麻(生)",598,22.3,15,54.9],
["C1620101","黑芝麻粉","黑芝麻粉",601,15.7,20.8,55.2],
["C0805101","腰果(生)","腰果(生)",568,18.3,30.3,45.5],
["P1003101","辣蒜蓉酱","辣蒜蓉醬",78,2.3,7.8,4.2],
["P0100801","花椒粉","花椒粉",369,10,63.2,9.2],
["C0310102","盐酥夏威夷豆","鹽酥夏威夷豆",720,9.4,12,76.3],
["P1000401","素肉燥","素肉燥",483,12.4,12.5,42.6],
["P0201301","黄耆片","黃耆片",321,14.9,68.7,1.6],
["P0200701","梅子粉","梅子粉",286,2,60.8,3.9],
["R0400101","肉粽","肉粽",235,8.2,30.7,8.8],
["Q6100601","黑巧克力(85%)","黑巧克力(85%)",613,10.9,38.7,46.1],
["R9900101","生啤酒","生啤酒",50,0.4,8.2,0],
["H1200401","甜豌豆荚","甜豌豆莢",42,3,7.4,0.2],
["E3000101","梨山甘蓝(尖球形)","梨山甘藍(尖球形)",24,1.4,5.1,0.1],
["R5300202","香肠(蒜味)","香腸(蒜味)",387,16.6,17.7,27.8],
["I0420301","鸡肝(肉鸡)","雞肝(肉雞)",111,18.8,2.7,3.5],
["H1120102","黄豆粉(有机)","黃豆粉(有機)",434,42,25.9,21.9],
["J0415301","银鲳(2月)","銀鯧(2月)",123,17.9,0,5.1],
["D1000101","榴槤","榴槤",132,2.7,29.7,1.9],
["Q6100201","花生牛奶巧克力","花生牛奶巧克力",489,13,56.9,23.2],
["Q6100301","榛果牛奶巧克力","榛果牛奶巧克力",590,9,47.5,40.4],
["Q0900501","蜂蜜蛋糕(巧克力)","蜂蜜蛋糕(巧克力)",341,6.9,43.1,15.6],
["P1002901","日式照烧酱","日式照燒醬",227,3,52.6,0.5],
["Q0700301","蛋塔","蛋塔",376,4.1,41.1,21.7],
["Q0700401","蛋塔(葡式)","蛋塔(葡式)",375,3.7,31.9,25.8],
["J0414811","鲭鱼(腌制)","鯖魚(醃製)",281,14.9,1.3,24],
["R2400301","芋头馒头","芋頭饅頭",155,5.7,31.5,0.6],
["R2301301","竹笋包","竹筍包",209,6.9,32.9,5.5],
["J0409601","网纹龙占鱼","網紋龍占魚",101,21.7,0,0.9],
["B9900201","蒟蒻粉","蒟蒻粉",351,0.2,87.2,0.2],
["C1910101","调味南瓜子(去壳)","調味南瓜子(去殼)",561,30.4,13.5,47.9],
["R4900201","香菇面筋罐头","香菇麵筋罐頭",192,10.7,14.9,10],
["J31002","真牡蛎平均值","真牡蠣平均值",54,9.4,4.2,1.6],
["I0520201","鸭胗","鴨胗",97,20.5,0.3,1.1],
["E1500301","沙拉笋块","沙拉筍塊",24,1.6,4.8,0.1],
["L0348101","脱脂保久浓稠发酵乳(草莓&苹果)","脫脂保久濃稠發酵乳(草莓&蘋果)",68,3,13.6,0.2],
["I0322601","猪脑","豬腦",125,10.8,0,8.7],
["I0108302","牛後腿腱子心(2022年取样)","牛後腿腱子心(2022年取樣)",151,23.7,4,5.5],
["Q6100101","牛奶巧克力","牛奶巧克力",546,9.4,54,32.6],
["Q0500301","蛋黄芋头酥","蛋黃芋頭酥",217,3.1,44.2,3],
["R6100301","冷冻文蛤丸","冷凍文蛤丸",211,16.2,15.8,9.2],
["P1001101","白酱","白醬",61,1.2,6.8,3.2],
["P1001201","青酱","青醬",83,0.9,7.7,5.4],
["O0100501","乌梅汁","烏梅汁",58,0.3,13.8,0.2],
["O0600401","加盐沙士","加鹽沙士",41,0.8,9.4,0],
["Q1000701","糖粒甜甜圈(油炸)","糖粒甜甜圈(油炸)",401,5.3,50.3,19.8],
["M2000101","红花籽油","紅花籽油",884,0,0,100],
["P0800301","蚝油","蠔油",156,6.5,32.2,0.1],
["P1003801","米豆酱","米豆醬",128,7.4,17.9,3],
["P0600501","红醋","紅醋",5,0.3,0.8,0],
["R2100301","泡面(鲜虾口味)","泡麵(鮮蝦口味)",475,9.6,55.5,23.8],
["R6100601","冷冻虾丸","冷凍蝦丸",123,10.8,14.7,2.3],
["R6500101","冷冻鱿鱼圈","冷凍魷魚圈",143,15.7,19.2,0.4],
["I0406301","翅腿(肉鸡)","翅腿(肉雞)",210,17.8,1,14.8],
["R2400701","冷冻银丝卷(奶黄)","冷凍銀絲卷(奶黃)",283,8.9,54.5,3.3],
["Q6900501","棉花糖","棉花糖",331,3.2,78.9,0.3],
["R2400501","冷藏坚果馒头","冷藏堅果饅頭",307,9.6,47.3,8.8],
["R2300201","冷冻酸菜焢肉包子","冷凍酸菜焢肉包子",301,8.6,37.2,13.1],
["K0120601","鸡卤蛋白(现煮)","雞滷蛋白(現煮)",84,16.6,3.9,0.2],
["L0100101","高脂鲜乳","高脂鮮乳",73,3.2,6.1,4],
["L0214101","部份脱脂强化奶粉(钙强化)","部份脫脂強化奶粉(鈣強化)",408,25,51,11.8],
["D2700401","四周柿","四周柿",66,0.5,17.6,0.1],
["A0500601","野生红米","野生紅米",360,7.7,74.7,2.6],
["E4800201","红苋菜","紅莧菜",22,2.6,3.3,0.3],
["E4500101","马齿苋","馬齒莧",14,1.2,1.9,0.4],
["J0406701","大口逆鈎鰺","大口逆鈎鰺",103,21.8,0.1,1.1],
["E5200101","落葵","落葵",33,2.7,6,0.3],
["E5800101","花椰菜","花椰菜",23,1.8,4.5,0.1],
["I0810101","鸵腱肉","鴕腱肉",107,18.7,0.2,3.1],
["E7000201","花蒲瓜(圆形)","花蒲瓜(圓形)",15,0.3,3.5,0],
["E7000301","葫芦瓜","葫蘆瓜",20,0.5,4.1,0.3],
["J2101301","须赤虾","鬚赤蝦",92,20.7,0.6,0.4],
["J0408401","孟加拉笛鲷","孟加拉笛鯛",87,19.8,0,0.3],
["E1700301","芦笋花","蘆筍花",21,2.9,2.7,0.3],
["E3201203","土植青江菜(4月取样)","土植青江菜(4月取樣)",11,1,1.8,0.1],
["E9500101","龙骨瓣莕菜","龍骨瓣莕菜",17,1.1,3.1,0.3],
["E2250101","薤","薤",10,0.5,1.9,0.2],
["G0110101","乾木耳(红耳仔)","乾木耳(紅耳仔)",329,6.1,79.8,0.2],
["A0355201","面肠","麵腸",138,20.6,9.7,1.9],
["C2200101","银杏果","銀杏果",142,4.1,28.9,1.2],
["A0420101","玉米粉","玉米粉",369,0.3,88.3,0.4],
["I0308201","猪带皮腹脇肉","豬帶皮腹脇肉",368,14.5,0,33.9],
["I0520301","去骨鸭掌","去骨鴨掌",113,12.6,0,6.6],
["I03104","猪绞肉平均值","豬絞肉平均值",212,18.7,0,14.6],
["P0201401","陈皮","陳皮",349,6.9,74.8,2.4],
["N0700201","蜂蜜(春蜜)","蜂蜜(春蜜)",308,0.2,79.6,0.2],
["C2305101","生莲子","生蓮子",334,21.8,60.9,1.2],
["P1003001","蒜蓉酱","蒜蓉醬",282,4.2,21.2,20],
["P0100501","甘草粉","甘草粉",341,9.2,73.4,3.6],
["R3000501","油豆腐粉丝(阿给)","油豆腐粉絲(阿給)",146,6.9,15.7,6.2],
["R0900101","冷冻芝麻汤圆","冷凍芝麻湯圓",352,4.8,46.7,16.3],
["Q6200401","花生贡糖","花生貢糖",511,13.5,55,26.3],
["R6300301","冷冻干贝酥","冷凍干貝酥",146,8.3,27.7,0.2],
["D24003","李子平均值(红皮黄肉)","李子平均值(紅皮黃肉)",48,0.7,11.9,0.3],
["C0310101","原味夏威夷豆","原味夏威夷豆",700,7.5,18.2,71.6],
["C0410101","甜核桃","甜核桃",723,14.4,14.7,67.4],
["J2200301","红虾仁","紅蝦仁",43,9.5,1.5,0.3],
["J0412101","台湾鲷鱼片(水煮)","台灣鯛魚片(水煮)",130,23.4,1.3,3.3],
["D2000404","红宝石洋香瓜","紅寶石洋香瓜",39,1.2,9.6,0],
["E3201601","广岛野菜","廣島野菜",8,2,0.3,0.1],
["E5100101","菾菜","菾菜",21,2,3.7,0.1],
["J0403801","黄鳝","黃鱔",88,17.6,1,1.4],
["G1800101","舞菇","舞菇",28,1.4,5.8,0.1],
["M9900101","烤酥油","烤酥油",883,0,0,99.9],
["E7300101","长茄子","長茄子",25,1.2,5.3,0.2],
["O0702001","珍珠奶茶(去冰·微糖)","珍珠奶茶(去冰,微糖)",75,0.2,13.5,2.3],
["J0412102","台湾鲷鱼片(油煎)","台灣鯛魚片(油煎)",162,23.1,1.9,6.9],
["A05501","米粉平均值","米粉平均值",366,2.1,85.3,0.8],
["J2100901","白对虾(大)","白對蝦(大)",109,22.3,0,1.5],
["J0414809","鲭鱼(煎)","鯖魚(煎)",403,20,0,35.9],
["C0110101","甘扁桃仁片(熟)","甘扁桃仁片(熟)",618,23.4,14.8,56.9],
["C1305101","亚麻仁籽","亞麻仁籽",524,20.8,28.1,40.3],
["E7700101","青花菜芽","青花菜芽",25,2.4,3.6,0.6],
["E3050101","酸甘蓝菜","酸甘藍菜",22,1.4,4.2,0.2],
["J2100301","东方异腕虾","東方異腕蝦",78,17.7,0,0.3],
["P1001401","五味酱","五味醬",140,1.3,31.9,0.8],
["O0100101","西瓜汁(非原汁)","西瓜汁(非原汁)",30,1.1,6.1,0.1],
["Q1000501","肉松面包","肉鬆麵包",429,8.1,47.6,22.9],
["R2400601","黑糖馒头","黑糖饅頭",235,6.8,50,0.9],
["E5300103","广东莴苣","廣東萵苣",20,1,4,0.2],
["M2300101","高油酸棕榈油","高油酸棕櫚油",883,0,0,99.9],
["R5500101","冷冻牛肉汉堡肉","冷凍牛肉漢堡肉",249,14.4,6.3,18.5],
["A0500209","粳米(高雄145号)","粳米(高雄145號)",364,6.8,80,1],
["R0800201","紫米酒酿","紫米酒釀",155,4.2,33.6,0.4],
["D3200501","富士苹果(带皮)","富士蘋果(帶皮)",45,0.2,11.9,0.1],
["F9900301","寒天脆藻","寒天脆藻",10,0,2.5,0],
["R2800401","牛肉馅饼","牛肉餡餅",225,9.6,23.3,10.4],
["Q4100201","夹心饼乾(草莓)","夾心餅乾(草莓)",517,4.8,62.8,27.4],
["R2200801","冷冻猪肉熟水饺","冷凍豬肉熟水餃",235,7.2,28.9,10.1],
["Q6800101","维生素C口含锭(柠檬)","維生素C口含錠(檸檬)",399,0.2,98.3,0.6],
["J2100903","白对虾(小)(2022年取样)","白對蝦(小)(2022年取樣)",93,20.3,1.3,0.7],
["P1300101","法式奶酥酱","法式奶酥醬",596,6.7,37.6,46.5],
["P0101201","红胡椒粒","紅胡椒粒",376,5.9,59.3,13.7],
["A0551201","黑糯米浆","黑糯米漿",50,0.4,11.6,0.2],
["O0700101","美式咖啡(无糖)","美式咖啡(無糖)",2,0.2,0.3,0.1],
["J2101001","哈氏彷对虾","哈氏彷對蝦",82,18.7,0.6,0.2],
["R5900101","肉羹","肉羹",247,9.7,18.9,14.7],
["A0510301","五谷米","五穀米",358,8.7,72.9,2.9],
["M2500101","葵花籽油","葵花籽油",884,0,0,100],
["M0900301","奶油(液态)","奶油(液態)",340,2,0,39.1],
["R5600301","鸡肉酥","雞肉酥",451,26.7,53.2,14.6],
["E4800301","野苋菜","野莧菜",41,6.3,4.9,0.6],
["E5800301","紫色花椰菜","紫色花椰菜",40,3.1,7.6,0.3],
["E8800101","火炭母草","火炭母草",12,1.6,1.2,0.4],
["J0401801","斑海鲶","斑海鯰",86,19.2,0,0.5],
["J0402701","姬鱼","姬魚",104,24.1,0,0.2],
["E5500101","龙葵","龍葵",26,3.8,3.4,0.3],
["J0401002","虱目鱼(5月)","虱目魚(5月)",189,22.3,0,10.4],
["E9900301","荷兰豆菜心","荷蘭豆菜心",30,3.9,3.9,0.6],
["E3300103","翠玉白菜","翠玉白菜",19,1,2.8,0.7],
["E5300205","土植本岛莴苣(10月取样)","土植本島萵苣(10月取樣)",14,1.1,2.2,0.3],
["E4800101","白苋菜","白莧菜",17,1.9,2.6,0.3],
["J0407901","眼眶鱼","眼眶魚",113,20.3,0.2,2.9],
["E3100101","甘薯叶","甘藷葉",28,3.2,4.4,0.3],
["B0700201","马铃薯","馬鈴薯",77,2.6,15.8,0.2],
["J3500201","章鱼","章魚",61,13,0.9,0.6],
["B0100206","山药(台农1号)","山藥(台農1號)",93,2.6,19.9,0.1],
["B0100211","山药(花莲3号)","山藥(花蓮3號)",93,1.7,20.9,0.1],
["D0200102","木瓜(5月取样)","木瓜(5月取樣)",44,0.7,11.3,0.1],
["D1600104","杨桃(9月取样)","楊桃(9月取樣)",33,0.5,8.8,0],
["C1005101","山粉圆","山粉圓",400,16.3,58,12.8],
["P0102001","姜粉","薑粉",333,10.4,70.5,3.6],
["D3600101","柳橙","柳橙",44,0.8,11,0.1],
["D2900101","胭脂梅","胭脂梅",35,0.5,8.8,0.1],
["E7900101","紫高丽芽","紫高麗芽",32,0.2,6.6,0.7],
["J4100301","南美刺参","南美刺參",52,12,0,0],
["I04044","鸡排平均值","雞排平均值",183,17.1,0,12.2],
["Q8100501","凤梨果乾","鳳梨果乾",348,2,84.6,0.3],
["E6700201","绿皮蛇瓜","綠皮蛇瓜",32,1.9,5.6,0.6],
["D2400202","红肉李(小)","紅肉李(小)",38,0.7,9.2,0.3],
["A05001","籼米平均值","秈米平均值",357,7.8,77.4,0.9],
["D3700301","黄皮葡萄柚(进口)","黃皮葡萄柚(進口)",38,0.7,9.7,0.1],
["K0100102","鸡蛋(黄壳)","雞蛋(黃殼)",132,12.5,2,8.6],
["E4600201","日本茼蒿","日本茼蒿",15,2.6,1.8,0.2],
["C1505101","奇亚子","奇亞子",483,21.7,34.8,31.8],
["P0101401","绿胡椒粒","綠胡椒粒",379,11.3,68.4,7.3],
["L1000101","鲜奶可可","鮮奶可可",80,2.1,11.6,2.7],
["J0400501","魩仔鱼","魩仔魚",56,11.1,0,0.9],
["Q8100701","葡萄乾","葡萄乾",341,3.2,78.7,1.5],
["D2100403","金煌芒果","金煌芒果",52,0.8,13,0.2],
["I0420201","鸡尾椎","雞尾椎",452,9,0.1,45.9],
["P1003901","蒜味豆豉酱","蒜味豆豉醬",270,9.5,19.7,17],
["P0200501","咖哩块","咖哩塊",515,5.6,45.4,34.5],
["B0900101","莲藕","蓮藕",65,2,13.5,0.2],
["E7000102","蒲瓜(圆形)","蒲瓜(圓形)",18,0.6,4,0.1]
];
const tfndByName=new Map();
for(const [id,name,original,energy,protein,carbs,fat] of tfndRows){
 const code='TFND-'+id;const food={foodId:code,name,code,kcalPer100:energy,source:'https://data.gov.tw/dataset/8543',unknown:false};
 tfndByName.set(name,food); tfndByName.set(original.normalize('NFKC'),food);macrosPer100[code]=[protein,carbs,fat];
}
function tfndEstimate(raw){
 const quantity=raw.match(/^(\d+(?:\.\d+)?)\s*(?:克|g)\s*(.+)$/i)||raw.match(/^(.+?)\s*(\d+(?:\.\d+)?)\s*(?:克|g)$/i)?.map((v,i,a)=>i===1?a[2]:i===2?a[1]:v);
 const name=quantity?quantity[2]:raw;
 const food=tfndByName.get(name);if(!food)return null;
 const grams=quantity?Number(quantity[1]):100;
 if(!(grams>0&&grams<=10000))return {unknown:true,raw,name,reason:'请核对克数。'};
 return {...food,grams,kcal:grams*food.kcalPer100/100,raw,basis:quantity?'按输入克数':'未指定重量，按100克参考份（可修改）'};
}

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
  const imported=tfndEstimate(original);if(imported)return imported;
  const unknown=reason=>({name:original,raw:original,unknown:true,reason});
  if(/没吃|未吃|不吃|不含|不要/.test(original))return unknown('包含否定描述，未计入热量。');
  if(/[0-9]\s*[-~至]\s*[0-9]|几|少许|一点|口/.test(original))return unknown('份量表达暂不能可靠换算，可改写为半碗、一块等。');
  const candidates=foodCatalog.flatMap(f=>f.aliases.filter(alias=>original.includes(alias)).map(alias=>({f,alias}))).sort((a,b)=>b.alias.length-a.alias.length);
  if(!candidates.length&&/盖饭|盖浇饭/.test(original))return unknown('已记下这份盖饭。可补一道菜名，例如番茄牛肉盖饭，再估算。');
  if(!candidates.length)return unknown('尚无匹配的食物数据。');
  const {f,alias}=candidates[0];
  // Reject composite dishes and unsupported preparations instead of treating them as plain ingredients.
  let text=original.replace(alias,'');
  if(f.code==='CN-1296'||f.code==='CN-1291'){
   // 用户给出整包净重时优先采用标签重量，仅限单包。
   text=text.replace(/(?:一|1)(?:桶|包)\s*(?:净含量|净重|干重)\s*(?=\d)/,'').replace(/^(?:净含量|净重|干重)\s*(?=\d)/,'');
  }
  if(candidates.some(c=>c.f.id!==f.id&&!alias.includes(c.alias)))return unknown('多种食物请用逗号分开，避免份量混用。');
  if(/炒|炸|红烧|奶茶|蛋糕|夹心|酱|糖|奶粉|生米|生蛋|干面/.test(text))return unknown('该做法或配料尚无匹配数据，未套用普通食物热量。');
  const q=text.match(/([0-9]+(?:[.][0-9]+)?|半|[一二两三四五六七八九十]+)\s*(小|大)?\s*(千克|公斤|kg|毫升|ml|克|g|碗|盒|杯|瓶|份|个|颗|只|片|块|勺|桶|根|包)/i);
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
  return {foodId:f.id,name:f.name,raw:original,grams:Math.round(grams*10)/10,kcalPer100:f.energy,kcal:grams*f.energy/100,source:f.source||foodSourceBase+f.page,code:f.code,basis,unknown:false};
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
  const raw=fitplanStorage.getItem(key);if(!raw)return [];
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
 function write(next){if(locked)return false;try{fitplanStorage.setItem(key,JSON.stringify(next));records=next;renderRecords();if(window.dispatchEvent)window.dispatchEvent(new Event("food-records-changed"));return true}catch{status.textContent='保存失败，结果仍保留，请重试。';return false}}
 function make(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n}
 function totalText(rows){const t=foodTotals(rows);if(!rows.some(d=>d.items.some(i=>!i.unknown)))return '热量待估 · '+t.unknown+'项未计入';return (t.unknown?'已识别部分约 ':'已记录约 ')+t.total+' 千卡'+(t.unknown?' · '+t.unknown+'项未计入':'')}
 function showItems(container,items,recordId){
  items.forEach((item,index)=>{
   const card=make('div',undefined,'food-estimate-item');card.append(make('strong',item.name));
   if(item.unknown){card.append(make('p',item.reason+' 不按零热量处理。'));container.append(card);return}
   const label=make('label','估计份量 '),grams=make('input');grams.type='number';grams.className='gram-edit';grams.min='0.1';grams.max='10000';grams.step='any';grams.value=item.grams;grams.setAttribute('aria-label',item.name+'克数');
   label.append(grams,make('span','克'));card.append(label,make('p','约 '+Math.round(item.grams*item.kcalPer100/100)+' 千卡'));
   const macro=macrosPer100[item.code];
   if(macro){
    const [protein,carbs,fat]=macro.map(n=>(n*item.grams/100).toFixed(1));
    card.append(make('p','蛋白质 '+protein+' 克 · 碳水 '+carbs+' 克 · 脂肪 '+fat+' 克'));
   }
   const details=make('details'),summary=make('summary','查看估算依据'),link=make('a',(item.code.startsWith('TFND-')?'食药署食品营养资料集':item.code.startsWith('HK-')?'香港食安中心':item.code.startsWith('CN-')?'中国食物成分表':'FAO 食物表')+' · '+item.code);
   link.href=item.source;link.target='_blank';link.rel='noopener noreferrer';
   details.append(summary,make('p',item.basis+'；按 '+Number(item.kcalPer100.toFixed(1))+' 千卡/100克计算。'),link);card.append(details);
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
  if(document.getElementById){
   const check=el('day-complete'),day=filter.value;
   const marker='fitplan.food.complete.'+day;
   const signature=JSON.stringify(rows);
   check.disabled=!rows.length;
   check.checked=!!rows.length&&fitplanStorage.getItem(marker)===signature;
   check.onchange=()=>{try{
    if(check.checked)fitplanStorage.setItem(marker,signature);
    else fitplanStorage.removeItem(marker);
    status.textContent=check.checked?'已确认全天记全。':'已取消全天确认。';
   }catch{check.checked=!check.checked;status.textContent='保存失败，请重试。'}};
  }
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
  el('overview-intake').textContent=today.length?totalText(today):'待记录';
  const meals=el('overview-meals');
  meals.replaceChildren();
  for(const entry of today)meals.append(make('li',entry.meal+' · '+entry.raw));
  if(!today.length)meals.textContent='今天还没有饮食记录。';
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
if(typeof demoMonth!=='undefined'&&demoMonth){seedOctoberDemo();upgradeOctoberStatistics();const demoProfile=journalRecords("profile",{});if(!demoProfile.age&&demoProfile.weights?.["2026-10-01"]===61){Object.assign(demoProfile,{age:"25",height:"165",sex:"female",activity:"0"});fitplanStorage.setItem("fitplan.profile.v1",JSON.stringify(demoProfile))}}
if(document.getElementById)connectJournal('training');
connectFoodEstimator();
function seedOctoberDemo(){
 const key='fitplan.demo-seeded.v1';
 if(fitplanStorage.getItem(key))return;
 const menus=[
 ['100克燕麦粥，250克牛奶，100克香蕉','200克米饭，150克烤鸡胸肉，120克煮西兰花','220克烤土豆，160克原味豆腐，100克黄瓜'],
 ['80克全麦面包，100克水煮鸡蛋，150克苹果','200克米饭，120克烤瘦牛排，150克煮胡萝卜','200克熟鸡蛋面，120克原味豆腐，100克生菜'],
 ['200克酸奶，80克全麦面包，100克橙子','250克烤红薯，150克烤鸡胸肉，120克黄瓜','180克米饭，100克水煮鸡蛋，150克煮西兰花']
 ];
 const activities=[['快走',30],['弹力带训练',20],['舒缓拉伸',15],['慢跑',25],['徒手力量训练',25],['骑行',40],['散步',20]];
 const food=[],moves=[];
 for(let day=1;day<=31;day++){
  const date='2026-10-'+String(day).padStart(2,'0');
  const menu=menus[(day-1)%menus.length];
  menu.forEach((raw,i)=>food.push({id:date+'-meal-'+i,date,meal:['早餐','午餐','晚餐'][i],raw,items:estimateFood(raw)}));
  const [name,minutes]=activities[(day-1)%7];
  moves.push({id:date+'-move',date,name,raw:name+minutes+'分钟',minutes:String(minutes),state:day%10===0?'planned':'done',sets:'',reps:'',weight:'',note:'演示记录'});
 }
 fitplanStorage.setItem('fitplan.food.records.v1',JSON.stringify(food));
 fitplanStorage.setItem('fitplan.training.records.v1',JSON.stringify(moves));
 const weights={'2026-10-01':61,'2026-10-08':60.8,'2026-10-15':60.9,'2026-10-22':60.6,'2026-10-31':60.5};
 fitplanStorage.setItem('fitplan.profile.v1',JSON.stringify({weight:'60.5',weights}));
 fitplanStorage.setItem(key,'1');
}


if(document.getElementById){
 const search=el('library-search'),list=el('library-results'),feedback=el('library-feedback');
 const entries=[...foodCatalog.map(f=>({name:f.name,token:f.aliases[0],terms:[f.name,...f.aliases],id:f.id,kcal:f.energy})),
 ...tfndRows.map(([id,name,original,kcal])=>({name,token:name,terms:[name,original],id:'TFND-'+id,kcal}))];

 let limit=20,selected;
 const grams=el('library-grams'),panel=el('food-selection');
 function choice(food){
  const button=document.createElement('button');
  button.type='button';button.textContent=food.name;
  button.onclick=()=>{
   selected=food;panel.hidden=false;
   el('selection-label').textContent=food.name+' · 本次克数';
   grams.value='';grams.focus();
  };
  return button;
 }
 function show(){
  const counts=new Map();
  try{
   const records=JSON.parse(fitplanStorage.getItem('fitplan.food.records.v1')||'[]');
   for(const [index,record] of records.entries()){
    for(const id of new Set((record.items||[]).map(item=>item.foodId).filter(Boolean))){
     counts.set(id,{count:(counts.get(id)?.count||0)+1,last:index});
    }
   }
  }catch{}
  const recent=el('recent-foods');
  const favorites=entries.filter(f=>counts.has(f.id)).sort((a,b)=>{
   const x=counts.get(a.id),y=counts.get(b.id);
   return y.count-x.count || y.last-x.last;
  }).slice(0,5);
  recent.replaceChildren(...favorites.map(choice));
  if(!favorites.length)recent.textContent='记录吃过的食物后，就能从这里快速选择。';
  const key=search.value.trim().toLowerCase();
  const matches=key?entries.filter(f=>f.terms.some(t=>t.toLowerCase().includes(key))):[];
  list.replaceChildren(...matches.slice(0,limit).map(choice));
  if(key&&!matches.length)list.textContent='没有找到，试试更短的名称。';
  el('library-more').hidden=matches.length<=limit;
 }
 function add(){
  const n=grams.valueAsNumber;
  if(!selected||!Number.isFinite(n)||!grams.checkValidity()){grams.required=true;grams.reportValidity();grams.focus();grams.required=false;return}
  const input=el('food-raw');
  input.value+=(input.value.trim()?'，':'')+n+'克'+selected.token;
  input.dispatchEvent(new Event('input'));
  feedback.textContent='已加入 '+selected.name+' '+n+' 克。';
  panel.hidden=true;selected=null;grams.value='';
 }
 el('add-selection').onclick=add;
 grams.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();add()}};
 search.oninput=()=>{limit=20;show()};
 el('library-more').onclick=()=>{limit+=20;show()};
 window.addEventListener('food-records-changed',show);
 window.addEventListener('storage',e=>{if(e.storageArea===fitplanStorage&&e.key==='fitplan.food.records.v1')show()});
 show();
}
function journalRecords(key, fallback){
 return JSON.parse(fitplanStorage.getItem('fitplan.'+key+'.v1'))??fallback;
}
function renderWeek(){
 const panel=el('week-review');
 panel.replaceChildren();
 try{
  const food=journalRecords('food.records',[]),training=journalRecords('training.records',[]);
  const first=new Date((el("progress-day").value||localDay())+"T12:00:00");first.setHours(12,0,0,0);first.setDate(first.getDate()-(first.getDay()+6)%7);
  for(let i=0;i<7;i++){
   const date=new Date(first);date.setDate(first.getDate()+i);
   const day=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
   const meals=food.filter(r=>r.date===day),moves=training.filter(r=>r.date===day);
   const items=meals.flatMap(r=>r.items||[]),energy=items.filter(x=>Number.isFinite(x.kcal));
   const known=items.filter(x=>macrosPer100[x.code]&&positive(x.grams));
   const heading=document.createElement('h3');heading.textContent='周'+'一二三四五六日'[i]+' · '+day;
   const line=document.createElement('p');
   const parts=[];
   if(meals.length){
    parts.push('饮食 '+meals.length+' 条',energy.length?'已估约 '+Math.round(energy.reduce((n,x)=>n+x.kcal,0))+' 千卡':'热量待估');
    if(known.length)parts.push(...['蛋白质','碳水','脂肪'].map((label,k)=>label+' '+Number(known.reduce((n,x)=>n+macrosPer100[x.code][k]*x.grams/100,0).toFixed(1))+' 克'));
    if(known.length<items.length||energy.length<items.length)parts.push('部分数据待估');
   }else parts.push(day>localDay()?'尚未到来':'饮食未记录');
   if(moves.length)parts.push('已完成 '+moves.filter(x=>x.state==='done').length+' 项训练','计划 '+moves.filter(x=>x.state==='planned').length+' 项');
   else if(day<=localDay())parts.push('训练未记录');
   line.textContent=parts.join(' · ');panel.append(heading,line);
  }
 }catch{panel.textContent='本周记录读取失败，请重新打开页面。'}
}
if(document.getElementById){
 setupProgress();renderDayDetails();
 for(const event of ['hashchange','storage','focus','food-records-changed'])window.addEventListener(event,()=>{if(location.hash==='#week')renderProgress()});
}
function dateKey(date){
 return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
function weightHistory(profile){
 if(profile?.weights)return profile.weights;
 const saved=new Date(profile?.updatedAt);
 return positive(profile?.weight)&&Number.isFinite(saved.getTime())?{[dateKey(saved)]:Number(profile.weight)}:{};
}
function setupProgress(){
 el('measure-day').max=localDay();
 el('measure-day').value=localDay();
 el('progress-day').value=localDay();
 el('progress-month').value=demoMonth||localDay().slice(0,7);
 if(demoMonth){el('progress-day').value=demoMonth+'-15';for(const id of ['food-filter','training-filter']){el(id).value=demoMonth+'-15';el(id).dispatchEvent(new Event('change'))}}
 for(const id of ['progress-day','progress-month','progress-range'])el(id).addEventListener('change',renderProgress);
 renderProgress();
}
function renderProgress(){
 const monthly=el('progress-range').value==='month';
 el('month-control').hidden=el('month-review').hidden=!monthly;
 el('week-control').hidden=el('week-review').hidden=monthly;
 if(!monthly){renderWeek();return}
 const panel=el('month-review'),month=el('progress-month').value;
 panel.replaceChildren();
 if(!month){panel.textContent='请选择月份。';return}
 function line(tag,text){const node=document.createElement(tag);node.textContent=text;panel.append(node)}
 try{
  const inMonth=r=>r.date?.slice(0,7)===month;
  const meals=journalRecords('food.records',[]).filter(inMonth);
  const training=journalRecords('training.records',[]).filter(inMonth);
  const done=training.filter(r=>r.state==='done'),timed=done.filter(r=>positive(r.minutes));
  line('h2',month.replace('-',' 年 ')+' 月');
  line('p',meals.length?'饮食记录覆盖 '+new Set(meals.map(r=>r.date)).size+' 天，共 '+meals.length+' 条。':'本月暂无饮食记录。');
  line('p',training.length?'已完成 '+done.length+' 项训练'+(timed.length?'，已记时合计 '+Number(timed.reduce((n,r)=>n+Number(r.minutes),0).toFixed(1))+' 分钟':'')+'。另有 '+training.filter(r=>r.state==='planned').length+' 项计划。':'本月暂无训练记录。');
  const profile=journalRecords('profile',{}),samples=[];
  for(const day of new Set(meals.map(row=>row.date))){
   const sample=energyDay(day,profile,meals.filter(row=>row.date===day),training.filter(row=>row.date===day));
   if(Number.isFinite(sample.intake))samples.push(sample);
  }
  line('h3','日均热量收支');
  if(samples.length){
   const mean=key=>Math.round(samples.reduce((sum,row)=>sum+row[key],0)/samples.length);
   const intake=mean('intake'),burn=mean('total'),gap=intake-burn;
   const cards=document.createElement('div');cards.className='energy-averages';
   for(const [label,value] of [['日均摄入',intake],['日均总消耗',burn],[gap<0?'日均缺口':gap>0?'日均盈余':'收支持平',Math.abs(gap)]]){
    const cell=document.createElement('div'),title=document.createElement('span'),number=document.createElement('strong');
    title.textContent=label;number.textContent=value.toLocaleString('zh-CN');cell.append(title,number);cards.append(cell);
   }
   panel.append(cards);
   line('p','单位：千卡 / 天 · 共 '+samples.length+' 个饮食记全、可估算收支的日期');
   line('p','日均消耗中，非训练时段约 '+mean('daily')+' 千卡，已记录训练约 '+mean('exercise')+' 千卡。非训练时段按久坐日估算。');
  }else line('p','暂无可计算的完整日期。请确认全天饮食已记全，并补全估算消耗所需的身体数据和训练记录。');
  line('h3','体重变化');
  const points=Object.entries(weightHistory(journalRecords('profile',{}))).filter(([day,w])=>day.startsWith(month+'-')&&positive(w)).sort(([a],[b])=>a.localeCompare(b));
  if(!points.length){line('p','本月还没有体重测量。可在「身体数据」选择测量日期后保存。');return}
  const first=points[0][1],last=points.at(-1)[1],delta=Number((last-first).toFixed(1));
  line('p',points.length===1?'本月首次测量：'+first+' kg。':first+' → '+last+' kg，首末两次相差 '+(delta>0?'+':'')+delta+' kg。');
  const weights=points.map(p=>Number(p[1])),lo=Math.min(...weights)-0.5,hi=Math.max(...weights)+0.5;
  const days=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();
  const x=d=>48+(Number(d.slice(-2))-1)*400/(days-1),y=w=>128-(w-lo)*104/(hi-lo);
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  function draw(tag,attrs,text){const n=document.createElementNS(svg.namespaceURI,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text)n.textContent=text;svg.append(n);return n}
  svg.setAttribute('viewBox','0 0 480 164');svg.setAttribute('role','img');svg.setAttribute('aria-label',month+' 体重曲线，单位千克。逐日数值见下方测量明细。');
  for(const w of [lo,hi]){draw('line',{x1:48,x2:448,y1:y(w),y2:y(w),stroke:'#dbe3d6'});draw('text',{x:2,y:y(w)+4},w.toFixed(1))}
  draw('text',{x:48,y:156},'1 日');draw('text',{x:422,y:156},days+' 日');
  draw('polyline',{points:points.map(([d,w])=>x(d)+','+y(w)).join(' '),fill:'none',stroke:'#426853','stroke-width':3});
  for(const [d,w] of points)draw('circle',{cx:x(d),cy:y(w),r:4,fill:'#365846'});
  panel.append(svg);
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='测量明细（'+points.length+' 天）';details.append(summary);
  for(const [d,w] of points){const p=document.createElement('p');p.textContent=d+' · '+w+' kg';details.append(p)}panel.append(details);
 }catch{panel.textContent='月度记录暂时无法读取。'}
}

function upgradeOctoberStatistics(){
 const marker='fitplan.demo.statistics.v1';
 if(fitplanStorage.getItem(marker))return;
 const meals=journalRecords('food.records',[]);
 for(let day=1;day<=31;day++){
  const date='2026-10-'+String(day).padStart(2,'0');
  const rows=meals.filter(r=>r.date===date);
  if(day%5&&rows.length===3&&rows.every((r,i)=>r.id===date+'-meal-'+i))
   fitplanStorage.setItem('fitplan.food.complete.'+date,JSON.stringify(rows));
 }
 const codes={'快走':'17200','慢跑':'12020','徒手力量训练':'02056','骑行':'01015'};
 const weights=weightHistory(journalRecords('profile',{}));
 const moves=journalRecords('training.records',[]);
 for(const move of moves){
  if(move.activity||move.id!==move.date+'-move')continue;
  const row=activityCatalog.find(r=>r[0]===codes[move.name]);
  const date=Object.keys(weights).filter(d=>d<=move.date).sort().at(-1);
  if(row&&date)move.activity={code:row[0],met:row[1],description:row[2],kcal:Math.round(row[1]*weights[date]*Number(move.minutes)/60)};
 }
 fitplanStorage.setItem('fitplan.training.records.v1',JSON.stringify(moves));
 fitplanStorage.setItem(marker,'1');
}

function energyDay(day,profile,meals,moves){
 const history=weightHistory(profile);
 const measured=Object.keys(history).filter(d=>d<=day).sort().at(-1);
 const weight=measured?history[measured]:Object.keys(history).length?null:profile.weight;
 const baseline=dailyEnergyEstimate({...profile,weight,activity:'0'});
 const unavailable={total:null,balance:'热量收支待估算'};
 if(!baseline)return {...unavailable,detail:'需要适用的成人资料和当日或更早的体重记录'};
 const done=moves.filter(r=>r.state==='done');
 const minutes=done.reduce((n,r)=>n+Number(r.minutes),0);
 if(minutes>1440||done.some(r=>!positive(r.minutes)||!Number.isFinite(r.activity?.kcal))){
  return {...unavailable,detail:'久坐日基线约 '+Math.round(baseline)+' 千卡；已完成训练的时长或热量待核实'};
 }
 const daily=Math.round(baseline*(1-minutes/1440)),exercise=Math.round(done.reduce((n,r)=>n+r.activity.kcal,0)),total=daily+exercise;
 const detail='非训练时段约 '+daily+' + 已记录训练 '+exercise+' = 预计全天 '+total+' 千卡（久坐日参照）';
 const complete=meals.length&&fitplanStorage.getItem('fitplan.food.complete.'+day)===JSON.stringify(meals)&&meals.every(r=>r.items?.length&&r.items.every(i=>!i.unknown&&Number.isFinite(i.kcal)));
 if(!complete)return {total,detail,balance:'摄入尚未确认记全或有热量待估，暂不计算盈亏'};
 const intake=Math.round(meals.flatMap(r=>r.items).reduce((n,i)=>n+i.kcal,0)),difference=intake-total;
 return {total,daily,exercise,intake,detail,balance:'摄入 '+intake+' 千卡，'+(difference===0?'估算收支持平':'预计'+(difference>0?'盈余':'缺口')+'约 '+Math.abs(difference)+' 千卡')};
}
