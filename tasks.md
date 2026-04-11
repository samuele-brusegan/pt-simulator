# PT-Simulator - Task List

## Completati (Passi Fatti)
- [x] Inizializzazione della struttura base del progetto (HTML, CSS).
- [x] Setup dell'architettura in moduli JS (`app.js`, `canvas`, `devices`, `ui`, `cli`, `storage`, `network`).
- [x] Implementazione base della grid 2D e del CanvasManager.
- [x] Logica base per creazione e cancellazione nodi (DeviceFactory).
- [x] Logica per il posizionamento dei dispositivi (drag & drop da palette a canvas).
- [x] Implementazione di base per la connessione tra dispositivi (cavi).
- [x] LocalStorage manager per il salvataggio/caricamento dello stato della rete.
- [x] Struttura e layout base con CSS per canvas e terminale.
- [x] Rifinire la validazione della connessione (limite porte per dispositivo, tipi di porte).
- [x] Implementazione dei comandi Cisco IOS all'interno del TerminalManager (`js/cli/`).
- [x] Implementare la logica specifica per le interfacce e i tipi di cavi (`data/cables`, `data/interfaces`).
- [x] Dispositivi: Aggiungere le specifiche complete (numero porte, tipo) per Switch 2960, Router 2911, PC, Server.
- [x] CLI: Implementare il parser per i comandi `enable`, `conf t`, `interface`, `ip address`, ecc.
- [x] **Backend PHP**: Terminare lo sviluppo e testare l'integrazione degli endpoint API in `api/save.php` e `api/load.php`.
- [x] **UI/UX Modernizzazione**: Spostamento palette in basso a sinistra (2:1 ratio) e restyling grid.
- [x] **Icone Cisco**: Sistema duale 2D/3D con icone personalizzate per PC, Switch, Router e Server.
- [x] **Finestra Staccabile**: Implementazione finestre di configurazione indipendenti via `window.open` e sync via `BroadcastChannel`.
- [x] **CLI Pro**: Parser IOS fedele con supporto shortcuts e tab completion.
- [x] **Compatibilità**: Check forzato all'avvio per `BroadcastChannel`.

## In Corso (Work in Progress)
- [ ] Cavi: Gestire il tipo di cavo (Straight, Cross, Console) durante il collegamento tramite UI.

## Da Fare (To Do)
- [ ] **Networking**: Logica di ping o tracing tra dispositivi per verificare le configurazioni IP.
- [ ] **PWA**: Registrazione Service Worker e configurazione di cache offline completa.
- [ ] **UI**: Esporta/importa JSON per condivisione file locali.
