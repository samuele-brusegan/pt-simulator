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
        
        // Add Default Gateway field for PCs and Servers
        if (data.type === 'pc' || data.type === 'server') {
            const gwSection = document.createElement('div');
            gwSection.className = 'form-section';
            gwSection.innerHTML = `
                <h3>Routing</h3>
                <div class="modal-form-group">
                    <label class="modal-label">Default Gateway</label>
                    <input type="text" id="config-default-gateway" value="${data.defaultGateway || ''}" class="modal-input" placeholder="es. 192.168.0.1">
                </div>
            `;
            intfContainer.appendChild(gwSection);
            
            // Add event listener for default gateway
            document.getElementById('config-default-gateway').addEventListener('change', (e) => {
                this.sendUpdate({ defaultGateway: e.target.value || null });
            });
        }
        
        // Add Static Routes field for Routers
        if (data.type === 'router') {
            const routesSection = document.createElement('div');
            routesSection.className = 'form-section';
            routesSection.innerHTML = `
                <h3>Rotte Statiche</h3>
                <div id="static-routes-container"></div>
                <button id="add-route-btn" class="btn" style="margin-top: 10px;">Aggiungi Rota</button>
            `;
            intfContainer.appendChild(routesSection);
            
            // Add event listener for adding routes
            document.getElementById('add-route-btn').addEventListener('click', () => {
                this.addStaticRouteUI();
            });
            
            // Render existing routes if any
            if (data.staticRoutes) {
                data.staticRoutes.forEach(route => {
                    this.addStaticRouteUI(route);
                });
            }
        }
        
        data.interfaces.forEach(intf => {
            const section = document.createElement('div');
            section.className = 'form-section';
            const cidr = this.maskToCIDR(intf.mask);
            section.innerHTML = `
                <h4>${intf.name}</h4>
                <div class="modal-form-group">
                    <label class="modal-label">IP Address</label>
                    <input type="text" value="${intf.ip || ''}" data-intf-id="${intf.id}" data-field="ip" class="modal-input intf-input">
                </div>
                <div class="modal-form-group" style="display: flex; gap: 10px;">
                    <div style="flex: 1;">
                        <label class="modal-label">Subnet Mask</label>
                        <input type="text" value="${intf.mask || ''}" data-intf-id="${intf.id}" data-field="mask" class="modal-input intf-input">
                    </div>
                    <div style="width: 80px;">
                        <label class="modal-label">CIDR</label>
                        <input type="text" value="${cidr || ''}" data-intf-id="${intf.id}" data-field="cidr" class="modal-input intf-input">
                    </div>
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
                    // Handle CIDR/Mask conversion
                    if (field === 'cidr') {
                        // Convert CIDR to mask
                        intf.mask = this.cidrToMask(value);
                        // Update the mask field in UI
                        const maskInput = document.querySelector(`input[data-intf-id="${intfId}"][data-field="mask"]`);
                        if (maskInput) maskInput.value = intf.mask;
                    } else if (field === 'mask') {
                        // Convert mask to CIDR
                        const cidr = this.maskToCIDR(value);
                        // Update the CIDR field in UI
                        const cidrInput = document.querySelector(`input[data-intf-id="${intfId}"][data-field="cidr"]`);
                        if (cidrInput) cidrInput.value = cidr;
                    } else if (field === 'ip') {
                        // Auto-set subnet mask based on IP class if mask is empty
                        if (!intf.mask || intf.mask === '') {
                            const autoMask = this.getAutoMaskForIP(value);
                            if (autoMask) {
                                intf.mask = autoMask;
                                const maskInput = document.querySelector(`input[data-intf-id="${intfId}"][data-field="mask"]`);
                                if (maskInput) maskInput.value = autoMask;
                                const cidrInput = document.querySelector(`input[data-intf-id="${intfId}"][data-field="cidr"]`);
                                if (cidrInput) cidrInput.value = this.maskToCIDR(autoMask);
                            }
                        }
                    } else {
                        intf[field] = value;
                    }
                    
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

    // Convert subnet mask to CIDR notation
    maskToCIDR(mask) {
        if (!mask) return '';
        const parts = mask.split('.');
        if (parts.length !== 4) return '';
        
        let bits = 0;
        let binaryStr = '';
        
        for (const part of parts) {
            const n = parseInt(part);
            // Validate octet is 0-255
            if (isNaN(n) || n < 0 || n > 255) return '';
            
            // Convert to 8-bit binary string
            const octetBinary = n.toString(2).padStart(8, '0');
            binaryStr += octetBinary;
            bits += octetBinary.split('1').length - 1;
        }
        
        // Check for contiguous mask (no gaps like 10101010)
        // A valid subnet mask should be all 1s followed by all 0s
        const match = binaryStr.match(/^1*0*$/);
        if (!match) return '';
        
        return `/${bits}`;
    }

    // Convert CIDR notation to subnet mask
    cidrToMask(cidr) {
        if (!cidr) return '';
        const bits = parseInt(cidr.replace('/', ''));
        if (isNaN(bits) || bits < 0 || bits > 32) return '';
        
        let mask = 0xffffffff << (32 - bits);
        mask = mask >>> 0; // Convert to unsigned 32-bit
        
        return [
            (mask >>> 24) & 0xff,
            (mask >>> 16) & 0xff,
            (mask >>> 8) & 0xff,
            mask & 0xff
        ].join('.');
    }

    // Get auto subnet mask based on IP class
    getAutoMaskForIP(ip) {
        if (!ip) return '';
        const firstOctet = parseInt(ip.split('.')[0]);
        if (isNaN(firstOctet)) return '';
        
        if (firstOctet >= 1 && firstOctet <= 126) {
            return '255.0.0.0'; // Class A - /8
        } else if (firstOctet >= 128 && firstOctet <= 191) {
            return '255.255.0.0'; // Class B - /16
        } else if (firstOctet >= 192 && firstOctet <= 223) {
            return '255.255.255.0'; // Class C - /24
        }
        return '';
    }

    // Add static route UI
    addStaticRouteUI(existingRoute = null) {
        const container = document.getElementById('static-routes-container');
        const routeId = existingRoute ? existingRoute.id : crypto.randomUUID();
        
        const routeDiv = document.createElement('div');
        routeDiv.className = 'static-route-row';
        routeDiv.dataset.routeId = routeId;
        routeDiv.style.cssText = `
            display: flex;
            gap: 10px;
            margin-bottom: 10px;
            align-items: center;
        `;
        
        routeDiv.innerHTML = `
            <div style="flex: 1;">
                <input type="text" class="modal-input route-destination" placeholder="Rete (es. 192.168.1.0)" value="${existingRoute?.destination || ''}">
            </div>
            <div style="width: 100px;">
                <input type="text" class="modal-input route-mask" placeholder="Mask" value="${existingRoute?.mask || ''}">
            </div>
            <div style="flex: 1;">
                <input type="text" class="modal-input route-gateway" placeholder="Gateway" value="${existingRoute?.gateway || ''}">
            </div>
            <div style="width: 50px;">
                <input type="text" class="modal-input route-interface" placeholder="Intf" value="${existingRoute?.interface || ''}">
            </div>
            <button class="btn btn-danger remove-route-btn" style="padding: 5px 10px;">×</button>
        `;
        
        // Add event listeners
        routeDiv.querySelector('.remove-route-btn').addEventListener('click', () => {
            routeDiv.remove();
            this.updateStaticRoutes();
        });
        
        routeDiv.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', () => {
                this.updateStaticRoutes();
            });
        });
        
        container.appendChild(routeDiv);
        
        if (!existingRoute) {
            this.updateStaticRoutes();
        }
    }

    // Update static routes from UI
    updateStaticRoutes() {
        const container = document.getElementById('static-routes-container');
        const routes = [];
        
        container.querySelectorAll('.static-route-row').forEach(row => {
            const destination = row.querySelector('.route-destination').value;
            const mask = row.querySelector('.route-mask').value;
            const gateway = row.querySelector('.route-gateway').value;
            const interfaceName = row.querySelector('.route-interface').value;
            
            if (destination && mask) {
                routes.push({
                    id: row.dataset.routeId,
                    destination,
                    mask,
                    gateway: gateway || null,
                    interface: interfaceName || null
                });
            }
        });
        
        this.sendUpdate({ staticRoutes: routes });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ConfigLoader();
});
