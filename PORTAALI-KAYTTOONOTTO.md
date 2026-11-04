# Snedo Aikataulu 1.6 – TJT-portaalin käyttöönotto

Tämä on version 1.5 päälle tehty erillinen moniyritys- ja yhteistallennusversio. **Älä korvaa tuotannossa toimivaa 1.5-versiota ennen kuin tämän version portaalikirjautuminen, tietojen siirto ja varmuuskopiointi on testattu.**

## Mitä uudessa versiossa on

- Yritykset `tjt`, `tjt-katto` ja `previmek` käyttävät erillisiä projektitietokantoja.
- Samasta yrityksestä kaikki voivat katsella ja tulostaa kaikkia aikatauluja. Oikeus `read` ei salli muokkaamista, `edit` sallii muokkauksen ja `admin` myös muokkausvarauksen ohittamisen hallintarajapinnassa.
- Projektihakemisto näyttää yrityksen vanhat aikataulut, viimeisen muokkaajan ja mahdollisen muokkausvarauksen.
- Projektit tallentuvat automaattisesti yhteiselle palvelimelle. Revisionumero estää vanhan version hiljaisen ylikirjoituksen.
- Projektin samanaikainen muokkaus estetään kahden minuutin uusittavalla varauksella. Useampi saa lukea samaa projektia.
- Nykyinen Gantt, PDF-tulostus ja JSON-vienti säilyvät. Selainkohtainen tallennus on edelleen käytössä vain vanhassa 1.5-tilassa.

## Tuotantopaketin valmistaminen

Windowsissa projektin juuressa (Node.js ja npm asennettu):

```powershell
npm ci
$env:SNEDO_STATIC_EXPORT = "1"
$env:SNEDO_PORTAL_MODE = "1"
$env:NEXT_PUBLIC_SNEDO_PORTAL_MODE = "1"
npm run build
```

Tarvitaan `out`-kansio, `server`-kansio ja Node.js. Ehdotetut polut palvelimella:

- Ohjelma: `C:\TJT\Ohjelmat\Snedo-Aikataulu-v1.6\`
- Projektidata: `C:\TJT\Data\Snedo-Aikataulu\`
- Yritystiedostot: `tjt\projects.json`, `tjt-katto\projects.json`, `previmek\projects.json` (kukin datakansion alla)

Tällä versiolla on oma erillinen Node-palvelu, jonka ehdotettu portti on 4183. Varmista vapaa portti ennen käynnistystä. **Palvelu kuuntelee oletuksena vain osoitteessa 127.0.0.1**, eikä sitä saa avata julkisesti ilman portaalin oikeustarkistusta.

```powershell
$env:SNEDO_AIKATAULU_HOST = "127.0.0.1"
$env:SNEDO_AIKATAULU_PORT = "4183"
$env:SNEDO_AIKATAULU_DATA_DIR = "C:\TJT\Data\Snedo-Aikataulu"
$env:SNEDO_AIKATAULU_OUT_DIR = "C:\TJT\Ohjelmat\Snedo-Aikataulu-v1.6\out"
$env:TJT_PORTAL_SCHEDULE_SECRET = "ASETA_TAHAN_VAHINTAAN_32_MERKIN_SALAINEN_ARVO"
node "C:\TJT\Ohjelmat\Snedo-Aikataulu-v1.6\server\server.mjs"
```

Salainen avain luodaan ja säilytetään turvallisesti palvelimella. **Älä sisällytä sitä GitHubiin tai kirjalliseen käyttäjäohjeeseen.** Tallenna ajopalvelun asetukset niin, että palvelu käynnistyy koneen käynnistyessä kuten muut TJT:n taustapalvelut.

## Pakollinen integraatio TJT-Portaali-v1:een

Portaalin lähdekoodia ei ole tässä GitHub-repositoriossa. Siksi käyttöönotossa on tehtävä seuraava liitos toimivaan portaaliin:

1. Portaalin `Aikataulu`-kortti avaa **saman portaalin kautta** osoitteen `/aikataulu` (ei suoraa pääsyä porttiin 4183).
2. Portaali välittää kaikki `/aikataulu/*`-pyynnöt sisäisesti palveluun `127.0.0.1:4183`, polku säilyttäen. Myös `/_next`-staattiset tiedostot sijaitsevat `/aikataulu/_next/*`-polussa.
3. Portaali tarkistaa jokaisella pyynnöllä kirjautuneen käyttäjän, valitun yrityksen sekä tämän yrityksen Aikataulu-katselu-/muokkausoikeuden. **Älä luota selaimesta lähetettyyn yritystunnukseen tai oikeusrooliin.**
4. Portaali **poistaa selaimen mahdollisesti lähettämät** `x-tjt-schedule-context` ja `x-tjt-schedule-signature` -otsakkeet, muodostaa itse uuden lyhytikäisen allekirjoitetun kontekstin ja lisää sen sisäiseen pyyntöön.
5. Konteksti on UTF-8-JSON base64url-muodossa otsakkeessa `x-tjt-schedule-context`. JSON-kentät:

```json
{
  "userId": "portal-user-id",
  "userName": "Mika Viljanen",
  "companyId": "tjt",
  "role": "admin",
  "expiresAt": 0
}
```

`expiresAt` on **Unix-aika millisekunteina**, enintään kaksi minuuttia tulevaisuuteen. Oikeat yritystunnukset ovat `tjt`, `tjt-katto` ja `previmek`; roolit `read`, `edit`, `admin`. Yritystunnus ja rooli määräytyvät portaalin palvelimella kirjautumisesta sekä käyttöoikeuksista.

6. Allekirjoitusotsake `x-tjt-schedule-signature` on `HMAC-SHA256(secret, base64urlContext)` pienaakkosisena heksamerkkijonona. Molemmilla palveluilla on sama vain palvelimen ympäristössä säilytettävä `TJT_PORTAL_SCHEDULE_SECRET`.
7. Jos sessio on vanhentunut, yritysoikeus puuttuu tai käyttäjä on uloskirjautunut, portaali palauttaa 401/403 **ennen** välitystä.
8. Testaa Heikin, Jessen ja Mikan tunnukset eri yrityksissä: jokainen näkee vain oikeutensa mukaisen yrityksen aikataulut ja muokkauksen tilan.

**Huom.** Portaalin tuotantokoodin ja olemassa olevan kirjautumis-/yritysvaihtologiikan tarkistus on pakollinen ennen kuin integraation voi merkitä valmiiksi. Tämä repo ei yksin muuta TJT-portaalin korttia tai tunnuksia.

## Vanhojen aikataulujen siirtäminen

Versio 1.5 tallensi aikataulut selaimen localStorageen. Niitä **ei saa automaattisesti kopioida** usean yrityksen yhteiskantaan, sillä oikea omistava yritys pitää valita.

1. Avaa vanha 1.5 samalla selaimella, jolla aikataulut on tehty.
2. Vie jokaisesta halutusta projektista JSON-varmuuskopio.
3. Kirjaudu uuteen portaaliin ja valitse oikea yritys.
4. Luo uusi aikataulu. Avaa uuden aikataulun **Avaa JSON** ja valitse tiedosto.
5. Varmista, että ohjelma näyttää **Tallennettu palvelimelle** ja projekti tulee saman yrityksen hakemistoon myös toisella koneella.
6. Säilytä JSON-varmuuskopiot toistaiseksi.

## Varmuuskopiot ja käyttöönoton hyväksyntä

- Ota `C:\TJT\Data\Snedo-Aikataulu` mukaan nykyiseen portaalin varmuuskopiointiin ja säilytä lisäksi koneesta erillinen kopio.
- Tarkista, että selaimen sulkeminen/avaaminen, eri käyttäjät, samaan projektiin kohdistuva muokkauslukko, verkkokatkos ja tietokannan palautus toimivat.
- Käynnistä tuotantokäyttö vasta, kun portaali tunnistaa käyttäjät ja yritykset oikein eikä suoraa palvelinporttia voi käyttää ohittamaan käyttöoikeuksia.


## TJT-Portaali-v1-liitos 4.11.2026

Erillinen integraatiopaketti säilyttää portaalin nykyisen HTTPS-kirjautumisen.
Aikataulu avataan `/aikataulu?company=<portaalin yritystunnus>`.
Selain lähettää portaalin CSRF-tunnisteen ja välilehtikohtaisen tunnisteen.
Portaali tarkistaa oikeuden jokaisella pyynnöllä ja muuntaa `tjt_katto`-tunnuksen
Aikataulun `tjt-katto`-tunnukseksi. Selaimen yritysvalinta ei itsessään anna oikeutta.
Kaikilla portaalissa yritykseen kuuluvilla käyttäjillä on aikataulujen lukuoikeus;
muokkaus vaatii kyseisen yrityksen Aikataulu-ohjelman `edit`-oikeuden.

Allekirjoitettu konteksti voi sisältää `lockId`-arvon, joka sitoo varauksen
portaalin istuntoon ja välilehteen. Se ei ole käyttäjän henkilötunnus.
Tuotannon ajopalvelu asettaa `SNEDO_STRICT_STORAGE=1`: kadonnutta tietokantaa
ei korvata tyhjällä. Tietokannat alustetaan erikseen asennuksessa.

Integraatiopaketti sijoittaa aikataulut portaalin aktiivisen datakansion
`aikataulu-v1.6`-alihakemistoon. Näin nykyinen paikallinen ja Drive-varmistus
sisältää kaikki kolme yritystä sekä käyttäjärekisterin. Palautus tehdään vain
uuteen kansioon. Aikataulu 1.5:n localStorageen tai palveluun ei kosketa.

Asennus alkaa vain lukevalla `01-Tarkista.ps1`-tarkistuksella.
`02-Asenna-Rinnalle.ps1` tuo 1.6:n koekäyttöön vasta varmuuskopion ja
Drive-palautuksen tarkistuksen jälkeen. Se käynnistää portaalin uudelleen,
joten käyttäjät kirjautuvat uudelleen. Vanhan 1.5:n poistamiseen tai
korvaamiseen ei sisälly komentoa. Oikeiden projektien JSON-tuonti ja
käyttäjien selainkokeet tehdään ennen tuotantokäytön hyväksyntää.
