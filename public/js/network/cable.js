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

        // Check if ports are already connected to other cables
        if (startDevice.getConnectedCables().some(c =>
            c.startPort === startPort || c.endPort === startPort
        )) return false;

        if (endDevice.getConnectedCables().some(c =>
            c.startPort === endPort || c.endPort === endPort
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

        // Draw small circles at ends
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(startPos.x, startPos.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(endPos.x, endPos.y, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
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