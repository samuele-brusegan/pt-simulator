// PT-Simulator Main Application Entry Point
import { CanvasManager } from './canvas/canvas-manager.js';
import { StorageManager } from './storage/storage.js';
import { DeviceFactory } from './devices/device-factory.js';
import { PaletteManager } from './ui/palette-manager.js';
import { TerminalManager } from './cli/terminal-manager.js';
import { ConfigWindowManager } from './ui/config-window-manager.js';
import { Cable } from './network/cable.js';

class PTSimulator {
    constructor() {
        this.canvasManager = null;
        this.storageManager = new StorageManager();
        this.deviceFactory = new DeviceFactory();
        this.paletteManager = null;
        this.terminalManager = null;
        this.configWindowManager = new ConfigWindowManager(this);
        this.devices = [];
        this.cables = [];

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
            this.terminalManager = new TerminalManager(document.getElementById('terminal'), this);

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

                this.renderNetwork();
            }
        } catch (error) {
            console.warn('Could not load network data:', error);
            // Start with empty network
            this.devices = [];
            this.cables = [];
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
        this.saveNetwork();
        return device;
    }

    removeDevice(device) {
        const index = this.devices.indexOf(device);
        if (index !== -1) {
            // Remove any cables connected to this device
            this.cables = this.cables.filter(cable =>
                cable.startDevice !== device && cable.endDevice !== device
            );
            this.devices.splice(index, 1);
            this.saveNetwork();
        }
    }

    addCable(cable) {
        this.cables.push(cable);
        // Update device connections
        cable.startDevice.addConnection(cable);
        cable.endDevice.addConnection(cable);
        this.saveNetwork();
        return cable;
    }

    removeCable(cable) {
        const index = this.cables.indexOf(cable);
        if (index !== -1) {
            // Update device connections
            cable.startDevice.removeConnection(cable);
            cable.endDevice.removeConnection(cable);
            this.cables.splice(index, 1);
            this.saveNetwork();
        }
    }

    renderNetwork() {
        this.canvasManager.clear();
        // Render cables first (behind devices)
        this.cables.forEach(cable => cable.render(this.canvasManager.getContext()));
        // Render devices
        this.devices.forEach(device => device.render(this.canvasManager.getContext()));
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

            // Deselect all devices
            this.devices.forEach(device => device.setSelected(false));

            if (clickedDevice) {
                clickedDevice.setSelected(true);
                // Set active device for CLI terminal
                this.terminalManager.setActiveDevice(clickedDevice);
                this.terminalManager.focus();
            } else {
                // Clicked on empty space, clear terminal
                this.terminalManager.setActiveDevice(null);
            }

            this.renderNetwork();
        });

        // Handle double click for configuration window
        this.canvasManager.canvas.addEventListener('dblclick', (e) => {
            const rect = this.canvasManager.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left - this.canvasManager.offsetX) / this.canvasManager.scale;
            const y = (e.clientY - rect.top - this.canvasManager.offsetY) / this.canvasManager.scale;

            const clickedDevice = this.devices.find(device =>
                device.containsPoint(x, y)
            );

            if (clickedDevice) {
                this.configWindowManager.openWindow(clickedDevice.id);
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
            if (e.key === 'Delete') {
                // Check if we're creating a cable - cancel it
                if (this.canvasManager.isCreatingCable) {
                    this.canvasManager.isCreatingCable = false;
                    this.canvasManager.cableStartDevice = null;
                    this.canvasManager.cableStartPort = null;
                    this.canvasManager.tempCable = null;
                    this.renderNetwork(); // Clear temp cable
                    return;
                }

                const selectedDevice = this.devices.find(device => device.isSelected());
                if (selectedDevice) {
                    if (confirm('Delete this device?')) {
                        this.removeDevice(selectedDevice);
                        this.renderNetwork();
                    }
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
                
                // Reset active cable type and pointer
                this.canvasManager.activeCableType = null;
                this.canvasManager.canvas.style.cursor = 'default';
                this.paletteManager.clearSelection();
                
                this.renderNetwork(); // Clear temp cable and refresh UI
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvasManager.resize();
            this.renderNetwork();
        });

        // Handle device updates from CLI
        document.addEventListener('deviceUpdated', () => {
            this.renderNetwork();
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
            this.renderNetwork();
        });
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.ptSimulator = new PTSimulator();
});

// Export for module usage
export { PTSimulator };