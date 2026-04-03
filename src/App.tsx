import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from 'firebase/auth';
import { getFirestore, collection, setDoc, updateDoc, onSnapshot, deleteDoc, doc, query, getDoc, deleteField, orderBy } from 'firebase/firestore';

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
  SPECTATOR: 'spectator',
  ADMIN_LOBBY: 'admin_lobby',
  ADMIN_ROOM: 'admin_room',
  GLOBAL_LEADERBOARD: 'global_leaderboard',
} as const;
type View = typeof VIEWS[keyof typeof VIEWS];

const MAX_ROUNDS = 5;

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
      { id: 'p1', icon: '🏛️', name: 'Base Previdenziale', desc: 'Fondo pensione', metrics: { settore: 'Multi-Asset Pension', volatilita: 'Media', vantaggioFiscale: 'Deducibilità Genitori' } },
      { id: 'p2', icon: '🌍', name: 'Esposizione Mercato Puro', desc: 'PAC azionario globale', metrics: { settore: 'Azionario Globale', volatilita: 'Alta', stile: 'Growth' } },
      { id: 'p3', icon: '🛡️', name: 'Liquidità / Conto Corrente', desc: 'Liquidità corrente', metrics: { settore: 'Monetario', volatilita: 'Nulla', ytm: '0%' } },
      { id: 'p4', icon: '🏥', name: 'Protezione / Futuro', desc: 'Polizza unit linked', metrics: { settore: 'Unit Linked / Assicurativo', volatilita: 'Bassa/Media', focus: 'Accumulo' } },
      { id: 'p5', icon: '🚀', name: 'Motore Azionario Esentasse', desc: 'PIR (PAC)', metrics: { settore: 'Azionario Italia PMI', volatilita: 'Alta', vantaggioFiscale: 'Esenzione Capital Gain 5 anni' } }
    ]
  },
  '25-50': {
    title: 'Fascia 25-50 anni', focus: 'Focus: Accumulo e Architettura Core-Satellite',
    products: [
      { id: 'p1', icon: '🏛️', name: 'Base Previdenziale Dinamica', desc: 'Fondo pensione lifecycle', metrics: { settore: 'Multi-Asset LifeCycle', volatilita: 'Alta a scalare', vantaggioFiscale: 'Massima Deducibilità' } },
      { id: 'p2', icon: '🌍', name: 'Satelliti Azionari Crescita', desc: 'PAC azionario globale & emergente', metrics: { settore: 'Azionario Globale & Emergente', volatilita: 'Alta', beta: '1.2' } },
      { id: 'p3', icon: '💶', name: 'Liquidità / Conto Corrente', desc: 'Fondo emergenze', metrics: { settore: 'Monetario', volatilita: 'Nulla', ytm: '0%' } },
      { id: 'p4', icon: '🏥', name: 'Protezione Famiglia', desc: 'Polizza unit linked', metrics: { settore: 'Assicurativo Misto', volatilita: 'Media', focus: 'Protezione Capitale' } },
      { id: 'p5', icon: '⚖️', name: 'Bond Stabilizzatore Core', desc: 'Bond subordinati globali', metrics: { settore: 'Obbligazionario Subordinato Corporate', volatilita: 'Medio/Bassa', ytm: '4.5%', duration: '3.5 anni', rating: 'BBB' } },
      { id: 'p6', icon: '🛡️', name: 'Scudo Fiscale', desc: 'PIR bilanciato', metrics: { settore: 'Bilanciato Italia', volatilita: 'Media', vantaggioFiscale: 'Esenzione Tasse' } }
    ]
  },
  '50-70': {
    title: 'Fascia 50-70 anni', focus: 'Focus: Transizione Strategica e De-risking',
    products: [
      { id: 'p1', icon: '🏛️', name: 'Previdenza in De-risking', desc: 'Fondo pensione lifecycle', metrics: { settore: 'Multi-Asset Prudente', volatilita: 'Bassa', focus: 'Consolidamento' } },
      { id: 'p2', icon: '🌍', name: 'Esposizione Mercato Puro', desc: 'Azionario globale (PAC)', metrics: { settore: 'Azionario Globale', volatilita: 'Alta' } },
      { id: 'p3', icon: '🛡️', name: 'Buffer di Liquidità', desc: 'Conto deposito / liquidità', metrics: { settore: 'Monetario', volatilita: 'Nulla', ytm: '0%' } },
      { id: 'p4', icon: '🏥', name: 'Ottimizzazione Successoria', desc: 'Polizza unit linked', metrics: { settore: 'Unit Linked', volatilita: 'Bassa', focus: 'Pianificazione Ereditaria' } },
      { id: 'p5', icon: '💸', name: 'Azionario per Flussi/Dividendi', desc: 'Azionario dividendi Globale (PAC)', metrics: { settore: 'Azionario Value/Dividend Global', volatilita: 'Media', yield_dividendo: '3.8%' } },
      { id: 'p6', icon: '🎯', name: 'Bond a Scadenza', desc: 'Obbligazionario a scadenza', metrics: { settore: 'Obbligazionario Target Maturity', volatilita: 'Bassa', ytm: '4.0%', duration: 'Scadenza 2028' } },
      { id: 'p7', icon: '👵', name: 'Satellite Tematico Longevity', desc: 'Fondo tematico longevity (PAC)', metrics: { settore: 'Azionario Tematico', volatilita: 'Alta', trend: 'Invecchiamento Popolazione' } }
    ]
  },
  '70+': {
    title: 'Fascia Over 70', focus: 'Focus: Ingegneria del Decumulo (Floor & Upside)',
    products: [
      { id: 'p1', icon: '🏛️', name: 'Rendita e Decumulo', desc: 'Fondo pensione', metrics: { settore: 'Erogazione Rendita', volatilita: 'Bassa', focus: 'Rendita Vitalizia' } },
      { id: 'p2', icon: '🌍', name: 'Mantenimento Azionario', desc: 'Azionario globale diversificato (PAC)', metrics: { settore: 'Azionario Globale', volatilita: 'Alta', scopo: 'Upside Lungo Termine' } },
      { id: 'p3', icon: '🧱', name: 'IL FLOOR (Liquidità 2/5 anni)', desc: 'Bond breve termine / liquidità', metrics: { settore: 'Obbligazionario Breve Termine', volatilita: 'Molto Bassa', duration: '1.5 anni', scopo: 'Protezione Rischio Sequenza' } },
      { id: 'p4', icon: '🏥', name: 'Ottimizzazione / Riserva LTC', desc: 'Polizza unit linked', metrics: { settore: 'Assicurativo', volatilita: 'Bassa', coperture: 'Long Term Care' } },
      { id: 'p5', icon: '💵', name: 'CORE INCOME (Flussi Regolari)', desc: 'Multi-asset cedola globale', metrics: { settore: 'Multi-Asset Income', volatilita: 'Medio/Bassa', target_cedola: '4.5%' } },
      { id: 'p6', icon: '🚀', name: 'UPSIDE (Motore Anti-Inflazione)', desc: 'Fondo tematico longevity', metrics: { settore: 'Azionario Tematico', volatilita: 'Alta', scopo: 'Battere Inflazione' } }
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
  const [prevView, setPrevView] = useState<View>(VIEWS.JOIN);
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
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [showFullDisclaimer, setShowFullDisclaimer] = useState(false);
  
  // Stati Admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [roomNameInput, setRoomNameInput] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiHint, setAiHint] = useState('');
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
    if (!user || !gameId || (view !== VIEWS.PLAY && view !== VIEWS.SETUP && view !== VIEWS.SPECTATOR && view !== VIEWS.ADMIN_ROOM)) return;

    const unsubscribe = onSnapshot(gameDocRef(gameId), 
      (docSnap) => {
        if (docSnap.exists()) {
          setGameData(docSnap.data());
        } else {
          setGameData(null);
          if (view === VIEWS.PLAY || view === VIEWS.SETUP || view === VIEWS.SPECTATOR) {
             showMessage("L'aula è stata chiusa dall'istruttore.", "error");
             setView(VIEWS.JOIN);
          }
        }
      },
      (error) => console.error("Errore sync stanza:", error)
    );

    return () => unsubscribe();
  }, [user, gameId, view]);

  // --- LISTENER GLOBALE PER TUTTE LE AULE ---
  useEffect(() => {
    if (!user || (view !== VIEWS.ADMIN_LOBBY && view !== VIEWS.GLOBAL_LEADERBOARD)) return;

    const q = query(gamesCol(), orderBy('createdAt', 'desc'));
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

  // --- AUTO-REDIRECT A SPECTATOR SE LA STANZA SI RIEMPIE IN SETUP ---
  useEffect(() => {
    if (view !== VIEWS.SETUP || !gameData || !activePortfolios) return;
    const allBracketsFull = Object.keys(activePortfolios).every(b => gameData.teams?.[b]?.status === STATUS.SUBMITTED);
    if (allBracketsFull) {
      setView(VIEWS.SPECTATOR);
      showMessage("Tutti i posti sono stati occupati — sei in modalità spettatore", 'info');
    }
  }, [gameData, view]);

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
        const data = docSnap.data();
        const config = data.config || appConfig;
        const allBracketsFull = Object.keys(config).every(b => data.teams?.[b]?.status === STATUS.SUBMITTED);
        setGameId(upperCode);
        setIsTeamMember(false);
        if (allBracketsFull) {
          setGameData(data);
          setView(VIEWS.SPECTATOR);
          showMessage(`Aula ${upperCode} al completo — sei in modalità spettatore`, 'info');
        } else {
          setView(VIEWS.SETUP);
          showMessage(`Benvenuto nell'Aula ${upperCode}`, 'success');
        }
      } else {
        showMessage("Codice Aula inesistente.", "error");
      }
    } catch (error) {
      showMessage("Errore di connessione. Riprova.", "error");
    } finally {
      setIsJoining(false);
    }
  };

  const handleViewRoomFromLeaderboard = (roomId: string) => {
    const roomData = allGames.find(g => g.id === roomId);
    if (!roomData) return;
    setGameId(roomId);
    setGameData(roomData as any);
    setIsTeamMember(false);
    setPrevView(VIEWS.GLOBAL_LEADERBOARD);
    setView(VIEWS.SPECTATOR);
  };

  const handleViewGlobalLeaderboard = async (code: string) => {
    const upperCode = code.trim().toUpperCase();
    if (upperCode.length < 3) {
      showMessage("Inserisci il codice della tua aula per continuare.", "error");
      return;
    }
    setIsJoining(true);
    try {
      const docSnap = await getDoc(gameDocRef(upperCode));
      if (docSnap.exists()) {
        setPrevView(view);
        setView(VIEWS.GLOBAL_LEADERBOARD);
      } else {
        showMessage("Codice Aula inesistente.", "error");
      }
    } catch {
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

    const nameConflict = gameData?.teams
      ? Object.entries(gameData.teams).find(([bracket, team]: [string, any]) =>
          bracket !== selectedAge &&
          team.groupName?.toLowerCase().trim() === groupName.toLowerCase().trim()
        )
      : null;
    if (nameConflict) {
      showMessage(`Nome già usato da un altro gruppo. Scegli un nome diverso o entra come membro.`, "error");
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

  const handleJoinAsTeamMember = (age: string) => {
    setSelectedAge(age);
    setIsTeamMember(true);
    setActiveTab(age);
    setView(VIEWS.PLAY);
  };

  const handleInputChange = (productId, value) => {
    if (value === '' || (/^\d+$/.test(value) && parseInt(value) >= 0 && parseInt(value) <= 100)) {
      setLocalAllocations(prev => ({ ...prev, [productId]: value }));
    }
  };

  const currentTotal = Object.values(localAllocations).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
  const isPerfect = currentTotal === 100;

  const handleSubmitToCloud = async () => {
    if (!isPerfect || !user || !gameId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const docRef = gameDocRef(gameId);
      await updateDoc(docRef, {
        [`teams.${selectedAge}.allocations`]: localAllocations,
        [`teams.${selectedAge}.status`]: 'submitted'
      });
      showMessage("Portafoglio confermato! Il Game Master vi osserva.", "success");
    } catch (error) {
      showMessage("Errore durante la conferma definitiva.", "error");
    } finally {
      setIsSubmitting(false);
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

  const handlePasswordReset = async () => {
    if (!adminEmail.trim()) {
      showMessage("Inserisci la tua email per ricevere il link di reset.", "error");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, adminEmail.trim().toLowerCase());
      showMessage("Email di reset inviata! Controlla la casella di posta.", "success");
    } catch {
      showMessage("Errore nell'invio dell'email. Verifica che l'indirizzo sia corretto.", "error");
    }
  };

  const handleAdminEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword) return;
    setIsLoggingIn(true);
    try {
      const result = await signInWithEmailAndPassword(auth, adminEmail.trim().toLowerCase(), adminPassword);
      const email = result.user.email?.toLowerCase();
      if (!email) throw new Error("Email non trovata");
      const adminDoc = await getDoc(adminDocRef(email));
      if (adminDoc.exists()) {
        setIsAdmin(true);
        setShowAdminLogin(false);
        setAdminEmail('');
        setAdminPassword('');
        setView(VIEWS.ADMIN_LOBBY);
        showMessage(`Benvenuto, ${email}`, "success");
      } else {
        await signOut(auth);
        await signInAnonymously(auth);
        setIsAdmin(false);
        showMessage("Accesso negato: questa email non è autorizzata.", "error");
      }
    } catch (error: any) {
      console.error("Email Login Error:", error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        showMessage("Email o password non corretti.", "error");
      } else {
        showMessage("Errore durante l'accesso.", "error");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLeaveRoom = () => {
    setGameId('');
    setGameData(null);
    setGroupName('');
    setSelectedAge('');
    setIsTeamMember(false);
    setView(VIEWS.JOIN);
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

  const isValidPortfoliosConfig = (cfg: unknown): cfg is PortfoliosConfig => {
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return false;
    const brackets = cfg as Record<string, unknown>;
    if (Object.keys(brackets).length === 0) return false;
    return Object.values(brackets).every(b => {
      if (!b || typeof b !== 'object' || Array.isArray(b)) return false;
      const bracket = b as Record<string, unknown>;
      if (typeof bracket.title !== 'string' || typeof bracket.focus !== 'string') return false;
      if (!Array.isArray(bracket.products) || bracket.products.length === 0) return false;
      return (bracket.products as unknown[]).every(p => {
        if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
        const prod = p as Record<string, unknown>;
        return typeof prod.id === 'string' && typeof prod.name === 'string' &&
               typeof prod.desc === 'string' && prod.metrics !== null && typeof prod.metrics === 'object';
      });
    });
  };

  const handleImportConfig = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsedConfig = JSON.parse(event.target.result);
        if (isValidPortfoliosConfig(parsedConfig)) {
          if (!window.confirm("Sostituire la configurazione prodotti attuale? Questa operazione sovrascriverà i prodotti della stanza in corso.")) return;
          setAppConfig(parsedConfig);
          if (gameId) {
            const docRef = gameDocRef(gameId);
            await updateDoc(docRef, { config: parsedConfig });
          }
          showMessage("Nuova configurazione caricata con successo!", "success");
        } else {
          showMessage("Formato JSON non valido. Verificare che ogni fascia abbia title, focus e products con id, name, desc, metrics.", "error");
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
    const confirm = window.prompt(`Per eliminare l'aula digita il codice: ${idToDel}`);
    if (confirm?.trim().toUpperCase() !== idToDel) {
      if (confirm !== null) showMessage("Codice errato. Aula non eliminata.", "error");
      return;
    }
    try {
      await deleteDoc(gameDocRef(idToDel));
      if (idToDel === gameId) setView(VIEWS.ADMIN_LOBBY);
      showMessage("Aula eliminata.", "info");
    } catch(e) {
      showMessage("Errore durante l'eliminazione.", "error");
    }
  };

  const unlockTeamAllocation = async (ageBracket) => {
    if (!window.confirm(`Sbloccare l'allocazione di ${gameData?.teams?.[ageBracket]?.groupName}? Potranno modificarla e riconsegnarla.`)) return;
    try {
      await updateDoc(gameDocRef(gameId), { [`teams.${ageBracket}.status`]: STATUS.DRAFT });
      showMessage(`Allocazione ${ageBracket} sbloccata.`, 'info');
    } catch (e) {
      showMessage("Errore durante lo sblocco.", "error");
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

    const systemPrompt = `Sei il Game Master del "Longevity Game".
La tua identità: Chief Investment Strategist con 25 anni sui mercati globali.
Leggi ogni evento — economico o di vita — attraverso la lente dell'impatto finanziario sul portafoglio del cliente.
Tono: autorevole, teatrale, ironico. Premi le scelte tecnicamente solide, demolisci quelle ingenue. Una frecciata ben piazzata vale più di un paragrafo.

EVENTI: l'evento può essere di qualsiasi natura — macroeconomica (a titolo esemplificativo: geopolitica, inflazione, recessione, spread creditizi, rally, tassi, valute) o di vita personale (a titolo esemplificativo: eventi familiari, lavorativi, sanitari, successori) — sia positivi che negativi in egual misura. La scelta è completamente libera e non vincolata dall'ordine degli esempi.
Gli eventi macroeconomici si applicano identici a tutti i team.
Gli eventi di vita personale, se pertinenti, possono essere adattati alla fascia d'età (es. "nascita figlio" per 25-50, "nascita nipote" per 70+).
In ogni caso, valuta sempre l'impatto finanziario sul portafoglio del cliente.

PAC (Piano di Accumulo del Capitale): quando l'evento è un calo dei mercati azionari, i prodotti con metodologia PAC non vanno penalizzati come l'azionario puro. Il PAC si nutre della volatilità: acquistare quote a prezzi più bassi abbassa il prezzo medio di carico e migliora i rendimenti futuri. Modula il giudizio in base all'orizzonte temporale della fascia:
- 0-25 anni: massimo beneficio. Orizzonte lunghissimo, ogni calo è un'opportunità di accumulo straordinaria. Tono quasi entusiasta.
- 25-50 anni: forte beneficio. Il dollar-cost averaging lavora a pieno regime. Tono rassicurante.
- 50-70 anni: beneficio moderato. La fase di accumulo residua è più breve, ma il PAC attenua comunque lo shock. Tono neutro, senza allarmismi.
- 70+ anni: beneficio limitato. L'orizzonte è più breve e la tolleranza alla volatilità ridotta, ma il PAC resta meno penalizzante dell'azionario puro. Tono cauto ma non catastrofico.

VALUTAZIONE: usa le metriche tecniche fornite per ciascun prodotto (disponibili nel JSON) per giustificare ogni voto con precisione chirurgica.
Premia chi era posizionato per cogliere l'opportunità o assorbire lo shock. Punteggio da 1 a 10.

STILE — TASSATIVO:
- Scenario: massimo 3 righe. Titolo ad effetto, descrizione immediata
- Valutazione per team: massimo 2-3 righe. Voto, motivazione tecnica, una battuta finale tagliente
- Sii pungente, non prolisso. Una frecciata ben piazzata vale più di un paragrafo`;

    const hintClause = aiHint.trim()
      ? `\n\nSuggerimento dell'istruttore (usalo come ispirazione per l'evento): "${aiHint.trim()}"`
      : '';
    const userQuery = `Ecco i portafogli delle squadre in gara, completi di metriche finanziarie per ciascun prodotto. Genera un evento e valuta i portafogli.${hintClause}\n\n${JSON.stringify(submittedTeams, null, 2)}`;

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

    const callAI = async () => {
      const functionUrl = import.meta.env.VITE_AI_FUNCTION_URL || '/.netlify/functions/generate-event';
      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.status === 429) throw new Error('Servizio AI momentaneamente sovraccarico. Riprova tra qualche secondo.');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || errorData.message || `Errore server: ${res.status}`);
      }
      return await res.json();
    };

    try {
      const result = await callAI();
      const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (textResponse) {
        const parsedData = JSON.parse(textResponse);
        const newEvent = {
          ...parsedData,
          timestamp: Date.now(),
          ...(aiHint.trim() && { hintUsed: aiHint.trim() })
        };
        
        const currentEvents = gameData.events || [];
        const updates = { events: [newEvent, ...currentEvents] };
        
        parsedData.evaluations.forEach(ev => {
           const currentScore = gameData.teams[ev.ageBracket]?.totalScore || 0;
           updates[`teams.${ev.ageBracket}.totalScore`] = currentScore + ev.score;
        });

        const docRef = gameDocRef(gameId);
        await updateDoc(docRef, updates);
        
        setAiHint('');
        showMessage("Evento generato e punteggi aggiornati!", "success");
      }
    } catch (error) {
      console.error("Errore Gemini:", error);
      const msg = error instanceof Error ? error.message : "Errore durante la generazione dell'imprevisto.";
      showMessage(msg, "error");
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

  const globalTeams = useMemo(() => {
    return allGames.flatMap(game =>
      Object.entries(game.teams || {}).map(([age, team]: [string, any]) => ({
        roomId: game.id,
        age,
        groupName: team.groupName,
        totalScore: team.totalScore || 0,
        status: team.status,
        roomRounds: (game as any).events?.length || 0,
      }))
    )
    .filter(t => t.status === STATUS.SUBMITTED)
    .sort((a, b) => b.totalScore - a.totalScore);
  }, [allGames]);

  const globalByBracket = useMemo(() => {
    const brackets: Record<string, typeof globalTeams> = {};
    globalTeams.forEach(t => {
      if (!brackets[t.age]) brackets[t.age] = [];
      brackets[t.age].push(t);
    });
    return brackets;
  }, [globalTeams]);

  const Leaderboard = () => {
     if (!gameData || !gameData.teams) return null;

     if (rankedTeams.length === 0) return null;


     return (
       <div className="mb-8 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
         <h3 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">
           <span>🏆</span> Classifica Generale
         </h3>
         <div className="grid grid-cols-4 gap-3">
           {rankedTeams.map((t, idx) => (
             <div key={t.age} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${idx === 0 ? 'bg-[#FCE5CC] border-[#F9CB99]' : 'bg-slate-50 border-slate-200'}`}>
                <span className={`text-xl font-black flex-shrink-0 ${idx === 0 ? 'text-[#F07D00]' : 'text-slate-400'}`}>#{idx + 1}</span>
                <div className="min-w-0">
                   <div className="font-bold text-slate-800 leading-tight truncate">{t.groupName}</div>
                   <div className={`text-sm font-black ${idx === 0 ? 'text-[#F07D00]' : 'text-[#39B2B6]'}`}>{t.totalScore || 0} pt</div>
                </div>
             </div>
           ))}
         </div>
       </div>
     );
  };

  const deleteAIEvent = async (eventIndex: number) => {
    if (!gameId || !gameData?.events) return;
    if (!window.confirm('Eliminare questo imprevisto? I punti assegnati verranno sottratti.')) return;

    const eventToDelete = gameData.events[eventIndex];
    const newEvents = gameData.events.filter((_, i) => i !== eventIndex);

    const updates: Record<string, any> = { events: newEvents };
    eventToDelete.evaluations.forEach((ev: any) => {
      const current = gameData.teams?.[ev.ageBracket]?.totalScore || 0;
      updates[`teams.${ev.ageBracket}.totalScore`] = Math.max(0, current - ev.score);
    });

    await updateDoc(gameDocRef(gameId), updates);
  };

  const EventsLog = () => {
    const events = gameData?.events || [];
    if (events.length === 0) return null;

    return (
      <div className="mt-8 space-y-6 pb-12">
        <h3 className="text-2xl font-black text-[#001C4B] flex items-center gap-2">
          <span>✨</span> Cronache del Game Master
        </h3>
        {events.map((ev, idx) => (
          <div key={idx} className="bg-white rounded-3xl shadow-xl overflow-hidden border-2 border-[#CCD9EA] animate-fade-in-up">
            <div className="bg-gradient-to-r from-[#004F9F] to-[#009EE0] p-6 text-white relative">
              {isAdmin && view === VIEWS.ADMIN_ROOM && (
                <button
                  onClick={() => deleteAIEvent(idx)}
                  className="absolute top-4 right-4 bg-white/20 hover:bg-[#E6325E] text-white text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
                  title="Elimina imprevisto"
                >
                  🗑️ Elimina
                </button>
              )}
              <span className="bg-white/20 text-[#EBF4FB] text-xs font-bold px-3 py-1 rounded-full mb-3 inline-block uppercase tracking-wider">
                {new Date(ev.timestamp).toLocaleTimeString('it-IT')} - Imprevisto #{events.length - idx}{ev.hintUsed ? ' (su suggerimento)' : ''}
              </span>
              <h4 className="text-2xl font-black mb-2">{ev.scenarioTitle}</h4>
              <p className="text-[#CCD9EA] leading-relaxed font-medium text-base md:text-lg">{ev.scenarioDescription}</p>
            </div>
            <div className="p-6 bg-slate-50 grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...ev.evaluations].sort((a, b) => b.score - a.score).map((evalItem, i) => {
                const isGood = evalItem.score >= 7;
                const isBad = evalItem.score < 5;
                return (
                  <div key={i} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-2 h-full ${isGood ? 'bg-[#39B2B6]' : isBad ? 'bg-[#E6325E]' : 'bg-[#F07D00]'}`}></div>
                    <div className="pl-3 flex justify-between items-start mb-2">
                      <div>
                        <h5 className="font-bold text-slate-800">{evalItem.teamName}</h5>
                        <span className="text-xs text-slate-500 font-bold">{evalItem.ageBracket} anni</span>
                      </div>
                      <div className={`text-2xl font-black ${isGood ? 'text-[#39B2B6]' : isBad ? 'text-[#E6325E]' : 'text-[#F07D00]'}`}>
                        +{evalItem.score} pt
                      </div>
                    </div>
                    <p className="pl-3 text-base text-slate-600 italic">{evalItem.feedback}</p>
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
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-xl shadow-2xl font-bold text-white transition-all transform animate-fade-in-down ${notification.type === 'error' ? 'bg-[#E6325E]' : notification.type === 'success' ? 'bg-[#39B2B6]' : 'bg-[#004F9F]'}`}>
          {notification.message}
        </div>
      )}

      {/* Simulatore Smartphone (solo nelle view admin) */}
      {isAdmin && !isSimulator && (view === VIEWS.ADMIN_LOBBY || view === VIEWS.ADMIN_ROOM) && (
        <>
          <button 
            onClick={() => setShowSimulator(!showSimulator)} 
            className="fixed bottom-6 right-6 bg-[#004F9F] text-white w-16 h-16 rounded-full shadow-[0_0_20px_rgba(79,70,229,0.4)] z-50 hover:bg-[#EBF4FB]0 transition-transform transform hover:scale-110 flex items-center justify-center text-3xl border-2 border-[#6693BF]"
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
                 {editingTeam.isNew ? 'Crea Squadra Manualmente' : 'Modifica Squadra'} <span className="text-[#004F9F]">({editingTeam.ageBracket} anni)</span>
              </h2>
              <div className="space-y-4">
                 <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Nome Team</label>
                    <input
                      type="text"
                      value={editingTeam.groupName}
                      onChange={e => setEditingTeam({...editingTeam, groupName: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 font-bold text-slate-800 focus:border-[#004F9F] outline-none"
                    />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Allocazioni (%)</label>
                    {activePortfolios[editingTeam.ageBracket].products.map(p => (
                       <div key={p.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="min-w-0 pr-2">
                             <div className="text-sm font-bold text-slate-700 leading-tight truncate">{p.name}</div>
                             <div className="text-[10px] font-semibold text-[#004F9F] mt-0.5 truncate">{p.desc}</div>
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
                 <button onClick={saveAdminEdit} className="px-5 py-3 bg-[#004F9F] text-white font-bold rounded-xl shadow-md hover:bg-[#003063] transition-colors">Salva e Conferma</button>
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

            {/* Form email/password */}
            <form onSubmit={handleAdminEmailLogin} className="mb-4 text-left">
              <input
                type="email"
                placeholder="Email"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                disabled={isLoggingIn}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 mb-3 text-sm focus:outline-none focus:border-[#004F9F] disabled:bg-slate-50"
              />
              <input
                type="password"
                placeholder="Password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                disabled={isLoggingIn}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 mb-3 text-sm focus:outline-none focus:border-[#004F9F] disabled:bg-slate-50"
              />
              <div className="text-right mb-3">
                <button type="button" onClick={handlePasswordReset} className="text-xs text-[#004F9F] hover:underline">
                  Password dimenticata?
                </button>
              </div>
              <button
                type="submit"
                disabled={isLoggingIn || !adminEmail.trim() || !adminPassword}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${isLoggingIn || !adminEmail.trim() || !adminPassword ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-[#004F9F] hover:bg-[#003063] text-white'}`}
              >
                {isLoggingIn ? 'Accesso in corso...' : 'Accedi'}
              </button>
            </form>

            {/* Separatore */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">oppure</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Google OAuth */}
            <button
              onClick={handleAdminGoogleLogin}
              disabled={isLoggingIn}
              className={`w-full flex items-center justify-center gap-3 border-2 p-3 rounded-xl mb-4 font-bold text-sm transition-all shadow-sm ${isLoggingIn ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200 hover:border-[#004F9F] text-slate-700 hover:shadow-md'}`}
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              Accedi con Google
            </button>

            <button onClick={() => { setShowAdminLogin(false); setAdminEmail(''); setAdminPassword(''); }} className="text-slate-400 hover:text-slate-600 font-bold text-sm">Annulla</button>
          </div>
        </div>
      )}

      {/* HEADER GLOBALE */}
      <header className={`max-w-6xl w-full bg-white rounded-3xl shadow-sm border-t-8 border-[#004F9F] overflow-hidden ${isSimulator ? 'mb-4' : 'mb-8'}`}>
        {/* Titolo */}
        <div className={isSimulator ? 'p-4 text-center' : 'p-6 md:p-8 text-center'}>
          <h1
            className={`font-black text-[#001C4B] tracking-tight transition-colors ${isSimulator ? 'text-2xl cursor-default' : 'text-4xl md:text-5xl cursor-pointer hover:text-[#004F9F]'}`}
            onClick={() => { if(!isSimulator) { if(!isAdmin) setShowAdminLogin(true); else setView(VIEWS.ADMIN_LOBBY); } }}
            title={!isSimulator ? (isAdmin ? "Vai alla Lobby Admin" : "Clicca per Accesso Regia") : ""}
          >
            Longevity Game
          </h1>
        </div>

        {/* Barra bottoni — solo fuori dal simulatore e quando ci sono azioni disponibili */}
        {!isSimulator && user && (isAdmin || gameId) && (
          <div className="border-t border-slate-100 px-6 md:px-8 py-2 flex justify-end items-center gap-2">
            {isAdmin && view === VIEWS.ADMIN_ROOM && (
              <button
                onClick={() => setView(VIEWS.ADMIN_LOBBY)}
                className="bg-slate-100 hover:bg-[#CCD9EA] text-slate-500 hover:text-[#004F9F] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                🏛️ Lobby
              </button>
            )}
            {view !== VIEWS.GLOBAL_LEADERBOARD && (
              <button
                onClick={() => { setPrevView(view); setView(VIEWS.GLOBAL_LEADERBOARD); }}
                className="bg-slate-100 hover:bg-[#EBF4FB] text-slate-500 hover:text-[#004F9F] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                🌍 Globale
              </button>
            )}
            {isAdmin ? (
              <button
                onClick={handleLogout}
                className="bg-slate-100 hover:bg-[#FAD5DE] text-slate-500 hover:text-[#E6325E] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                🚪 Esci
              </button>
            ) : (
              gameId && (
                <button
                  onClick={handleLeaveRoom}
                  className="bg-slate-100 hover:bg-[#FAD5DE] text-slate-500 hover:text-[#E6325E] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  🚪 Esci
                </button>
              )
            )}
          </div>
        )}
      </header>

      {/* VISTA 0: INSERIMENTO CODICE AULA */}
      {view === VIEWS.JOIN && user && (
         <main className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden animate-fade-in-up p-8 text-center border border-slate-100">
            <div className="w-20 h-20 bg-[#CCD9EA] text-[#004F9F] rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">🏢</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Entra in Aula</h2>
            <p className="text-slate-500 mb-6 text-sm">Inserisci il codice proiettato dall'istruttore per unirti alla partita.</p>
            
            <input 
              type="text" 
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-4 text-center text-xl font-black text-slate-800 tracking-wider uppercase focus:border-[#004F9F] outline-none transition-colors mb-6"
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
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400 mb-3">Hai già partecipato a una sessione?</p>
              <button
                onClick={() => handleViewGlobalLeaderboard(joinCodeInput)}
                disabled={isJoining}
                className="w-full text-[#004F9F] font-bold text-sm p-3 rounded-xl border-2 border-[#CCD9EA] hover:bg-[#EBF4FB] transition-colors"
              >
                🌍 Vedi Classifica Globale
              </button>
            </div>

            {/* DISCLAIMER LEGALE */}
            <div className="mt-6 pt-4 border-t border-slate-100 text-left">
              <button
                onClick={() => setShowFullDisclaimer(v => !v)}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors w-full"
              >
                <span>⚖️</span>
                <span>Disclaimer legale</span>
                <span className="ml-auto">{showFullDisclaimer ? '▲' : '▼'}</span>
              </button>

              {!showFullDisclaimer && (
                <p className="mt-2 text-[10px] text-slate-400 leading-relaxed">
                  Applicazione a scopo esclusivamente formativo e ludico. I contenuti non costituiscono consulenza in materia di investimenti ai sensi del D.Lgs. 58/1998 (TUF) e della Direttiva 2014/65/UE (MiFID II).{' '}
                  <button onClick={() => setShowFullDisclaimer(true)} className="underline hover:text-slate-600">Leggi tutto</button>
                </p>
              )}

              {showFullDisclaimer && (
                <div className="mt-3 text-[10px] text-slate-400 leading-relaxed space-y-2">
                  <p><strong className="text-slate-500">Natura del servizio.</strong> Longevity Game è un'applicazione web a finalità esclusivamente formativa e ludica, sviluppata per supportare sessioni di educazione finanziaria. Non costituisce, in nessuna circostanza, prestazione di servizi di investimento ai sensi dell'art. 1, comma 5, del D.Lgs. 24 febbraio 1998, n. 58 (Testo Unico della Finanza) e della Direttiva 2014/65/UE (MiFID II).</p>
                  <p><strong className="text-slate-500">Non è consulenza finanziaria.</strong> Le allocazioni di portafoglio generate nell'ambito del gioco, i punteggi attribuiti e i feedback dell'intelligenza artificiale non costituiscono raccomandazioni personalizzate di investimento ai sensi dell'art. 1, comma 5-septies, TUF, né sollecitazione all'investimento, offerta al pubblico di strumenti finanziari o qualsiasi altro servizio regolamentato ai sensi della normativa vigente.</p>
                  <p><strong className="text-slate-500">Prodotti illustrativi.</strong> I prodotti e gli strumenti finanziari eventualmente menzionati sono utilizzati a scopo puramente illustrativo ed educativo. La loro inclusione nel gioco non implica alcuna raccomandazione di acquisto, sottoscrizione o disinvestimento, né alcun riferimento a prodotti reali commercializzati da soggetti specifici.</p>
                  <p><strong className="text-slate-500">Divieto di utilizzo dei risultati.</strong> I risultati, le allocazioni e i punteggi ottenuti nel corso del gioco non devono essere condivisi, comunicati o utilizzati in alcun modo come consigli di investimento nei confronti di terzi. L'utilizzo dei contenuti del gioco in contesti diversi da quello formativo per cui è stato progettato è espressamente escluso.</p>
                  <p><strong className="text-slate-500">Rischi degli investimenti.</strong> Qualsiasi investimento in strumenti finanziari comporta rischi, inclusa la perdita parziale o totale del capitale investito. I rendimenti simulati non costituiscono indicazione di risultati futuri e non hanno valore predittivo.</p>
                  <p><strong className="text-slate-500">Accesso alle sessioni.</strong> L'accesso a sessioni di gioco è riservato ai partecipanti espressamente autorizzati dal facilitatore. L'accesso non autorizzato è contrario alle condizioni d'uso dell'applicazione. I contenuti delle sessioni sono strettamente riservati ai partecipanti autorizzati e non possono essere divulgati a terzi.</p>
                </div>
              )}
            </div>
         </main>
      )}

      {/* VISTA 1: SETUP GIOCATORE */}
      {view === VIEWS.SETUP && user && (
        <main className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden animate-fade-in-up border border-slate-100">
          <div className="bg-[#004F9F] text-white p-3 text-center font-bold tracking-widest text-xs">
            AULA: {gameId}
          </div>
          <div className="p-6 md:p-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">Configura la Squadra</h2>
            
            {(() => {
              const matchEntry = gameData?.teams
                ? Object.entries(gameData.teams).find(([_, team]: [string, any]) =>
                    team.groupName?.toLowerCase().trim() === groupName.toLowerCase().trim() &&
                    groupName.trim().length >= 2
                  )
                : null;
              const matchedAge = matchEntry?.[0];
              const matchedTeamData = matchEntry?.[1] as any;

              return (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2">Nome del Team</label>
                    <input
                      type="text"
                      className={`w-full bg-slate-50 border-2 rounded-xl p-3 text-lg font-bold text-slate-800 outline-none transition-colors ${matchedAge ? 'border-[#39B2B6] focus:border-[#39B2B6]' : 'border-slate-200 focus:border-[#004F9F]'}`}
                      placeholder="es. Lupi di Wall Street"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                    />
                  </div>

                  {matchedAge ? (
                    <>
                      <div className="bg-[#D8F0F1] border border-[#88D0D2] rounded-xl p-4 flex items-center gap-3">
                        <span className="text-2xl">👥</span>
                        <div>
                          <p className="font-black text-[#1D7A7D] text-sm">Gruppo trovato!</p>
                          <p className="text-xs text-[#2A8A8D] font-medium">
                            <strong>{matchedTeamData.groupName}</strong> — fascia {matchedAge} anni
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleJoinAsTeamMember(matchedAge)}
                        className="w-full bg-[#39B2B6] hover:bg-[#2A8A8D] text-white font-bold text-lg p-4 rounded-xl shadow-lg transition-colors"
                      >
                        Entra come membro 👥
                      </button>
                    </>
                  ) : (
                    <>
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
                                      ? 'border-[#004F9F] bg-[#EBF4FB] text-[#003063] shadow-inner'
                                      : 'border-slate-200 bg-white text-slate-500 hover:border-[#6693BF] hover:bg-slate-50'
                                }`}
                              >
                                <span className="text-sm">{age} anni</span>
                                {isOccupied && (
                                  <span className="text-[10px] font-bold text-[#E6325E] truncate w-full text-center">
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
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        </main>
      )}

      {/* VISTA 2: PLAY */}
      {view === VIEWS.PLAY && (
        <main className="max-w-4xl w-full animate-fade-in-up">
          
          <div className="flex justify-between items-center mb-4 px-2">
             <div className="bg-white px-3 py-1.5 rounded-full shadow-sm font-bold text-[#003063] border border-[#CCD9EA] flex items-center gap-2 text-sm">
               <span className="text-[10px] bg-[#004F9F] text-white px-2 py-0.5 rounded">AULA {gameId}</span>
               <span>👤</span> <span className="truncate max-w-[100px] md:max-w-[150px]">{groupName}</span>
             </div>
             
             {/* Punteggio Live Squadra */}
             <div className="flex items-center gap-2 bg-[#FCE5CC] text-[#C06300] border border-[#F9CB99] px-4 py-1.5 rounded-full shadow-sm font-black text-sm">
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
                        ? 'bg-white text-[#003063] border-b-4 border-b-teal-600 shadow-sm' 
                        : 'text-slate-500 hover:bg-slate-200'}`}
                  >
                    <span className="flex items-center gap-1">
                      {tab}
                      {tabTeam?.status === STATUS.SUBMITTED && <span title="Completato">✔️</span>}
                      {tabTeam?.status === STATUS.DRAFT && !isMyTab && <span title="In lavorazione" className="animate-pulse text-[#F07D00]">⏳</span>}
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
                  <div className={`p-4 md:p-6 border-b ${isMyTab ? 'bg-slate-50 border-slate-100' : 'bg-[#EBF4FB] border-[#CCD9EA]'}`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <h2 className="text-xl md:text-2xl font-black text-slate-800">{activePortfolios[activeTab].title}</h2>
                        <p className={`font-bold mt-1 text-xs md:text-sm flex items-center gap-1 ${isMyTab ? 'text-[#003063]' : 'text-[#003063]'}`}>
                          {activePortfolios[activeTab].focus}
                        </p>
                      </div>
                      {!isMyTab && (
                        <div className="bg-[#004F9F] text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-2 shadow-md w-max">
                          <span className="text-lg">👀</span> 
                          <div>
                            <div className="text-[10px] text-[#99B5D5] leading-tight">Spia:</div>
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
                          !isMyTab ? 'bg-white border-[#CCD9EA] opacity-90' : 
                          isDisabled ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-100 hover:border-[#99B5D5] shadow-sm'
                        }`}>
                          <div className="flex items-center flex-1 mr-2 min-w-0">
                            <span className="text-2xl md:text-3xl mr-3 flex-shrink-0">{prod.icon}</span>
                            <div className="flex flex-col min-w-0">
                              <h3 className="font-bold text-sm md:text-base text-slate-800 leading-tight truncate">{prod.name}</h3>
                              <p className="text-[10px] md:text-xs font-semibold text-[#004F9F] leading-tight mt-0.5 truncate">{prod.desc}</p>
                            </div>
                          </div>
                          
                          <div className={`flex items-center border-2 rounded-lg overflow-hidden transition-all w-20 md:w-28 flex-shrink-0 ${
                            !isMyTab ? 'bg-[#EBF4FB] border-[#99B5D5]' :
                            isDisabled ? 'bg-slate-200 border-slate-300' : 'bg-slate-50 border-slate-200 focus-within:border-[#004F9F]'
                          }`}>
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder={spiedTeam || isMyTab ? "0" : "-"}
                              value={displayValue}
                              onChange={(e) => handleInputChange(prod.id, e.target.value)}
                              disabled={isDisabled}
                              className={`w-full text-center text-lg md:text-xl font-black p-2 outline-none bg-transparent ${
                                !isMyTab ? 'text-[#001C4B] cursor-not-allowed' :
                                isDisabled ? 'text-slate-500 cursor-not-allowed' : 'text-slate-800'
                              }`}
                            />
                            <span className={`px-2 font-black text-sm h-full flex items-center border-l-2 ${
                               !isMyTab ? 'border-[#99B5D5] text-[#6693BF]' :
                               isDisabled ? 'border-slate-300 text-slate-400' : 'border-slate-200 text-slate-400'
                            }`}>%</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {isMyTab && (
                    isTeamMember && isMyTeamLocked ? (
                      <div className="p-5 bg-[#EBF4FB] border-t border-[#CCD9EA] flex items-center gap-3">
                        <span className="text-2xl">👥</span>
                        <div>
                          <p className="font-black text-[#003063] text-sm">Modalità membro</p>
                          <p className="text-xs text-slate-500">Il portafoglio è stato consegnato</p>
                        </div>
                      </div>
                    ) : (
                      <div className={`p-5 transition-colors duration-500 ${isMyTeamLocked ? 'bg-[#D8F0F1]' : isPerfect ? 'bg-[#EBF4FB]' : 'bg-white border-t border-slate-100'}`}>
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                          <div className="text-center md:text-left">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Il tuo Totale</p>
                            <h3 className={`text-3xl font-black ${isMyTeamLocked ? 'text-[#39B2B6]' : isPerfect ? 'text-[#004F9F]' : currentTotal > 100 ? 'text-[#E6325E]' : 'text-slate-800'}`}>
                              {currentTotal}%
                            </h3>
                          </div>
                          {!isMyTeamLocked && (
                            <button
                              onClick={handleSubmitToCloud}
                              disabled={!isPerfect || isSubmitting}
                              className={`w-full md:w-auto px-6 py-3 rounded-xl font-black text-base shadow-lg transition-all transform ${
                                isPerfect && !isSubmitting
                                  ? 'bg-[#004F9F] hover:bg-[#EBF4FB]0 text-white hover:-translate-y-1'
                                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              {isSubmitting ? 'Conferma in corso...' : isPerfect ? 'Conferma Definitiva' : `Mancano ${100 - currentTotal}%`}
                            </button>
                          )}
                          {isMyTeamLocked && (
                            <div className="text-[#2A8A8D] font-bold text-center md:text-right leading-tight">
                              <span className="block text-xl mb-1">✅</span>
                              Consegna Registrata.
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </div>
              );
            })()}
          </div>

          {/* Area Risultati IA per i giocatori */}
          <EventsLog />

        </main>
      )}

      {/* VISTA 2B: SPETTATORE */}
      {view === VIEWS.SPECTATOR && gameData && activePortfolios && (
        <main className="max-w-6xl w-full animate-fade-in-up pb-12">

          {/* Banner spettatore */}
          <div className="mb-6 flex items-center gap-3 bg-white border-2 border-[#CCD9EA] rounded-2xl px-6 py-4 shadow-sm w-full">
            <span className="text-3xl">👁</span>
            <div>
              <h2 className="font-black text-[#003063] text-xl leading-tight">Modalità Spettatore</h2>
              <p className="text-sm text-slate-500 font-medium">Tutti i posti sono occupati — stai osservando in tempo reale.</p>
            </div>
            <span className="ml-auto bg-[#004F9F] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              AULA {gameId}
            </span>
          </div>

          {/* Classifica */}
          <Leaderboard />

          {/* Schede portafoglio di ciascuna fascia — sola lettura, ordinate per punteggio */}
          <div className="space-y-4 mb-8">
            {[
              ...rankedTeams.map(t => t.age),
              ...Object.keys(activePortfolios).filter(age => !gameData.teams?.[age] || gameData.teams[age].status !== STATUS.SUBMITTED)
            ].map(age => {
              const team = gameData.teams?.[age];
              const portfolio = activePortfolios[age];
              return (
                <div key={age} className="bg-white rounded-3xl shadow-sm border border-[#CCD9EA] overflow-hidden">
                  <div className="bg-[#EBF4FB] border-b border-[#CCD9EA] p-4 md:p-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-slate-800 text-lg">{portfolio.title}</h3>
                      <p className="text-xs font-semibold text-[#004F9F] mt-0.5">{portfolio.focus}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {team ? (
                        <>
                          <span className="text-sm font-bold text-slate-600">{team.groupName}</span>
                          <span className={`text-xs font-black px-3 py-1 rounded-full ${team.status === STATUS.SUBMITTED ? 'bg-[#D8F0F1] text-[#1D7A7D]' : 'bg-[#FCE5CC] text-[#C06300] animate-pulse'}`}>
                            {team.status === STATUS.SUBMITTED ? '✅ Consegnato' : '⏳ In corso'}
                          </span>
                          <span className="font-black text-[#39B2B6]">{team.totalScore || 0} pt</span>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 font-bold italic">Posto libero</span>
                      )}
                    </div>
                  </div>
                  {team && team.allocations && (
                    <div className="p-4 md:p-5 space-y-2">
                      {portfolio.products.map(prod => {
                        const val = team.allocations?.[prod.id] || '';
                        return (
                          <div key={prod.id} className="flex items-center p-2.5 rounded-xl border border-[#CCD9EA] bg-slate-50">
                            <span className="text-2xl mr-3 flex-shrink-0">{prod.icon}</span>
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="font-bold text-sm text-slate-800 truncate">{prod.name}</span>
                              <span className="text-[10px] font-semibold text-[#004F9F] truncate">{prod.desc}</span>
                            </div>
                            <div className="flex items-center border border-[#99B5D5] rounded-lg overflow-hidden bg-[#EBF4FB] w-20 flex-shrink-0">
                              <span className="flex-1 text-center font-black text-[#001C4B] py-1.5 text-base">{val || '—'}</span>
                              <span className="px-2 font-black text-xs border-l border-[#99B5D5] text-[#6693BF] self-stretch flex items-center">%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Cronache */}
          <EventsLog />

        </main>
      )}

      {/* VISTA 2C: CLASSIFICA GLOBALE */}
      {view === VIEWS.GLOBAL_LEADERBOARD && (
        <main className="max-w-6xl w-full animate-fade-in-up pb-12">

          {/* Banner */}
          <div className="mb-6 flex items-center gap-3 bg-white border-2 border-[#CCD9EA] rounded-2xl px-6 py-4 shadow-sm w-full">
            <span className="text-3xl">🌍</span>
            <div>
              <h2 className="font-black text-[#003063] text-xl leading-tight">Classifica Globale</h2>
              <p className="text-sm text-slate-500 font-medium">{allGames.length} aule in gioco — dati in tempo reale</p>
            </div>
            <button
              onClick={() => setView(prevView)}
              className="ml-auto bg-slate-100 hover:bg-[#CCD9EA] text-slate-600 hover:text-[#003063] px-4 py-2 rounded-xl text-sm font-bold transition-colors"
            >
              ← Torna
            </button>
          </div>

          {allGames.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center text-slate-400 border border-slate-100">
              <span className="text-5xl block mb-4">⏳</span>
              <p className="font-bold">Caricamento dati in corso...</p>
            </div>
          ) : (
            <>
              {/* CLASSIFICA ASSOLUTA */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 mb-6">
                <h3 className="text-xl font-black text-slate-800 mb-5 flex items-center gap-2">
                  <span>🏆</span> Classifica Assoluta
                </h3>
                {globalTeams.length === 0 ? (
                  <p className="text-slate-400 text-sm italic">Nessun gruppo ha ancora consegnato.</p>
                ) : (
                  <div className="space-y-2">
                    {globalTeams.slice(0, 3).map((t, idx) => (
                      <button key={`${t.roomId}-${t.age}`} onClick={() => handleViewRoomFromLeaderboard(t.roomId)} className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl border text-left transition-opacity hover:opacity-75 ${idx === 0 ? 'bg-[#FCE5CC] border-[#F9CB99]' : 'bg-slate-50 border-slate-200'}`}>
                        <span className={`text-lg font-black w-8 text-center flex-shrink-0 ${idx === 0 ? 'text-[#F07D00]' : 'text-slate-400'}`}>#{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-800 leading-tight truncate">{t.groupName}</div>
                          <div className="text-xs text-slate-500 font-medium">Aula {t.roomId} · {t.age} anni</div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <span className="text-xs bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                            {t.roomRounds}/{MAX_ROUNDS} round
                          </span>
                          <span className={`text-lg font-black ${idx === 0 ? 'text-[#F07D00]' : 'text-[#39B2B6]'}`}>
                            {t.totalScore} pt
                          </span>
                          <span className="text-slate-400 text-xs">→</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* CLASSIFICHE PER FASCIA */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
                <h3 className="text-xl font-black text-slate-800 mb-5 flex items-center gap-2">
                  <span>📊</span> Classifica per Fascia d'Età
                </h3>
                {Object.keys(globalByBracket).length === 0 ? (
                  <p className="text-slate-400 text-sm italic">Nessun gruppo ha ancora consegnato.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(globalByBracket)
                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                      .map(([age, teams]) => (
                        <div key={age}>
                          <h4 className="font-black text-[#004F9F] text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#004F9F] inline-block"></span>
                            Portafoglio {age} anni
                          </h4>
                          <div className="space-y-2">
                            {teams.slice(0, 3).map((t, idx) => (
                              <button key={`${t.roomId}-${t.age}-${idx}`} onClick={() => handleViewRoomFromLeaderboard(t.roomId)} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-left transition-opacity hover:opacity-75 ${idx === 0 ? 'bg-[#D8F0F1] border-[#88D0D2]' : 'bg-slate-50 border-slate-200'}`}>
                                <span className={`text-sm font-black w-6 text-center flex-shrink-0 ${idx === 0 ? 'text-[#1D7A7D]' : 'text-slate-400'}`}>#{idx + 1}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="font-bold text-slate-800 text-sm truncate">{t.groupName}</div>
                                  <div className="text-[10px] text-slate-500 font-medium">Aula {t.roomId}</div>
                                </div>
                                <span className={`font-black text-sm flex-shrink-0 ${idx === 0 ? 'text-[#1D7A7D]' : 'text-[#39B2B6]'}`}>
                                  {t.totalScore} pt
                                </span>
                                <span className="text-slate-400 text-xs flex-shrink-0">→</span>
                              </button>
                            ))}
                          </div>
                        </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
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
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl p-3 text-white placeholder-slate-400 focus:border-[#6693BF] outline-none font-bold text-center uppercase"
                  maxLength="15"
                />
                <button 
                  onClick={createNewGameRoom} 
                  disabled={!roomNameInput.trim()}
                  className={`px-8 py-3 rounded-xl font-black shadow-lg transition-transform transform ${roomNameInput.trim() ? 'bg-[#EBF4FB]0 hover:bg-[#6693BF] text-white hover:-translate-y-1' : 'bg-slate-600 text-slate-400 cursor-not-allowed'}`}
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
                    <span className="bg-[#EBF4FB] text-[#003063] font-black px-3 py-1 rounded-lg text-sm border border-[#CCD9EA]">
                      {activeTeamsCount}/4 Gruppi
                    </span>
                  </div>
                  
                  <div className="flex gap-2 mt-6">
                    <button 
                      onClick={() => { setGameId(game.id); setView(VIEWS.ADMIN_ROOM); }}
                      className="flex-1 bg-slate-100 hover:bg-[#004F9F] hover:text-white text-slate-700 font-bold py-3 rounded-xl transition-colors"
                    >
                      Entra / Proietta
                    </button>
                    <button 
                      onClick={() => deleteGameRoom(game.id)}
                      className="w-14 bg-white border border-[#F5ABBD] text-[#E6325E] hover:bg-[#E6325E] hover:text-white rounded-xl font-bold transition-colors flex items-center justify-center"
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
          
          <div className="bg-slate-800 text-white p-6 md:p-8 rounded-3xl shadow-2xl mb-8 border-4 border-[#004F9F] flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-center">
            
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
                <h2 className="text-3xl lg:text-4xl font-black mb-2 truncate">Regia Live | Aula: <span className="text-[#6693BF] tracking-widest">{gameId}</span></h2>
                <p className="text-slate-300 font-medium text-base lg:text-lg mb-2">
                  Inquadra il QR Code oppure vai su questo link:
                </p>
                {/* Contenitore URL blindato con inline styles per garantire il wrapping */}
                <div className="w-full max-w-full overflow-hidden bg-slate-900 px-4 py-3 rounded-lg border border-slate-700 mb-4">
                  <div className="font-mono text-[#99B5D5] text-xs sm:text-sm select-all" style={{ wordBreak: 'break-all', overflowWrap: 'break-word', whiteSpace: 'normal' }}>
                    {window.location.origin}{window.location.pathname}?room={gameId}
                  </div>
                </div>
              </div>
              
              {/* Bottoni Azione Sotto al Link */}
              <div className="mb-3">
                {(() => {
                  const eventCount = gameData?.events?.length || 0;
                  const isFirstRound = eventCount === 0;
                  if (isFirstRound) {
                    return (
                      <p className="mb-2">
                        <span className="bg-[#F07D00] text-white text-xs font-bold px-3 py-1 rounded-full">
                          ✨ Round 1 — la AI decide liberamente il destino dei portafogli
                        </span>
                      </p>
                    );
                  }
                  const sortedBrackets = Object.keys(activePortfolios).sort((a, b) => parseInt(a) - parseInt(b));
                  const hintTeam = sortedBrackets[(eventCount - 1) % sortedBrackets.length];
                  return hintTeam ? (
                    <p className="mb-2">
                      <span className="bg-[#F07D00] text-white text-xs font-bold px-3 py-1 rounded-full">
                        🎯 Turno {gameData?.teams?.[hintTeam]?.groupName || `fascia ${hintTeam} anni`}
                      </span>
                    </p>
                  ) : null;
                })()}
                <textarea
                  value={aiHint}
                  onChange={(e) => setAiHint(e.target.value)}
                  disabled={isGeneratingAI || (gameData?.events?.length || 0) === 0}
                  placeholder={(gameData?.events?.length || 0) === 0 ? 'Round 1: nessun hint, la AI è libera di scegliere' : 'Scrivi qui il suggerimento del team di turno... (opzionale)'}
                  rows={2}
                  className={`w-full border rounded-xl p-3 text-sm placeholder-slate-400 resize-none focus:outline-none transition-colors ${(gameData?.events?.length || 0) === 0 ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-50 border-slate-200 text-slate-700 focus:border-[#6693BF]'}`}
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={generateAIEvent}
                  disabled={isGeneratingAI || (gameData?.events?.length || 0) >= MAX_ROUNDS}
                  className={`px-6 py-3 rounded-2xl font-black text-base shadow-lg transition-transform transform flex-1 text-center text-white ${isGeneratingAI || (gameData?.events?.length || 0) >= MAX_ROUNDS ? 'bg-[#6693BF] cursor-not-allowed' : 'bg-gradient-to-r from-[#1596C8] to-[#004F9F] hover:scale-105'}`}
                >
                  {isGeneratingAI
                    ? '✨ Elaborazione...'
                    : (gameData?.events?.length || 0) >= MAX_ROUNDS
                      ? `✅ ${MAX_ROUNDS}/${MAX_ROUNDS} Round completati`
                      : `✨ Scatena Imprevisto AI (${gameData?.events?.length || 0}/${MAX_ROUNDS})`}
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
            {[
              ...rankedTeams.map(t => t.age),
              ...Object.keys(activePortfolios).filter(age => !gameData.teams?.[age] || gameData.teams[age].status !== STATUS.SUBMITTED)
            ].map(ageBracket => {
              const team = gameData.teams?.[ageBracket];
              const isOccupied = !!team;
              const isSubmitted = team?.status === STATUS.SUBMITTED;
              const groupTotal = team ? Object.values(team.allocations).reduce((sum, val) => sum + (parseInt(val) || 0), 0) : 0;
              const teamScore = team?.totalScore || 0;
              
              return (
                <div key={ageBracket} className={`bg-white rounded-3xl shadow-lg border-2 overflow-hidden transition-all flex flex-col h-full ${!isOccupied ? 'border-dashed border-slate-200 opacity-60' : isSubmitted ? 'border-[#39B2B6]' : 'border-[#F6B166]'}`}>
                  <div className={`p-4 border-b flex justify-between items-center ${!isOccupied ? 'bg-slate-50' : isSubmitted ? 'bg-[#D8F0F1] border-[#B1E0E2]' : 'bg-[#FCE5CC] border-[#FCE5CC]'}`}>
                    <div className="flex-1 min-w-0 pr-4">
                      <h3 className="font-black text-slate-800 text-xl truncate">{isOccupied ? team.groupName : 'In attesa...'}</h3>
                      <span className="text-sm font-bold text-slate-500">{ageBracket} anni</span>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {isOccupied ? (
                          <>
                             <div className="flex items-center gap-1 bg-white text-[#F07D00] px-3 py-1 rounded-full text-sm font-black border border-[#F9CB99] shadow-sm">
                                <span>🏆</span> {teamScore} pt
                             </div>
                             {isSubmitted ? (
                               <button
                                 onClick={() => unlockTeamAllocation(ageBracket)}
                                 title="Clicca per sbloccare l'allocazione"
                                 className="px-3 py-1 rounded-full text-xs font-black border bg-[#B1E0E2] text-[#1E6365] border-[#88D0D2] hover:bg-[#FCE5CC] hover:text-[#C06300] hover:border-[#F9CB99] transition-colors cursor-pointer"
                               >
                                 CONSEGNATO
                               </button>
                             ) : (
                               <span className="px-3 py-1 rounded-full text-xs font-black border bg-[#FCE5CC] text-[#C06300] border-[#F9CB99]">
                                 IN BOZZA
                               </span>
                             )}
                             <button 
                                onClick={() => openAdminEditModal(ageBracket)}
                                title="Modifica manualmente questa squadra"
                                className="w-8 h-8 flex items-center justify-center bg-white text-[#004F9F] rounded-full shadow hover:bg-[#EBF4FB]0 hover:text-white transition-colors border border-[#CCD9EA]"
                             >✏️</button>
                             <button 
                               onClick={() => kickTeamFromRoom(ageBracket)}
                               title="Espelli squadra e libera la fascia"
                               className="w-8 h-8 flex items-center justify-center bg-white text-[#E6325E] rounded-full shadow hover:bg-[#E6325E] hover:text-white transition-colors border border-[#FAD5DE]"
                             >✕</button>
                          </>
                        ) : (
                          <button 
                             onClick={() => openAdminEditModal(ageBracket)}
                             className="px-4 py-1.5 bg-white border-2 border-slate-200 text-slate-500 font-bold rounded-full hover:border-[#6693BF] hover:text-[#004F9F] transition-colors text-sm"
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
                        <span className={`font-black text-lg ${groupTotal === 100 ? 'text-[#39B2B6]' : 'text-[#E6325E]'}`}>{groupTotal}%</span>
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
    <div className="relative min-h-screen bg-[#CCD9EA]">
      <LongevityGame />
    </div>
  );
};

export default App;
