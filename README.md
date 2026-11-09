# 🐕 Tokyo – Diario di salute

Web app (PWA) per tenere sotto controllo la salute di Tokyo, Shiba Inu:
visite, malattie, farmaci e integratori, alimentazione, peso e un calendario riassuntivo.

## Funzioni

- **Dashboard**: contatore "giorni senza…" per ogni disturbo (😊 oltre 50 giorni, 😐 21–50, 😟 0–20, "in corso" se l'episodio non è chiuso), promemoria dei cicli, riepilogo del giorno.
- **Visite**: tipo, data (anche futura), veterinario, note, allegati.
- **Malattie**: disturbo, descrizione, inizio/fine, gravità, note, allegati e foto.
- **Farmaci e integratori**: tipo (farmaco/integratore/antiparassitario), dosaggio, frequenza, periodo, avviso per il ciclo successivo (es. 2 mesi dopo la fine).
- **Alimentazione**: crocchette/umido/snack con periodo d'uso.
- **Peso**: storico e grafico dell'andamento.
- **Calendario** stile Garmin Connect con barre colorate per tipo di evento.
- **Backup** esportabile/ripristinabile (allegati inclusi).

I dati sono sincronizzati con **Firebase Firestore** (con copia locale per l'uso offline), gli allegati vanno nella cartella "Tokyo" di **Google Drive** e visite e promemoria compaiono nel calendario Google **"Tokyo"**.

## Pubblicazione

L'app è un Worker Cloudflare (`wrangler.jsonc`) che serve i file di `dist/`:
https://tokyo.andrea-marchionni11.workers.dev

Ogni push su `main` viene pubblicato in automatico da **Cloudflare Workers Builds**
(build: `npm run build`, deploy: `npx wrangler deploy`).

## Sviluppo

```bash
npm install
npm run dev      # server di sviluppo
npm run build    # build di produzione in dist/
```

Stack: React + TypeScript + Vite, Tailwind CSS, Dexie (IndexedDB), Firebase (Auth + Firestore), API Google Drive e Calendar, vite-plugin-pwa.
