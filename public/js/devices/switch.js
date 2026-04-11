// Switch Device Subclass
import { Device } from './device.js';

export class Switch extends Device {
    constructor(options = {}) {
        super({
            ...options,
            type: 'switch',
            model: options.model || 'switch-2960',
            name: options.name || 'Switch',
            width: options.width || 70,
            height: options.height || 45
        });

        // Set default interfaces if none provided
        if (this.interfaces.length === 0) {
            this.interfaces = [];
            
            // 24 FastEthernet ports
            for (let i = 1; i <= 24; i++) {
                this.interfaces.push({
                    id: Device.generateId(),
                    name: `FastEthernet0/${i}`,
                    type: 'fastethernet',
                    speed: 100,
                    duplex: 'full',
                    mac: this.generateMAC(),
                    ip: null,
                    status: 'down'
                });
            }
            
            // 2 GigabitEthernet ports
            for (let i = 1; i <= 2; i++) {
                this.interfaces.push({
                    id: Device.generateId(),
                    name: `GigabitEthernet0/${i}`,
                    type: 'gigabitethernet',
                    speed: 1000,
                    duplex: 'full',
                    mac: this.generateMAC(),
                    ip: null,
                    status: 'down'
                });
            }

            // Add VLAN capability
            this.vlans = {
                1: { name: 'default', ports: [] }
            };
        }
    }

    generateMAC() {
        // Generate a random MAC address with locally administered bit set
        const rand = () => Math.floor(Math.random() * 256);
        return [0x02, rand(), rand(), rand(), rand(), rand()]
            .map(b => b.toString(16).padStart(2, '0'))
            .join(':');
    }

    getDeviceInfo() {
        return {
            icons: {
                '2d': 'icons/2d/switch.png',
                '3d': 'icons/3d/workgroup switch.svg'
            }
        };
    }

    render(ctx) {
        super.render(ctx);

        // Draw switch-specific icon (fallback only)
        if (!this.imageLoaded) {
            ctx.save();
            ctx.translate(this.x, this.y);

            // Switch body
            ctx.fillStyle = '#21262d';
            ctx.strokeStyle = '#30363d';
            ctx.lineWidth = 1;

            // Main switch body
            ctx.beginPath();
            ctx.roundRect(-30, -20, 60, 40, 4);
            ctx.fill();
            ctx.stroke();

            // Port indicators (simplified)
            ctx.fillStyle = '#6b7280';
            for (let i = 0; i < 3; i++) {
                const x = -20 + i * 20;
                ctx.fillRect(x, -25, 3, 3);
            }

            ctx.restore();
        }
    }

    // VLAN management
    addVLAN(id, name) {
        if (!this.vlans[id]) {
            this.vlans[id] = { name, ports: [] };
        }
    }

    removeVLAN(id) {
        delete this.vlans[id];
        // Remove from all ports
        Object.values(this.vlans).forEach(vlan => {
            vlan.ports = vlan.ports.filter(portId => portId !== id);
        });
    }

    addPortToVLAN(portId, vlanId) {
        if (this.vlans[vlanId]) {
            if (!this.vlans[vlanId].ports.includes(portId)) {
                this.vlans[vlanId].ports.push(portId);
            }
        }
    }

    removePortFromVLAN(portId, vlanId) {
        if (this.vlans[vlanId]) {
            this.vlans[vlanId].ports = this.vlans[vlanId].ports.filter(
                pid => pid !== portId
            );
        }
    }
}