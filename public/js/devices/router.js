// Router Device Subclass
import { Device } from './device.js';

export class Router extends Device {
    constructor(options = {}) {
        super({
            ...options,
            type: 'router',
            model: options.model || 'router-2911',
            name: options.name || 'Router',
            width: options.width || 80,
            height: options.height || 50
        });

        // Set default interfaces if none provided
        if (this.interfaces.length === 0) {
            this.interfaces = [
                {
                    id: Device.generateId(),
                    name: 'GigabitEthernet0/0',
                    type: 'gigabitethernet',
                    speed: 1000,
                    duplex: 'full',
                    mac: this.generateMAC(),
                    ip: null,
                    status: 'down'
                },
                {
                    id: Device.generateId(),
                    name: 'GigabitEthernet0/1',
                    type: 'gigabitethernet',
                    speed: 1000,
                    duplex: 'full',
                    mac: this.generateMAC(),
                    ip: null,
                    status: 'down'
                },
                {
                    id: Device.generateId(),
                    name: 'Serial0/0/0',
                    type: 'serial',
                    speed: 2,
                    duplex: 'half',
                    mac: this.generateMAC(),
                    ip: null,
                    status: 'down'
                }
            ];

            // Routing table
            this.routingTable = {
                directlyConnected: [],
                static: []
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
                '2d': 'icons/2d/router.png',
                '3d': 'icons/3d/router.svg'
            }
        };
    }

    render(ctx) {
        super.render(ctx);

        // Draw router-specific icon details (fallback only)
        if (!this.imageLoaded) {
            ctx.save();
            ctx.translate(this.x, this.y);

            // Router body
            ctx.fillStyle = '#21262d';
            ctx.strokeStyle = '#30363d';
            ctx.lineWidth = 1;

            // Main router body with antenna-like protrusions
            ctx.beginPath();
            ctx.roundRect(-35, -25, 70, 50, 6);
            ctx.fill();
            ctx.stroke();

            // Antenna indicators
            ctx.fillStyle = '#6b7280';
            ctx.fillRect(-40, -30, 4, 4);
            ctx.fillRect(36, -30, 4, 4);

            ctx.restore();
        }
    }

    // Basic routing table management
    addDirectlyConnected(network, mask, interfaceName) {
        this.routingTable.directlyConnected.push({
            network,
            mask,
            interface: interfaceName,
            type: 'directly-connected'
        });
    }

    addStaticRoute(network, mask, nextHopOrInterface, adminDistance = 1) {
        this.routingTable.static.push({
            network,
            mask,
            nextHopOrInterface,
            type: 'static',
            adminDistance
        });
    }

    lookupRoute(ipAddress) {
        // Simple longest prefix match - would be more complex in reality
        // For MVP, we'll just check if IP is in any directly connected subnet
        return this.routingTable.directlyConnected.find(route => {
            // Simplified check - real implementation would convert to network addresses
            return true; // placeholder
        }) || null;
    }
}