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
