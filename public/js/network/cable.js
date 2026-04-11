// Cable Class - Represents a connection between two device interfaces
export class Cable {
    constructor(options = {}) {
        this.id = options.id || crypto.randomUUID();
        this.startDevice = options.startDevice || null;
        this.startPort = options.startPort || null;
        this.endDevice = options.endDevice || null;
        this.endPort = options.endPort || null;
        this.type = options.type || 'ethernet-straight'; // straight, cross, fiber, serial
        this.color = options.color || '#3b82f6';
        this.label = options.label || '';
    }

    // Set connection endpoints
    setConnection(startDevice, startPort, endDevice, endPort) {
        this.startDevice = startDevice;
        this.startPort = startPort;
        this.endDevice = endDevice;
        this.endPort = endPort;
    }

    // Check if cable is connected to a device
    isConnectedTo(device) {
        return this.startDevice === device || this.endDevice === device;
    }

    // Get the other device given one device
    getOtherDevice(device) {
        if (this.startDevice === device) return this.endDevice;
        if (this.endDevice === device) return this.startDevice;
        return null;
    }

    // Get the other port given one port
    getOtherPort(port) {
        if (this.startPort === port) return this.endPort;
        if (this.endPort === port) return this.startPort;
        return null;
    }

    // Validate if this cable type is valid for the given interfaces
    static isValidConnection(startDevice, startPort, endDevice, endPort, cableType) {
        // Same device not allowed
        if (startDevice === endDevice) return false;

        // Check if ports are already connected to other cables (using IDs for robustness)
        if (startDevice.getConnectedCables().some(c =>
            (c.startDevice.id === startDevice.id && c.startPort.id === startPort.id) ||
            (c.endDevice.id === startDevice.id && c.endPort.id === startPort.id)
        )) return false;

        if (endDevice.getConnectedCables().some(c =>
            (c.startDevice.id === endDevice.id && c.startPort.id === endPort.id) ||
            (c.endDevice.id === endDevice.id && c.endPort.id === endPort.id)
        )) return false;

        // Check compatibility based on cable type and interface types
        const compatibilityMap = {
            'ethernet-straight': [
                ['fastethernet', 'fastethernet'],
                ['gigabitethernet', 'gigabitethernet'],
                ['gigabitethernet', 'fastethernet']
            ],
            'ethernet-cross': [
                ['fastethernet', 'fastethernet'],
                ['serial', 'serial']
            ],
            'fiber-single': [
                ['fiber-single', 'fiber-single']
            ],
            'fiber-multi': [
                ['fiber-multi', 'fiber-multi']
            ],
            'serial': [
                ['serial', 'serial']
            ]
        };

        const startType = startPort.type;
        const endType = endPort.type;
        const validPairs = compatibilityMap[cableType] || [];

        // Check if the pair is valid (order doesn't matter)
        return validPairs.some(([typeA, typeB]) =>
            (startType === typeA && endType === typeB) ||
            (startType === typeB && endType === typeA)
        );
    }

    // Get world coordinates of start port
    getStartPosition() {
        if (!this.startDevice || !this.startPort) return null;
        return this.startDevice.getPortPosition(this.startPort.name);
    }

    // Get world coordinates of end port
    getEndPosition() {
        if (!this.endDevice || !this.endPort) return null;
        return this.endDevice.getPortPosition(this.endPort.name);
    }

    // Render the cable as a Bezier curve
    render(ctx) {
        const startPos = this.getStartPosition();
        const endPos = this.getEndPosition();

        if (!startPos || !endPos) return;

        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        // Create a Bezier curve with control points for a nice cable shape
        const controlX = (startPos.x + endPos.x) / 2;
        const controlY = (startPos.y + endPos.y) / 2 - 50; // Arc upwards

        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        ctx.quadraticCurveTo(controlX, controlY, endPos.x, endPos.y);
        ctx.stroke();

        // Draw labels near the ends
        this.renderLabelAt(ctx, startPos, controlX, controlY, this.startPort, this.startDevice);
        this.renderLabelAt(ctx, endPos, controlX, controlY, this.endPort, this.endDevice);

        ctx.restore();
    }

    renderLabelAt(ctx, pos, ctrlX, ctrlY, port, device) {
        if (!port || !device) return;

        // Vector towards the curve center
        const dx = ctrlX - pos.x;
        const dy = ctrlY - pos.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 1) return;

        // Position the label slightly away from the device center
        const offset = 45;
        const lx = pos.x + (dx / dist) * offset;
        const ly = pos.y + (dy / dist) * offset;

        ctx.save();
        ctx.translate(lx, ly);
        
        const name = port.name;
        const ip = port.ip || '';
        const cidr = port.mask ? this.maskToCIDR(port.mask) : '';
        const text = `${name}${ip ? ' (' + ip + cidr + ')' : ''}`;
        
        ctx.font = '9px "Fira Code", monospace';
        const metrics = ctx.measureText(text);
        const pw = metrics.width + 4;
        const ph = 12;

        ctx.fillStyle = 'rgba(13, 17, 23, 0.85)';
        ctx.fillRect(-pw/2, -ph/2, pw, ph);
        
        ctx.fillStyle = '#8b949e';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 0, 0);
        
        ctx.restore();
    }

    maskToCIDR(mask) {
        if (!mask) return '';
        const parts = mask.split('.');
        if (parts.length !== 4) return '';
        let bits = 0;
        parts.forEach(part => {
            let n = parseInt(part);
            if (isNaN(n)) return;
            // Count bits (classic approach)
            const b = n.toString(2).split('1').length - 1;
            bits += b;
        });
        return `/${bits}`;
    }

    // Serialize for saving
    serialize() {
        return {
            id: this.id,
            startDeviceId: this.startDevice ? this.startDevice.id : null,
            startPortId: this.startPort ? this.startPort.id : null,
            endDeviceId: this.endDevice ? this.endDevice.id : null,
            endPortId: this.endPort ? this.endPort.id : null,
            type: this.type,
            color: this.color,
            label: this.label
        };
    }

    // Deserialize
    static deserialize(data, deviceMap) {
        const cable = new Cable({
            id: data.id,
            type: data.type,
            color: data.color,
            label: data.label
        });

        // Resolve device references
        if (data.startDeviceId) cable.startDevice = deviceMap[data.startDeviceId];
        if (data.endDeviceId) cable.endDevice = deviceMap[data.endDeviceId];
        if (data.startPortId) {
            // Find port by ID in the device
            if (cable.startDevice) {
                cable.startPort = cable.startDevice.interfaces.find(
                    intf => intf.id === data.startPortId
                );
            }
        }
        if (data.endPortId) {
            if (cable.endDevice) {
                cable.endPort = cable.endDevice.interfaces.find(
                    intf => intf.id === data.endPortId
                );
            }
        }

        return cable;
    }
}