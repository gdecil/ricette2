# 🍲 Ricette Locali

Ricette Locali è un'applicazione web progettata per cercare, importare e organizzare ricette online, garantendo che tutti i dati e le immagini rimangano salvati localmente sul tuo computer.

## ✨ Caratteristiche principali

- **Ricerca Privata**: Integrazione con **SearXNG** per ricerche online protette e senza tracking.
- **Importazione Intelligente**: Importa ricette da qualsiasi URL grazie a tecniche di estrazione dati (Trafilatura, BeautifulSoup) e supporto opzionale per **Ollama** (LLM) per completare i dati mancanti.
- **Gestione Locale**: Database **SQLite** con ricerca full-text (FTS5) e gestione immagini locale con hash per evitare duplicati.
- **Dashboard Interattiva**:
    - Filtri avanzati per ingredienti, stato, preferiti e categorie.
    - Categorie personalizzabili con supporto **drag-and-drop**.
    - Gestione dello stato (da provare, già preparata, ecc.).
- **Dettagli Ricetta**:
    - Caricamento manuale di immagini e note personali.
    - Visualizzazione dei metadati estratti e dell'URL originale.
    - Rimozione rapida delle ricette.

## 🛠 Stack Tecnologico

- **Backend**: FastAPI (Python 3.11+)
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Database**: SQLite (FTS5)
- **Search**: SearXNG (Docker)
- **AI (Opzionale)**: Ollama (Llama 3.2)

## 📋 Requisiti

- **Python 3.11** o superiore.
- **Docker Desktop** (necessario per far girare SearXNG).
- **Ollama** (opzionale, per il completamento automatico dei dati tramite AI).

## 🚀 Installazione

### 1. Preparazione dell'Ambiente Virtuale
Apri un terminale nella cartella del progetto e segui questi passaggi:

```powershell
# Creazione ambiente virtuale
python -m venv .venv

# Attivazione (Windows)
.venv\Scripts\Activate.ps1

# Installazione dipendenze
python -m pip install -r requirements.txt
```

### 2. Configurazione SearXNG (Motore di Ricerca)
Avvia SearXNG tramite Docker per abilitare la ricerca locale:

```powershell
docker compose up -d
```
SearXNG sarà disponibile su `http://localhost:8080`.

### 3. Avvio dell'Applicazione
Avvia il server FastAPI:

```powershell
.venv\Scripts\python.exe -m uvicorn app:app --reload
```
L'app sarà accessibile su `http://127.0.0.1:8000`.

## 🌐 Accesso Remoto e Networking

### Rete Locale
Per accedere dall'interno della tua rete locale, avvia Uvicorn con:
```powershell
.venv\Scripts\python.exe -m uvicorn app:app --host 0.0.0.0 --port 8000
```
*Nota: Assicurati di aprire la porta 8000 sul firewall di Windows se necessario.*

### Accesso da Internet (Sicurezza)
**Attenzione**: Questa versione non include autenticazione nativa. Per accedere da remoto in sicurezza:
- Usa una VPN (es. **Tailscale** o **WireGuard**).
- Oppure configura un reverse proxy HTTPS con autenticazione e rate limiting.

## 🤖 Configurazione Ollama (Opzionale)

Per utilizzare Ollama come fallback quando i dati estratti sono incompleti:

1. Scarica il modello: `ollama pull llama3.2`
2. Configura le variabili d'ambiente prima di avviare l'app:

```powershell
:OLLAMA_ENABLED = "true"
:OLLAMA_MODEL = "llama3.2".venv\Scripts\python.exe -m uvicorn app:app --reload
```

### Variabili di Sistema Supportate:
- : Endpoint SearXNG (Default: `http://localhost:8080/search`)
- : Endpoint Ollama (Default: `http://localhost:11434`)
- : Modello Ollama (Default: `llama3.2`)
- : Abilita il fallback AI (Valore: `true`)

## 📖 Guida Rapida

1. **Cerca**: Usa la sezione "Cerca online" per trovare ricette tramite SearXNG.
2. **Salva**: Clicca su "Salva ricetta" per aggiungere i risultati estratti alla tua collezione.
3. **Importa**: Inserisci un URL direttamente nella dashboard per importare una ricetta specifica.
4. **Organizza**: Usa i filtri e le categorie (drag-and-drop) per gestire la tua raccolta.
5. **Dettagli**: Apri ogni ricetta per modificare categorie, stati, o aggiungere note manuali e immagini.

## 🗄️ Gestione Dati

Tutti i tuoi dati sono salvati localmente nella cartella `/data`:
- : Database SQLite con indicizzazione full-text.
- : Immagini scaricate o caricate (gestite tramite hash per evitare duplicati).

## 🔗 API Reference

| Endpoint | Metodo | Descrizione |
| :--- | :--- | :--- |
|  |  | Ricerca online tramite SearXNG |
|  |  | Elenco e filtri della raccolta ||  |  | Importa ricette da URL ||  |  | Crea una ricetta manuale ||  |  | Modifica una ricetta esistente ||  |  | Carica un'immagine per una ricetta ||  |  | Elimina una ricetta ||  |  | Statistiche della raccolta |

## 📄 Licenza
Progetto personale per uso locale.