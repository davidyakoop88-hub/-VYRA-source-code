# VYRA – projektöverlämning

## Projektet

VYRA är en lokal webbapp för TikTok Live/OBS med en overlay-studio, widgets, Action & Event, scener och transparent overlay-output. Projektet är byggt i vanlig HTML, CSS och JavaScript utan ett obligatoriskt byggsteg.

## Viktigaste sidorna

- `index.html` – publik startsida.
- `studio.html` – huvudappen och redigeraren.
- `overlay.html` – transparent output för OBS/TikTok Studio.

## Viktigaste kodfilerna

- `studio.js`, `studio.css` – studio, canvas, widgets och redigering.
- `media.js`, `extras.js` – widgetbibliotek och extra beteenden.
- `action-event.js`, `action-event-advanced.js`, `action-options.js` – Action & Event-gränssnittet.
- `action-runtime.js`, `action-scenes.js`, `action-media.js` – körning, upp till tio scener och media.
- `gift-fireworks.js`, `gift-fireworks.css` – Gift Fireworks.
- `profile-frames-premium.js`, `profile-frames-premium.css` – profilramar.
- `overview-premium.js`, `overview-premium.css` – översiktens premiumutseende.
- `live-client.js`, `studio-live.js` – live-/eventanslutning.
- `assets/` – bilder, teman, presenter och andra resurser.

## Starta lokalt

På Windows kan `STARTA-HEMSIDAN.cmd` användas. Alternativt kan en lokal statisk server startas i projektmappen och `studio.html` öppnas. Projektet har senast använts på `http://127.0.0.1:4173/studio.html`.

Öppna inte bara `studio.html` via `file://` när funktioner behöver lokal lagring, media eller overlay-kommunikation.

## Viktigt för fortsatt arbete

- Bevara befintliga funktioner och ändra en widget i taget.
- Studio och overlay delar tillstånd via webbläsarens lokala lagring och meddelanden mellan flikar.
- En dold widget ska finnas kvar i lagret men inte renderas i overlay-output.
- Action skapas först; Event väljer sedan vilken Action som ska triggas och i vilken scen.
- Varje scen har en separat overlay-länk och online/offline-status.
- Overlay-output ska ha transparent bakgrund. Studio-gränssnittet ska inte synas i OBS-länken.
- Lägg aldrig `.env`, API-nycklar eller hemligheter i frontendfiler.

## Filer som inte ligger i kodarkivet

Avsiktligt utelämnade: `.env`, Git-historik, lokala verktyg/cachar, stora råvideor samt genererade rendersekvenser. De behövs inte för att läsa eller fortsätta utveckla koden. Kopiera dem separat om originalmedierna också ska flyttas.

## Bra första uppgift i Claude

Läs först `CLAUDE-HANDOFF.md`, `studio.html`, `studio.js`, `studio.css`, `media.js` och Action & Event-filerna. Kartlägg därefter beroendena innan du ändrar något. Gör små ändringar, kontrollera både Studio och `overlay.html`, och undvik stora omskrivningar av fungerande delar.
