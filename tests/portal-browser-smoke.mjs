// Browser contract test for the portal transport. The real TJT auth/proxy is tested
// separately in the installation package; these sessions are synthetic fixtures.
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createHmac,randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const root=await mkdtemp(join(tmpdir(),'portal-browser-'));
const secret=randomBytes(48).toString('hex');
let service,browser;
const allocator=createServer();allocator.listen(0,'127.0.0.1');await once(allocator,'listening');const port=allocator.address().port;await new Promise(r=>allocator.close(r));
const csrf='synthetic-browser-csrf';
const users={editor:{userId:'editor',userName:'Testimuokkaaja',role:'edit'},reader:{userId:'reader',userName:'Testilukija',role:'read'}};
const proxy=createServer(async(req,res)=>{
 try{
  const user=users[(req.headers.cookie||'').replace('test_user=','')];if(!user){res.writeHead(401);res.end('{}');return;}
  if(req.url==='/portal-api/me'){res.setHeader('content-type','application/json');res.end(JSON.stringify({csrf}));return;}
  if(req.url.startsWith('/?')){res.end('<h1>TJT test portal</h1>');return;}
  const u=new URL(req.url,'http://local'),c=req.headers['x-tjt-company']||u.searchParams.get('company')||'tjt';
  const companyId={tjt:'tjt',tjt_katto:'tjt-katto',previmek:'previmek'}[c];
  if(!companyId){res.writeHead(403);res.end('{}');return;}
  if(!['GET','HEAD'].includes(req.method)&&req.headers['x-tjt-csrf']!==csrf){res.writeHead(403);res.end('{}');return;}
  const chunks=[];for await(const b of req)chunks.push(b);
  const token=Buffer.from(JSON.stringify({...user,companyId,lockId:user.userId+':'+req.headers['x-tjt-tab'],expiresAt:Date.now()+30000})).toString('base64url');
  const upstream=await fetch(`http://127.0.0.1:${port}${req.url}`,{method:req.method,headers:{'content-type':'application/json','x-tjt-schedule-context':token,'x-tjt-schedule-signature':createHmac('sha256',secret).update(token).digest('hex')},...chunks.length?{body:Buffer.concat(chunks)}:{}});
  res.writeHead(upstream.status,{'content-type':upstream.headers.get('content-type')||'text/plain'});res.end(Buffer.from(await upstream.arrayBuffer()));
 }catch(e){res.writeHead(500);res.end(JSON.stringify({error:e.message}));}
});
try{
 service=spawn(process.execPath,['server/server.mjs'],{env:{...process.env,SNEDO_AIKATAULU_PORT:String(port),SNEDO_AIKATAULU_DATA_DIR:root,TJT_PORTAL_SCHEDULE_SECRET:secret},stdio:['ignore','pipe','inherit']});await once(service.stdout,'data');
 proxy.listen(0,'127.0.0.1');await once(proxy,'listening');const origin=`http://127.0.0.1:${proxy.address().port}`;
 browser=await chromium.launch({headless:true});const errors=[];
 async function open(user){const c=await browser.newContext();await c.addCookies([{name:'test_user',value:user,url:origin}]);const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());return p;}
 const p=await open('editor');await p.goto(origin+'/aikataulu?company=tjt');await p.getByRole('dialog',{name:'Projektit',exact:true}).waitFor();
 await p.getByLabel('Työnumero',{exact:true}).fill('2701');await p.getByLabel('Kohde',{exact:true}).fill('Tuontia varten');await p.getByRole('button',{name:'Luo',exact:true}).click();await p.getByRole('dialog',{name:'Projektit',exact:true}).waitFor({state:'hidden'});
 const payload={version:1,projectNumber:'2701',projectName:'Siirtokoe Ääkköset',scheduleName:'Yleisaikataulu',statusDate:'2026-11-04',tasks:[{id:1,type:'task',name:'Julkisivutyö',start:'2026-11-04',duration:5,level:0,progress:20}],snapshots:[],extraDaysOff:['2026-12-24'],milestones:[{id:'m1',title:'Valmis',date:'2026-12-01'}]};
 await p.locator('input[type=file][accept*="json"]').setInputFiles({name:'vanha-1.5.jana.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
 await p.getByRole('button',{name:'Tallenna nyt',exact:true}).click();await p.waitForFunction(()=>document.querySelector('.portal-company-bar')?.textContent.includes('Tallennettu palvelimelle'));
 const db=JSON.parse(await readFile(join(root,'tjt/projects.json'),'utf8'));assert.equal(db.projects.length,1);assert.deepEqual(db.projects[0].data,payload);
 if(process.env.SNEDO_QA_SCREENSHOT){await p.setViewportSize({width:1600,height:1000});await p.screenshot({path:process.env.SNEDO_QA_SCREENSHOT});}
 const rp=await open('reader');await rp.goto(origin+'/aikataulu?company=tjt');await rp.getByText('Vain katselu',{exact:true}).waitFor();assert(await rp.getByRole('button',{name:'+ Työvaihe',exact:true}).isDisabled());
 const second=await p.context().newPage();await second.goto(p.url());await second.getByText('Vain katselu',{exact:true}).waitFor();assert(await second.getByRole('button',{name:'+ Työvaihe',exact:true}).isDisabled());
 await p.getByRole('button',{name:'← TJT-pääsivulle',exact:true}).click();await p.getByRole('heading',{name:'TJT test portal'}).waitFor();
 await p.goto(origin+'/aikataulu?company=tjt_katto');await p.getByRole('dialog',{name:'Projektit',exact:true}).waitFor();assert(!(await p.locator('.project-card-list').textContent()).includes('Siirtokoe'));
 await p.goto(origin+'/aikataulu?company=tjt');await p.getByRole('button',{name:'Tallenna nyt',exact:true}).waitFor();
 await p.route('**/aikataulu/api/projects/*',route=>route.request().method()==='PUT'?route.abort():route.continue());
 await p.locator('input[type=file][accept*="json"]').setInputFiles({name:'muutos.jana.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...payload,projectName:'Tallentamaton'}))});
 await p.getByRole('alert').filter({hasText:'Muutoksia ei tallennettu'}).waitFor();const before=p.url();await p.getByRole('button',{name:'← TJT-pääsivulle',exact:true}).click();assert.equal(p.url(),before);
 assert.deepEqual(errors,[]);console.log('PORTAL BROWSER PASS: create, 1.5 JSON import, persistent save, shared read, read-only UI, second-tab lock, company selection, return and failed-save retention.');
}catch(e){if(browser){let i=0;for(const c of browser.contexts())for(const p of c.pages()){console.error('FAILURE PAGE',p.url(),(await p.locator('body').innerText()).slice(0,1200));await p.screenshot({path:'portal-browser-failure-'+(i++)+'.png'}).catch(()=>{});}}throw e;}
finally{if(browser)await browser.close();await new Promise(r=>proxy.close(r));if(service){const done=once(service,'exit');service.kill();await done;}await rm(root,{recursive:true,force:true});}
