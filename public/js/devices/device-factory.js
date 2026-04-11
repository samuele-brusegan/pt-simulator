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
        const deviceInfo = {
            pc: {
                name: 'PC',
                icons: {
                    '2d': 'icons/2d/pc.png',
                    '3d': 'icons/3d/pc.svg'
                },
                description: 'Personal Computer'
            },
            switch: {
                name: 'Switch',
                icons: {
                    '2d': 'icons/2d/switch.png',
                    '3d': 'icons/3d/workgroup switch.svg'
                },
                description: 'Network Switch'
            },
            router: {
                name: 'Router',
                icons: {
                    '2d': 'icons/2d/router.png',
                    '3d': 'icons/3d/router.svg'
                },
                description: 'Network Router'
            },
            server: {
                name: 'Server',
                icons: {
                    '2d': 'icons/2d/server.png',
                    '3d': 'icons/3d/fileserver.svg'
                },
                description: 'Network Server'
            }
        };
        return deviceInfo[type] || null;
    }
}