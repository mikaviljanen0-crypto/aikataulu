import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import update from '../deployment/portal-ui-1.6.2/Paivita-Ulkoasu.cjs';
const hash = text => createHash('sha256').update(text).digest('hex');
function fixture(t, version='1.6.2') {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'aikataulu-ui-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const app=path.join(root,'app'),patch=path.join(root,'patch'),backups=path.join(root,'backups');
 const old={'schedule/out/index.html':'OLD HTML','schedule/out/_next/static/old.js':'OLD JS','server.cjs':'SERVER','aluesuunnitelma/editor.html':'AREA EDITOR','backup/run.cjs':'AREA-AWARE BACKUP','app/web/portal.js':'AREA-AWARE PORTAL'};
 const next={'schedule/out/index.html':'NEW HTML','schedule/out/_next/static/new.js':'NEW JS'};
 for(const[base,files]of [[app,old],[path.join(patch,'payload'),next]])for(const[f,b]of Object.entries(files)){fs.mkdirSync(path.dirname(path.join(base,f)),{recursive:true});fs.writeFileSync(path.join(base,f),b);}
 fs.writeFileSync(path.join(app,'manifest.json'),JSON.stringify({files:Object.fromEntries(Object.entries(old).map(([f,b])=>[f,hash(b)]))}));
 fs.writeFileSync(path.join(patch,'ulkoasu.json'),JSON.stringify({format:'tjt-schedule-ui-'+version,previous:Object.fromEntries(Object.entries(old).filter(([f])=>f.startsWith('schedule/')).map(([f,b])=>[f,hash(b)])),files:Object.fromEntries(Object.entries(next).map(([f,b])=>[f,hash(b)]))}));
 fs.writeFileSync(path.join(app,'projects.json'),'DO NOT CHANGE PROJECT DATA');
 return{root,app,patch,backups};
}
for(const version of ['1.6.2','1.6.3']) test('UI '+version+' keeps server, area tool, project data and old assets; repeat is a no-op',t=>{
 const f=fixture(t,version),before=JSON.parse(fs.readFileSync(path.join(f.app,'manifest.json'),'utf8')),r=update.apply(f.patch,f.app,f.backups);assert(!r.already);
 assert.equal(fs.readFileSync(path.join(f.app,'schedule/out/index.html'),'utf8'),'NEW HTML');
 assert.equal(fs.readFileSync(path.join(f.app,'schedule/out/_next/static/old.js'),'utf8'),'OLD JS');
 assert.equal(fs.readFileSync(path.join(f.app,'projects.json'),'utf8'),'DO NOT CHANGE PROJECT DATA');
 assert.equal(fs.readFileSync(path.join(f.app,'server.cjs'),'utf8'),'SERVER');
 const after=JSON.parse(fs.readFileSync(path.join(f.app,'manifest.json'),'utf8'));
 for(const[file,sha]of Object.entries(before.files))if(!file.startsWith('schedule/out/')){assert.equal(after.files[file],sha);assert.equal(hash(fs.readFileSync(path.join(f.app,file))),sha);}
 assert.equal(fs.readFileSync(path.join(r.backup,'old/schedule/out/index.html'),'utf8'),'OLD HTML');
 assert(update.apply(f.patch,f.app,f.backups).already);
});
for(const version of ['1.6.2','1.6.3']) test('UI '+version+' interrupted publish restores entry HTML and remains retryable',t=>{
 const f=fixture(t,version);
 assert.throws(()=>update.apply(f.patch,f.app,f.backups,{afterWrite(file){if(file.endsWith('index.html'))throw Error('SIMULATED WRITE FAILURE');}}),/Aiempi nakyma palautettu/);
 assert.equal(fs.readFileSync(path.join(f.app,'schedule/out/index.html'),'utf8'),'OLD HTML');
 assert.equal(fs.readFileSync(path.join(f.app,'projects.json'),'utf8'),'DO NOT CHANGE PROJECT DATA');
 assert(!update.apply(f.patch,f.app,f.backups).already);
});
test('unexpected installed or supplied content is rejected before any change',t=>{
 const f=fixture(t);
 fs.writeFileSync(path.join(f.app,'server.cjs'),'DIFFERENT SERVER');
 assert.throws(()=>update.apply(f.patch,f.app,f.backups),/odottamaton/);
 assert(!fs.existsSync(f.backups));
 fs.writeFileSync(path.join(f.app,'server.cjs'),'SERVER');
 fs.writeFileSync(path.join(f.patch,'payload/schedule/out/index.html'),'CORRUPTED');
 assert.throws(()=>update.apply(f.patch,f.app,f.backups),/Paketin tiedosto/);
 assert.equal(fs.readFileSync(path.join(f.app,'schedule/out/index.html'),'utf8'),'OLD HTML');
});
