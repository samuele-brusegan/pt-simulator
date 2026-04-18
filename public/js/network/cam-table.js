// CAM (Content Addressable Memory) Table for Switches
// Implements MAC address learning and forwarding logic

export class CAMTable {
    constructor() {
        this.entries = []; // Array of {macAddress, port, timestamp}
        this.maxAge = 300000; // 5 minutes in milliseconds
    }

    // Learn a MAC address on a specific port
    learn(macAddress, port) {
        // Remove existing entry for this MAC if it exists
        this.entries = this.entries.filter(entry => entry.macAddress !== macAddress);
        
        // Add new entry
        this.entries.push({
            macAddress: macAddress,
            port: port,
            timestamp: Date.now()
        });
        
        console.log(`CAM: Learned ${macAddress} on port ${port.name}`);
    }

    // Find which port a MAC address is associated with
    lookup(macAddress) {
        const entry = this.entries.find(e => e.macAddress === macAddress);
        if (entry) {
            // Check if entry is not expired
            if (Date.now() - entry.timestamp < this.maxAge) {
                return entry.port;
            } else {
                // Remove expired entry
                this.entries = this.entries.filter(e => e !== entry);
            }
        }
        return null;
    }

    // Get port for MAC address (returns null if unknown)
    getPortForMAC(macAddress) {
        return this.lookup(macAddress);
    }

    // Check if MAC is known
    isMACKnown(macAddress) {
        return this.lookup(macAddress) !== null;
    }

    // Remove entry for a specific MAC
    forget(macAddress) {
        this.entries = this.entries.filter(entry => entry.macAddress !== macAddress);
    }

    // Remove all entries for a specific port
    forgetPort(port) {
        this.entries = this.entries.filter(entry => entry.port !== port);
    }

    // Clear all entries
    clear() {
        this.entries = [];
    }

    // Remove expired entries
    cleanup() {
        const now = Date.now();
        this.entries = this.entries.filter(entry => 
            now - entry.timestamp < this.maxAge
        );
    }

    // Get all entries
    getEntries() {
        // Cleanup first
        this.cleanup();
        return [...this.entries];
    }

    // Get entry count
    getCount() {
        this.cleanup();
        return this.entries.length;
    }

    // Serialize for saving
    serialize() {
        return {
            entries: this.entries,
            maxAge: this.maxAge
        };
    }

    // Deserialize from saved data
    static deserialize(data) {
        const cam = new CAMTable();
        cam.entries = data.entries || [];
        cam.maxAge = data.maxAge || 300000;
        return cam;
    }

    // Get forwarding decision for a packet
    getForwardingPort(destinationMAC, ingressPort) {
        const knownPort = this.lookup(destinationMAC);
        
        if (knownPort) {
            // Known destination - forward to specific port
            if (knownPort !== ingressPort) {
                return knownPort; // Forward to specific port
            } else {
                return null; // Don't forward back to ingress port
            }
        } else {
            // Unknown destination - flood to all ports except ingress
            return 'flood';
        }
    }
}
