# Aikatauluohjelmisto v1.0

Ensimmäinen kokonainen käyttölogiikan versio rakennusalan jana- ja viikkoaikataulusta.

## Uutta v1.0-versiossa

- erillinen Yleisaikataulu- ja Viikkoaikataulu-näkymä
- viikkoaikataulun luominen valitun viikon yleisaikataulutehtävistä
- työtehtävien tarkentaminen viikkotasolle
- viikon päivä, rakennus/alue, vastuuhenkilö ja tavoite
- tehtävän tila:
  - Suunniteltu
  - Käynnissä
  - Valmis
  - Estynyt
- vapaat huomautukset
- uusien viikkotehtävien lisääminen käsin
- viikkotehtävien poistaminen
- edellisen ja seuraavan viikon selaaminen
- A4-vaakatulostukseen sopiva viikkoaikataulutaulukko
- valmiiden ja estyneiden tehtävien yhteenveto

## Viikkoaikataulun periaate

Yleisaikataulu pysyy työmaan pääaikatauluna. Viikkoaikataulu on siitä erillinen, tarkempi suunnitelma.

Kun viikkoaikataulu luodaan, ohjelma kopioi lähtöriveiksi työvaiheet, jotka osuvat valitulle viikolle. Tämän jälkeen työnjohtaja voi:

- jakaa työn pienempiin tehtäviin
- lisätä viikon konkreettisen tavoitteen
- nimetä vastuuhenkilön
- merkitä esteet
- lisätä tehtäviä, joita yleisaikataulussa ei ole

Muutokset viikkoaikataulussa eivät muuta yleisaikataulun rakennetta.

## Seuraavat pääkohteet

1. projektien palvelintallennus ja kirjautuminen
2. viikkoaikataulun kopiointi seuraavalle viikolle
3. keskeneräisten viikkotehtävien automaattinen siirto
4. seurantatulosteiden versioarkisto
5. Tocoman-tuonnin ensimmäinen esikatselu
