// Cable Class - Represents a connection between two device interfaces
export class Cable {
    constructor(options = {}) {
        this.id = options.id || crypto.randomUUID();
        this.startDevice = options.startDevice || null;
        this.startPort = options.startPort || null;
        this.endDevice = options.endDevice || null;
        this.endPort = options.endPort || null;
        this.type = options.type || 'ethernet-straight'; // straight, cross, fiber, serial
        // Always use default color based on type, ignore passed color unless explicitly needed
        this.color = this.getDefaultColor(options.type);
        this.label = options.label || '';
        this.selected = false;
    }

    getDefaultColor(type) {
        const colorMap = {
            'console': '#58a6ff', // Azzurro
            'ethernet-straight': '#c9d1d9', // Grigio chiaro (per contrasto su sfondo scuro)
            'ethernet-cross': '#c9d1d9', // Grigio chiaro (per contrasto su sfondo scuro)
            'fiber-single': '#f85149', // Rosso
            'fiber-multi': '#f85149', // Rosso
            'serial-dce': '#f85149', // Rosso (fulmine)
            'serial-dte': '#f85149', // Rosso (fulmine)
            'serial': '#f85149' // Rosso (fulmine)
        };
        return colorMap[type] || '#3b82f6';
    }

    // Abbreviate interface names (e.g., FastEthernet0 -> Fa0)
    abbreviateInterfaceName(name) {
        if (!name) return '';
        const abbreviations = {
            'FastEthernet': 'Fa',
            'GigabitEthernet': 'Gi',
            'Serial': 'S',
            'Console': 'Con'
        };
        
        for (const [full, abbrev] of Object.entries(abbreviations)) {
            if (name.startsWith(full)) {
                return name.replace(full, abbrev);
            }
        }
        return name;
    }

    // Get status indicator for interfaces
    getStatusIndicators() {
        const startStatus = this.startPort ? this.startPort.status : 'down';
        const endStatus = this.endPort ? this.endPort.status : 'down';
        
        return {
            start: startStatus,
            end: endStatus,
            bothUp: startStatus === 'up' && endStatus === 'up',
            bothDown: startStatus === 'down' && endStatus === 'down',
            mixed: startStatus !== endStatus
        };
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

    // Check if a point is near the cable (for click detection)
    containsPoint(x, y, threshold = 5) {
        const startPos = this.getStartPosition();
        const endPos = this.getEndPosition();

        if (!startPos || !endPos) return false;

        // Calculate distance from point to line segment
        const A = x - startPos.x;
        const B = y - startPos.y;
        const C = endPos.x - startPos.x;
        const D = endPos.y - startPos.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = startPos.x;
            yy = startPos.y;
        } else if (param > 1) {
            xx = endPos.x;
            yy = endPos.y;
        } else {
            xx = startPos.x + param * C;
            yy = startPos.y + param * D;
        }

        const dx = x - xx;
        const dy = y - yy;
        const distance = Math.sqrt(dx * dx + dy * dy);

        return distance <= threshold;
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
        if (startDevice && startDevice.getConnectedCables && startDevice.getConnectedCables().some(c =>
            (c.startDevice && c.startDevice.id === startDevice.id && c.startPort.id === startPort.id) ||
            (c.endDevice && c.endDevice.id === startDevice.id && c.endPort.id === startPort.id)
        )) return false;

        if (endDevice && endDevice.getConnectedCables && endDevice.getConnectedCables().some(c =>
            (c.startDevice && c.startDevice.id === endDevice.id && c.startPort.id === endPort.id) ||
            (c.endDevice && c.endDevice.id === endDevice.id && c.endPort.id === endPort.id)
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

    // Render the cable as a straight line
    render(ctx) {
        const startPos = this.getStartPosition();
        const endPos = this.getEndPosition();

        if (!startPos || !endPos) return;

        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.selected ? 4 : 2;
        ctx.lineCap = 'round';

        // Draw straight line
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(endPos.x, endPos.y);
        ctx.stroke();

        // Draw labels near the ends
        const midX = (startPos.x + endPos.x) / 2;
        const midY = (startPos.y + endPos.y) / 2;
        this.renderLabelAt(ctx, startPos, midX, midY, this.startPort, this.startDevice);
        this.renderLabelAt(ctx, endPos, midX, midY, this.endPort, this.endDevice);

        // Draw status indicators on the cable
        this.renderStatusIndicators(ctx, startPos, endPos, midX, midY);

        ctx.restore();
    }

    renderLabelAt(ctx, pos, ctrlX, ctrlY, port, device) {
        if (!port || !device) return;

        // Vector towards the line center
        const dx = ctrlX - pos.x;
        const dy = ctrlY - pos.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 1) return;

        // Position the label slightly away from the device center
        const offset = 45;
        const lx = pos.x + (dx / dist) * offset;
        const ly = pos.y + (dy / dist) * offset;

        // Calculate perpendicular direction for label offset
        const perpX = -dy / dist;
        const perpY = dx / dist;
        const labelOffset = 18; // Offset label perpendicular to cable direction

        ctx.save();
        ctx.translate(lx + perpX * labelOffset, ly + perpY * labelOffset);
        
        const name = this.abbreviateInterfaceName(port.name);
        const ip = port.ip || '';
        const cidr = port.mask ? this.maskToCIDR(port.mask) : '';
        
        // Split into lines
        const lines = ip ? [name, ip + cidr] : [name];
        
        ctx.font = '9px "Fira Code", monospace';
        
        // Calculate max width and total height
        let maxWidth = 0;
        lines.forEach(line => {
            const metrics = ctx.measureText(line);
            if (metrics.width > maxWidth) maxWidth = metrics.width;
        });
        
        const lineHeight = 11;
        const padding = 6;
        const pw = maxWidth + padding * 2;
        const ph = lines.length * lineHeight + padding * 2;

        ctx.fillStyle = 'rgba(13, 17, 23, 0.6)';
        ctx.fillRect(-pw/2, -ph/2, pw, ph);
        
        ctx.fillStyle = '#8b949e';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Draw each line
        lines.forEach((line, index) => {
            const yOffset = -ph/2 + padding + lineHeight/2 + index * lineHeight;
            ctx.fillText(line, 0, yOffset);
        });
        
        ctx.restore();
    }

    renderStatusIndicators(ctx, startPos, endPos, midX, midY) {
        const status = this.getStatusIndicators();
        
        // Calculate positions for indicators (near the labels)
        const startIndicatorOffset = 55;
        const endIndicatorOffset = 55;
        
        const startDx = midX - startPos.x;
        const startDy = midY - startPos.y;
        const startDist = Math.sqrt(startDx*startDx + startDy*startDy);
        
        const endDx = midX - endPos.x;
        const endDy = midY - endPos.y;
        const endDist = Math.sqrt(endDx*endDx + endDy*endDy);
        
        const startIndicatorX = startPos.x + (startDx / startDist) * startIndicatorOffset;
        const startIndicatorY = startPos.y + (startDy / startDist) * startIndicatorOffset;
        
        const endIndicatorX = endPos.x + (endDx / endDist) * endIndicatorOffset;
        const endIndicatorY = endPos.y + (endDy / endDist) * endIndicatorOffset;
        
        // Draw start indicator
        this.drawStatusIndicator(ctx, startIndicatorX, startIndicatorY, status.start, status.mixed);
        
        // Draw end indicator
        this.drawStatusIndicator(ctx, endIndicatorX, endIndicatorY, status.end, status.mixed);
    }

    drawStatusIndicator(ctx, x, y, portStatus, isMixed) {
        const size = 6;
        ctx.save();
        ctx.translate(x, y);
        
        if (portStatus === 'up') {
            // Green dot for UP
            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.arc(0, 0, size/2, 0, Math.PI * 2);
            ctx.fill();
        } else if (portStatus === 'down') {
            if (isMixed) {
                // Orange triangle for DOWN in mixed state
                ctx.fillStyle = '#f59e0b';
                ctx.beginPath();
                ctx.moveTo(0, -size/2);
                ctx.lineTo(size/2, size/2);
                ctx.lineTo(-size/2, size/2);
                ctx.closePath();
                ctx.fill();
            } else {
                // Red dot for DOWN (both down)
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                ctx.arc(0, 0, size/2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        ctx.restore();
    }

    maskToCIDR(mask) {
        if (!mask) return '';
        const parts = mask.split('.');
        if (parts.length !== 4) return '';
        
        let bits = 0;
        let binaryStr = '';
        
        for (const part of parts) {
            const n = parseInt(part);
            // Validate octet is 0-255
            if (isNaN(n) || n < 0 || n > 255) return '';
            
            // Convert to 8-bit binary string
            const octetBinary = n.toString(2).padStart(8, '0');
            binaryStr += octetBinary;
            bits += octetBinary.split('1').length - 1;
        }
        
        // Check for contiguous mask (no gaps like 10101010)
        // A valid subnet mask should be all 1s followed by all 0s
        const match = binaryStr.match(/^1*0*$/);
        if (!match) return '';
        
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
            label: data.label
        });
        // Color will be set by getDefaultColor based on type

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
            // Find port by ID in the device
            if (cable.endDevice) {
                cable.endPort = cable.endDevice.interfaces.find(
                    intf => intf.id === data.endPortId
                );
            }
        }

        return cable;
    }
}