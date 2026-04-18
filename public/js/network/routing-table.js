// Routing Table for Routers
// Implements static routing with longest prefix match

export class RoutingTable {
    constructor() {
        this.routes = []; // Array of {destination, mask, gateway, interface, metric}
    }

    // Add a route
    addRoute(destination, mask, gateway, interfaceName, metric = 1) {
        // Check if route already exists
        const existingIndex = this.routes.findIndex(r => 
            r.destination === destination && 
            r.mask === mask
        );
        
        if (existingIndex >= 0) {
            // Update existing route
            this.routes[existingIndex] = {
                destination,
                mask,
                gateway,
                interface: interfaceName,
                metric
            };
        } else {
            // Add new route
            this.routes.push({
                destination,
                mask,
                gateway,
                interface: interfaceName,
                metric
            });
        }
        
        console.log(`Routing: Added route ${destination}/${mask} via ${gateway} on ${interfaceName}`);
    }

    // Remove a route
    removeRoute(destination, mask) {
        this.routes = this.routes.filter(r => 
            !(r.destination === destination && r.mask === mask)
        );
    }

    // Find the best route for a destination IP (longest prefix match)
    findRoute(destinationIP) {
        let bestRoute = null;
        let bestPrefixLength = -1;

        for (const route of this.routes) {
            const prefixLength = this.getPrefixLength(route.mask);
            
            if (prefixLength > bestPrefixLength && this.isInNetwork(destinationIP, route.destination, route.mask)) {
                bestRoute = route;
                bestPrefixLength = prefixLength;
            }
        }

        return bestRoute;
    }

    // Check if an IP is in a network
    isInNetwork(ip, network, mask) {
        const ipNum = this.ipToNumber(ip);
        const networkNum = this.ipToNumber(network);
        const maskNum = this.ipToNumber(mask);
        
        return (ipNum & maskNum) === (networkNum & maskNum);
    }

    // Convert IP string to number
    ipToNumber(ip) {
        const parts = ip.split('.').map(Number);
        return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
    }

    // Convert number to IP string
    numberToIP(num) {
        return [
            (num >>> 24) & 255,
            (num >>> 16) & 255,
            (num >>> 8) & 255,
            num & 255
        ].join('.');
    }

    // Get prefix length from subnet mask
    getPrefixLength(mask) {
        const maskNum = this.ipToNumber(mask);
        let count = 0;
        for (let i = 31; i >= 0; i--) {
            if ((maskNum >>> i) & 1) {
                count++;
            } else {
                break;
            }
        }
        return count;
    }

    // Add default route
    addDefaultRoute(gateway, interfaceName) {
        this.addRoute('0.0.0.0', '0.0.0.0', gateway, interfaceName);
    }

    // Add connected route (directly connected network)
    addConnectedRoute(network, mask, interfaceName) {
        this.addRoute(network, mask, null, interfaceName, 0);
    }

    // Get all routes
    getRoutes() {
        return [...this.routes];
    }

    // Clear all routes
    clear() {
        this.routes = [];
    }

    // Serialize for saving
    serialize() {
        return {
            routes: this.routes
        };
    }

    // Deserialize from saved data
    static deserialize(data) {
        const table = new RoutingTable();
        table.routes = data.routes || [];
        return table;
    }

    // Get route summary for display
    getSummary() {
        return this.routes.map(route => ({
            destination: `${route.destination}/${this.getPrefixLength(route.mask)}`,
            gateway: route.gateway || 'directly connected',
            interface: route.interface,
            metric: route.metric
        }));
    }
}
