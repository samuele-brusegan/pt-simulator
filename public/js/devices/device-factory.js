// Device Factory - Creates device instances based on type
import { PC } from './pc.js';
import { Switch } from './switch.js';
import { Router } from './router.js';
import { Server } from './server.js';

export class DeviceFactory {
    constructor() {
        this.deviceTypes = {
            'pc': PC,
            'switch': Switch,
            'router': Router,
            'server': Server
        };
    }

    createDevice(type, options = {}) {
        const DeviceClass = this.deviceTypes[type];
        if (!DeviceClass) {
            throw new Error(`Unknown device type: ${type}`);
        }
        return new DeviceClass(options);
    }

    getAvailableTypes() {
        return Object.keys(this.deviceTypes);
    }

    getDeviceInfo(type) {
        // This would normally come from a config file
        const deviceInfo = {
            pc: {
                name: 'PC',
                icon: '💻',
                description: 'Personal Computer'
            },
            switch: {
                name: 'Switch',
                icon: '🔀',
                description: 'Network Switch'
            },
            router: {
                name: 'Router',
                icon: '📡',
                description: 'Network Router'
            },
            server: {
                name: 'Server',
                icon: '🖥️',
                description: 'Network Server'
            }
        };
        return deviceInfo[type] || null;
    }
}