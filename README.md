# 🐕 Tokyo – Diario di salute

Web app (PWA) per tenere sotto controllo la salute di Tokyo, Shiba Inu:
visite, malattie, farmaci e integratori, alimentazione, peso e un calendario riassuntivo.

## Funzioni

- **Dashboard**: contatore "giorni senza…" per i disturbi scelti nella scheda (😊 oltre 50 giorni, 😐 21–50, 😟 0–20, "in corso" se l'episodio è aperto); riquadro **In evidenza** con scadenze dei prossimi 30 giorni, farmaci e integratori in corso e ultimo peso; ricerca in fondo.
- **Visite**: tipo, data, veterinario, note, allegati, promemoria del richiamo (es. vaccini). Le visite "Malattia" creano o aggiornano un episodio; le altre (es. ecografia) possono collegarsi a un episodio esistente. In ogni visita si possono registrare i farmaci prescritti.
- **Malattie**: disturbo, descrizione, inizio/fine, gravità, note, allegati, farmaci somministrati e visite collegate.
- **Farmaci e integratori**: tipo (farmaco/integratore/antiparassitario), dosaggio, frequenza, periodo, avviso per il ciclo successivo, collegamento alla visita o all'episodio.
- **Alimentazione**: crocchette/umido/snack con periodo d'uso.
- **Peso**: storico e grafico dell'andamento.
- **Calendario** stile Garmin Connect con barre colorate per tipo di evento e aggiunta rapida.
- **Schede di sola lettura** per le voci salvate, con ✏️ per modificarle.
- **Ricerca** in tutte le sezioni, senza distinzione di maiuscole e accenti.
- **Riepilogo sanitario in PDF** e **backup** esportabile/ripristinabile.

I dati sono sincronizzati con **Firebase Firestore** (con copia locale per l'uso offline), gli allegati vanno nella cartella "Tokyo" di **Google Drive** e visite e promemoria compaiono nel calendario Google **"Tokyo"**.

## Pubblicazione

L'app è un Worker Cloudflare (`wrangler.jsonc`) che serve i file di `dist/`:
https://tokyo.andrea-marchionni11.workers.dev

Ogni push su `main` viene pubblicato in automatico da **Cloudflare Workers Builds**
(build: `npm run build`, deploy: `npx wrangler deploy`). Se una build non parte
(raramente l'avviso da GitHub non arriva a Cloudflare), basta un nuovo push su `main`.

## Sviluppo

```bash
npm install
npm run dev      # server di sviluppo
npm run build    # build di produzione in dist/
```

Stack: React + TypeScript + Vite, Tailwind CSS, Dexie (IndexedDB), Firebase (Auth + Firestore), API Google Drive e Calendar, vite-plugin-pwa.
