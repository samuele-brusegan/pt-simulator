// ARP Cache for MAC address resolution
// Implements ARP protocol for IP to MAC address mapping

export class ARPCache {
    constructor() {
        this.entries = []; // Array of {ipAddress, macAddress, interface, timestamp}
        this.maxAge = 60000; // 1 minute in milliseconds (typical ARP timeout)
        this.pendingRequests = new Map(); // Track pending ARP requests
    }

    // Add or update an ARP entry
    addEntry(ipAddress, macAddress, interfaceName) {
        // Remove existing entry for this IP if it exists
        this.entries = this.entries.filter(entry => entry.ipAddress !== ipAddress);
        
        // Add new entry
        this.entries.push({
            ipAddress: ipAddress,
            macAddress: macAddress,
            interface: interfaceName,
            timestamp: Date.now()
        });
        
        console.log(`ARP: Cached ${ipAddress} -> ${macAddress} on ${interfaceName}`);
        
        // Resolve any pending requests for this IP
        if (this.pendingRequests.has(ipAddress)) {
            const callbacks = this.pendingRequests.get(ipAddress);
            callbacks.forEach(callback => callback(macAddress));
            this.pendingRequests.delete(ipAddress);
        }
    }

    // Look up MAC address for an IP
    lookup(ipAddress) {
        const entry = this.entries.find(e => e.ipAddress === ipAddress);
        if (entry) {
            // Check if entry is not expired
            if (Date.now() - entry.timestamp < this.maxAge) {
                return entry.macAddress;
            } else {
                // Remove expired entry
                this.entries = this.entries.filter(e => e !== entry);
            }
        }
        return null;
    }

    // Check if IP is known
    isIPKnown(ipAddress) {
        return this.lookup(ipAddress) !== null;
    }

    // Remove entry for a specific IP
    removeEntry(ipAddress) {
        this.entries = this.entries.filter(entry => entry.ipAddress !== ipAddress);
    }

    // Remove all entries for a specific interface
    removeInterface(interfaceName) {
        this.entries = this.entries.filter(entry => entry.interface !== interfaceName);
    }

    // Clear all entries
    clear() {
        this.entries = [];
        this.pendingRequests.clear();
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
        this.cleanup();
        return [...this.entries];
    }

    // Get entry count
    getCount() {
        this.cleanup();
        return this.entries.length;
    }

    // Request MAC address for an IP (returns Promise)
    resolve(ipAddress, timeout = 5000) {
        const cachedMAC = this.lookup(ipAddress);
        if (cachedMAC) {
            return Promise.resolve(cachedMAC);
        }

        return new Promise((resolve, reject) => {
            // Check if there's already a pending request
            if (this.pendingRequests.has(ipAddress)) {
                this.pendingRequests.get(ipAddress).push(resolve);
            } else {
                this.pendingRequests.set(ipAddress, [resolve]);
                
                // Set timeout
                setTimeout(() => {
                    if (this.pendingRequests.has(ipAddress)) {
                        const callbacks = this.pendingRequests.get(ipAddress);
                        this.pendingRequests.delete(ipAddress);
                        callbacks.forEach(cb => cb(null));
                    }
                }, timeout);
            }
        });
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
        const cache = new ARPCache();
        cache.entries = data.entries || [];
        cache.maxAge = data.maxAge || 60000;
        return cache;
    }

    // Get summary for display
    getSummary() {
        this.cleanup();
        return this.entries.map(entry => ({
            ip: entry.ipAddress,
            mac: entry.macAddress,
            interface: entry.interface,
            age: Math.floor((Date.now() - entry.timestamp) / 1000) + 's'
        }));
    }
}
