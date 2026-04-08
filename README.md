# PT-Simulator

Alternativa open-source a Cisco Packet Tracer per la simulazione di reti, basata su PHP/JS e installabile come PWA.

## Caratteristiche

- ✅ **PWA Installabile**: Funziona offline, installabile su desktop e mobile
- ✅ **Canvas 2D**: Drag-and-drop di dispositivi, cavi colorati per tipo
- ✅ **Dispositivi Multipli**: PC, Switch, Router, Server con interfacce realistiche
- ✅ **CLI IOS**: Terminale web con comandi Cisco IOS simulati
- ✅ **Persistenza Client-Side**: Salvataggio automatico in localStorage/IndexedDB
- ✅ **Esporta/Importa JSON**: Condividi le tue reti come file
- ✅ **Tema Scuro**: Ottimizzato per lunghe sessioni di lavoro

## Dispositivi Supportati

- **PC**: Generic PC con interfaccia FastEthernet
- **Switch**: Cisco 2960 con 24 porte FastEthernet
- **Router**: Cisco 2911 con 2x GigabitEthernet, 2x Serial
- **Server**: Generic Server con 2x GigabitEthernet

## Tipi di Cavo

- Ethernet Straight-through (PC-Switch, Switch-Router)
- Ethernet Cross-over (Router-Router, dispositivi simili)
- Fiber Single-mode (lunghe distanze)
- Fiber Multi-mode (brevi distanze)
- Serial DCE/DTE (router-router)

## CLI IOS Simulata

Comandi supportati:
- `enable`, `disable`, `configure terminal`
- `interface <name>`, `ip address <ip> <mask>`
- `no shutdown`, `shutdown`
- `show running-config`, `show interfaces`, `show ip interface brief`
- `show version`, `help`

## Installazione

### Opzione 1: Server Web (Consigliato)
1. Clona questo repository
2. Assicurati di avere PHP 8.1+ abilitato
3. Punto il tuo web server alla directory `public/`
4. Abilita il file `.htaccess` per routing pulito (se necessario)
5. Visita `http://tuo-dominio/pt-simulator/`

### Opzione 2: Demo Locale
1. Apri direttamente `public/index.html` nel browser
2. Alcune funzionalità API potrebbero essere limitate (salvataggio remoto)
3. La PWA funzionerà comunque per uso locale

### Opzione 3: Docker
```bash
# Usa il docker-compose esistente o crea il tuo
docker build -t pt-simulator .
docker run -p 8080:80 pt-simulator
```

## Utilizzo

1. **Aggiungi dispositivi**: Trascina dalla barra laterale sinistra sul canvas
2. **Connetti dispositivi**: Trascina da una porta all'altra per creare un cavo
3. **Configura dispositivi**: Clicca su un dispositivo per attivare la CLI
4. **Salva rete**: Usa il menu File → Esporta JSON
5. **Carica rete**: Usa il menu File → Importa JSON

## Sviluppo

Il progetto è organizzato come segue:

```
public/
├── index.html          # Shell HTML
├── css/
│   └── style.css       # Tema scuro e layout
├── js/
│   ├── app.js          # Main application entry point
│   ├── canvas/         # Canvas 2D e gestione viewport
│   ├── devices/        # Classi dispositivi (PC, Switch, Router, Server)
│   ├── network/        # Classe Cable e logica di connessione
│   ├── storage/        # Gestione persistenza localStorage
│   ├── ui/             # Palette dispositivi e context menu
│   └── cli/            # Terminale web e parser comandi IOS
├── service-worker.js   # PWA offline caching
└── manifest.json       # PWA manifest

data/
├── devices/            # Definizioni modelli dispositivi
├── interfaces/         # Tipi NIC e velocità
└── cables/             # Tipi cavo e compatibilità

api/
├── save.php            # Endpoint per salvataggio remoto
└── load.php            # Endpoint per caricamento/lista salvataggi
```

## Browser Support

- Chrome 80+ (raccomandato)
- Firefox 75+
- Safari 13+
- Edge 80+

## Licenza

MIT License - vedere file LICENSE.md

## Ringraziamenti

Ispirato a Cisco Packet Tracer e altri simulatori di rete educativi.