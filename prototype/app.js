const DAY=24*60*60*1000; const pxDay=72/7; const projectStart=new Date('2026-07-06T00:00:00');
let tasks=[
{id:1,name:'Talo 32',level:0,start:'2026-07-23',duration:30,progress:70,summary:true},
{id:2,name:'Purkutyöt',level:1,start:'2026-07-23',duration:5,progress:100},
{id:3,name:'Muottityö, raudoitus ja valu',level:1,start:'2026-07-30',duration:5,progress:100},
{id:4,name:'Hiekkapuhallus',level:1,start:'2026-08-06',duration:5,progress:80},
{id:5,name:'Betonikorjaus',level:1,start:'2026-08-13',duration:5,progress:40},
{id:6,name:'Ylitasoitus',level:1,start:'2026-08-20',duration:5,progress:0},
{id:7,name:'Maalaus- ja pinnoitus',level:1,start:'2026-08-27',duration:5,progress:0},
{id:8,name:'Talo 30',level:0,start:'2026-08-06',duration:30,progress:25,summary:true},
{id:9,name:'Purkutyöt',level:1,start:'2026-08-06',duration:5,progress:100},
{id:10,name:'Muottityö, raudoitus ja valu',level:1,start:'2026-08-13',duration:5,progress:40},
{id:11,name:'Hiekkapuhallus',level:1,start:'2026-08-20',duration:5,progress:0},
{id:12,name:'Betonikorjaus',level:1,start:'2026-08-27',duration:5,progress:0},
{id:13,name:'Ylitasoitus',level:1,start:'2026-09-03',duration:5,progress:0},
{id:14,name:'Maalaus- ja pinnoitus',level:1,start:'2026-09-10',duration:5,progress:0},
{id:15,name:'Parvekekaide- ja lasiasennus',level:0,start:'2026-08-31',duration:15,progress:0,summary:true},
{id:16,name:'Pihakatoksien rakentaminen',level:0,start:'2026-07-23',duration:5,progress:100,summary:true}
];
let selected=1, baseline=null;
const tbody=document.querySelector('#taskTable tbody'), rows=document.querySelector('#rows'), cal=document.querySelector('#calendar');
function date(s){return new Date(s+'T00:00:00')} function fmt(d){return d.toISOString().slice(0,10)}
function workEnd(t){let d=date(t.start), n=t.duration-1; while(n>0){d=new Date(d.getTime()+DAY);if(d.getDay()!=0&&d.getDay()!=6)n--}return d}
function addWorkDays(start,delta){let d=new Date(start),step=delta>=0?1:-1,n=Math.abs(delta);while(n){d=new Date(d.getTime()+step*DAY);if(d.getDay()!=0&&d.getDay()!=6)n--}return d}
function weekNo(d){let x=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));x.setUTCDate(x.getUTCDate()+4-(x.getUTCDay()||7));let y=new Date(Date.UTC(x.getUTCFullYear(),0,1));return Math.ceil((((x-y)/DAY)+1)/7)}
function hier(i){let stack=[];for(let k=0;k<=i;k++){stack[tasks[k].level]=(stack[tasks[k].level]||0)+1;stack=stack.slice(0,tasks[k].level+1)}return stack.join('.')}
function save(){localStorage.setItem('aikataulu-proto',JSON.stringify({tasks,baseline}));document.querySelector('#saveState').textContent='Tallennettu '+new Date().toLocaleTimeString('fi-FI',{hour:'2-digit',minute:'2-digit'})}
function renderCalendar(){cal.innerHTML='';for(let i=0;i<16;i++){let d=new Date(projectStart.getTime()+i*7*DAY);let e=document.createElement('div');e.className='week';e.innerHTML=d.toLocaleString('fi-FI',{month:'long'})+'<b>vko '+weekNo(d)+'</b>';cal.appendChild(e)}}
function render(){tbody.innerHTML='';rows.innerHTML=''; tasks.forEach((t,i)=>{let tr=document.createElement('tr');tr.dataset.id=t.id;tr.className=(t.summary?'summary ':'')+(t.id===selected?'task-selected':'');tr.innerHTML=`<td><input type="radio" name="sel" ${t.id===selected?'checked':''}></td><td class="hier">${hier(i)}</td><td class="task-name" contenteditable style="padding-left:${8+t.level*18}px">${t.name}</td><td><input class="duration" type="number" min="1" value="${t.duration}"></td><td><input class="start" type="date" value="${t.start}"></td><td><input class="progress" type="number" min="0" max="100" value="${t.progress}"></td>`;tbody.appendChild(tr);
tr.onclick=()=>{selected=t.id;render()};tr.querySelector('.task-name').onblur=e=>{t.name=e.target.textContent.trim()||'Nimetön';save();render()};tr.querySelector('.duration').onchange=e=>{t.duration=Math.max(1,+e.target.value);save();render()};tr.querySelector('.start').onchange=e=>{t.start=e.target.value;save();render()};tr.querySelector('.progress').onchange=e=>{t.progress=Math.max(0,Math.min(100,+e.target.value));save();render()};
let gr=document.createElement('div');gr.className='gantt-row';let bar=document.createElement('div');bar.className='bar '+(t.summary?'summary-bar':'');let left=(date(t.start)-projectStart)/DAY*pxDay;let width=Math.max(12,(workEnd(t)-date(t.start))/DAY*pxDay+pxDay);bar.style.left=left+'px';bar.style.width=width+'px';bar.innerHTML=`<span class="bar-label">${hier(i)}</span><div class="bar-progress" style="width:${t.progress}%"></div><span class="resize"></span>`;gr.appendChild(bar);
if(baseline&&baseline[t.id]){let b=baseline[t.id],bb=document.createElement('div');bb.className='bar baseline';bb.style.left=((date(b.start)-projectStart)/DAY*pxDay)+'px';bb.style.width=Math.max(12,(workEnd(b)-date(b.start))/DAY*pxDay+pxDay)+'px';gr.appendChild(bb)}
makeDrag(bar,t);rows.appendChild(gr)});positionStatus();save()}
function makeDrag(bar,t){let mode,startX,startLeft,startW;bar.onpointerdown=e=>{e.preventDefault();mode=e.target.classList.contains('resize')?'resize':'move';startX=e.clientX;startLeft=parseFloat(bar.style.left);startW=parseFloat(bar.style.width);bar.setPointerCapture(e.pointerId)};bar.onpointermove=e=>{if(!mode)return;let dx=e.clientX-startX;if(mode==='move')bar.style.left=Math.round((startLeft+dx)/pxDay)*pxDay+'px';else bar.style.width=Math.max(pxDay,Math.round((startW+dx)/pxDay)*pxDay)+'px'};bar.onpointerup=e=>{if(!mode)return;if(mode==='move'){let delta=Math.round((parseFloat(bar.style.left)-startLeft)/pxDay);t.start=fmt(addWorkDays(date(t.start),delta))}else{let days=Math.max(1,Math.round(parseFloat(bar.style.width)/pxDay));t.duration=days}mode=null;save();render()}}
function positionStatus(){let d=date(document.querySelector('#statusDate').value);document.querySelector('#statusLine').style.left=((d-projectStart)/DAY*pxDay)+'px'}
document.querySelector('#add').onclick=()=>{let idx=Math.max(0,tasks.findIndex(x=>x.id===selected));let id=Math.max(...tasks.map(x=>x.id))+1;tasks.splice(idx+1,0,{id,name:'Uusi työvaihe',level:tasks[idx]?.level||0,start:tasks[idx]?.start||'2026-07-23',duration:5,progress:0});selected=id;render()};
document.querySelector('#indent').onclick=()=>{let i=tasks.findIndex(x=>x.id===selected);if(i>0)tasks[i].level=Math.min(tasks[i-1].level+1,tasks[i].level+1);render()};
document.querySelector('#outdent').onclick=()=>{let t=tasks.find(x=>x.id===selected);if(t)t.level=Math.max(0,t.level-1);render()};
document.querySelector('#baseline').onclick=()=>{baseline={};tasks.forEach(t=>baseline[t.id]={start:t.start,duration:t.duration});save();render();alert('Tavoiteaikataulu tallennettu. Oranssi ohut jana näyttää tavoitteen.')};
document.querySelector('#tracking').onclick=()=>{let c=document.querySelector('#trackingContent');c.innerHTML='<div class="legend"><span class="l1"></span>Tavoite <span class="l2"></span>Suunnitelma <span class="l3"></span>Toteutuma</div>';tasks.filter(t=>!t.summary).forEach(t=>{let e=document.createElement('div');e.className='track-item';e.innerHTML=`<strong>${t.name}</strong><label>Valmiusaste <input type="range" min="0" max="100" value="${t.progress}"></label><label>Toteutunut alku <input type="date" value="${t.actualStart||''}"></label><label>Toteutunut loppu <input type="date" value="${t.actualEnd||''}"></label><label>Huomautus <input value="${t.note||''}"></label>`;let ins=e.querySelectorAll('input');ins[0].oninput=ev=>{t.progress=+ev.target.value;render()};ins[1].onchange=ev=>{t.actualStart=ev.target.value;save()};ins[2].onchange=ev=>{t.actualEnd=ev.target.value;t.progress=ev.target.value?100:t.progress;save();render()};ins[3].onchange=ev=>{t.note=ev.target.value;save()};c.appendChild(e)});document.querySelector('#trackingPanel').classList.remove('hidden')};
document.querySelector('#closePanel').onclick=()=>document.querySelector('#trackingPanel').classList.add('hidden');document.querySelector('#statusDate').onchange=positionStatus;document.querySelector('#paper').onchange=e=>document.body.classList.toggle('a3',e.target.value.startsWith('A3'));document.querySelector('#print').onclick=()=>window.print();
let stored=localStorage.getItem('aikataulu-proto');if(stored){try{let s=JSON.parse(stored);tasks=s.tasks||tasks;baseline=s.baseline||null}catch(e){}}renderCalendar();render();
