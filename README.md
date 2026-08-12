# Boekoe

Boekoe is een mobile-first Surinaamse community-app. Hij werkt direct als interactieve demo en kan met een gratis Supabase-project als echte multi-user PWA draaien.

## Online versie

De productieversie staat op [https://boekoe.github.io/](https://boekoe.github.io/). De frontend draait gratis op GitHub Pages; accounts, database, foto's en live updates draaien op de gratis Supabase-laag.

## Wat werkt

- Registratie en login via e-mail
- Profielen, feed, tekst- en fotoberichten
- Likes, reacties, volgen en live feed-updates
- Zoeken, meldingen, rapporteren en blokkeren
- Adminmoderatie
- Donkere modus en responsive mobiele navigatie
- Installeerbaar als PWA op iPhone, Android en desktop
- Volledige demo zonder backend, opgeslagen in de browser

## Lokaal starten

Vereist Node.js 20 of nieuwer.

```bash
npm install
npm run dev
```

Open daarna de URL die Vite toont. Zonder `.env` draait Boekoe automatisch in demomodus.

## Echte accounts en gedeelde data activeren

1. Maak gratis een project op [Supabase](https://supabase.com/).
2. Open **SQL Editor**, plak de volledige inhoud van `supabase/schema.sql` en kies **Run**.
3. Ga naar **Project Settings > API** en kopieer de Project URL en public/anon key.
4. Kopieer `.env.example` naar `.env` en vul beide waarden in:

```env
VITE_SUPABASE_URL=https://PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

5. Start de app opnieuw. De gele `Demo`-badge verandert in een groene `Live`-badge en het loginscherm verschijnt.
6. Voor snelle tests kun je in Supabase onder **Authentication > Providers > Email** de verplichte e-mailbevestiging uitzetten. Zet die vóór openbare lancering weer aan.
7. Maak na registratie een beheerder met de laatste, uitgecommentarieerde SQL-regel in `schema.sql`.

De anon key mag in frontendcode staan; de meegestuurde Row Level Security-policies beschermen alle persoonsgegevens en schrijfacties. Deel nooit de `service_role` key.

## Gratis deployen op Cloudflare Pages

1. Zet deze map in een GitHub-repository.
2. Ga naar Cloudflare Dashboard > **Workers & Pages > Create > Pages > Connect to Git**.
3. Stel in:
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Output directory: `dist`
   - Node.js version: `20`
4. Voeg onder **Environment variables** de twee `VITE_SUPABASE_...` waarden toe.
5. Deploy. Cloudflare geeft een gratis `*.pages.dev`-adres en HTTPS.

Een eigen `.com`- of `.sr`-domein is optioneel en kost doorgaans geld. De hosting en Supabase-backend blijven gratis binnen hun free-tierlimieten.

## Installeren als app

- **Android / Chrome:** open het menu en kies *App installeren* of *Toevoegen aan startscherm*.
- **iPhone / Safari:** tik op *Deel* en dan *Zet op beginscherm*.
- **Desktop / Chrome/Edge:** gebruik het installatie-icoon rechts in de adresbalk.

Een native App Store/Play Store-pakket kan later met Capacitor worden gemaakt. De webapp blijft de gratis route; Apple en Google rekenen registratiekosten voor storepublicatie.

## Productiechecklist

- Schrijf definitieve communityregels, privacyverklaring en voorwaarden.
- Configureer een eigen e-mailtemplate in Supabase Auth.
- Stel minimaal twee moderators aan en test de rapportageflow.
- Maak periodiek een export/back-up; de gratis Supabase-laag biedt geen volwaardige point-in-time back-up.
- Optimaliseer/gecomprimeer foto’s vóór een grote publieke lancering.
- Test met VoiceOver/TalkBack en op tragere mobiele verbindingen.

## Techniek

React 19, TypeScript, Vite, Supabase (Postgres/Auth/Storage/Realtime), handgeschreven PWA-serviceworker en Lucide-iconen.
