# Ricette Locali

Web app locale per cercare, importare e organizzare ricette online mantenendo dati e immagini sul proprio computer.

## Funzionalita

- Ricerca online tramite SearXNG locale
- Importazione di una o piu ricette da URL
- Estrazione dei dati `schema.org/Recipe` in JSON-LD
- Fallback con Trafilatura/BeautifulSoup e Ollama opzionale
- Database SQLite locale con ricerca full-text FTS5
- Download locale delle immagini con hash per evitare duplicati
- Dashboard per consultare e filtrare la raccolta
- Filtri per testo, ingredienti, stato, preferiti e categoria
- Categorie personalizzabili e spostamento drag and drop
- Modifica dello stato: da provare o gia preparata
- Cambio categoria dal dettaglio della ricetta
- Caricamento manuale dell'immagine
- Salvataggio di testo e appunti incollati manualmente nel dettaglio
- Visualizzazione dell'URL originale e dei dettagli estratti
- Eliminazione delle ricette dal dettaglio

## Requisiti

- Python 3.11 o superiore
- Docker Desktop, necessario solo per SearXNG
- Ollama opzionale per completare ricette con dati incompleti

## Installazione

Da PowerShell, nella cartella del progetto:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Se il virtual environment esiste gia:

```powershell
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Avvio

### 1. SearXNG

Avvia il motore di ricerca locale:

```powershell
docker compose up -d
```

SearXNG sara disponibile su `http://localhost:8080`.

### 2. Applicazione

```powershell
.venv\Scripts\python.exe -m uvicorn app:app --reload
```

Apri quindi:

```text
http://127.0.0.1:8000
```

### Accesso da un altro computer nella rete locale

Avvia Uvicorn ascoltando anche sulla rete locale (non usare `--reload` per un avvio condiviso):

```powershell
.venv\Scripts\python.exe -m uvicorn app:app --host 0.0.0.0 --port 8000
```

Sul computer remoto apri `http://INDIRIZZO-IP-DEL-PC:8000`. Per trovare l'indirizzo IPv4 del PC che esegue l'app:

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*'}
```

Se Windows Firewall blocca la connessione, crea una regola in ingresso limitata alla rete privata:

```powershell
New-NetFirewallRule -DisplayName "Ricette Locali" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private
```

SearXNG resta disponibile solo sul PC dell'app (`127.0.0.1:8080`); il computer remoto passa sempre dall'API di Ricette Locali.

### Accesso da Internet

Non esporre direttamente la porta 8000 su Internet: questa versione non include autenticazione. Usa una VPN (ad esempio Tailscale o WireGuard) per l'accesso remoto oppure un reverse proxy HTTPS con autenticazione, rate limiting e una regola firewall dedicata.

## Ollama opzionale

Per usare Ollama come fallback quando i dati estratti sono incompleti:

```powershell
ollama pull llama3.2
$env:OLLAMA_ENABLED = "true"
$env:OLLAMA_MODEL = "llama3.2"
.venv\Scripts\python.exe -m uvicorn app:app --reload
```

Variabili supportate:

- `SEARXNG_URL`: endpoint SearXNG, predefinito `http://localhost:8080/search`
- `OLLAMA_URL`: endpoint Ollama, predefinito `http://localhost:11434`
- `OLLAMA_MODEL`: modello Ollama, predefinito `llama3.2`
- `OLLAMA_ENABLED`: abilita il fallback Ollama con valore `true`

## Utilizzo

1. Apri **Cerca online** e cerca una ricetta tramite SearXNG.
2. Controlla titolo, descrizione e URL originale.
3. Seleziona **Salva ricetta** oppure usa **Da URL** nella raccolta.
4. Apri l'immagine della ricetta per vedere tutti i dettagli estratti.
5. Dal dettaglio puoi cambiare categoria, stato o immagine, oppure eliminare la ricetta.
6. Usa i filtri della raccolta per trovare rapidamente le ricette salvate.

## Dati locali

I dati vengono creati nella cartella `data/`:

- `data/recipes.db`: database SQLite e indice FTS5
- `data/images/`: immagini scaricate o caricate manualmente

Queste directory contengono dati locali dell'utente e non sono necessarie per il codice dell'applicazione.

## Struttura

```text
ricette/
├── app.py
├── requirements.txt
├── docker-compose.yml
├── searxng/settings.yml
├── static/
│   ├── app.js
│   ├── index.html
│   └── styles.css
└── data/
    ├── recipes.db
    └── images/
```

## API principali

- `GET /api/search?q=...`: ricerca online tramite SearXNG
- `GET /api/recipes`: elenco e filtri della raccolta
- `POST /api/import`: importa ricette da URL
- `PATCH /api/recipes/{id}`: modifica ricetta
- `POST /api/recipes/{id}/image`: carica un'immagine
- `DELETE /api/recipes/{id}`: elimina una ricetta
- `GET /api/stats`: statistiche della raccolta

## Licenza

Progetto personale per uso locale.
