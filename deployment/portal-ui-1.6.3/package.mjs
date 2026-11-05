// Standalone UI repair for the installed 1.6.2 portal, including installations
// that have since added Aluesuunnitelma. No old portal/server files are shipped.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(here,'../..');
const args=process.argv.slice(2);
if(args.length!==2)throw Error('Pass the previous 1.6.2 ulkoasu.json and a NEW destination directory.');
const [previousFile,destination]=args.map(p=>path.resolve(p));
if(fs.existsSync(destination))throw Error('Destination already exists.');
const previous=JSON.parse(fs.readFileSync(previousFile,'utf8'));
if(previous.format!=='tjt-schedule-ui-1.6.2'||!previous.files?.['schedule/out/index.html'])throw Error('Expected the delivered 1.6.2 UI inventory.');
const html=fs.readFileSync(path.join(repo,'out/index.html'),'utf8');
if(!html.includes('<title>Aikataulu</title>')||!html.includes('/aikataulu/_next/'))throw Error('Build the portal export first.');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const update=path.join(destination,'alatehtavat-1.6.3'),files={};
function copy(directory,relative=''){
 for(const e of fs.readdirSync(directory,{withFileTypes:true})){
  if(e.isSymbolicLink())throw Error('No symlinks in export.');
  const name=relative+e.name;
  if(e.isDirectory())copy(path.join(directory,e.name),name+'/');
  else{const key='schedule/out/'+name,bytes=fs.readFileSync(path.join(directory,e.name)),target=path.join(update,'payload',key);files[key]=sha(bytes);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes);}
 }
}
copy(path.join(repo,'out'));
const manifest=JSON.stringify({format:'tjt-schedule-ui-1.6.3',previous:previous.files,files},null,2)+'\n';
fs.writeFileSync(path.join(update,'ulkoasu.json'),manifest);
const updater=fs.readFileSync(path.join(here,'../portal-ui-1.6.2/Paivita-Ulkoasu.cjs'));
fs.writeFileSync(path.join(update,'Paivita-Ulkoasu.cjs'),updater);
const ps=fs.readFileSync(path.join(here,'05-Paivita-Alatehtavat.ps1.template'),'utf8').replace('__UPDATER_SHA__',sha(updater)).replace('__MANIFEST_SHA__',sha(manifest));
fs.writeFileSync(path.join(destination,'05-Paivita-Alatehtavat.ps1'),'\uFEFF'+ps.replace(/\r?\n/g,'\r\n'));
fs.copyFileSync(path.join(here,'LUE-ENSIN.txt'),path.join(destination,'LUE-ENSIN.txt'));
console.log(JSON.stringify({destination,files:Object.keys(files).length,updaterSha256:sha(updater)}));
