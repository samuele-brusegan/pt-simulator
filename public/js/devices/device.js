// Base Device Class
export class Device {
    constructor(options = {}) {
        this.id = options.id || crypto.randomUUID();
        this.type = options.type || 'generic';
        this.model = options.model || 'unknown';
        this.name = options.name || `${this.type.charAt(0).toUpperCase() + this.type.slice(1)}`;

        // Position and transformation
        this.x = options.x || 0;
        this.y = options.y || 0;
        this.rotation = options.rotation || 0; // in degrees

        // Visual properties
        this.width = options.width || 60;
        this.height = options.height || 40;
        this.selected = false;

        // Interfaces (ports)
        this.interfaces = options.interfaces || [];

        // Configuration state
        this.config = options.config || {
            hostname: this.name,
            enableSecret: null,
            interfaces: {}
        };

        // Connection tracking
        this.connectedCables = [];
    }

    // Position management
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }

    getPosition() {
        return { x: this.x, y: this.y };
    }

    // Selection management
    setSelected(selected) {
        this.selected = selected;
    }

    isSelected() {
        return this.selected;
    }

    // Interface management
    addInterface(interfaceObj) {
        this.interfaces.push(interfaceObj);
    }

    removeInterface(interfaceId) {
        this.interfaces = this.interfaces.filter(intf => intf.id !== interfaceId);
    }

    getInterfaceById(id) {
        return this.interfaces.find(intf => intf.id === id);
    }

    getInterfaceByName(name) {
        return this.interfaces.find(intf => intf.name === name);
    }

    // Connection management
    addConnection(cable) {
        if (!this.connectedCables.includes(cable)) {
            this.connectedCables.push(cable);
        }
    }

    removeConnection(cable) {
        this.connectedCables = this.connectedCables.filter(c => c !== cable);
    }

    getConnectedCables() {
        return [...this.connectedCables];
    }

    // Hit testing
    containsPoint(x, y) {
        // Simple rectangular hit test - can be improved for rotated devices
        const halfWidth = this.width / 2;
        const halfHeight = this.height / 2;

        return (
            x >= this.x - halfWidth &&
            x <= this.x + halfWidth &&
            y >= this.y - halfHeight &&
            y <= this.y + halfHeight
        );
    }

    // Rendering - to be overridden by subclasses
    render(ctx) {
        // Save context state
        ctx.save();

        // Translate to device position
        ctx.translate(this.x, this.y);

        // Rotate if needed
        if (this.rotation !== 0) {
            ctx.rotate(this.rotation * Math.PI / 180);
        }

        // Draw device body
        ctx.fillStyle = this.selected ? '#fbbf24' : '#21262d';
        ctx.strokeStyle = '#30363d';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.roundRect(
            -this.width / 2,
            -this.height / 2,
            this.width,
            this.height,
            4
        );
        ctx.fill();
        ctx.stroke();

        // Draw device label
        ctx.fillStyle = '#c9d1d9';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.name, 0, 0);

        // Draw interfaces (ports)
        this.renderInterfaces(ctx);

        // Restore context
        ctx.restore();
    }

    renderInterfaces(ctx) {
        // Draw interfaces as small circles on device edges
        this.interfaces.forEach((interfaceObj, index) => {
            // Calculate position based on interface index
            const portSize = 6;
            const portX = this._getInterfaceX(index);
            const portY = this._getInterfaceY(index);

            // Determine port color based on connection status
            const isConnected = this.connectedCables.some(cable =>
                cable.startDevice === this || cable.endDevice === this
            );

            ctx.fillStyle = isConnected ? '#10b981' : '#ef4444';
            ctx.beginPath();
            ctx.arc(portX, portY, portSize / 2, 0, Math.PI * 2);
            ctx.fill();

            // Draw interface label (small)
            ctx.fillStyle = '#9ca3af';
            ctx.font = '8px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(interfaceObj.name, portX, portY - portSize / 2 - 2);
        });
    }

    _getInterfaceX(index) {
        // Simple distribution - can be improved per device type
        const count = this.interfaces.length;
        if (count === 1) return 0;

        // Distribute ports on device perimeter
        const angle = (index / Math.max(count - 1, 1)) * Math.PI * 2;
        const radius = Math.max(this.width, this.height) / 2 + 8;

        return Math.cos(angle) * radius;
    }

    _getInterfaceY(index) {
        const count = this.interfaces.length;
        if (count === 1) return 0;

        const angle = (index / Math.max(count - 1, 1)) * Math.PI * 2;
        const radius = Math.max(this.width, this.height) / 2 + 8;

        return Math.sin(angle) * radius;
    }

    // Get position of a specific interface/port
    getPortPosition(portName) {
        const interfaceObj = this.interfaces.find(intf => intf.name === portName);
        if (!interfaceObj) return null;

        // Find index of this interface
        const index = this.interfaces.indexOf(interfaceObj);
        if (index === -1) return null;

        // Calculate position
        const count = this.interfaces.length;
        if (count === 1) {
            const angle = 0;
        } else {
            const angle = (index / Math.max(count - 1, 1)) * Math.PI * 2;
        }
        const radius = Math.max(this.width, this.height) / 2 + 8;

        return {
            x: this.x + Math.cos(angle) * radius,
            y: this.y + Math.sin(angle) * radius
        };
    }

    // Serialization for saving
    serialize() {
        return {
            id: this.id,
            type: this.type,
            model: this.model,
            name: this.name,
            x: this.x,
            y: this.y,
            rotation: this.rotation,
            width: this.width,
            height: this.height,
            interfaces: this.interfaces.map(intf => ({
                id: intf.id,
                name: intf.name,
                type: intf.type,
                // Add any interface-specific state here
            })),
            config: this.config
        };
    }

    // Deserialization
    static deserialize(data) {
        // This would be implemented in subclasses
        return new Device(data);
    }
}