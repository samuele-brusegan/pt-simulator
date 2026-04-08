// PC Device Subclass
import { Device } from './device.js';

export class PC extends Device {
    constructor(options = {}) {
        super({
            ...options,
            type: 'pc',
            model: options.model || 'pc-generic',
            name: options.name || 'PC',
            width: options.width || 60,
            height: options.height || 40
        });

        // Set default interfaces if none provided
        if (this.interfaces.length === 0) {
            this.interfaces = [
                {
                    id: crypto.randomUUID(),
                    name: 'FastEthernet0',
                    type: 'fastethernet',
                    speed: 100,
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

        // Draw PC-specific icon (monitor-like)
        ctx.save();
        ctx.translate(this.x, this.y);

        // Monitor screen
        ctx.fillStyle = '#000000';
        ctx.fillRect(-20, -18, 40, 30);

        // Monitor stand
        ctx.fillStyle = '#6b7280';
        ctx.fillRect(-4, 12, 8, 6);

        ctx.restore();
    }
}