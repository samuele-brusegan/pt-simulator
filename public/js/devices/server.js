// Server Device Subclass
import { Device } from './device.js';

export class Server extends Device {
    constructor(options = {}) {
        super({
            ...options,
            type: 'server',
            model: options.model || 'server-generic',
            name: options.name || 'Server',
            width: options.width || 70,
            height: options.height => 50
        });

        // Set default interfaces if none provided
        if (this.interfaces.length === 0) {
            this.interfaces = [
                {
                    id: crypto.randomUUID(),
                    name: 'eth0',
                    type: 'gigabitethernet',
                    speed: 1000,
                    duplex: 'full',
                    mac: this.generateMAC(),
                    ip: null,
                    status: 'down'
                },
                {
                    id: crypto.randomUUID(),
                    name: 'eth1',
                    type: 'gigabitethernet',
                    speed: 1000,
                    duplex: 'full',
                    mac: this.generateMAC(),
                    ip: null,
                    status: 'down'
                }
            ];
        }
    }

    generateMAC() {
        // Generate a random MAC address with locally administered bit set
        const rand = () => Math.floor(Math.random() * 256);
        return [0x02, rand(), rand(), rand(), rand(), rand()]
            .map(b => b.toString(16).padStart(2, '0'))
            .join(':');
    }

    render(ctx) {
        super.render(ctx);

        // Draw server-specific icon (tower/server-like)
        ctx.save();
        ctx.translate(this.x, this.y);

        // Server chassis
        ctx.fillStyle = '#21262d';
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.roundRect(-30, -25, 60, 50, 4);
        ctx.fill();
        ctx.stroke();

        // Drive bays indicator
        ctx.fillStyle = '#6b7280';
        for (let i = 0; i < 3; i++) {
            ctx.fillRect(-25 + i * 15, 10, 8, 4);
        }

        // Power/status lights
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(20, -15, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}