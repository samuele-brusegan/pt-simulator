// PT-Simulator Main Application Entry Point
import { CanvasManager } from './canvas/canvas-manager.js';
import { StorageManager } from './storage/storage.js';
import { DeviceFactory } from './devices/device-factory.js';
import { PaletteManager } from './ui/palette-manager.js';
import { ConfigWindowManager } from './ui/config-window-manager.js';
import { Cable } from './network/cable.js';

class PTSimulator {
    constructor() {
        this.canvasManager = null;
        this.storageManager = new StorageManager();
        this.deviceFactory = new DeviceFactory();
        this.paletteManager = null;
        this.configWindowManager = new ConfigWindowManager(this);
        this.devices = [];
        this.cables = [];
        this.deleteMode = false; // Track if in delete mode

        this.init();
    }

    async init() {
        // Check for BroadcastChannel support
        if (!window.BroadcastChannel) {
            const errorMsg = 'Error: Your browser does not support BroadcastChannel. This app requires it for device configuration.';
            document.body.innerHTML = `<div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#0d1117;color:#f85149;font-family:monospace;text-align:center;padding:2rem;">${errorMsg}</div>`;
            throw new Error(errorMsg);
        }

        try {
            // Initialize managers
            this.canvasManager = new CanvasManager(document.getElementById('main-canvas'));
            this.paletteManager = new PaletteManager(document.getElementById('palette'), this.deviceFactory);

            // Load saved network or create new one
            await this.loadNetwork();

            // Set references for canvas rendering
            this.canvasManager.devices = this.devices;
            this.canvasManager.cables = this.cables;

            // Set up event listeners
            this.setupEventListeners();

            // Start render loop
            this.canvasManager.startRenderLoop();

            console.log('PT-Simulator initialized');
        } catch (error) {
            console.error('Failed to initialize PT-Simulator:', error);
        }
    }

    async loadNetwork() {
        try {
            const networkData = await this.storageManager.loadNetwork();
            if (networkData) {
                // 1. Re-instantiate devices
                const devicesData = networkData.devices || [];
                this.devices = devicesData.map(data => {
                    const device = this.deviceFactory.createDevice(data.type, data);
                    // Manually restore properties that might not be in constructor
                    if (data.x !== undefined) device.x = data.x;
                    if (data.y !== undefined) device.y = data.y;
                    if (data.id) device.id = data.id;
                    if (data.interfaces) device.interfaces = data.interfaces;
                    if (data.hostname) device.hostname = data.hostname;
                    return device;
                });

                // 2. Map IDs to device instances for cable reconstruction
                const deviceMap = {};
                this.devices.forEach(d => deviceMap[d.id] = d);

                // 3. Re-instantiate cables
                const cablesData = networkData.cables || [];
                this.cables.length = 0; // Clear in-place to keep canvas reference sync
                
                cablesData.forEach(data => {
                    const cable = Cable.deserialize(data, deviceMap);
                    
                    if (cable.startDevice && cable.endDevice && cable.startPort && cable.endPort) {
                        this.cables.push(cable);
                        
                        // Restore connections in devices
                        cable.startDevice.addConnection(cable);
                        cable.endDevice.addConnection(cable);
                    }
                });

                // Update canvas-manager references
                this.canvasManager.devices = this.devices;
                this.canvasManager.cables = this.cables;
            }
        } catch (error) {
            console.warn('Could not load network data:', error);
            // Start with empty network
            this.devices = [];
            this.cables = [];
            this.canvasManager.devices = this.devices;
            this.canvasManager.cables = this.cables;
        }
    }

    saveNetwork() {
        const networkData = {
            version: '1.0',
            timestamp: Date.now(),
            devices: this.devices.map(device => device.serialize()),
            cables: this.cables.map(cable => cable.serialize())
        };
        return this.storageManager.saveNetwork(networkData);
    }

    addDevice(device) {
        this.devices.push(device);
        this.canvasManager.devices = this.devices;
        this.saveNetwork();
        return device;
    }

    removeDevice(device) {
        console.log('removeDevice called for:', device);
        // Remove device from array
        this.devices = this.devices.filter(d => d.id !== device.id);

        // Remove all cables connected to this device
        this.cables = this.cables.filter(cable =>
            cable.startDevice !== device && cable.endDevice !== device
        );

        // Update canvas-manager references
        this.canvasManager.devices = this.devices;
        this.canvasManager.cables = this.cables;

        console.log('Devices after removal:', this.devices.length);
        this.saveNetwork();
    }

    addCable(cable) {
        this.cables.push(cable);
        this.canvasManager.cables = this.cables;
        // Update device connections
        cable.startDevice.addConnection(cable);
        cable.endDevice.addConnection(cable);
        this.saveNetwork();
        return cable;
    }

    removeCable(cable) {
        this.cables = this.cables.filter(c => c.id !== cable.id);
        this.canvasManager.cables = this.cables;
        this.saveNetwork();
    }


    setupEventListeners() {
        // Handle device creation from palette (legacy center placement)
        this.paletteManager.onDeviceCreate((deviceType) => {
            const device = this.deviceFactory.createDevice(deviceType);
            
            // Avoid overlapping at the center - add some jitter or offset
            const centerX = this.canvasManager.getWidth() / 2;
            const centerY = this.canvasManager.getHeight() / 2;
            
            // Initial offset based on existing device count
            const offset = this.devices.length * 40;
            const posX = Math.max(100, (centerX - 200) + (offset % 400));
            const posY = Math.max(100, (centerY - 100) + Math.floor(offset / 400) * 60);
            
            device.setPosition(posX, posY);
            this.addDevice(device);
        });

        // Handle canvas clicks for device selection
        this.canvasManager.onClick((x, y) => {
            const clickedDevice = this.devices.find(device =>
                device.containsPoint(x, y)
            );

            // Check if clicked on a cable
            const clickedCable = this.cables.find(cable =>
                cable.containsPoint(x, y)
            );

            // If in delete mode, show confirmation for clicked item
            if (this.deleteMode) {
                console.log('Delete mode active, clickedDevice:', clickedDevice, 'clickedCable:', clickedCable);
                if (clickedDevice) {
                    this.showDeleteModal('device', clickedDevice);
                    this.exitDeleteMode();
                } else if (clickedCable) {
                    this.showDeleteModal('cable', clickedCable);
                    this.exitDeleteMode();
                } else {
                    // Clicked empty space, exit delete mode
                    this.exitDeleteMode();
                }
                return;
            }

            // Deselect all devices and cables
            this.devices.forEach(device => device.setSelected(false));
            this.cables.forEach(cable => cable.selected = false);

            if (clickedDevice) {
                clickedDevice.setSelected(true);
            } else if (clickedCable) {
                clickedCable.selected = true;
            }
        });

        // Handle double click for configuration window
        this.canvasManager.canvas.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const rect = this.canvasManager.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left - this.canvasManager.offsetX) / this.canvasManager.scale;
            const y = (e.clientY - rect.top - this.canvasManager.offsetY) / this.canvasManager.scale;

            const clickedDevice = this.devices.find(device =>
                device.containsPoint(x, y)
            );

            if (clickedDevice) {
                console.log('Double click on device:', clickedDevice.name);
                this.configWindowManager.openWindow(clickedDevice.id);
                // Highlight the device when config window is opened
                clickedDevice.setConfigured(true);
            }
        });


        // Handle canvas drops for device creation (from palette drag)
        this.canvasManager.onDrop((x, y, deviceType) => {
            const device = this.deviceFactory.createDevice(deviceType);
            // Snap to grid (20px increments)
            const snappedX = Math.round(x / 20) * 20;
            const snappedY = Math.round(y / 20) * 20;
            device.setPosition(snappedX, snappedY);
            this.addDevice(device);
        });

        // Handle cable creation events
        this.canvasManager.onCableStart((x, y, details) => {
            // Visual feedback for cable start could be added here
            // For now, we just track the state in canvas manager
        });

        this.canvasManager.onCableEnd((cable) => {
            // Validate that cable doesn't already exist
            const exists = this.cables.some(existingCable =>
                (existingCable.startDevice === cable.startDevice &&
                 existingCable.startPort === cable.startPort &&
                 existingCable.endDevice === cable.endDevice &&
                 existingCable.endPort === cable.endPort) ||
                (existingCable.startDevice === cable.endDevice &&
                 existingCable.startPort === cable.endPort &&
                 existingCable.endDevice === cable.startDevice &&
                 existingCable.endPort === cable.startPort)
            );

            if (!exists) {
                this.addCable(cable);
            }
        });

        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();

                // Check if we're creating a cable - cancel it
                if (this.canvasManager.isCreatingCable) {
                    this.canvasManager.isCreatingCable = false;
                    this.canvasManager.cableStartDevice = null;
                    this.canvasManager.cableStartPort = null;
                    this.canvasManager.tempCable = null;
                    return;
                }

                // Find selected device or cable
                const selectedDevice = this.devices.find(device => device.selected);
                const selectedCable = this.cables.find(cable => cable.selected);

                if (selectedDevice) {
                    // Delete immediately if selected
                    this.showDeleteModal('device', selectedDevice);
                } else if (selectedCable) {
                    // Delete immediately if selected
                    this.showDeleteModal('cable', selectedCable);
                } else {
                    // Enter delete mode
                    this.enterDeleteMode();
                }
            }
            // Escape key to cancel cable creation or active tool
            else if (e.key === 'Escape') {
                if (this.canvasManager.isCreatingCable) {
                    this.canvasManager.isCreatingCable = false;
                    this.canvasManager.cableStartDevice = null;
                    this.canvasManager.cableStartPort = null;
                    this.canvasManager.tempCable = null;
                }

                // Exit delete mode if active
                if (this.deleteMode) {
                    this.exitDeleteMode();
                }

                // Reset active cable type and pointer
                this.canvasManager.activeCableType = null;
                this.canvasManager.canvas.style.cursor = 'default';
                this.paletteManager.clearSelection();
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvasManager.resize();
        });

        // Handle device updates from CLI
        document.addEventListener('deviceUpdated', () => {
            // Render loop will handle update automatically
            this.saveNetwork();
        });

        // Handle global icon style changes
        document.addEventListener('pt-simulator:iconStyleChanged', (e) => {
            const newStyle = e.detail.style;
            this.devices.forEach(device => {
                if (device.updateIconStyle) {
                    device.updateIconStyle(newStyle);
                }
            });
        });
    }

    enterDeleteMode() {
        this.deleteMode = true;
        this.canvasManager.canvas.style.cursor = 'not-allowed';
        this.showDeleteNotification();
        console.log('Entered delete mode');
    }

    exitDeleteMode() {
        this.deleteMode = false;
        this.canvasManager.canvas.style.cursor = 'default';
        this.hideDeleteNotification();
        console.log('Exited delete mode');
    }

    showDeleteNotification() {
        const notification = document.createElement('div');
        notification.id = 'delete-notification';
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.left = '20px';
        notification.style.backgroundColor = '#f85149';
        notification.style.color = 'white';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '6px';
        notification.style.fontFamily = "'Fira Code', monospace";
        notification.style.fontSize = '14px';
        notification.style.zIndex = '10000';
        notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
        notification.textContent = '🗑️ Modalità eliminazione attiva - Clicca su un dispositivo/cavo per eliminarlo';
        document.body.appendChild(notification);
    }

    hideDeleteNotification() {
        const notification = document.getElementById('delete-notification');
        if (notification) {
            notification.remove();
        }
    }

    showDeleteModal(type, item) {
        console.log('showDeleteModal called:', type, item);
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.cssText = `
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 8px;
            padding: 20px;
            min-width: 300px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        `;

        const title = document.createElement('h3');
        title.textContent = `Eliminare ${type === 'device' ? 'dispositivo' : 'cavo'}?`;
        title.style.cssText = `
            color: #f85149;
            margin: 0 0 15px 0;
            font-family: 'Fira Code', monospace;
            font-size: 16px;
        `;

        const message = document.createElement('p');
        message.textContent = type === 'device' 
            ? `Sei sicuro di voler eliminare il dispositivo "${item.name || item.type}"?` 
            : 'Sei sicuro di voler eliminare questo cavo?';
        message.style.cssText = `
            color: #c9d1d9;
            margin: 0 0 20px 0;
            font-family: 'Fira Code', monospace;
            font-size: 14px;
        `;

        const buttons = document.createElement('div');
        buttons.style.cssText = `
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Annulla';
        cancelBtn.style.cssText = `
            background: #21262d;
            color: #c9d1d9;
            border: 1px solid #30363d;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-family: 'Fira Code', monospace;
            font-size: 14px;
        `;
        cancelBtn.onclick = () => {
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
            }
        };

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Elimina';
        confirmBtn.style.cssText = `
            background: #f85149;
            color: white;
            border: 1px solid #f85149;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-family: 'Fira Code', monospace;
            font-size: 14px;
        `;
        confirmBtn.onclick = () => {
            console.log('Confirm delete clicked for:', type, item);
            if (type === 'device') {
                this.removeDevice(item);
            } else if (type === 'cable') {
                this.removeCable(item);
            }
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
            }
        };

        buttons.appendChild(cancelBtn);
        buttons.appendChild(confirmBtn);

        modalContent.appendChild(title);
        modalContent.appendChild(message);
        modalContent.appendChild(buttons);

        modal.appendChild(modalContent);
        document.body.appendChild(modal);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.ptSimulator = new PTSimulator();
});

// Export for module usage
export { PTSimulator };