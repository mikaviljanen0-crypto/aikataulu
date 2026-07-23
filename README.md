# Aikatauluohjelmisto v0.5

Rakennusalan jana-aikatauluohjelmiston kehitysversio.

## Uutta v0.5-versiossa

- Tocoman `.plr` -tiedostojen selaimessa toimiva, turvallinen analyysityökalu
- OLE / Microsoft Compound Document -tiedostomuodon tunnistus
- Tocomanin versio- ja tietovirtanimien poiminta
- tiedoston sisältämien luettavien tekstinäytteiden tarkastelu
- toteutuma näytetään omana vihreänä jananaan
- tavoite, suunnitelma/jäljellä, toteutuma ja seurantahetki näkyvät selkeässä legendassa
- janan siirto ja venytys palautettu Gantt-näkymään
- projektikalenteri huomioidaan myös hiirellä siirrossa

## Tocoman-tuonnin tila

v0.5 ei vielä tuo tehtäviä automaattisesti. Se tekee ensimmäisen teknisen analyysin `.plr`-tiedostosta ja näyttää:

- tunnistetaanko tiedosto OLE-säiliöksi
- mitä Tocoman-/Pluto-versioviitteitä löytyy
- mitä luettavia tietovirtojen nimiä ja tekstinäytteitä tiedostossa on

Seuraava vaihe on vertailla testitiedostoja 1–7 ja paikantaa tehtävänimen, aloituspäivän, keston, hierarkian ja värin binäärirakenteet.

## Käynnistys kehityskoneella

```bash
npm install
npm run dev
```
