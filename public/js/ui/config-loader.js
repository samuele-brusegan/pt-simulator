// Config Loader - Script for the separate configuration window
import { TerminalManager } from '../cli/terminal-manager.js';

class ConfigLoader {
    constructor() {
        this.deviceId = new URLSearchParams(window.location.search).get('deviceId');
        this.channel = new BroadcastChannel('pt-simulator-sync');
        this.deviceData = null;
        this.terminalManager = null;
        
        if (!this.deviceId) {
            document.body.innerHTML = '<h1>Errore: ID dispositivo mancante.</h1>';
            return;
        }

        this.init();
    }

    async init() {
        this.setupTabs();
        this.setupChannel();
        this.setupFormEvents();
        
        // Notify main window we are ready
        this.channel.postMessage({ type: 'READY', deviceId: this.deviceId });
        
        // Fallback: if no response in 2s, show error
        setTimeout(() => {
            if (!this.deviceData) {
                document.getElementById('device-title').textContent = 'Errore di connessione';
                document.getElementById('connection-status').textContent = '● Offline';
                document.getElementById('connection-status').style.color = '#ef4444';
            }
        }, 2000);
    }

    setupTabs() {
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                
                // Active button
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Active content
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                document.getElementById(target).classList.add('active');
                
                // Special handling for CLI focus
                if (target === 'cli' && this.terminalManager) {
                    this.terminalManager.focus();
                }
            });
        });
    }

    setupChannel() {
        this.channel.onmessage = (event) => {
            const { type, deviceId, data } = event.data;
            if (deviceId !== this.deviceId) return;

            if (type === 'DEVICE_DATA') {
                this.deviceData = data;
                this.renderUI();
            }
        };
    }

    renderUI() {
        const data = this.deviceData;
        document.getElementById('device-title').textContent = `${data.model.toUpperCase()} - ${data.name}`;
        document.getElementById('config-hostname').value = data.name;
        
        // Render interfaces in Config tab
        const intfContainer = document.getElementById('interface-configs');
        intfContainer.innerHTML = '<h3>Interfacce</h3>';
        
        data.interfaces.forEach(intf => {
            const section = document.createElement('div');
            section.className = 'form-section';
            section.innerHTML = `
                <h4>${intf.name}</h4>
                <div class="modal-form-group">
                    <label class="modal-label">IP Address</label>
                    <input type="text" value="${intf.ip || ''}" data-intf-id="${intf.id}" data-field="ip" class="modal-input intf-input">
                </div>
                <div class="modal-form-group">
                    <label class="modal-label">Subnet Mask</label>
                    <input type="text" value="${intf.mask || ''}" data-intf-id="${intf.id}" data-field="mask" class="modal-input intf-input">
                </div>
                <div class="modal-form-group">
                    <label class="modal-label">Port Status</label>
                    <select data-intf-id="${intf.id}" data-field="status" class="modal-select intf-input">
                        <option value="up" ${intf.status === 'up' ? 'selected' : ''}>On</option>
                        <option value="down" ${intf.status === 'down' ? 'selected' : ''}>Off</option>
                    </select>
                </div>
            `;
            intfContainer.appendChild(section);
        });

        // Initialize Terminal if not already done
        if (!this.terminalManager) {
            // We need to mock the device object for TerminalManager
            const mockDevice = {
                id: this.deviceId,
                name: data.name,
                interfaces: data.interfaces.map(i => ({...i}))
            };
            this.terminalManager = new TerminalManager(document.getElementById('terminal'));
            this.terminalManager.setActiveDevice(mockDevice);
            
            // Override print to also sync back if needed? 
            // Actually TerminalManager works on its own object. 
            // We should listen for changes in the mockDevice and sync them.
        } else {
            // Update terminal's device name if changed
            this.terminalManager.activeDevice.name = data.name;
            this.terminalManager.updatePrompt();
        }

        // Render Physical list
        const portsList = document.getElementById('ports-list');
        portsList.innerHTML = data.interfaces.map(i => `
            <li><strong>${i.name}</strong>: ${i.status === 'up' ? 'Attiva' : 'Spenta'} (${i.type})</li>
        `).join('');
    }

    setupFormEvents() {
        // Global Hostname
        document.getElementById('config-hostname').addEventListener('change', (e) => {
            this.sendUpdate({ name: e.target.value });
        });

        // Interface updates
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('intf-input')) {
                const intfId = e.target.dataset.intfId;
                const field = e.target.dataset.field;
                const value = e.target.value;

                // Find and update in our local copy
                const intf = this.deviceData.interfaces.find(i => i.id === intfId);
                if (intf) {
                    intf[field] = value;
                    this.sendUpdate({ interfaces: this.deviceData.interfaces });
                    
                    // Also sync terminal mock
                    if (this.terminalManager) {
                        const terminalIntf = this.terminalManager.activeDevice.interfaces.find(i => i.id === intfId);
                        if (terminalIntf) terminalIntf[field] = value;
                    }
                }
            }
        });

        // Listen for CLI-driven updates from our local TerminalManager
        document.addEventListener('deviceUpdated', (e) => {
            const updatedDevice = e.detail;
            this.sendUpdate({
                name: updatedDevice.name,
                interfaces: updatedDevice.interfaces
            });
            
            // Update UI title and forms
            document.getElementById('device-title').textContent = `${this.deviceData.model.toUpperCase()} - ${updatedDevice.name}`;
            document.getElementById('config-hostname').value = updatedDevice.name;
        });
    }

    sendUpdate(partialData) {
        this.channel.postMessage({
            type: 'UPDATE_DEVICE',
            deviceId: this.deviceId,
            data: partialData
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ConfigLoader();
});
