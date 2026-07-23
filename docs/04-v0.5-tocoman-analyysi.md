# v0.5 – Tocoman-tuonnin analyysivaihe

## Tavoite

Vanhojen `.plr`-projektien säilyttäminen käytettävissä myös Tocoman-lisenssin päätyttyä.

## Turvallisuusperiaate

Tuontityökalu ei kirjoita `.plr`-tiedostoon eikä muuta alkuperäistä tiedostoa. Selain lukee tiedoston vain analyysia varten.

## Tunnistetut lähtökohdat

Aiemman tiedostoanalyysin perusteella `.plr` on Microsoft Compound Document / OLE -säiliö. Projektitiedostoissa on esiintynyt muun muassa nimiä:

- `Contents`
- `ContentsRev153`
- `ContentsRev200`
- `ContentsRev256`
- `ContentsRev275`
- `ContentsRev300`
- `ContentsRev350`
- `Pluto project management ver. ...`

## Seuraava tutkimusvaihe

Testitiedostoja 1–7 verrataan tavutasolla. Kukin tiedosto muuttaa vain yhtä ominaisuutta, jolloin voidaan paikantaa:

1. tehtävän nimi
2. aloituspäivä
3. kesto
4. hierarkiataso
5. janan väri
6. tavoite- ja toteumatieto

Kun nämä on tunnistettu, rakennetaan ensimmäinen varsinainen `.plr` → Aikataulu-projekti -muunnin.
