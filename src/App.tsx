import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut 
} from 'firebase/auth';
import { getFirestore, collection, setDoc, updateDoc, onSnapshot, deleteDoc, doc, query, getDoc, deleteField, limit } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'simulatore-longevity-ca';
const gamesCol = () => collection(db, 'artifacts', appId, 'public', 'data', 'games');
const gameDocRef = (id: string) => doc(db, 'artifacts', appId, 'public', 'data', 'games', id);
const adminDocRef = (email: string) => doc(db, 'artifacts', appId, 'admins', email);

// ==========================================
// COSTANTI
// ==========================================
const VIEWS = {
  JOIN: 'join',
  SETUP: 'setup',
  PLAY: 'play',
  ADMIN_LOBBY: 'admin_lobby',
  ADMIN_ROOM: 'admin_room',
} as const;
type View = typeof VIEWS[keyof typeof VIEWS];

const STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
} as const;
type TeamStatus = typeof STATUS[keyof typeof STATUS];

// ==========================================
// TIPI
// ==========================================
interface ProductMetrics {
  [key: string]: string | undefined;
}

interface Product {
  id: string;
  icon: string;
  name: string;
  desc: string;
  metrics: ProductMetrics;
}

interface BracketConfig {
  title: string;
  focus: string;
  products: Product[];
}

type PortfoliosConfig = Record<string, BracketConfig>;

interface Team {
  groupName: string;
  allocations: Record<string, string>;
  status: TeamStatus;
  totalScore: number;
}

interface GameEvent {
  scenarioTitle: string;
  scenarioDescription: string;
  timestamp: number;
  evaluations: Array<{
    ageBracket: string;
    teamName: string;
    score: number;
    feedback: string;
  }>;
}

interface GameData {
  createdAt: number;
  marketName: string;
  config: PortfoliosConfig;
  teams: Record<string, Team>;
  events: GameEvent[];
}

// ==========================================
// CONFIGURAZIONE DI DEFAULT PRODOTTI
// ==========================================
const defaultPortfoliosConfig = {
  '0-25': {
    title: 'Fascia 0-25 anni', focus: 'Focus: Tempo e Capitalizzazione',
    products: [
      { id: 'p1', icon: '🏛️', name: 'Base Previdenziale', desc: 'Amundi SecondaPensione', metrics: { settore: 'Multi-Asset Pension', volatilita: 'Media', vantaggioFiscale: 'Deducibilità Genitori' } },
      { id: 'p2', icon: '🌍', name: 'Esposizione Mercato Puro', desc: 'PAC Amundi Funds Global Equity', metrics: { settore: 'Azionario Globale', volatilita: 'Alta', stile: 'Growth' } },
      { id: 'p3', icon: '🛡️', name: 'Liquidità / Conto Corrente', desc: 'Per emergenze e spese correnti', metrics: { settore: 'Monetario', volatilita: 'Nulla', ytm: '0%' } },
      { id: 'p4', icon: '🏥', name: 'Protezione / Futuro', desc: 'Polizza CA Vita Global Solution', metrics: { settore: 'Unit Linked / Assicurativo', volatilita: 'Bassa/Media', focus: 'Successione/LTC' } },
      { id: 'p5', icon: '🚀', name: 'Motore Azionario Esentasse', desc: 'Amundi Crescita PIR', metrics: { settore: 'Azionario Italia PMI', volatilita: 'Alta', vantaggioFiscale: 'Esenzione Capital Gain 5 anni' } }
    ]
  },
  '25-50': {
    title: 'Fascia 25-50 anni', focus: 'Focus: Accumulo e Architettura Core-Satellite',
    products: [
      { id: 'p1', icon: '🏛️', name: 'Base Previdenziale Dinamica', desc: 'SecondaPensione (Prog. LifeCycle)', metrics: { settore: 'Multi-Asset LifeCycle', volatilita: 'Alta a scalare', vantaggioFiscale: 'Massima Deducibilità' } },
      { id: 'p2', icon: '🌍', name: 'Satelliti Azionari Crescita', desc: 'PAC Amundi Global Equity / Emerging', metrics: { settore: 'Azionario Globale & Emergente', volatilita: 'Alta', beta: '1.2' } },
      { id: 'p3', icon: '💶', name: 'Liquidità / Conto Corrente', desc: 'Fondo emergenze', metrics: { settore: 'Monetario', volatilita: 'Nulla', ytm: '0%' } },
      { id: 'p4', icon: '🏥', name: 'Protezione Famiglia', desc: 'Polizza CA Vita Global Solution', metrics: { settore: 'Assicurativo Misto', volatilita: 'Media', focus: 'Protezione Capitale' } },
      { id: 'p5', icon: '⚖️', name: 'Bond Stabilizzatore Core', desc: 'Amundi Global Subordinated Bond', metrics: { settore: 'Obbligazionario Subordinato Corporate', volatilita: 'Medio/Bassa', ytm: '4.5%', duration: '3.5 anni', rating: 'BBB' } },
      { id: 'p6', icon: '🛡️', name: 'Scudo Fiscale', desc: 'Amundi Futuro PIR / Progetto Futuro PIR', metrics: { settore: 'Bilanciato Italia', volatilita: 'Media', vantaggioFiscale: 'Esenzione Tasse' } }
    ]
  },
  '50-70': {
    title: 'Fascia 50-70 anni', focus: 'Focus: Transizione Strategica e De-risking',
    products: [
      { id: 'p1', icon: '🏛️', name: 'Previdenza in De-risking', desc: 'SecondaPensione (Prog. LifeCycle)', metrics: { settore: 'Multi-Asset Prudente', volatilita: 'Bassa', focus: 'Consolidamento' } },
      { id: 'p2', icon: '🌍', name: 'Esposizione Mercato Puro', desc: 'PAC Amundi Funds Global Equity', metrics: { settore: 'Azionario Globale', volatilita: 'Alta' } },
      { id: 'p3', icon: '🛡️', name: 'Buffer di Liquidità', desc: 'App Sblocca Risparmi / Conto Corrente', metrics: { settore: 'Monetario', volatilita: 'Nulla', ytm: '0%' } },
      { id: 'p4', icon: '🏥', name: 'Ottimizzazione Successoria', desc: 'Polizza CA Vita Global Solution', metrics: { settore: 'Unit Linked', volatilita: 'Bassa', focus: 'Pianificazione Ereditaria' } },
      { id: 'p5', icon: '💸', name: 'Azionario per Flussi/Dividendi', desc: 'Amundi US Dividend Equity', metrics: { settore: 'Azionario Value/Dividend USA', volatilita: 'Media', yield_dividendo: '3.8%' } },
      { id: 'p6', icon: '🎯', name: 'Bond a Scadenza', desc: 'Amundi Buy & Watch 2028', metrics: { settore: 'Obbligazionario Target Maturity', volatilita: 'Bassa', ytm: '4.0%', duration: 'Scadenza 2028' } },
      { id: 'p7', icon: '👵', name: 'Satellite Tematico Longevity', desc: 'CPR Silver Age', metrics: { settore: 'Azionario Tematico', volatilita: 'Alta', trend: 'Invecchiamento Popolazione' } }
    ]
  },
  '70+': {
    title: 'Fascia Over 70', focus: 'Focus: Ingegneria del Decumulo (Floor & Upside)',
    products: [
      { id: 'p1', icon: '🏛️', name: 'Rendita e Decumulo', desc: 'Amundi SecondaPensione', metrics: { settore: 'Erogazione Rendita', volatilita: 'Bassa', focus: 'Rendita Vitalizia' } },
      { id: 'p2', icon: '🌍', name: 'Mantenimento Azionario', desc: 'PAC Amundi Funds Global Equity', metrics: { settore: 'Azionario Globale', volatilita: 'Alta', scopo: 'Upside Lungo Termine' } },
      { id: 'p3', icon: '🧱', name: 'IL FLOOR (Liquidità 2/5 anni)', desc: 'Amundi Div. Short-Term Bond / CC', metrics: { settore: 'Obbligazionario Breve Termine', volatilita: 'Molto Bassa', duration: '1.5 anni', scopo: 'Protezione Rischio Sequenza' } },
      { id: 'p4', icon: '🏥', name: 'Ottimizzazione / Riserva LTC', desc: 'Polizza CA Vita Global Solution', metrics: { settore: 'Assicurativo', volatilita: 'Bassa', coperture: 'Long Term Care' } },
      { id: 'p5', icon: '💵', name: 'CORE INCOME (Flussi Regolari)', desc: 'Amundi Selezione Cedola Globale', metrics: { settore: 'Multi-Asset Income', volatilita: 'Medio/Bassa', target_cedola: '4.5%' } },
      { id: 'p6', icon: '🚀', name: 'UPSIDE (Motore Anti-Inflazione)', desc: 'CPR Silver Age', metrics: { settore: 'Azionario Tematico', volatilita: 'Alta', scopo: 'Battere Inflazione' } }
    ]
  }
};

// ==========================================
// COMPONENTE PRINCIPALE DEL GIOCO
// ==========================================
const LongevityGame = ({ isSimulator = false }) => {
  const [user, setUser] = useState(null);

  // Stati Globali e di Stanza
  const [view, setView] = useState<View>(VIEWS.JOIN);
  const [gameId, setGameId] = useState('');
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [allGames, setAllGames] = useState<Array<GameData & { id: string }>>([]);
  
  // Configurazione Dinamica
  const [appConfig, setAppConfig] = useState(defaultPortfoliosConfig);
  const fileInputRef = useRef(null);
  
  // Stati del Giocatore
  const [groupName, setGroupName] = useState('');
  const [selectedAge, setSelectedAge] = useState('');
  const [localAllocations, setLocalAllocations] = useState({});
  const [activeTab, setActiveTab] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  
  // Stati Admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [roomNameInput, setRoomNameInput] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);

  const [notification, setNotification] = useState({ show: false, message: '', type: '' });

  const activePortfolios = gameData?.config || appConfig;

  // --- INITIALIZATION & AUTH ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (!auth.currentUser) {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser && currentUser.email) {
        try {
          const adminDoc = await getDoc(adminDocRef(currentUser.email.toLowerCase()));
          if (adminDoc.exists()) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        } catch (e) {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- LISTENER PER LA STANZA SPECIFICA ---
  useEffect(() => {
    if (!user || !gameId || (view !== VIEWS.PLAY && view !== VIEWS.SETUP && view !== VIEWS.ADMIN_ROOM)) return;

    const unsubscribe = onSnapshot(gameDocRef(gameId), 
      (docSnap) => {
        if (docSnap.exists()) {
          setGameData(docSnap.data());
        } else {
          setGameData(null);
          if (view === VIEWS.PLAY || view === VIEWS.SETUP) {
             showMessage("L'aula è stata chiusa dall'istruttore.", "error");
             setView(VIEWS.JOIN);
          }
        }
      },
      (error) => console.error("Errore sync stanza:", error)
    );

    return () => unsubscribe();
  }, [user, gameId, view]);

  // --- LISTENER GLOBALE PER TUTTE LE AULE (Solo Admin) ---
  useEffect(() => {
    if (!user || !isAdmin || view !== VIEWS.ADMIN_LOBBY) return;

    const q = query(gamesCol(), limit(50));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const games = [];
        snapshot.forEach((doc) => {
          games.push({ id: doc.id, ...doc.data() });
        });
        games.sort((a, b) => b.createdAt - a.createdAt);
        setAllGames(games);
      },
      (error) => console.error("Errore sync globale:", error)
    );

    return () => unsubscribe();
  }, [user, isAdmin, view]);

  // --- AUTO-SAVE DEBOUNCE ---
  const isMyTeamLocked = gameData?.teams?.[selectedAge]?.status === STATUS.SUBMITTED;
  
  useEffect(() => {
    if (view !== VIEWS.PLAY || !gameId || !selectedAge || isMyTeamLocked) return;

    const timeoutId = setTimeout(() => {
      const docRef = gameDocRef(gameId);
      updateDoc(docRef, { [`teams.${selectedAge}.allocations`]: localAllocations }).catch(e => {
        console.error(e);
        showMessage("Errore nel salvataggio automatico. Controlla la connessione.", "error");
      });
    }, 1500);

    return () => clearTimeout(timeoutId);
  }, [localAllocations, view, gameId, selectedAge, isMyTeamLocked]);

  const showMessage = (message, type = 'info') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 4000);
  };

  // --- LOGICHE GIOCATORE ---
  const handleJoinRoom = async (code) => {
    const upperCode = code.trim().toUpperCase();
    if (upperCode.length < 3) {
      showMessage("Inserisci un codice valido.", "error");
      return;
    }

    setIsJoining(true);
    try {
      const docSnap = await getDoc(gameDocRef(upperCode));
      if (docSnap.exists()) {
        setGameId(upperCode);
        setView(VIEWS.SETUP);
        showMessage(`Benvenuto nell'Aula ${upperCode}`, 'success');
      } else {
        showMessage("Codice Aula inesistente.", "error");
      }
    } catch (error) {
      showMessage("Errore di connessione. Riprova.", "error");
    } finally {
      setIsJoining(false);
    }
  };

  useEffect(() => {
    if (user && view === VIEWS.JOIN && !isSimulator) {
      const urlParams = new URLSearchParams(window.location.search);
      const roomCode = urlParams.get('room');
      if (roomCode) {
        handleJoinRoom(roomCode);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [user, view, isSimulator]);

  const handleStartPlay = async () => {
    if (groupName.trim().length < 2) {
      showMessage("Inserisci un nome valido.", "error");
      return;
    }
    if (!selectedAge) {
      showMessage("Seleziona la fascia d'età.", "error");
      return;
    }
    
    if (gameData?.teams?.[selectedAge]) {
      showMessage("Fascia d'età appena occupata da un altro gruppo!", "error");
      return;
    }
    
    try {
      const initialAlloc = {};
      activePortfolios[selectedAge].products.forEach(p => initialAlloc[p.id] = '');
      
      const docRef = gameDocRef(gameId);
      await updateDoc(docRef, {
        [`teams.${selectedAge}`]: {
          groupName,
          allocations: initialAlloc,
          status: STATUS.DRAFT,
          totalScore: 0
        }
      });

      setLocalAllocations(initialAlloc);
      setActiveTab(selectedAge);
      setView(VIEWS.PLAY);
    } catch (error) {
      showMessage("Errore di connessione. Riprova.", "error");
    }
  };

  const handleInputChange = (productId, value) => {
    if (value === '' || (/^\d+$/.test(value) && parseInt(value) >= 0 && parseInt(value) <= 100)) {
      setLocalAllocations(prev => ({ ...prev, [productId]: value }));
    }
  };

  const currentTotal = Object.values(localAllocations).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
  const isPerfect = currentTotal === 100;

  const handleSubmitToCloud = async () => {
    if (!isPerfect || !user || !gameId) return;

    try {
      const docRef = gameDocRef(gameId);
      await updateDoc(docRef, {
        [`teams.${selectedAge}.allocations`]: localAllocations,
        [`teams.${selectedAge}.status`]: 'submitted'
      });
      showMessage("Portafoglio confermato! Il Game Master vi osserva.", "success");
    } catch (error) {
      showMessage("Errore durante la conferma definitiva.", "error");
    }
  };

  // --- LOGICHE ADMIN ---
  const handleAdminGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    // Rimossa la forzatura del select_account che può causare blocchi in alcuni browser

    setIsLoggingIn(true);
    try {
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email?.toLowerCase();
      if (!email) throw new Error("Email non trovata");

      // Verifica immediata su Firestore nel percorso corretto
      const adminDoc = await getDoc(adminDocRef(email));
      
      if (adminDoc.exists()) {
        setIsAdmin(true);
        setShowAdminLogin(false);
        setView(VIEWS.ADMIN_LOBBY);
        showMessage(`Benvenuto, ${result.user.displayName}`, "success");
      } else {
        await signOut(auth);
        await signInAnonymously(auth);
        setIsAdmin(false);
        showMessage("Accesso negato: questa email non è autorizzata.", "error");
      }
    } catch (error) {
      console.error("Google Login Error:", error);
      // Se l'utente chiude il popup, non mostriamo errori rossi inutili
      if (error.code !== 'auth/popup-closed-by-user') {
        showMessage("Errore durante l'accesso con Google.", "error");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      await signInAnonymously(auth);
      setIsAdmin(false);
      setView(VIEWS.JOIN);
      showMessage("Logout effettuato.", "info");
    } catch (error) {
      showMessage("Errore durante il logout.", "error");
    }
  };

  const handleImportConfig = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsedConfig = JSON.parse(event.target.result);
        if (parsedConfig['0-25'] && parsedConfig['70+']) {
          if (!window.confirm("Sostituire la configurazione prodotti attuale? Questa operazione sovrascriverà i prodotti della stanza in corso.")) return;
          setAppConfig(parsedConfig);
          if (gameId) {
            const docRef = gameDocRef(gameId);
            await updateDoc(docRef, { config: parsedConfig });
          }
          showMessage("Nuova configurazione caricata con successo!", "success");
        } else {
          showMessage("Formato JSON non valido. Mancano le fasce d'età.", "error");
        }
      } catch (err) {
        showMessage("Errore nella lettura del file.", "error");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const createNewGameRoom = async () => {
    if (!roomNameInput.trim()) {
      showMessage("Inserisci il nome dell'aula (es. MILANO).", "error");
      return;
    }

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeString = `${day}${month}-${hours}${minutes}`;

    const safeRoomName = roomNameInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const newCode = `${safeRoomName}-${timeString}`;

    try {
      await setDoc(gameDocRef(newCode), {
        createdAt: Date.now(),
        status: 'active',
        marketName: roomNameInput.trim().toUpperCase(),
        config: appConfig, 
        teams: {},
        events: [] 
      });
      setGameId(newCode);
      setRoomNameInput('');
      setView(VIEWS.ADMIN_ROOM);
      showMessage(`Nuova Aula creata: ${newCode}`, "success");
    } catch(e) {
      showMessage("Errore nella creazione dell'aula.", "error");
    }
  };

  const deleteGameRoom = async (idToDel) => {
    try {
      await deleteDoc(gameDocRef(idToDel));
      if (idToDel === gameId) setView(VIEWS.ADMIN_LOBBY);
      showMessage("Aula eliminata.", "info");
    } catch(e) {
      showMessage("Errore durante l'eliminazione.", "error");
    }
  };

  const kickTeamFromRoom = async (ageBracket) => {
    if(!window.confirm("Sicuro di voler liberare questa fascia d'età? I dati andranno persi.")) return;
    try {
       const docRef = gameDocRef(gameId);
       await updateDoc(docRef, {
         [`teams.${ageBracket}`]: deleteField()
       });
       showMessage(`Slot ${ageBracket} liberato.`, "success");
    } catch (e) {
      showMessage("Errore durante l'espulsione.", "error");
    }
  };

  const openAdminEditModal = (ageBracket) => {
    const team = gameData?.teams?.[ageBracket];
    if (team) {
      setEditingTeam({ ageBracket, groupName: team.groupName, allocations: team.allocations, isNew: false });
    } else {
      const initialAlloc = {};
      activePortfolios[ageBracket].products.forEach(p => initialAlloc[p.id] = '');
      setEditingTeam({ ageBracket, groupName: `Gruppo ${ageBracket}`, allocations: initialAlloc, isNew: true });
    }
  };

  const saveAdminEdit = async () => {
    const total = Object.values(editingTeam.allocations).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    if (total !== 100) {
       showMessage("Attenzione: il totale deve essere 100% per confermare.", "error");
       return;
    }

    try {
       const docRef = gameDocRef(gameId);
       await updateDoc(docRef, {
          [`teams.${editingTeam.ageBracket}`]: {
             groupName: editingTeam.groupName,
             allocations: editingTeam.allocations,
             status: STATUS.SUBMITTED,
             totalScore: gameData?.teams?.[editingTeam.ageBracket]?.totalScore || 0
          }
       });
       setEditingTeam(null);
       showMessage("Squadra aggiornata e confermata.", "success");
    } catch (error) {
       showMessage("Errore durante il salvataggio manuale.", "error");
    }
  };

  // --- GEMINI AI INTEGRATION ---
  const generateAIEvent = async () => {
    if (!gameData || !gameData.teams) return;
    
    const submittedTeams = Object.keys(gameData.teams).reduce((acc, bracket) => {
      const team = gameData.teams[bracket];
      if (team.status === STATUS.SUBMITTED) {
        acc[bracket] = {
          groupName: team.groupName,
          allocations: {}
        };
        activePortfolios[bracket].products.forEach(p => {
          const allocationValue = team.allocations[p.id] || "0";
          acc[bracket].allocations[`${p.name} (${p.desc})`] = {
            pesoPercentuale: `${allocationValue}%`,
            dettagliTecnici: p.metrics || {}
          };
        });
      }
      return acc;
    }, {});

    if (Object.keys(submittedTeams).length === 0) {
      showMessage("Nessun portafoglio confermato. Attendi che i team consegnino.", "error");
      return;
    }

    setIsGeneratingAI(true);
    showMessage("L'Esperto sta analizzando i mercati...", "info");

    const systemPrompt = `Sei il Game Master del "Longevity Game" per consulenti finanziari Crédit Agricole/Amundi.
La tua identità: Sei un Macroeconomista e Gestore Istituzionale di Portafogli con oltre 20 anni di esperienza sui mercati finanziari globali.
Il tuo tono deve essere teatrale, pungente, ironico ma TECNICAMENTE E CLINICAMENTE INATTACCABILE. Hai visto crisi, bolle e crolli, non perdoni gli errori da principianti.

Il tuo compito è:
1. Inventare uno scenario (shock macroeconomico, evento geopolitico, o un evento di vita del cliente).
2. Valutare con precisione chirurgica le scelte di Asset Allocation dei vari team.
Hai a disposizione nei dati JSON inviati non solo le percentuali (pesoPercentuale), ma le vere metriche tecniche dei prodotti scelti (duration, YTM, esposizione settoriale, volatilità, rating, vantaggi fiscali). DEVI usare questi dati tecnici per giustificare i tuoi voti!

REGOLE D'ORO:
- Usa terminologia finanziaria avanzata (curva dei tassi, spread creditizio, equity risk premium, drawdown, sequence of returns risk).
- Se un team over 70 è troppo esposto su duration lunghe in caso di rialzo dei tassi, massacrali per aver esposto il cliente a perdite in conto capitale proprio quando gli serve reddito liquido.
- Se crolla l'azionario, loda il team 0-25 anni se fa PAC (comprano a sconto, la volatilità è loro alleata matematica).
- Penalizza severamente l'over 70 se non ha lasciato un "Floor" adeguato (Liquidità o Amundi Div Short-Term) per far fronte a spese impreviste senza smontare le azioni ai minimi.
- Valorizza l'uso corretto dello "Scudo Fiscale" (PIR o SecondaPensione).

Sii spietato ma oggettivo. Assegna un punteggio numerico da 1 a 10 per ogni team in base all'impatto matematico e logico dello shock sui loro portafogli specifici.`;

    const userQuery = `Ecco i portafogli attuali delle squadre in gara, completi di metriche finanziarie dei prodotti scelti. Colpiscili con un evento macroeconomico inaspettato!\n\n${JSON.stringify(submittedTeams, null, 2)}`;

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            scenarioTitle: { type: "STRING", description: "Titolo accattivante dell'imprevisto" },
            scenarioDescription: { type: "STRING", description: "Descrizione dettagliata dell'evento macro, dei tassi, geopolitico o di vita." },
            evaluations: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  ageBracket: { type: "STRING" },
                  teamName: { type: "STRING" },
                  score: { type: "NUMBER", description: "Voto da 1 a 10" },
                  feedback: { type: "STRING", description: "Giudizio tecnico da esperto, sarcastico e basato rigorosamente su duration, YTM, volatilità e % scelte." }
                },
                required: ["ageBracket", "teamName", "score", "feedback"]
              }
            }
          },
          required: ["scenarioTitle", "scenarioDescription", "evaluations"]
        }
      }
    };

    const fetchWithRetry = async (retries = 5, delay = 1000) => {
      // Usiamo la Netlify Function come scudo per la sicurezza
      const functionUrl = '/.netlify/functions/generate-event';
      
      for (let i = 0; i < retries; i++) {
        try {
          const res = await fetch(functionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          
          if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
          }
          return await res.json();
        } catch (e) {
          if (i === retries - 1) throw e;
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
        }
      }
    };

    try {
      const result = await fetchWithRetry();
      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (textResponse) {
        const parsedData = JSON.parse(textResponse);
        const newEvent = {
          ...parsedData,
          timestamp: Date.now()
        };
        
        const currentEvents = gameData.events || [];
        const updates = { events: [newEvent, ...currentEvents] };
        
        parsedData.evaluations.forEach(ev => {
           const currentScore = gameData.teams[ev.ageBracket]?.totalScore || 0;
           updates[`teams.${ev.ageBracket}.totalScore`] = currentScore + ev.score;
        });

        const docRef = gameDocRef(gameId);
        await updateDoc(docRef, updates);
        
        showMessage("Evento generato e punteggi aggiornati!", "success");
      }
    } catch (error) {
      console.error("Errore Gemini:", error);
      showMessage("Errore durante la connessione all'IA. Verifica le API key.", "error");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // --- ESPORTAZIONI JSON ---
  const downloadJSON = (data, filename) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", filename);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const exportDefaultConfig = () => {
    downloadJSON(defaultPortfoliosConfig, 'Configurazione_Base_Longevity_Game.json');
    showMessage("Configurazione di base scaricata!", "success");
  };

  const exportSingleRoom = () => {
    if (!gameData || !gameData.teams) return;
    
    const exportData = {
      Portafogli: {},
      Imprevisti: []
    };
    
    Object.keys(gameData.teams).forEach(ageBracket => {
      const team = gameData.teams[ageBracket];
      if (team.status === STATUS.SUBMITTED) {
        const bracketData = activePortfolios[ageBracket];
        const readableAllocations = {};
        
        bracketData.products.forEach(p => {
          readableAllocations[`${p.name} (${p.desc})`] = `${team.allocations[p.id] || "0"}%`;
        });
        exportData.Portafogli[`${ageBracket} anni (Team: ${team.groupName})`] = {
          PunteggioTotale: team.totalScore || 0,
          Allocazioni: readableAllocations
        };
      }
    });

    if (Object.keys(exportData.Portafogli).length === 0) {
      showMessage("Nessun portafoglio confermato in quest'aula.", "error");
      return;
    }

    if (gameData.events && gameData.events.length > 0) {
      exportData.Imprevisti = gameData.events.map(ev => ({
        Titolo: ev.scenarioTitle,
        Descrizione: ev.scenarioDescription,
        Data: new Date(ev.timestamp).toLocaleString('it-IT'),
        Valutazioni: ev.evaluations.map(e => ({
          Gruppo: `${e.teamName} (${e.ageBracket} anni)`,
          PunteggioAssegnato: e.score,
          Feedback: e.feedback
        }))
      }));
    }

    downloadJSON({ [`Aula_${gameId}`]: exportData }, `Aula_${gameId}_Dati.json`);
    showMessage("Dati scaricati con successo!", "success");
  };

  const exportAllRooms = () => {
    if (allGames.length === 0) return;
    
    const exportData = {};
    allGames.forEach(game => {
      const roomKey = `Aula_${game.id}`;
      exportData[roomKey] = {
        Portafogli: {},
        Imprevisti: []
      };
      
      const configUsed = game.config || defaultPortfoliosConfig;

      if(game.teams) {
        Object.keys(game.teams).forEach(ageBracket => {
           const team = game.teams[ageBracket];
           if (team.status === STATUS.SUBMITTED) {
             const bracketData = configUsed[ageBracket];
             const readableAllocations = {};
             bracketData.products.forEach(p => {
                readableAllocations[`${p.name}`] = `${team.allocations[p.id] || "0"}%`;
             });
             exportData[roomKey].Portafogli[`${ageBracket} anni (${team.groupName})`] = {
               PunteggioTotale: team.totalScore || 0,
               Allocazioni: readableAllocations
             };
           }
        });
      }

      if (game.events && game.events.length > 0) {
        exportData[roomKey].Imprevisti = game.events.map(ev => ({
          Titolo: ev.scenarioTitle,
          Descrizione: ev.scenarioDescription,
          Data: new Date(ev.timestamp).toLocaleString('it-IT'),
          Valutazioni: ev.evaluations.map(e => ({
            Gruppo: `${e.teamName} (${e.ageBracket} anni)`,
            PunteggioAssegnato: e.score,
            Feedback: e.feedback
          }))
        }));
      }
    });

    downloadJSON(exportData, `Classifica_Generale_Aule.json`);
  };

  // --- COMPONENTI UI SECONDARI ---
  const rankedTeams = useMemo(() => {
    if (!gameData?.teams) return [];
    return Object.entries(gameData.teams)
      .map(([age, team]) => ({ age, ...team }))
      .filter(t => t.status === STATUS.SUBMITTED)
      .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
  }, [gameData?.teams]);

  const Leaderboard = () => {
     if (!gameData || !gameData.teams) return null;

     if (rankedTeams.length === 0) return null;


     return (
       <div className="mb-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
         <h3 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">
           <span>🏆</span> Classifica Generale
         </h3>
         <div className="flex flex-wrap gap-4">
           {rankedTeams.map((t, idx) => (
             <div key={t.age} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${idx === 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                <span className={`text-xl font-black ${idx === 0 ? 'text-amber-500' : 'text-slate-400'}`}>#{idx + 1}</span>
                <div>
                   <div className="font-bold text-slate-800">{t.groupName}</div>
                   <div className="text-xs text-slate-500 font-bold">{t.age} anni</div>
                </div>
                <div className="ml-4 font-black text-emerald-600 text-xl">{t.totalScore || 0} pt</div>
             </div>
           ))}
         </div>
       </div>
     );
  };

  const EventsLog = () => {
    const events = gameData?.events || [];
    if (events.length === 0) return null;

    return (
      <div className="mt-8 space-y-6 pb-12">
        <h3 className="text-2xl font-black text-indigo-800 flex items-center gap-2">
          <span>✨</span> Cronache del Game Master
        </h3>
        {events.map((ev, idx) => (
          <div key={idx} className="bg-white rounded-3xl shadow-xl overflow-hidden border-2 border-indigo-100 animate-fade-in-up">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
              <span className="bg-white/20 text-indigo-50 text-xs font-bold px-3 py-1 rounded-full mb-3 inline-block uppercase tracking-wider">
                {new Date(ev.timestamp).toLocaleTimeString('it-IT')} - Imprevisto #{events.length - idx}
              </span>
              <h4 className="text-2xl font-black mb-2">{ev.scenarioTitle}</h4>
              <p className="text-indigo-100 leading-relaxed font-medium text-sm md:text-base">{ev.scenarioDescription}</p>
            </div>
            <div className="p-6 bg-slate-50 grid grid-cols-1 md:grid-cols-2 gap-4">
              {ev.evaluations.map((evalItem, i) => {
                const isGood = evalItem.score >= 7;
                const isBad = evalItem.score < 5;
                return (
                  <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-2 h-full ${isGood ? 'bg-emerald-500' : isBad ? 'bg-rose-500' : 'bg-amber-400'}`}></div>
                    <div className="pl-3 flex justify-between items-start mb-2">
                      <div>
                        <h5 className="font-bold text-slate-800">{evalItem.teamName}</h5>
                        <span className="text-xs text-slate-500 font-bold">{evalItem.ageBracket} anni</span>
                      </div>
                      <div className={`text-2xl font-black ${isGood ? 'text-emerald-500' : isBad ? 'text-rose-500' : 'text-amber-500'}`}>
                        +{evalItem.score} pt
                      </div>
                    </div>
                    <p className="pl-3 text-sm text-slate-600 italic">"{evalItem.feedback}"</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const [showSimulator, setShowSimulator] = useState(false);

  return (
    <div className={`bg-slate-50 font-sans text-slate-800 flex flex-col items-center py-6 px-4 ${isSimulator ? 'min-h-full' : 'min-h-screen md:p-8'}`}>
      
      {/* Toast Notification */}
      {notification.show && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-xl shadow-2xl font-bold text-white transition-all transform animate-fade-in-down ${notification.type === 'error' ? 'bg-rose-500' : notification.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'}`}>
          {notification.message}
        </div>
      )}

      {/* Simulatore Smartphone (Riservato all'Admin) */}
      {isAdmin && !isSimulator && (
        <>
          <button 
            onClick={() => setShowSimulator(!showSimulator)} 
            className="fixed bottom-6 right-6 bg-indigo-600 text-white w-16 h-16 rounded-full shadow-[0_0_20px_rgba(79,70,229,0.4)] z-50 hover:bg-indigo-500 transition-transform transform hover:scale-110 flex items-center justify-center text-3xl border-2 border-indigo-400"
            title="Simula Smartphone Consulente"
          >
            📱
          </button>

          {showSimulator && (
            <div className="fixed bottom-24 right-6 w-[375px] h-[667px] bg-slate-900 rounded-[3rem] shadow-2xl z-50 p-2 border-4 border-slate-700 overflow-hidden flex flex-col animate-fade-in-up">
              {/* Top Notch dell'iPhone */}
              <div className="w-24 h-6 bg-slate-900 absolute top-2 left-1/2 transform -translate-x-1/2 rounded-b-2xl z-50 flex items-center justify-center">
                 <div className="w-12 h-1.5 bg-slate-800 rounded-full"></div>
              </div>
              
              {/* Lo Schermo (Esegue una versione indipendente dell'App) */}
              <div className="flex-1 bg-white rounded-[2.5rem] overflow-y-auto custom-scrollbar relative border border-slate-800 pt-6">
                 <LongevityGame isSimulator={true} />
              </div>
              
              {/* Bottom Bar dell'iPhone */}
              <div className="w-32 h-1 bg-slate-600 rounded-full mx-auto mt-2 mb-1"></div>
            </div>
          )}
        </>
      )}

      {/* Modal Edit Admin */}
      {editingTeam && isAdmin && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-black text-slate-800 mb-4">
                 {editingTeam.isNew ? 'Crea Squadra Manualmente' : 'Modifica Squadra'} <span className="text-teal-600">({editingTeam.ageBracket} anni)</span>
              </h2>
              <div className="space-y-4">
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Nome Team</label>
                    <input
                      type="text"
                      value={editingTeam.groupName}
                      onChange={e => setEditingTeam({...editingTeam, groupName: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 font-bold text-slate-800 focus:border-teal-500 outline-none"
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Allocazioni (%)</label>
                    {activePortfolios[editingTeam.ageBracket].products.map(p => (
                       <div key={p.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="min-w-0 pr-2">
                             <div className="text-sm font-bold text-slate-700 leading-tight truncate">{p.name}</div>
                             <div className="text-[10px] font-semibold text-teal-600 mt-0.5 truncate">{p.desc}</div>
                          </div>
                          <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden w-24 flex-shrink-0">
                             <input
                                type="number"
                                min="0" max="100"
                                value={editingTeam.allocations[p.id]}
                                onChange={e => setEditingTeam({
                                   ...editingTeam,
                                   allocations: { ...editingTeam.allocations, [p.id]: e.target.value }
                                })}
                                className="w-full text-center p-2 font-black text-slate-800 outline-none"
                             />
                             <span className="pr-2 text-slate-400 text-xs font-bold">%</span>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-100">
                 <button onClick={() => setEditingTeam(null)} className="px-5 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors">Annulla</button>
                 <button onClick={saveAdminEdit} className="px-5 py-3 bg-teal-600 text-white font-bold rounded-xl shadow-md hover:bg-teal-700 transition-colors">Salva e Conferma</button>
              </div>
           </div>
        </div>
      )}

      {/* Modal Admin Login */}
      {showAdminLogin && !isSimulator && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-70 z-40 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center">
            <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center justify-center gap-2">
              <span>🔐</span> Regia Istruttore
            </h2>
            <p className="text-slate-500 mb-8 text-sm">Accedi con il tuo account Google per gestire le aule.</p>
            
            <button 
              onClick={handleAdminGoogleLogin}
              disabled={isLoggingIn}
              className={`w-full flex items-center justify-center gap-3 border-2 p-4 rounded-xl mb-4 font-bold transition-all shadow-sm ${isLoggingIn ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200 hover:border-teal-500 text-slate-700 hover:shadow-md'}`}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
              {isLoggingIn ? 'Accesso in corso...' : 'Accedi con Google'}
            </button>

            <button onClick={() => setShowAdminLogin(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">Annulla</button>
          </div>
        </div>
      )}

      {/* HEADER GLOBALE */}
      <header className={`max-w-5xl w-full text-center bg-white rounded-3xl shadow-sm border-t-8 border-teal-600 relative ${isSimulator ? 'p-4 mb-4' : 'p-6 md:p-8 mb-8'}`}>
        {isAdmin && !isSimulator && (
          <button 
            onClick={handleLogout}
            className="absolute top-4 right-4 bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-500 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          >
            Esci 🚪
          </button>
        )}
        <h1 
          className={`font-black text-teal-800 tracking-tight transition-colors ${isSimulator ? 'text-2xl cursor-default' : 'text-4xl md:text-5xl cursor-pointer hover:text-teal-600'}`}
          onClick={() => { if(!isSimulator) { if(!isAdmin) setShowAdminLogin(true); else setView(VIEWS.ADMIN_LOBBY); } }}
          title={!isSimulator ? (isAdmin ? "Vai alla Lobby Admin" : "Clicca per Accesso Regia") : ""}
        >
          Longevity Game
        </h1>
      </header>

      {/* VISTA 0: INSERIMENTO CODICE AULA */}
      {view === VIEWS.JOIN && user && (
         <main className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden animate-fade-in-up p-8 text-center border border-slate-100">
            <div className="w-20 h-20 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">🏢</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Entra in Aula</h2>
            <p className="text-slate-500 mb-6 text-sm">Inserisci il codice proiettato dall'istruttore per unirti alla partita.</p>
            
            <input 
              type="text" 
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-4 text-center text-xl font-black text-slate-800 tracking-wider uppercase focus:border-teal-500 outline-none transition-colors mb-6"
              placeholder="CODICE AULA"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom(joinCodeInput)}
            />
            <button
              onClick={() => handleJoinRoom(joinCodeInput)}
              disabled={isJoining}
              className={`w-full text-white font-bold text-lg p-4 rounded-xl shadow-lg transition-all transform ${isJoining ? 'bg-slate-400 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 hover:-translate-y-1'}`}
            >
              {isJoining ? 'Connessione...' : 'Entra 🚀'}
            </button>
         </main>
      )}

      {/* VISTA 1: SETUP GIOCATORE */}
      {view === VIEWS.SETUP && user && (
        <main className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden animate-fade-in-up border border-slate-100">
          <div className="bg-teal-600 text-white p-3 text-center font-bold tracking-widest text-xs">
            AULA: {gameId}
          </div>
          <div className="p-6 md:p-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Configura la Squadra</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2">Nome del Team</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 text-lg font-bold text-slate-800 focus:border-teal-500 outline-none"
                  placeholder="es. Lupi di Wall Street"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2">Cliente Assegnato</label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.keys(activePortfolios).map(age => {
                    const occupyingTeam = gameData?.teams?.[age];
                    const isOccupied = !!occupyingTeam;

                    return (
                      <button
                        key={age}
                        onClick={() => setSelectedAge(age)}
                        disabled={isOccupied}
                        className={`p-3 rounded-xl border-2 font-black transition-all flex flex-col items-center justify-center gap-1 ${
                          isOccupied 
                            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                            : selectedAge === age 
                              ? 'border-teal-600 bg-teal-50 text-teal-700 shadow-inner' 
                              : 'border-slate-200 bg-white text-slate-500 hover:border-teal-300 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-sm">{age} anni</span>
                        {isOccupied && (
                          <span className="text-[10px] font-bold text-rose-500 truncate w-full text-center">
                            {occupyingTeam.groupName}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button 
                onClick={handleStartPlay}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-lg p-4 rounded-xl shadow-lg transition-all transform hover:-translate-y-1"
              >
                Inizia Allocazione 🚀
              </button>
            </div>
          </div>
        </main>
      )}

      {/* VISTA 2: PLAY */}
      {view === VIEWS.PLAY && (
        <main className="max-w-4xl w-full animate-fade-in-up">
          
          <div className="flex justify-between items-center mb-4 px-2">
             <div className="bg-white px-3 py-1.5 rounded-full shadow-sm font-bold text-teal-700 border border-teal-100 flex items-center gap-2 text-sm">
               <span className="text-[10px] bg-teal-600 text-white px-2 py-0.5 rounded">AULA {gameId}</span>
               <span>👤</span> <span className="truncate max-w-[100px] md:max-w-[150px]">{groupName}</span>
             </div>
             
             {/* Punteggio Live Squadra */}
             <div className="flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 px-4 py-1.5 rounded-full shadow-sm font-black text-sm">
                <span>🏆</span> {gameData?.teams?.[selectedAge]?.totalScore || 0} pt
             </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 mb-8">
            <div className="flex overflow-x-auto bg-slate-100 border-b custom-scrollbar">
              {Object.keys(activePortfolios).map(tab => {
                const tabTeam = gameData?.teams?.[tab];
                const isMyTab = tab === selectedAge;
                
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 min-w-[100px] py-3 px-2 text-xs md:text-sm font-bold transition-all border-r border-slate-200 flex flex-col items-center justify-center gap-1
                      ${activeTab === tab 
                        ? 'bg-white text-teal-700 border-b-4 border-b-teal-600 shadow-sm' 
                        : 'text-slate-500 hover:bg-slate-200'}`}
                  >
                    <span className="flex items-center gap-1">
                      {tab}
                      {tabTeam?.status === STATUS.SUBMITTED && <span title="Completato">✔️</span>}
                      {tabTeam?.status === STATUS.DRAFT && !isMyTab && <span title="In lavorazione" className="animate-pulse text-amber-500">⏳</span>}
                    </span>
                    {!isMyTab && tabTeam && (
                       <span className="text-[9px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full truncate max-w-[80px]">
                         {tabTeam.groupName}
                       </span>
                    )}
                  </button>
                )
              })}
            </div>

            {(() => {
              const isMyTab = activeTab === selectedAge;
              const spiedTeam = gameData?.teams?.[activeTab];
              
              let displayTotal = 0;
              if (isMyTab) {
                displayTotal = currentTotal;
              } else if (spiedTeam && spiedTeam.allocations) {
                displayTotal = Object.values(spiedTeam.allocations).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
              }

              return (
                <div>
                  <div className={`p-4 md:p-6 border-b ${isMyTab ? 'bg-slate-50 border-slate-100' : 'bg-indigo-50 border-indigo-100'}`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <h2 className="text-xl md:text-2xl font-black text-slate-800">{activePortfolios[activeTab].title}</h2>
                        <p className={`font-bold mt-1 text-xs md:text-sm flex items-center gap-1 ${isMyTab ? 'text-teal-700' : 'text-indigo-700'}`}>
                          {activePortfolios[activeTab].focus}
                        </p>
                      </div>
                      {!isMyTab && (
                        <div className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 shadow-md w-max">
                          <span className="text-lg">👀</span> 
                          <div>
                            <div className="text-[10px] text-indigo-200 leading-tight">Spia:</div>
                            <div className="leading-tight text-sm">{spiedTeam ? spiedTeam.groupName : 'Nessuno'}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 md:p-6 space-y-3 bg-slate-50">
                    {activePortfolios[activeTab].products.map(prod => {
                      const displayValue = isMyTab 
                        ? localAllocations[prod.id] 
                        : (spiedTeam?.allocations?.[prod.id] || '');
                      
                      const isDisabled = !isMyTab || isMyTeamLocked;

                      return (
                        <div key={prod.id} className={`flex items-center p-3 rounded-xl border-2 transition-all ${
                          !isMyTab ? 'bg-white border-indigo-100 opacity-90' : 
                          isDisabled ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-100 hover:border-teal-200 shadow-sm'
                        }`}>
                          <div className="flex items-center flex-1 mr-2 min-w-0">
                            <span className="text-2xl md:text-3xl mr-3 flex-shrink-0">{prod.icon}</span>
                            <div className="flex flex-col min-w-0">
                              <h3 className="font-bold text-sm md:text-base text-slate-800 leading-tight truncate">{prod.name}</h3>
                              <p className="text-[10px] md:text-xs font-semibold text-teal-600 leading-tight mt-0.5 truncate">{prod.desc}</p>
                            </div>
                          </div>
                          
                          <div className={`flex items-center border-2 rounded-lg overflow-hidden transition-all w-20 md:w-28 flex-shrink-0 ${
                            !isMyTab ? 'bg-indigo-50 border-indigo-200' :
                            isDisabled ? 'bg-slate-200 border-slate-300' : 'bg-slate-50 border-slate-200 focus-within:border-teal-500'
                          }`}>
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder={spiedTeam || isMyTab ? "0" : "-"}
                              value={displayValue}
                              onChange={(e) => handleInputChange(prod.id, e.target.value)}
                              disabled={isDisabled}
                              className={`w-full text-center text-lg md:text-xl font-black p-2 outline-none bg-transparent ${
                                !isMyTab ? 'text-indigo-800 cursor-not-allowed' :
                                isDisabled ? 'text-slate-500 cursor-not-allowed' : 'text-slate-800'
                              }`}
                            />
                            <span className={`px-2 font-black text-sm h-full flex items-center border-l-2 ${
                               !isMyTab ? 'border-indigo-200 text-indigo-400' :
                               isDisabled ? 'border-slate-300 text-slate-400' : 'border-slate-200 text-slate-400'
                            }`}>%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {isMyTab && (
                    <div className={`p-5 transition-colors duration-500 ${isMyTeamLocked ? 'bg-emerald-50' : isPerfect ? 'bg-teal-50' : 'bg-white border-t border-slate-100'}`}>
                      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="text-center md:text-left">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Il tuo Totale</p>
                          <h3 className={`text-3xl font-black ${isMyTeamLocked ? 'text-emerald-600' : isPerfect ? 'text-teal-600' : currentTotal > 100 ? 'text-rose-500' : 'text-slate-800'}`}>
                            {currentTotal}%
                          </h3>
                        </div>
                        
                        {!isMyTeamLocked && (
                          <button 
                            onClick={handleSubmitToCloud}
                            disabled={!isPerfect}
                            className={`w-full md:w-auto px-6 py-3 rounded-xl font-black text-base shadow-lg transition-all transform ${
                              isPerfect 
                                ? 'bg-teal-600 hover:bg-teal-500 text-white hover:-translate-y-1' 
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            {isPerfect ? 'Conferma Definitiva' : `Mancano ${100 - currentTotal}%`}
                          </button>
                        )}
                        {isMyTeamLocked && (
                          <div className="text-emerald-700 font-bold text-center md:text-right leading-tight">
                            <span className="block text-xl mb-1">✅</span>
                            Consegna Registrata.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Area Risultati IA per i giocatori */}
          <EventsLog />

        </main>
      )}

      {/* VISTA 3A: ADMIN LOBBY */}
      {view === VIEWS.ADMIN_LOBBY && isAdmin && !isSimulator && (
        <main className="w-full max-w-5xl animate-fade-in-up pb-12">
           <div className="flex flex-col md:flex-row justify-between items-center bg-slate-800 text-white p-8 rounded-3xl shadow-2xl mb-8">
            <div>
              <h2 className="text-3xl font-black mb-2">Pannello di Controllo Globale</h2>
              <p className="text-slate-300 font-medium">Gestisci le aule formative e i dati nazionali.</p>
              
              {/* Import/Export Config */}
              <div className="mt-4 pt-4 border-t border-slate-700 flex flex-wrap gap-3">
                 <label className="bg-slate-700 hover:bg-slate-600 text-xs font-bold px-4 py-2 rounded cursor-pointer transition-colors text-slate-200 border border-slate-600 flex items-center gap-2">
                    ⚙️ Carica configurazione prodotti
                    <input 
                      type="file" 
                      accept=".json" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleImportConfig} 
                    />
                 </label>
                 <button 
                    onClick={exportDefaultConfig}
                    className="bg-slate-700 hover:bg-slate-600 text-xs font-bold px-4 py-2 rounded transition-colors text-slate-200 border border-slate-600 flex items-center gap-2"
                 >
                    📥 Esporta configurazione di base
                 </button>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 mt-6 md:mt-0">
              <button 
                onClick={exportAllRooms} 
                className="px-6 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-colors border border-slate-600 flex items-center justify-center gap-2"
              >
                🌍 Export Classifica
              </button>
              <div className="flex flex-col gap-2">
                <input 
                  type="text" 
                  placeholder="Nome Aula (es. ROMA)"
                  value={roomNameInput}
                  onChange={(e) => setRoomNameInput(e.target.value.toUpperCase())}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl p-3 text-white placeholder-slate-400 focus:border-teal-400 outline-none font-bold text-center uppercase"
                  maxLength="15"
                />
                <button 
                  onClick={createNewGameRoom} 
                  disabled={!roomNameInput.trim()}
                  className={`px-8 py-3 rounded-xl font-black shadow-lg transition-transform transform ${roomNameInput.trim() ? 'bg-teal-500 hover:bg-teal-400 text-white hover:-translate-y-1' : 'bg-slate-600 text-slate-400 cursor-not-allowed'}`}
                >
                  + CREA AULA
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allGames.map(game => {
              const activeTeamsCount = game.teams ? Object.keys(game.teams).length : 0;
              const date = new Date(game.createdAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
              
              return (
                <div key={game.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-black text-slate-800 tracking-widest">{game.id}</h3>
                      <p className="text-xs font-bold text-slate-400 mt-1 uppercase">Creata: {date}</p>
                    </div>
                    <span className="bg-teal-50 text-teal-700 font-black px-3 py-1 rounded-lg text-sm border border-teal-100">
                      {activeTeamsCount}/4 Gruppi
                    </span>
                  </div>
                  
                  <div className="flex gap-2 mt-6">
                    <button 
                      onClick={() => { setGameId(game.id); setView(VIEWS.ADMIN_ROOM); }}
                      className="flex-1 bg-slate-100 hover:bg-teal-600 hover:text-white text-slate-700 font-bold py-3 rounded-xl transition-colors"
                    >
                      Entra / Proietta
                    </button>
                    <button 
                      onClick={() => deleteGameRoom(game.id)}
                      className="w-14 bg-white border border-rose-200 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl font-bold transition-colors flex items-center justify-center"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      )}

      {/* VISTA 3B: ADMIN ROOM */}
      {view === VIEWS.ADMIN_ROOM && isAdmin && gameData && !isSimulator && (
        <main className="w-full max-w-6xl animate-fade-in-up pb-12">
          
          <button onClick={() => setView(VIEWS.ADMIN_LOBBY)} className="text-slate-500 font-bold hover:text-slate-800 flex items-center gap-1 mb-4 px-2">
             <span>←</span> Torna alla Lobby
          </button>

          <div className="bg-slate-800 text-white p-6 md:p-8 rounded-3xl shadow-2xl mb-8 border-4 border-teal-500 flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-center">
            
            {/* QR CODE QUADRATO E FORZATO */}
            <div className="bg-white p-3 rounded-2xl shadow-inner hidden md:flex items-center justify-center border-2 border-slate-700 w-48 h-48 lg:w-56 lg:h-56 flex-shrink-0">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(window.location.origin + window.location.pathname + '?room=' + gameId)}`} 
                alt="QR Code Aula" 
                className="w-full h-full object-contain aspect-square"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>
            
            <div className="flex-1 flex flex-col justify-center h-full min-w-0 w-full overflow-hidden">
              <div className="mb-4 w-full">
                <h2 className="text-3xl lg:text-4xl font-black mb-2 truncate">Regia Live | Aula: <span className="text-teal-400 tracking-widest">{gameId}</span></h2>
                <p className="text-slate-300 font-medium text-base lg:text-lg mb-2">
                  Inquadra il QR Code oppure vai su questo link:
                </p>
                {/* Contenitore URL blindato con inline styles per garantire il wrapping */}
                <div className="w-full max-w-full overflow-hidden bg-slate-900 px-4 py-3 rounded-lg border border-slate-700 mb-4">
                  <div className="font-mono text-teal-300 text-xs sm:text-sm select-all" style={{ wordBreak: 'break-all', overflowWrap: 'break-word', whiteSpace: 'normal' }}>
                    {window.location.origin}{window.location.pathname}?room={gameId}
                  </div>
                </div>
              </div>
              
              {/* Bottoni Azione Sotto al Link */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={generateAIEvent} 
                  disabled={isGeneratingAI}
                  className={`px-6 py-3 rounded-2xl font-black text-base shadow-lg transition-transform transform flex-1 text-center ${isGeneratingAI ? 'bg-indigo-400 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:scale-105 shadow-indigo-500/30'}`}
                >
                  {isGeneratingAI ? '✨ Elaborazione...' : '✨ Scatena Imprevisto AI'}
                </button>
                <button 
                  onClick={exportSingleRoom} 
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold border border-slate-600 transition-colors flex-1 text-center"
                >
                  📥 Esporta dati
                </button>
              </div>
            </div>
          </div>

          <Leaderboard />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.keys(activePortfolios).map(ageBracket => {
              const team = gameData.teams?.[ageBracket];
              const isOccupied = !!team;
              const isSubmitted = team?.status === STATUS.SUBMITTED;
              const groupTotal = team ? Object.values(team.allocations).reduce((sum, val) => sum + (parseInt(val) || 0), 0) : 0;
              const teamScore = team?.totalScore || 0;
              
              return (
                <div key={ageBracket} className={`bg-white rounded-3xl shadow-lg border-2 overflow-hidden transition-all flex flex-col h-full ${!isOccupied ? 'border-dashed border-slate-200 opacity-60' : isSubmitted ? 'border-emerald-400' : 'border-amber-300'}`}>
                  <div className={`p-4 border-b flex justify-between items-center ${!isOccupied ? 'bg-slate-50' : isSubmitted ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
                    <div className="flex-1 min-w-0 pr-4">
                      <h3 className="font-black text-slate-800 text-xl truncate">{isOccupied ? team.groupName : 'In attesa...'}</h3>
                      <span className="text-sm font-bold text-slate-500">{ageBracket} anni</span>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {isOccupied ? (
                          <>
                             <div className="flex items-center gap-1 bg-white text-amber-600 px-3 py-1 rounded-full text-sm font-black border border-amber-200 shadow-sm">
                                <span>🏆</span> {teamScore} pt
                             </div>
                             <span className={`px-3 py-1 rounded-full text-xs font-black border ${isSubmitted ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-200'}`}>
                                {isSubmitted ? 'CONSEGNATO' : 'IN BOZZA'}
                             </span>
                             <button 
                                onClick={() => openAdminEditModal(ageBracket)}
                                title="Modifica manualmente questa squadra"
                                className="w-8 h-8 flex items-center justify-center bg-white text-teal-600 rounded-full shadow hover:bg-teal-500 hover:text-white transition-colors border border-teal-100"
                             >✏️</button>
                             <button 
                               onClick={() => kickTeamFromRoom(ageBracket)}
                               title="Espelli squadra e libera la fascia"
                               className="w-8 h-8 flex items-center justify-center bg-white text-rose-500 rounded-full shadow hover:bg-rose-500 hover:text-white transition-colors border border-rose-100"
                             >✕</button>
                          </>
                        ) : (
                          <button 
                             onClick={() => openAdminEditModal(ageBracket)}
                             className="px-4 py-1.5 bg-white border-2 border-slate-200 text-slate-500 font-bold rounded-full hover:border-teal-400 hover:text-teal-600 transition-colors text-sm"
                          >
                             ✏️ Crea Gruppo
                          </button>
                        )}
                    </div>
                  </div>
                  
                  {isOccupied ? (
                    <div className="p-5 flex-1 flex flex-col">
                      <ul className="space-y-3 mb-4 flex-1">
                        {activePortfolios[ageBracket].products.map(p => (
                          <li key={p.id} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2 overflow-hidden mr-2 min-w-0">
                              <span className="text-lg flex-shrink-0">{p.icon}</span>
                              <div className="flex flex-col min-w-0">
                                <span className="text-slate-800 font-bold leading-tight truncate">{p.name}</span>
                                <span className="text-slate-500 font-semibold text-[11px] leading-tight mt-0.5 truncate">{p.desc}</span>
                              </div>
                            </div>
                            <span className="font-black text-slate-800 bg-slate-100 px-3 py-1 rounded-lg min-w-[50px] text-center border border-slate-200 flex-shrink-0">
                              {team.allocations[p.id] || 0}%
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="bg-slate-50 rounded-xl p-3 flex justify-between items-center border border-slate-100 mt-auto">
                        <span className="text-xs font-bold text-slate-500 uppercase">Totale Inserito</span>
                        <span className={`font-black text-lg ${groupTotal === 100 ? 'text-emerald-600' : 'text-rose-500'}`}>{groupTotal}%</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-10 flex-1 flex items-center justify-center text-slate-300">
                       <span className="text-4xl animate-pulse">⏳</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Area Risultati IA per Admin */}
          <EventsLog />

        </main>
      )}
    </div>
  );
};

// ==========================================
// WRAPPER GLOBALE CON SIMULATORE SMARTPHONE
// ==========================================
const App = () => {
  return (
    <div className="relative min-h-screen bg-slate-100">
      <LongevityGame />
    </div>
  );
};

export default App;
