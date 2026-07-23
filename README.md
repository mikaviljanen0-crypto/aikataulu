# Aikatauluohjelmisto v0.2

Ensimmäinen Next.js + TypeScript -pohjainen sovellusrunko rakennusalan jana-aikataululle.

## Tässä versiossa

- tyhjästä muokattava tehtävätaulukko ja WBS-hierarkia
- tehtävien lisääminen, poistaminen, sisennys, ulonnus ja rivijärjestys
- Gantt-janojen siirtäminen ja keston muuttaminen hiirellä
- tavoiteaikataulun tallentaminen
- toteumaseuranta: valmiusaste, toteutunut alku/loppu, ennuste ja huomautus
- kuukausittaisten seurantatilanteiden tallennus
- A4- ja A3-vaakatulostus
- projektin automaattinen paikallistallennus
- JSON-varmuuskopiointi ja palautus

## Käynnistys

Node.js 20 tai uudempi:

```bash
npm install
npm run dev
```

Avaa selaimessa `http://localhost:3000`.

## Seuraavat työvaiheet

1. Oikea tietokanta ja käyttäjähallinta
2. Projektien luettelo ja projektin avaaminen
3. suomalaiset pyhäpäivät ja projektikohtaiset kalenterit
4. summatehtävien automaattinen laskenta alatehtävistä
5. seuranta-aikataulujen versiohistoria ja vertailu
6. Tocoman `.plr` -tuontitutkimus
7. Excel-tuonti ja -vienti
8. tulostuksen tarkka Tocoman-tyylinen esikatselu
