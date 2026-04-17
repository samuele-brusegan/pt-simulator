// Base Device Class
export class Device {
    constructor(options = {}) {
        this.id = options.id || crypto.randomUUID();
        this.name = options.name || 'Device';
        this.type = options.type || 'device';
        this.model = options.model || 'unknown';
        this.x = options.x || 100;
        this.y = options.y || 100;
        this.rotation = options.rotation || 0; // in degrees

        // Visual properties
        this.width = options.width || 70;
        this.height = options.height || 50;
        this.selected = false;
        this.configured = false; // Track if config window is open

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

        // Image icon for rendering - use 3D by default if no preference saved
        this.iconStyle = localStorage.getItem('pt-simulator-icon-style') || '3d';
        this.image = new Image();
        this.imageLoaded = false;
        this.loadIcon();
    }

    loadIcon() {
        const deviceInfo = this.getDeviceInfo();
        if (deviceInfo && deviceInfo.icons) {
            this.image.src = deviceInfo.icons[this.iconStyle] || deviceInfo.icons['2d'];
            this.image.onload = () => { this.imageLoaded = true; };
        }
    }

    updateIconStyle(style) {
        this.iconStyle = style;
        this.imageLoaded = false;
        this.loadIcon();
    }

    getDeviceInfo() {
        // This will be properly implemented/passed, for now we assume a global reference or factory access
        // Ideally the factory should provide this. For MVP, we'll try to find it.
        return null; // Will be overridden or fixed
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

    // Configuration window state
    setConfigured(configured) {
        this.configured = configured;
    }

    isConfigured() {
        return this.configured;
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

        // Draw device body (Image or fallback)
        if (this.imageLoaded) {
            ctx.drawImage(
                this.image,
                -this.width / 2,
                -this.height / 2,
                this.width,
                this.height
            );
        } else {
            ctx.fillStyle = this.selected ? '#fbbf24' : '#21262d';
            ctx.strokeStyle = '#30363d';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(-this.width / 2, -this.height / 2, this.width, this.height, 4);
            ctx.fill();
            ctx.stroke();
        }

        // Draw selection highlight if needed
        if (this.selected) {
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2;
            ctx.strokeRect(-this.width / 2 - 2, -this.height / 2 - 2, this.width + 4, this.height + 4);
        }

        // Draw configuration highlight if config window is open
        if (this.configured) {
            ctx.strokeStyle = '#58a6ff';
            ctx.lineWidth = 3;
            ctx.strokeRect(-this.width / 2 - 3, -this.height / 2 - 3, this.width + 6, this.height + 6);
        }

        // Draw device label below
        ctx.fillStyle = '#c9d1d9';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(this.name, 0, this.height / 2 + 5);

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

    // Get position of a specific interface/port (returns device center as requested)
    getPortPosition(portName) {
        return {
            x: this.x,
            y: this.y
        };
    }

    // Find the nearest port to a given point (returns null if no port within threshold)
    getNearestPort(x, y, threshold = 15) {
        let nearestPort = null;
        let minDistance = threshold;

        this.interfaces.forEach(port => {
            const portPos = this.getPortPosition(port.name);
            if (portPos) {
                const distance = Math.sqrt(
                    Math.pow(x - portPos.x, 2) +
                    Math.pow(y - portPos.y, 2)
                );
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestPort = port;
                }
            }
        });

        return nearestPort;
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
                ip: intf.ip,
                mask: intf.mask,
                status: intf.status
            })),
            config: this.config
        };
    }

    // ID Generation Utility
    static generateId(prefix = 'id') {
        if (window.crypto && window.crypto.randomUUID) {
            return window.crypto.randomUUID();
        }
        // Fallback for non-secure contexts (HTTP)
        return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
    }

    // Deserialization
    static deserialize(data) {
        // This would be implemented in subclasses
        return new Device(data);
    }
}