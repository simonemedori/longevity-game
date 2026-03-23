# Longevity Game — Simulatore Finanziario IA

**Longevity Game** è un'applicazione web multiplayer per la formazione di consulenti finanziari. I partecipanti, divisi in squadre per fascia d'età, allocano portafogli di investimento e affrontano imprevisti macroeconomici generati in tempo reale da un Game Master basato su intelligenza artificiale.

---

## Funzionalità

### Per i partecipanti
- **Accesso tramite codice aula** — inserisci il codice proiettato dall'istruttore per unirti alla sessione
- **Allocazione portafoglio** — distribuisci il 100% del patrimonio tra i prodotti finanziari della tua fascia d'età, con metriche tecniche dettagliate
- **Vista spia** — puoi osservare in tempo reale le scelte delle altre squadre
- **Modalità spettatore** — se tutti i posti sono già occupati, entri automaticamente in modalità read-only con classifica e cronache in evidenza
- **Classifica globale** — visualizza il ranking in tempo reale tra tutte le aule attive, sia assoluta che per fascia d'età (accesso con il codice della propria aula)

### Per l'istruttore (admin)
- **Pannello di controllo** — crea e gestisce più aule contemporaneamente
- **Configurazione prodotti via JSON** — importa ed esporta configurazioni personalizzate dei portafogli
- **Game Master IA (Gemini 2.5 Flash)** — genera imprevisti macroeconomici, valuta i portafogli consegnati e assegna punteggi con feedback tecnici
- **Limite di 4 round** — il bottone AI mostra il contatore (es. `2/4`) e si blocca automaticamente al raggiungimento del limite, garantendo equità tra aule diverse
- **Hint a rotazione** — ogni round, una squadra a turno può suggerire uno scenario all'AI per mettere in difficoltà le altre
- **Eliminazione eventi AI** — rimuove un imprevisto dal log sottraendo automaticamente i punti assegnati
- **Gestione squadre** — espelli team, forza consegne, reimposta allocazioni
- **Cancellazione aula sicura** — richiede di digitare il codice esatto per confermare
- **Export dati** — esporta la classifica della singola aula o di tutte le aule in JSON
- **Simulatore mobile** — anteprima dell'interfaccia partecipante direttamente dal pannello admin

---

## Stack tecnologico

| Layer | Tecnologia |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS (CDN), palette brand Amundi |
| Database | Firebase Firestore (real-time sync) |
| Autenticazione | Firebase Auth (anonima + Google OAuth) |
| Intelligenza Artificiale | Google Gemini 2.5 Flash via Netlify/Vercel Function |
| Hosting primario | Netlify |
| Hosting secondario | Vercel (piano B) |

---

## Architettura di sicurezza

```
Browser → Netlify Function (/.netlify/functions/generate-event)
               ↓
          Google Gemini API
```

La chiave `GEMINI_API_KEY` non raggiunge mai il browser — vive esclusivamente nella funzione serverless lato server. Le credenziali Firebase sono pubbliche by design e protette dalle Firestore Security Rules (lettura/scrittura riservata agli utenti autenticati; creazione/eliminazione aule solo per admin registrati).

---

## Sviluppo locale

### Prerequisiti
- Node.js 18+
- Netlify CLI (`npm i -g netlify-cli`)

### Setup

```bash
# 1. Clona e installa
git clone https://github.com/simonemedori/longevity-game.git
cd longevity-game
npm install

# 2. Crea il file .env nella root del progetto
GEMINI_API_KEY=la_tua_chiave_google_ai_studio
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# 3. Avvia (frontend + funzione AI in locale)
netlify dev
```

> `netlify dev` è il comando corretto per lo sviluppo locale: avvia sia il frontend Vite sia la Netlify Function, replicando fedelmente l'ambiente di produzione.

---

## Deploy

### Netlify (primario)

1. Collega il repository GitHub a Netlify
2. Il build viene rilevato automaticamente da `netlify.toml` o dalle impostazioni di default
3. Aggiungi le variabili d'ambiente in **Site configuration → Environment variables**:

| Variabile | Descrizione |
|---|---|
| `GEMINI_API_KEY` | Chiave Google AI Studio (server-side) |
| `ALLOWED_ORIGINS` | Dominio del sito (es. `https://longevitygame.netlify.app`) |
| `VITE_FIREBASE_*` | Credenziali Firebase (6 variabili) |

### Vercel (piano B)

1. Importa il repository su [vercel.com](https://vercel.com)
2. Vercel rileva automaticamente la configurazione da `vercel.json`
3. Aggiungi le stesse variabili d'ambiente di Netlify, più:

| Variabile | Valore |
|---|---|
| `VITE_AI_FUNCTION_URL` | `/api/generate-event` |

> Il deploy su Vercel avviene automaticamente ad ogni push su `main` — senza consumo di crediti aggiuntivi (piano gratuito illimitato).

---

## Variabili d'ambiente — schema completo

```
# Server-side (mai esposte al browser)
GEMINI_API_KEY=
ALLOWED_ORIGINS=

# Client-side (prefisso VITE_ → incluse nel bundle)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Solo Vercel
VITE_AI_FUNCTION_URL=/api/generate-event
```

---

## Firestore Security Rules

Le regole di sicurezza sono nel file `firestore_rules.txt` e vanno applicate manualmente dalla console Firebase. In sintesi:

- **Aule di gioco** — lettura per tutti gli autenticati; creazione/eliminazione solo per admin; aggiornamento per tutti gli autenticati
- **Lista admin** — leggibile dagli autenticati, non modificabile da client
- **Tutto il resto** — bloccato
