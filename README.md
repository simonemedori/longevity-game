# 🎮 Longevity Game — Simulatore Finanziario IA

**Longevity Game** è un'applicazione web multiplayer per la formazione di consulenti finanziari. I partecipanti, divisi in squadre per fascia d'età, allocano portafogli di investimento e affrontano imprevisti macroeconomici generati in tempo reale da un Game Master basato su intelligenza artificiale.

---

## 📋 Indice

- [Flusso di una sessione](#-flusso-di-una-sessione)
- [Per i partecipanti](#-per-i-partecipanti)
- [Per l'istruttore](#-per-listruttore)
- [Stack tecnologico](#-stack-tecnologico)
- [Architettura di sicurezza](#-architettura-di-sicurezza)
- [Sviluppo locale](#-sviluppo-locale)
- [Deploy](#-deploy)
- [Variabili d'ambiente](#-variabili-dambiente)
- [Firestore Security Rules](#-firestore-security-rules)

---

## 🔄 Flusso di una sessione

Questa sezione descrive il flusso completo di una sessione tipo, dalla preparazione alla chiusura.

---

### Fase 1 — Preparazione (istruttore)

1. **Accedi** all'app con il tuo account Google tramite il pulsante di login admin
2. **Crea l'aula**: inserisci il nome del mercato (es. "Mercato Europeo 2024") e un codice aula breve e memorabile (es. `AMUNDI01`) — il codice è quello che proietterai ai partecipanti
3. **Opzionale**: importa una configurazione JSON personalizzata dei prodotti finanziari se vuoi usare un set diverso da quello di default
4. **Proietta il codice aula** e chiedi ai partecipanti di aprire l'app

---

### Fase 2 — Ingresso partecipanti

5. Ogni squadra apre l'app, inserisce il **codice aula** e sceglie il **nome del team**
6. Ogni squadra seleziona la propria **fascia d'età** (0-25 / 25-50 / 50-70 / 70+) — ogni fascia può essere occupata da un solo team
7. Una volta che tutti i team sono entrati, l'istruttore può dare il via all'allocazione

> 💡 Se tutti i posti sono già occupati, i nuovi ingressi finiscono automaticamente in **modalità spettatore**.

---

### Fase 3 — Allocazione portafoglio (round)

8. Ogni team **distribuisce il 100%** del patrimonio tra i prodotti disponibili per la propria fascia d'età
9. Quando soddisfatti dell'allocazione, cliccano **Conferma Definitiva** — da quel momento il portafoglio è bloccato per quel round
10. L'istruttore dal pannello admin vede in tempo reale lo stato di ogni team (in corso / consegnato)
11. Se necessario, l'istruttore può **forzare la consegna** di un team in ritardo o **resettare** un'allocazione

> 💡 Il team che ha il turno dell'**hint** può suggerire uno scenario all'IA (es. "crisi del debito sovrano") per mettere in difficoltà gli avversari.

---

### Fase 4 — Generazione imprevisto AI

12. Quando tutti (o la maggioranza) dei team hanno consegnato, l'istruttore clicca **Genera imprevisto**
13. Il **Game Master IA** (Gemini 2.5 Flash) analizza i portafogli consegnati, crea uno scenario macroeconomico realistico, valuta ogni portafoglio e assegna un punteggio con feedback tecnico
14. L'imprevisto e i punteggi appaiono in tempo reale per tutti — partecipanti, spettatori e classifica globale
15. Il contatore round si aggiorna (es. `1/4`) — al raggiungimento del limite il pulsante AI si blocca automaticamente

---

### Fase 5 — Round successivi

16. I team **sbloccano** le loro allocazioni (o l'istruttore le resetta) e riallocano per il round successivo, tenendo conto dell'imprevisto appena ricevuto
17. Si ripete dalla **Fase 3** per ogni nuovo round

---

### Fase 6 — Chiusura

18. Al termine dei round, la **classifica finale** è visibile a tutti
19. L'istruttore può **esportare i dati** (classifica e punteggi) in JSON per l'archiviazione o l'analisi post-sessione
20. L'aula rimane visibile nella **classifica globale** per il confronto tra sessioni parallele o future

---

## 👤 Per i partecipanti

### Accesso all'aula

1. Apri l'app e inserisci il **codice aula** proiettato dall'istruttore
2. Scegli o ricevi il nome del tuo team
3. Sei dentro — l'app si aggiorna in tempo reale senza bisogno di ricaricare la pagina

> 💡 Se tutti i posti sono già occupati, entri automaticamente in **modalità spettatore**: puoi seguire la partita con classifica e cronache visibili, ma senza modificare il portafoglio.

---

### 📊 Allocazione del portafoglio

- Distribuisci il **100% del patrimonio** tra i prodotti finanziari disponibili per la tua fascia d'età
- Ogni prodotto mostra metriche tecniche dettagliate (rendimento atteso, volatilità, orizzonte temporale…)
- Puoi modificare l'allocazione liberamente fino alla **consegna**
- Una volta consegnato, il portafoglio è bloccato per quel round

---

### 🔍 Vista spia

- Puoi osservare in **tempo reale** le scelte delle altre squadre nella tua aula
- Utile per capire le strategie degli avversari prima di consegnare

---

### 🏆 Classifica

- **Classifica aula** — ranking in tempo reale tra i team della tua sessione, con punteggi e storico degli imprevisti
- **Classifica globale** — visualizza il ranking tra tutte le aule attive in contemporanea, sia in termini assoluti che per fascia d'età (accessibile con il codice della propria aula)
- Dalla classifica globale puoi cliccare su un'aula per vederne i dettagli in tempo reale

---

## 🎓 Per l'istruttore

L'istruttore accede con **Google OAuth** e ha visibilità e controllo completo su tutte le aule.

---

### 🏫 Gestione delle aule

**Creare un'aula**
1. Dal pannello admin, clicca **Nuova aula**
2. Assegna un nome e un codice univoco (quello che proietterai ai partecipanti)
3. Configura le fasce d'età e i prodotti finanziari disponibili

**Configurazione prodotti via JSON**
- Puoi importare ed esportare configurazioni personalizzate dei portafogli in formato JSON
- Permette di preparare sessioni diverse (es. giovani investitori vs. prossimi alla pensione) e riutilizzarle

**Eliminare un'aula**
- La cancellazione richiede di digitare il **codice esatto** dell'aula per confermare — protezione contro eliminazioni accidentali

---

### 🤖 Game Master IA (Gemini 2.5 Flash)

Il cuore del gioco. L'IA genera imprevisti macroeconomici realistici, valuta i portafogli consegnati e assegna punteggi con feedback tecnici.

**Generare un imprevisto**
1. Clicca il pulsante **Genera imprevisto** nel pannello dell'aula
2. L'IA analizza i portafogli consegnati e crea uno scenario macroeconomico (es. rialzo tassi Fed, crisi geopolitica, shock energetico…)
3. Ogni squadra riceve un punteggio con motivazione tecnica

**Limite round**
- Il pulsante AI mostra il contatore corrente (es. `2/4`) e si **blocca automaticamente** al raggiungimento del limite (default: 4 round)
- Garantisce equità tra aule diverse che si svolgono in parallelo

**Eliminare un imprevisto**
- Puoi rimuovere un imprevisto dal log: i punti assegnati vengono **sottratti automaticamente** — utile in caso di errori o test

---

### 💡 Hint a rotazione

- Ogni round, una **squadra a turno** può suggerire uno scenario all'IA (es. "voglio che arrivi un'inflazione galoppante")
- Mette in difficoltà le altre squadre e aggiunge un elemento strategico
- La rotazione è gestita automaticamente dall'app

---

### 👥 Gestione squadre

| Azione | Descrizione |
|---|---|
| **Espelli team** | Rimuove una squadra dall'aula |
| **Forza consegna** | Consegna il portafoglio di un team che non lo ha fatto |
| **Reimposta allocazione** | Azzera le scelte di un team, permettendogli di riallocare |

---

### 📱 Simulatore mobile

- Dal pannello admin puoi aprire un'**anteprima dell'interfaccia partecipante** direttamente nel browser
- Utile per testare il flusso di gioco prima di iniziare la sessione

---

### 📤 Export dati

- **Export singola aula** — esporta la classifica e i dati di una sessione specifica in JSON
- **Export globale** — esporta i dati di tutte le aule attive in un unico file JSON
- Utile per analisi post-sessione o per l'archiviazione

---

## 🛠 Stack tecnologico

| Layer | Tecnologia |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS (CDN), palette brand Amundi |
| Database | Firebase Firestore (real-time sync) |
| Autenticazione | Firebase Auth (anonima + Google OAuth) |
| Intelligenza Artificiale | Google Gemini 2.5 Flash |
| Hosting primario | Firebase Hosting su [longevitygame.it](https://longevitygame.it) |
| Hosting secondario | Netlify |
| Hosting terziario | Vercel (piano B) |
| Funzione AI (Firebase) | Cloud Run (Firebase Functions v2, Node.js 22) |
| Funzione AI (Netlify) | Netlify Function |
| Funzione AI (Vercel) | Vercel Function |

---

## 🔒 Architettura di sicurezza

```
Browser → /generateEvent (Firebase Hosting rewrite)
               ↓
          Cloud Run Function (Node.js 22)
               ↓
          Google Gemini API
```

La chiave `GEMINI_API_KEY` non raggiunge mai il browser — vive esclusivamente nella funzione serverless lato server, protetta da Google Secret Manager. Le credenziali Firebase sono pubbliche by design e protette dalle Firestore Security Rules (lettura/scrittura riservata agli utenti autenticati; creazione/eliminazione aule solo per admin registrati).

---

## 💻 Sviluppo locale

### Prerequisiti
- Node.js 22+
- Netlify CLI (`npm i -g netlify-cli`)

### Setup

```bash
# 1. Clona e installa
git clone https://github.com/simonemedori/longevity-game.git
cd longevity-game
npm install

# 2. Crea il file .env.local nella root del progetto
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

> `netlify dev` avvia sia il frontend Vite sia la Netlify Function, replicando l'ambiente di produzione.

---

## 🚀 Deploy

### Firebase Hosting (primario) — longevitygame.it

Il deploy avviene **automaticamente** ad ogni merge su `main` tramite GitHub Actions.

Per un deploy manuale:
```bash
npm run build:firebase
firebase deploy
```

Variabili d'ambiente richieste nei **GitHub Secrets** del repository:

| Secret | Descrizione |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_LONGEVITY_GAME` | Service account Firebase (JSON) |
| `VITE_FIREBASE_API_KEY` | Credenziale Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | Es. `longevitygame.it` |
| `VITE_FIREBASE_PROJECT_ID` | ID progetto Firebase |
| `VITE_FIREBASE_STORAGE_BUCKET` | Bucket Firebase Storage |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sender ID Firebase |
| `VITE_FIREBASE_APP_ID` | App ID Firebase |

---

### Netlify (secondario)

1. Collega il repository GitHub a Netlify
2. Aggiungi le variabili d'ambiente in **Site configuration → Environment variables**:

| Variabile | Descrizione |
|---|---|
| `GEMINI_API_KEY` | Chiave Google AI Studio (server-side) |
| `ALLOWED_ORIGINS` | Dominio del sito (es. `https://longevitygame.netlify.app`) |
| `VITE_FIREBASE_*` | Credenziali Firebase (6 variabili) |

---

### Vercel (piano C)

1. Importa il repository su Vercel
2. Aggiungi le stesse variabili di Netlify, più:

| Variabile | Valore |
|---|---|
| `VITE_AI_FUNCTION_URL` | `/api/generate-event` |

---

## 🔑 Variabili d'ambiente — schema completo

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

## 🛡 Firestore Security Rules

Le regole di sicurezza sono nel file `firestore_rules.txt` e vanno applicate manualmente dalla console Firebase. In sintesi:

- **Aule di gioco** — lettura per tutti gli autenticati; creazione/eliminazione solo per admin; aggiornamento per tutti gli autenticati
- **Lista admin** — leggibile dagli autenticati, non modificabile da client
- **Tutto il resto** — bloccato
