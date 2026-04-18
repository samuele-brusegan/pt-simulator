// Toolbar Manager - Handles toolbar functionality
import { NetworkEngine } from '../network/network-engine.js';

export class ToolbarManager {
    constructor(app) {
        this.app = app;
        this.selectedDevices = [];
        this.pingMode = false;
        this.networkEngine = new NetworkEngine(app);
        this.init();
    }

    init() {
        this.downloadBtn = document.getElementById('btn-download');
        this.importBtn = document.getElementById('btn-import');
        this.newBtn = document.getElementById('btn-new');
        this.pingBtn = document.getElementById('btn-ping');
        this.fileInput = document.getElementById('file-input');
        this.selectionInfo = document.getElementById('selection-info');

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Download button
        this.downloadBtn.addEventListener('click', () => this.handleDownload());

        // Import button
        this.importBtn.addEventListener('click', () => this.handleImport());

        // New network button
        this.newBtn.addEventListener('click', () => this.handleNewNetwork());

        // Ping button
        this.pingBtn.addEventListener('click', () => this.handlePing());

        // Debug toggle button
        this.debugBtn = document.getElementById('btn-debug');
        this.debugNotificationsEnabled = false;
        this.debugBtn.addEventListener('click', () => this.toggleDebugNotifications());

        // File input change
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Escape key to exit ping mode
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.pingMode) {
                this.exitPingMode();
            }
        });
    }

    handleDownload() {
        const networkData = {
            version: '1.0',
            timestamp: Date.now(),
            devices: this.app.devices.map(device => device.serialize()),
            cables: this.app.cables.map(cable => cable.serialize())
        };

        // Create modal for filename input
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Scarica Rete</h3>
                <div class="modal-form-group">
                    <label class="modal-label">Nome file</label>
                    <input type="text" id="download-filename" class="modal-input" value="rete" placeholder="Nome del file">
                </div>
                <div class="modal-buttons">
                    <button id="download-confirm" class="btn">Scarica</button>
                    <button id="download-cancel" class="btn btn-secondary">Annulla</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('download-confirm').addEventListener('click', () => {
            const filename = document.getElementById('download-filename').value || 'rete';
            const blob = new Blob([JSON.stringify(networkData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.json`;
            a.click();
            URL.revokeObjectURL(url);
            document.body.removeChild(modal);
        });

        document.getElementById('download-cancel').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    }

    handleImport() {
        this.fileInput.click();
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                // Validate data structure
                if (!data.devices || !data.cables) {
                    alert('Formato file non valido');
                    return;
                }

                // Check for unsaved changes
                if (this.app.devices.length > 0 || this.app.cables.length > 0) {
                    this.showNewNetworkModal(() => {
                        this.loadNetworkData(data);
                    });
                } else {
                    this.loadNetworkData(data);
                }
            } catch (error) {
                alert('Errore nel parsing del file JSON');
                console.error(error);
            }
        };
        reader.readAsText(file);
        
        // Reset file input
        event.target.value = '';
    }

    loadNetworkData(data) {
        // Clear current network
        this.app.devices = [];
        this.app.cables = [];

        // Load devices
        data.devices.forEach(deviceData => {
            const device = this.app.deviceFactory.createDevice(deviceData.type, deviceData);
            if (device) {
                this.app.devices.push(device);
            }
        });

        // Load cables
        data.cables.forEach(cableData => {
            const startDevice = this.app.devices.find(d => d.id === cableData.startDeviceId);
            const endDevice = this.app.devices.find(d => d.id === cableData.endDeviceId);
            if (startDevice && endDevice) {
                const cable = new Cable({
                    startDevice: startDevice,
                    endDevice: endDevice,
                    startPort: cableData.startPort,
                    endPort: cableData.endPort
                });
                this.app.cables.push(cable);
                startDevice.addConnection(cable);
                endDevice.addConnection(cable);
            }
        });

        // Redraw canvas
        this.app.canvasManager.draw();

        console.log('Network loaded successfully');
    }

    handleNewNetwork() {
        if (this.app.devices.length === 0 && this.app.cables.length === 0) {
            return; // Network is already empty
        }

        this.showNewNetworkModal(() => {
            this.clearNetwork();
        });
    }

    showNewNetworkModal(onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Nuova Rete</h3>
                <p>Ci sono modifiche non salvate. Cosa vuoi fare?</p>
                <div class="modal-buttons">
                    <button id="new-save" class="btn">Salva e continua</button>
                    <button id="new-discard" class="btn btn-danger">Scarta modifiche</button>
                    <button id="new-cancel" class="btn btn-secondary">Annulla</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('new-save').addEventListener('click', () => {
            this.handleDownload();
            document.body.removeChild(modal);
            onConfirm();
        });

        document.getElementById('new-discard').addEventListener('click', () => {
            document.body.removeChild(modal);
            onConfirm();
        });

        document.getElementById('new-cancel').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    }

    clearNetwork() {
        // Clear devices and cables
        this.app.devices = [];
        this.app.cables = [];
        
        // Redraw canvas
        this.app.canvasManager.draw();
        
        // Save empty network
        this.app.saveNetwork();

        console.log('Network cleared');
    }

    handlePing() {
        // Enter ping mode
        this.pingMode = true;
        this.pingBtn.classList.add('active');
        this.pingBtn.disabled = true;
        
        // Clear current selection
        this.selectedDevices = [];
        this.app.devices.forEach(device => device.setSelected(false));
        this.app.cables.forEach(cable => cable.selected = false);
        
        // Update selection info
        this.selectionInfo.textContent = 'Seleziona 2 dispositivi per il ping';
        
        // Show notification
        this.showPingModeNotification();
    }

    showPingModeNotification() {
        const notification = document.createElement('div');
        notification.id = 'ping-mode-notification';
        notification.style.cssText = `
            position: fixed;
            top: 70px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #3b82f6;
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            font-family: 'Fira Code', monospace;
            font-size: 14px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        notification.textContent = '🎯 Modalità Ping attiva - Seleziona 2 dispositivi';
        document.body.appendChild(notification);
    }

    hidePingModeNotification() {
        const notification = document.getElementById('ping-mode-notification');
        if (notification) {
            notification.remove();
        }
    }

    exitPingMode() {
        this.pingMode = false;
        this.pingBtn.classList.remove('active');
        this.pingBtn.disabled = false;
        this.hidePingModeNotification();
        this.selectedDevices = [];
        this.updateSelectionInfo();
    }

    getDeviceIP(device) {
        // Try to get IP from interfaces
        if (device.interfaces && device.interfaces.length > 0) {
            for (const iface of device.interfaces) {
                // Check for both 'ip' and 'ipAddress' properties
                if (iface.ip) {
                    return iface.ip;
                }
                if (iface.ipAddress) {
                    return iface.ipAddress;
                }
            }
        }
        return null;
    }

    simulatePing(sourceDevice, targetDevice, sourceIP, targetIP) {
        console.log(`Pinging ${targetIP} from ${sourceIP}`);
        
        // Use NetworkEngine for realistic packet flow
        this.networkEngine.sendPing(sourceDevice, targetDevice);
    }

    updateSelection(selectedDevices) {
        this.selectedDevices = selectedDevices;
        this.updateSelectionInfo();
        
        // If in ping mode and 2 devices selected, send ping
        if (this.pingMode && this.selectedDevices.length === 2) {
            const sourceDevice = this.selectedDevices[0];
            const targetDevice = this.selectedDevices[1];
            
            const sourceIP = this.getDeviceIP(sourceDevice);
            const targetIP = this.getDeviceIP(targetDevice);
            
            if (sourceIP && targetIP) {
                this.simulatePing(sourceDevice, targetDevice, sourceIP, targetIP);
            } else {
                alert('I dispositivi devono avere indirizzi IP configurati');
            }
            
            // Exit ping mode after sending
            this.exitPingMode();
        }
    }

    updateSelectionInfo() {
        if (this.pingMode) {
            const count = this.selectedDevices.length;
            if (count === 0) {
                this.selectionInfo.textContent = 'Seleziona 2 dispositivi per il ping';
            } else if (count === 1) {
                this.selectionInfo.textContent = 'Seleziona 1 altro dispositivo';
            } else {
                this.selectionInfo.textContent = `${count} dispositivi selezionati`;
            }
        } else {
            const count = this.selectedDevices.length;
            this.selectionInfo.textContent = `${count} dispositivo${count !== 1 ? 'i' : ''} selezionato${count !== 1 ? 'i' : ''}`;
        }
    }

    toggleDebugNotifications() {
        this.debugNotificationsEnabled = !this.debugNotificationsEnabled;
        this.debugBtn.classList.toggle('active', this.debugNotificationsEnabled);
        
        // Update NetworkEngine debug setting
        this.networkEngine.debugNotificationsEnabled = this.debugNotificationsEnabled;
    }
}
