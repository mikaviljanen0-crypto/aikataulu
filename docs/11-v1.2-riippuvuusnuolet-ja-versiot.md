# v1.2 – riippuvuusnuolet ja aikatauluversiot

## Riippuvuusnuolet

Gantt-janalle piirretään SVG-kerros, joka käyttää samaa tehtäväjärjestystä kuin näkyvä taulukko. Nuoli muodostetaan suorakulmaisena reittinä:

1. edeltävän tehtävän loppu
2. vaakasuora siirtymä oikealle
3. pystysuora siirtymä seuraavan tehtävän riville
4. nuolenkärki seuraavan tehtävän alussa

## Aikatauluversiot

Versio on pysyvä kopio suunnittelutilanteesta. Se eroaa toteuman seurantatilanteesta, koska versioon kuuluu koko tehtävärakenne.

Tyypillinen käyttö:

1. yleisaikataulu laaditaan
2. versio tallennetaan nimellä `Urakkasopimuksen aikataulu`
3. työmaa etenee ja suunnitelmaa muutetaan
4. uusi versio tallennetaan työmaakokouksen jälkeen
5. vanhoihin versioihin voidaan palata ilman erillisiä tiedostoja
