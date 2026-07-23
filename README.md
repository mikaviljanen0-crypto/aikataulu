# Aikatauluohjelmisto v0.3

Rakennusalan selainpohjaisen jana-aikataulun kehitysversio. Tavoitteena on korvata Tocoman Aikataulu teidän todellisessa peruskäytössänne.

## v0.3:n tärkeimmät lisäykset

- summatehtävien alku, loppu ja valmiusaste lasketaan alatehtävistä
- loppupäivä näkyy taulukossa
- välitavoitteet
- valitun tehtävän kopiointi
- alatehtävät poistetaan yhdessä summatehtävän kanssa
- kalenterin siirto viiden viikon jaksoissa
- seurantatilanteiden historia ja palautus
- kuukausittaiseen työmaakokousseurantaan sopiva toteumapaneeli
- A4- ja A3-vaakatulostus
- JSON-varmuuskopiointi

## Käynnistys myöhemmin kehityskoneella

```bash
npm install
npm run dev
```

Komennot kirjoitetaan Visual Studio Coden terminaaliin tai Windows Terminaliin projektikansiossa. Tätä ei tarvitse tehdä ennen kuin projekti viedään Verceliin tai sitä testataan paikallisesti.

## Seuraavat työvaiheet

1. oikea projektinäkymä ja useiden projektien hallinta
2. suomalainen projektikalenteri, pyhäpäivät ja erilliset lomajaksot
3. Tocoman `.plr` -tuonnin tutkimustyökalu
4. tulostuksen sivutus ja tulostusalueen esikatselu
5. tavoite- ja toteumajanojen tarkempi esitystapa
