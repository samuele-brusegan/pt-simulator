# Bug Tracker - PT-Simulator

Questo file è dedicato al tracciamento dei bug riscontrati durante lo sviluppo e dei tentativi effettuati per risolverli, per evitare di ripetere gli stessi sforzi più volte.

## Formato Tracciamento Bug
```
### [ID-BUG] Titolo del Bug
- **Stato**: `Aperto` | `In Analisi` | `Risolto` | `Non Riproducibile`
- **Descrizione**: Breve descrizione del problema
- **Riproduzione**: Passaggi per riprodurre il problema
- **Tentativi di risoluzione**:
  1. [Data] Cosa è stato provato -> Risultato
- **Soluzione** (se risolto): Come è stato risolto
```

---

### [BUG-001] Quota Exceeded per Generazione Immagini (DALL-E/Imagen)
- **Stato**: `In Analisi`
- **Descrizione**: Durante la generazione dei set di icone 3D, è stato raggiunto il limite di quota dell'API (429 Resource Exhausted).
- **Riproduzione**: Tentativo di generare più di 3-4 immagini in rapida successione.
- **Tentativi di risoluzione**:
  1. [11/04/2026] Utilizzo di icone 2D esistenti come fallback per i modelli 3D mancanti (Switch, Router, Server) fino al reset della quota.
- **Soluzione**: Fallback temporaneo implementato in `DeviceFactory`. Una volta resettata la quota, basterà generare le restanti immagini e sostituire i file in `public/icons/3d/`.

---

### [BUG-002] Logica di spostamento dispositivo non funziona in alcuni casi
- **Stato**: `In Analisi`
- **Descrizione**: Il drag-and-drop dei dispositivi sul canvas non funziona correttamente in alcuni casi.
- **Riproduzione**: Spostare dispositivi sul canvas in diverse posizioni/condizioni.
- **Tentativi di risoluzione**:
  1. [17/04/2026] Aggiunto logging per debug in canvas-manager.js per tracciare quando inizia il drag dei dispositivi. Il problema potrebbe essere legato al conflitto con la modalità cavo attiva - quando un tipo di cavo è selezionato, il sistema tenta di creare connessioni invece di trascinare i dispositivi.
- **Soluzione**: Da determinare

---

### [BUG-003] Pannello di configurazione non si apre occasionalmente
- **Stato**: `In Analisi`
- **Descrizione**: Il pannello di configurazione dei dispositivi non si apre in modo intermittente.
- **Riproduzione**: Cliccare su dispositivi per aprire il pannello di configurazione più volte.
- **Tentativi di risoluzione**:
  1. [17/04/2026] Aggiunto preventDefault() e stopPropagation() al double-click handler in app.js per prevenire conflitti con altri event listener. Aggiunto logging per debug.
- **Soluzione**: Da determinare

---

### [BUG-006] Miglioramenti interfaccia e funzionalità
- **Stato**: `Risolto`
- **Descrizione**: Richieste multiple per migliorare l'interfaccia e le funzionalità del simulatore.
- **Riproduzione**: N/A
- **Tentativi di risoluzione**:
  1. [17/04/2026] Evidenziazione dispositivo solo quando config window è in primo piano (focus/blur events)
  2. [17/04/2026] Modale personalizzato per conferma eliminazione (HTML + CSS custom)
  3. [17/04/2026] Modalità eliminazione con Delete/Backspace quando nessun dispositivo selezionato, ESC per uscire
  4. [17/04/2026] Nascondo toolbar browser in config window (scrollbars=no)
  5. [17/04/2026] Campo CIDR accanto a subnet mask con conversione bidirezionale
  6. [17/04/2026] Auto subnet mask basata sulla classe IP (Class A /8, Class B /16, Class C /24)
  7. [17/04/2026] CLI prompts: prompt completo nella history (Router>, Router#, etc.), abbreviazioni comandi funzionanti, marker "^" per errori
- **Soluzione**: Implementate tutte le funzionalità richieste in app.js, config-window-manager.js, config-loader.js, terminal-manager.js, style.css, index.html

---

### [BUG-007] CLI prompt completo nella history
- **Stato**: `Risolto`
- **Descrizione**: Nella history dei comandi non mostrare sempre `>` ma l'intero prompt (Router>, Router#, Router(config)#, etc.)
- **Riproduzione**: N/A
- **Tentativi di risoluzione**:
  1. [17/04/2026] Modificata executeCommand() per mostrare il prompt completo nella history
  2. [17/04/2026] Ripristinate abbreviazioni comandi con isMatch dopo averle rimosse erroneamente
  3. [17/04/2026] Riparate funzioni print() e printError() corrotte da sed
- **Soluzione**: Modificato terminal-manager.js per mostrare il prompt completo nella history e mantenere le abbreviazioni funzionanti

---

### [BUG-005] Rimozione pannello terminale CLI
- **Stato**: `Risolto`
- **Descrizione**: Il pannello terminale CLI non serve a nulla - i dispositivi devono essere configurabili solo facendo doppio click.
- **Riproduzione**: N/A
- **Tentativi di risoluzione**:
  1. [17/04/2026] Rimosso il pannello terminale dall'HTML (index.html)
  2. [17/04/2026] Rimosso TerminalManager da app.js (import, inizializzazione, handler click)
- **Soluzione**: Rimosso completamente il terminale CLI. Ora i dispositivi sono configurabili solo tramite doppio click che apre la finestra di configurazione staccabile.

---

### [BUG-004] Impossibile collegare dispositivi con cavi
- **Stato**: `Risolto`
- **Descrizione**: Non è possibile collegare due dispositivi con i cavi - la funzionalità di connessione non funziona mai.
- **Riproduzione**: Tentare di trascinare un cavo da una porta all'altra tra due dispositivi.
- **Tentativi di risoluzione**:
  1. [17/04/2026] Aggiunto logging per debug in canvas-manager.js e palette-manager.js per tracciare la selezione del tipo di cavo e l'inizio della creazione del cavo. Il problema potrebbe essere che l'utente non seleziona prima un tipo di cavo dalla tab CONNECTIONS nella palette.
  2. [17/04/2026] Nuovi requisiti: aggiungere possibilità di collegare cliccando due dispositivi (non solo trascinando), cavi diritti invece che curve, colori corretti, nomi interfacce abbreviati.
  3. [17/04/2026] Implementate tutte le modifiche richieste:
     - Click-to-connect: ora è possibile collegare dispositivi cliccando sul primo dispositivo e poi sul secondo quando un tipo di cavo è selezionato
     - Cavi diritti: modificato il rendering da curve Bezier a linee dritte
     - Colori corretti: Console (#58a6ff azzurro), Straight/Cross (#c9d1d9 grigio chiaro per contrasto), Fibra (#f85149 rosso), Serial (#f85149 rosso)
     - Nomi abbreviati: FastEthernet0 -> Fa0, GigabitEthernet0 -> Gi0, Serial0 -> S0, Console0 -> Con0
  4. [17/04/2026] Migliorato contrasto: cambiato colore cavi ethernet da nero a grigio chiaro (#c9d1d9) per migliore visibilità su sfondo scuro
- **Soluzione**: Implementate tutte le funzionalità richieste in cable.js e canvas-manager.js
