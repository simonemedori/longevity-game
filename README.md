# 🏛️ Longevity Game - Simulatore Finanziario IA

**Longevity Game** è un'applicazione web interattiva creata per i consulenti finanziari (Crédit Agricole / Amundi). Permette di simulare scenari di investimento in tempo reale, dove squadre di consulenti allocano portafogli per diverse fasce d'età, affrontando imprevisti macroeconomici generati da un "Game Master" guidato dall'Intelligenza Artificiale.

## ✨ Funzionalità Principali

* **Multiplayer in Tempo Reale:** Creazione di "Aule" virtuali (es. MILANO, ROMA) dove i partecipanti si collegano tramite codice o QR Code.
* **Allocazione Portafogli:** 4 fasce d'età (0-25, 25-50, 50-70, 70+ anni) con prodotti finanziari reali, metriche tecniche e vincolo del 100%.
* **Game Master IA (Google Gemini 2.5):** L'intelligenza artificiale agisce come un macroeconomista spietato. Valuta i portafogli confermati, inventa shock di mercato e assegna punteggi e feedback tecnici basati sulle scelte dei consulenti.
* **Regia Istruttore (Admin Loby):** Pannello riservato per gestire le aule, importare configurazioni JSON personalizzate, espellere team, forzare consegne ed esportare le classifiche.
* **Simulatore Mobile Integrato:** Visualizzazione affiancata per testare l'interfaccia mobile (lato partecipante) direttamente dallo schermo del PC.

## 🛠️ Stack Tecnologico

* **Frontend:** React, TypeScript, Vite
* **Styling:** Tailwind CSS
* **Database & Auth:** Firebase (Firestore per il real-time sync, Authentication anonima)
* **Intelligenza Artificiale:** API REST di Google Gemini (Modello: `gemini-2.5-flash`)
* **Hosting raccomandato:** Netlify

## ⚙️ Configurazione e Installazione (Sviluppo Locale)

Se vuoi scaricare il progetto ed eseguirlo sul tuo computer:

1. **Clona il repository e installa le dipendenze:**
   ```bash
   npm install

2. **Configura le Variabili d'Ambiente:**
Crea un file .env nella cartella principale del progetto e inserisci la tua chiave API di Google AI Studio.
(Nota: per motivi di sicurezza, questo file non viene mai caricato su GitHub).
VITE_GEMINI_API_KEY=inserisci_qui_la_tua_chiave_AIza...

3. **Avvia il server di sviluppo:**
   ```bash
   npm run dev

## 🚀 Pubblicazione (Deploy su Netlify)
Per pubblicare l'app in produzione:

1. Collega il repository GitHub a Netlify.

2. In Netlify, vai in Site configuration -> Environment variables e aggiungi:

  - **Key**: `VITE_GEMINI_API_KEY`
  - **Value**: `[La tua chiave di Google AI Studio]`

3. Imposta il comando di build su vite build (o `CI= vite build` se ci sono warning di Tailwind).

4. Avvia il Deploy!

## 🔐 Sicurezza
Le credenziali di Firebase nel file `App.tsx` sono pubbliche in quanto gestite tramite permessi di sicurezza direttamente dalle regole di Firestore (Firebase Security Rules).
La chiave di Google Gemini, invece, deve rimanere strettamente privata e gestita unicamente tramite variabili d'ambiente (import.meta.env).
