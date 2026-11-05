'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS installer for the existing Windows portal. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));

function noLinks(file) {
  for (let p = path.resolve(file); ; p = path.dirname(p)) {
    if (fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink()) throw Error('Linkitetty polku: ' + p);
    if (path.dirname(p) === p) break;
  }
}
function safePath(root, relative, uiOnly = false) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(p => !p || p === '..' || p === '.')) throw Error('Virheellinen tiedostopolku.');
  if (uiOnly && !relative.startsWith('schedule/out/')) throw Error('Paivitys saa muuttaa vain aikataulun selainosan.');
  const file = path.resolve(root, relative);
  if (!file.startsWith(path.resolve(root) + path.sep)) throw Error('Virheellinen tiedostopolku.');
  noLinks(file);
  return file;
}
function matches(file, hash) {
  return /^[a-f0-9]{64}$/.test(hash) && fs.existsSync(file) && fs.statSync(file).isFile() && sha(fs.readFileSync(file)) === hash;
}
function check(root, app) {
  noLinks(root); noLinks(app);
  const patch = read(path.join(root, 'ulkoasu.json'));
  if (!['tjt-schedule-ui-1.6.2', 'tjt-schedule-ui-1.6.3'].includes(patch.format) || !patch.previous || !patch.files || !patch.files['schedule/out/index.html']) throw Error('Tuntematon ulkoasupaivitys.');
  for (const [relative, hash] of Object.entries(patch.files)) {
    if (!matches(safePath(path.join(root, 'payload'), relative, true), hash)) throw Error('Paketin tiedosto ei tasmaa: ' + relative);
  }
  const manifestFile = safePath(app, 'manifest.json');
  const manifest = read(manifestFile);
  if (!manifest.files || typeof manifest.files !== 'object') throw Error('Portaalin tiedostoluettelo puuttuu.');
  for (const [relative, hash] of Object.entries(manifest.files)) {
    if (!matches(safePath(app, relative), hash)) throw Error('Portaalissa on odottamaton tiedostoversio: ' + relative);
  }
  if (Object.entries(patch.files).every(([f, h]) => manifest.files[f] === h && matches(safePath(app, f, true), h))) return { patch, manifest, already: true };
  for (const [relative, hash] of Object.entries(patch.previous)) {
    if (manifest.files[relative] !== hash || !matches(safePath(app, relative, true), hash)) throw Error('Aikataulun lahtoversio ei tasmaa: ' + relative);
  }
  for (const [relative, hash] of Object.entries(patch.files)) {
    const file = safePath(app, relative, true);
    if (!Object.hasOwn(patch.previous, relative) && fs.existsSync(file) && !matches(file, hash)) throw Error('Uuden tiedoston paikalla on eri sisalto: ' + relative);
  }
  return { patch, manifest, already: false };
}
function atomic(file, bytes) {
  noLinks(file);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.ui-' + crypto.randomUUID() + '.tmp';
  try {
    fs.writeFileSync(temp, bytes, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temp, file);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}
function apply(root, app, backups, options = {}) {
  noLinks(backups);
  const lockFile = safePath(app, 'aikataulu-ui-update.lock');
  const lock = fs.openSync(lockFile, 'wx', 0o600);
  try {
    const { patch, manifest, already } = check(root, app);
    if (already) return { already: true };
    const backup = path.join(backups, 'Aikataulu-ulkoasu-' + patch.format.replace('tjt-schedule-ui-', '') + '-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomUUID());
    fs.mkdirSync(backup, { recursive: true, mode: 0o700 });
    const before = fs.readFileSync(path.join(app, 'manifest.json'));
    fs.writeFileSync(path.join(backup, 'manifest-before.json'), before, { flag: 'wx' });
    const files = Object.keys(patch.files).filter(f => !matches(safePath(app, f, true), patch.files[f]));
    // Publish hashed assets first and the entry HTML last. Keep old assets for open tabs.
    files.sort((a, b) => (a === 'schedule/out/index.html') - (b === 'schedule/out/index.html') || Number(!a.includes('/_next/static/')) - Number(!b.includes('/_next/static/')) || a.localeCompare(b));
    const originals = {};
    for (const f of files) {
      const target = safePath(app, f, true);
      originals[f] = fs.existsSync(target);
      if (originals[f]) {
        const copy = safePath(path.join(backup, 'old'), f, true);
        fs.mkdirSync(path.dirname(copy), { recursive: true });
        fs.copyFileSync(target, copy, fs.constants.COPYFILE_EXCL);
      }
    }
    fs.writeFileSync(path.join(backup, 'changes.json'), JSON.stringify({ version: patch.format, originals }, null, 2));
    const written = [];
    try {
      for (const f of files) {
        atomic(safePath(app, f, true), fs.readFileSync(safePath(path.join(root, 'payload'), f, true)));
        written.push(f);
        if (options.afterWrite) options.afterWrite(f);
      }
      const next = { ...manifest, files: { ...manifest.files, ...patch.files } };
      atomic(path.join(app, 'manifest.json'), JSON.stringify(next, null, 2) + '\n');
      if (!check(root, app).already) throw Error('Paivityksen lopputarkistus epaonnistui.');
    } catch (error) {
      try {
        for (const f of written.reverse()) {
          const target = safePath(app, f, true);
          if (originals[f]) atomic(target, fs.readFileSync(safePath(path.join(backup, 'old'), f, true)));
          // New immutable assets can stay: tabs may have fetched the new entry HTML.
        }
        const rollback = JSON.parse(before.toString('utf8').replace(/^\uFEFF/, ''));
        for (const f of written) if (!originals[f]) rollback.files[f] = patch.files[f];
        atomic(path.join(app, 'manifest.json'), JSON.stringify(rollback, null, 2) + '\n');
      } catch (restoreError) {
        throw Error(error.message + ' Palautus vaatii tarkistuksen: ' + restoreError.message + '. Ohjelmatiedostojen kopio: ' + backup);
      }
      throw Error(error.message + ' Aiempi nakyma palautettu. Ohjelmatiedostojen kopio: ' + backup);
    }
    return { already: false, backup, changedFiles: files.length };
  } finally {
    fs.closeSync(lock); fs.unlinkSync(lockFile);
  }
}
module.exports = { check, apply };
if (require.main === module) {
  try {
    const [command, app, backups] = process.argv.slice(2);
    if (command !== 'apply' || !app || !backups) throw Error('Kayta paketin mukana olevaa PowerShell-paivityskomentoa.');
    console.log(JSON.stringify(apply(__dirname, app, backups)));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
