# Aikatauluohjelmisto v0.6

Rakennusalan jana-aikatauluohjelmiston kehitysversio.

## Uutta v0.6-versiossa

- useiden Tocoman `.plr` -tiedostojen yhtäaikainen vertailu
- SHA-256-tarkistussumma jokaiselle tiedostolle
- tiedostokokojen ja OLE-tunnistuksen vertailu
- muuttuneiden tavujen lukumäärä
- suurimpien muuttuneiden tavuvälien paikantaminen heksadesimaaliosoitteilla
- lisättyjen ja poistuneiden ASCII-/UTF-16-tekstijonojen vertailu
- vertailu toimii paikallisesti selaimessa eikä muuta alkuperäisiä tiedostoja

## Todellisesta testiaineistosta havaittu

Tiedostojen `1.plr–7.plr` koot jakautuvat kolmeen ryhmään:

- 1–3: 86 528 tavua
- 4–6: 80 896 tavua
- 7: 81 920 tavua

Tämä viittaa siihen, että tiedostoissa on sekä kenttäkohtaisia muutoksia että kokonaisia rakenteellisia muutoksia. v0.6 auttaa erottamaan nämä toisistaan ennen varsinaisen tuontiparserin tekemistä.

## Seuraava vaihe

Vertailutulosten perusteella rakennetaan kenttäkartta:

1. tehtävän nimi
2. aloituspäivä
3. kesto
4. hierarkiataso
5. janan väri ja tyyli
6. tavoite- ja toteumatieto

Kun kenttäkartta on riittävän luotettava, ensimmäinen `.plr`-tehtävien tuonti lisätään esikatselutilassa.
