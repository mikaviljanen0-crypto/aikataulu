# Aikatauluohjelmisto v1.1

Rakennusalan yleis- ja viikkoaikataulun kehitysversio.

## Uutta v1.1-versiossa

### Yksinkertaiset riippuvuudet

- työvaiheelle voidaan valita edeltävä työvaihe
- riippuvuustyyppi on ensimmäisessä vaiheessa loppu–alku
- työvaiheelle voidaan antaa positiivinen tai negatiivinen viive työpäivinä
- `Laske riippuvuudet` ajoittaa tehtävät edeltävien tehtävien perusteella
- ohjelma tunnistaa riippuvuuskehän eikä jää laskemaan loputtomasti

Riippuvuuksia ei lasketa automaattisesti jokaisella muutoksella. Työnjohtaja voi muokata aikataulua vapaasti ja suorittaa laskennan halutessaan.

### Viikkoaikataulun jatkokäyttö

- koko viikkoaikataulu voidaan kopioida seuraavalle viikolle
- vain keskeneräiset tehtävät voidaan siirtää seuraavalle viikolle
- siirretyt tehtävät merkitään huomautuksella
- viikkoaikataulun tilat voidaan päivittää yleisaikataulun toteumaan
- yleisaikatauluun yhdistetty viikkotehtävä merkitään näkyvästi

## Toteuman päivitys viikkoaikataulusta

Kun kaikki samaan yleisaikataulutehtävään liittyvät viikkotehtävät ovat valmiita, yleisaikataulun valmiusasteeksi asetetaan 100 %.

Jos vähintään yksi viikkotehtävä on käynnissä tai valmis, yleisaikataulun valmiusastetta nostetaan vähintään 25 prosenttiin. Tätä voidaan myöhemmin tarkentaa määrien ja toteutuneiden tuntien perusteella.

## Seuraavat pääkohteet

1. kirjautuminen ja projektien palvelintallennus
2. käyttäjäroolit
3. seurantatulosteiden pysyvä versioarkisto
4. Tocoman-tuonnin ensimmäinen tehtäväesikatselu
5. riippuvuuksien näyttäminen nuolina Gantt-janalla
