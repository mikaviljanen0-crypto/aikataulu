# v1.1 – riippuvuudet ja viikkoaikataulun siirto

## Loppu–alku-riippuvuus

Ensimmäisen version riippuvuustyyppi on loppu–alku. Seuraava tehtävä alkaa edeltävän tehtävän päättymistä seuraavana työpäivänä.

Viiveellä voidaan muuttaa tätä:

- `0`: seuraava työpäivä
- `2`: kaksi lisätyöpäivää odotusta
- `-1`: tehtävät voivat limittyä yhden työpäivän

## Laskennan tarkoituksellinen käynnistys

Riippuvuuksia ei pakoteta jatkuvasti. Tämä vastaa paremmin käyttäjien melko vapaata aikataulutapaa. Käyttäjä suorittaa laskennan painikkeesta silloin, kun riippuvuudet halutaan päivittää.

## Viikon tehtävien siirtäminen

Keskeneräiset tehtävät ovat kaikki muut paitsi `Valmis`. Kun ne siirretään seuraavalle viikolle:

- päivä asetetaan seuraavan viikon maanantaiksi
- tila palautetaan suunnitelluksi
- estynyt tila voidaan säilyttää
- huomautukseen lisätään tieto siirrosta
