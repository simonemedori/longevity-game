// netlify/functions/generate-event.js
exports.handler = async (event, context) => {
  // Solo chiamate POST autorizzate
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Recupera la chiave dalle variabili di ambiente di Netlify (SENZA VITE_)
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Chiave API GEMINI_API_KEY non configurata su Netlify (Environment Variables)" }) 
    };
  }

  try {
    const body = JSON.parse(event.body);
    // Usiamo il modello flash 2.0 come nel tuo codice originale
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Errore server Netlify", details: error.message })
    };
  }
};
