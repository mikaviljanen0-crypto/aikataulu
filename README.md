# Aikatauluohjelmisto v1.3

Rakennusalan yleis- ja viikkoaikataulun kehitysversio.

## Uutta v1.3-versiossa

### Aikatauluversioiden vertailu

Kaksi tallennettua aikatauluversiota voidaan verrata keskenään. Vertailu tunnistaa:

- lisätyt tehtävät
- poistetut tehtävät
- nimen muutokset
- aloituspäivän muutokset
- keston muutokset
- hierarkiatason muutokset
- rakennuksen tai alueen muutokset
- vastuuhenkilön muutokset
- riippuvuuksien muutokset
- viiveiden muutokset
- värimuutokset

Vertailun tulokset ryhmitellään lisättyihin, poistettuihin ja muuttuneisiin tehtäviin.

### Poikkeama tavoitteesta

Kun tehtävän nykyinen aloitus tai kesto poikkeaa tallennetusta tavoitteesta:

- tavoitejana korostetaan
- tehtävärivi merkitään oranssilla reunalla

Näin työmaakokouksen seurantatulosteesta näkee nopeasti tehtävät, joiden suunnitelmaa on muutettu.

## Käyttöesimerkki

1. Tallenna versio `Urakkasopimuksen aikataulu`.
2. Muokkaa aikataulua työmaan edetessä.
3. Tallenna versio `Työmaakokous 4`.
4. Valitse molemmat versiot vertailuun.
5. Ohjelma näyttää tarkasti, mitkä työvaiheet ja päivämäärät muuttuivat.

## Seuraavat pääkohteet

1. projektien palvelintallennus
2. kirjautuminen ja käyttäjäroolit
3. Tocoman-tuonnin tehtäväesikatselu
4. tulostettava versiovertailuraportti
5. projektien arkistointi
