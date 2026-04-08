# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Project Setup:**
- No build step required - pure HTML/JS/PHP
- For local development: point web server to `/public/` directory
- PHP 8.1+ required for API endpoints (`/api/save.php`, `/api/load.php`)

**Common Tasks:**
- To test changes: reload `public/index.html` in browser
- To test API endpoints: use curl or Postman against `http://localhost/api/save.php` (POST) or `http://localhost/api/load.php` (GET)
- To reset development state: clear browser localStorage or use "File → New" in UI

**Code Quality:**
- JavaScript follows ES6+ module syntax with `import`/`export`
- PHP follows PSR-12 basic standards
- CSS uses BEM-like naming conventions
- No linting/testing setup currently - manual verification through browser

## Code Architecture

**High-Level Structure:**
```
pt-simulator/
├── public/             # Frontend assets (served statically)
│   ├── index.html      # Main entry point
│   ├── css/            # Styling (dark theme focused)
│   ├── js/             # Application logic (ES6 modules)
│   │   ├── app.js      # Main application controller
│   │   ├── canvas/     # 2D rendering and viewport management
│   │   ├── devices/    # Device classes (PC, Switch, Router, Server)
│   │   ├── network/    # Connection/cable logic
│   │   ├── storage/    # Persistence layer (localStorage)
│   │   ├── ui/         # UI components (palette, terminal)
│   │   └── cli/        # Command-line interface simulation
│   ├── service-worker.js # PWA offline support
│   └── manifest.json   # PWA metadata
├── data/               # Static device/cable definitions
│   ├── devices/        # Device model JSON files
│   ├── interfaces/     # NIC type definitions
│   └── cables/         # Cable type compatibility
└── api/                # PHP backend endpoints
    ├── save.php        # Save network configuration
    └── load.php        # Load/list saved configurations
```

**Data Flow:**
1. User interacts with UI (palette/canvas/terminal)
2. `app.js` mediates between UI components and data model
3. Device/Cable instances store state in JavaScript objects
4. `storage.js` handles auto-save to localStorage every 30s
5. Optional PHP API calls for remote backup (save.php/load.php)

**Key Architectural Decisions:**
- **Framework Choice:** Vanilla JS ES6 modules for zero dependencies
- **Persistence:** Client-side primary (localStorage) with optional PHP backend
- **Rendering:** Canvas 2D with manual render loop (requestAnimationFrame)
- **CLI:** Custom terminal implementation with basic IOS command simulation
- **Device Model:** Inheritance hierarchy (Device base → PC/Switch/Router/Server subclasses)
- **Cable System:** Bezier curves for visual representation with compatibility validation

**Extensibility Points:**
- Add new devices: extend `Device` class in `js/devices/`
- Add new cable types: update `data/cables/cable-types.json` and validation logic
- Add new CLI commands: extend `js/cli/terminal-manager.js` command handlers
- Modify device models: edit `data/devices/models.json`
- Change appearance: update `public/css/style.css`

**Browser Compatibility Target:**
- Modern browsers: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+
- Uses ES6+, Flexbox, CSS variables, Service Workers
- No transpilation or polyfills included (assumes modern browser)
