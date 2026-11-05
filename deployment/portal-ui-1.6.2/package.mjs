// Add the UI-only updater to the existing, verified TJT integration package.
// Build the portal export first; then pass ORIGINAL_PACKAGE_DIR OUTPUT_DIR.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const [original, destination] = process.argv.slice(2).map(p => path.resolve(p));
if (!original || !destination || original === destination || fs.existsSync(destination)) throw Error('Use an original package and a NEW output directory.');
const old = JSON.parse(fs.readFileSync(path.join(original, 'paivitys.json'), 'utf8'));
if (old.format !== 'tjt-schedule-integration-1.6.1') throw Error('Unexpected base package.');
const html = fs.readFileSync(path.join(repo, 'out/index.html'), 'utf8');
if (!html.includes('<title>Aikataulu</title>') || !html.includes('/aikataulu/_next/')) throw Error('Build a portal export first.');
fs.cpSync(original, destination, { recursive: true });
const update = path.join(destination, 'ulkoasu-1.6.2');
fs.mkdirSync(update);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const files = {};
function copy(directory, relative = '') {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const name = relative + entry.name;
    if (entry.isSymbolicLink()) throw Error('No symlinks in export.');
    if (entry.isDirectory()) copy(path.join(directory, entry.name), name + '/');
    else {
      const key = 'schedule/out/' + name;
      const bytes = fs.readFileSync(path.join(directory, entry.name));
      files[key] = sha(bytes);
      const target = path.join(update, 'payload', key);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes);
    }
  }
}
copy(path.join(repo, 'out'));
const manifest = JSON.stringify({ format: 'tjt-schedule-ui-1.6.2', previous: Object.fromEntries(Object.entries(old.files).filter(([f]) => f.startsWith('schedule/out/'))), files }, null, 2) + '\n';
fs.writeFileSync(path.join(update, 'ulkoasu.json'), manifest);
const updater = fs.readFileSync(path.join(here, 'Paivita-Ulkoasu.cjs'));
fs.writeFileSync(path.join(update, 'Paivita-Ulkoasu.cjs'), updater);
const ps = fs.readFileSync(path.join(here, '04-Paivita-Ulkoasu.ps1.template'), 'utf8').replace('__UPDATER_SHA__', sha(updater)).replace('__MANIFEST_SHA__', sha(manifest));
fs.writeFileSync(path.join(destination, '04-Paivita-Ulkoasu.ps1'), '\uFEFF' + ps.replace(/\r?\n/g, '\r\n'));
const instructions = `AIKATAULUN ULKOASUPÄIVITYS 1.6.2 – 5.11.2026

Jos Aikataulu 1.6 on jo asennettu portaaliin, aja tästä paketista vain
04-Paivita-Ulkoasu.ps1 TJT-PALVELIMEN järjestelmänvalvojan PowerShellissä.
Ensiasennuksessa tee alkuperäiset vaiheet 01 ja 02 ja sen jälkeen vaihe 04.

Esimerkiksi, kun tämä paketti on purettu kansioon
C:\\TJT\\Asennus\\Snedo-Aikataulu-1.6:

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\\TJT\\Asennus\\Snedo-Aikataulu-1.6\\04-Paivita-Ulkoasu.ps1"

Muutos säilyttää keltaisen S-tunnuksen, poistaa sen vierestä SNEDO-tekstin
ja tunnuslauseen sekä poistaa vanhan Ohjelmistot-ryhmän. Aikataulun omat
toiminnot ja TJT-pääsivulle-painike säilyvät. Yläotsikko on Aikataulu.

Päivitys tarkistaa asennetut ohjelmatiedostot ja säilyttää aiemman selainosan
paikallisessa varmuuskopiokansiossa. Vanhoja sisältötunnisteellisia tiedostoja
säilytetään avoimia välilehtiä varten. Palveluita ei käynnistetä uudelleen.
Projektitietokantoihin, käyttäjiin, oikeuksiin tai asetuksiin ei kirjoiteta.

Kun näkyy ULKOASU PAIVITETTY: tallenna avoin aikataulu ja päivitä Ctrl+F5.
Jos komento ilmoittaa virheestä, lähetä ilmoitus käyttöönottokeskusteluun.

--- Alkuperäinen käyttöönottomenettely ---

`;
const readme = path.join(destination, 'LUE-ENSIN.txt');
fs.writeFileSync(readme, instructions + fs.readFileSync(readme, 'utf8'));
console.log(JSON.stringify({ destination, files: Object.keys(files).length, updaterSha256: sha(updater) }));
