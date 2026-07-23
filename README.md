# Aikatauluohjelmisto v1.2

Rakennusalan yleis- ja viikkoaikataulun kehitysversio.

## Uutta v1.2-versiossa

### Riippuvuusnuolet

- loppu–alku-riippuvuudet näkyvät nyt nuolina Gantt-janalla
- nuoli lähtee edeltävän tehtävän lopusta
- nuoli päättyy seuraavan tehtävän alkuun
- nuolia ei näytetä suodatettujen tai suljettujen rivien välillä
- nuolet näkyvät myös tulosteessa

### Nimetyt aikatauluversiot

Nykyinen aikataulu voidaan tallentaa nimettynä versiona, esimerkiksi:

- Alkuperäinen yleisaikataulu
- Tilaajan hyväksymä aikataulu
- Työmaakokous 3
- Lisäajan jälkeen päivitetty aikataulu

Versiolle voidaan antaa kuvaus. Vanha versio voidaan palauttaa myöhemmin tai poistaa.

Aikatauluversio tallentaa:

- tehtävärivit
- päivämäärät
- kestot
- hierarkian
- riippuvuudet
- värit ja vastuut
- tavoiteaikataulun

## Ero seurantahistoriaan

- **Seurantahistoria** tallentaa toteuman tiettynä seurantahetkenä.
- **Aikatauluversio** tallentaa koko suunnitellun aikataulun rakenteen ja ajoituksen.

## Seuraavat pääkohteet

1. projektien palvelintallennus
2. kirjautuminen ja käyttäjäroolit
3. versioiden vertailunäkymä
4. Tocoman-tuonnin tehtäväesikatselu
5. PDF-tulostuksen tarkempi sivukohtainen esikatselu
