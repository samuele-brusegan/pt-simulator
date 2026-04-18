// Network Engine - Handles realistic packet flow through network
// Implements proper switching, routing, and forwarding logic

import { Packet } from './packet.js';
import { CAMTable } from './cam-table.js';
import { RoutingTable } from './routing-table.js';
import { ARPCache } from './arp-cache.js';

export class NetworkEngine {
    constructor(app) {
        this.app = app;
        this.activePackets = [];
        this.packetAnimations = [];
        this.debugNotificationsEnabled = false; // Default: off
        
        // Initialize network components for each device
        this.deviceStates = new Map();
    }

    // Initialize network components for devices
    initializeDeviceStates() {
        this.app.devices.forEach(device => {
            if (!this.deviceStates.has(device.id)) {
                const state = {
                    camTable: device.type === 'switch' ? new CAMTable() : null,
                    routingTable: device.type === 'router' ? new RoutingTable() : null,
                    arpCache: new ARPCache(),
                    macAddress: this.generateMAC(device)
                };
                
                // Add connected routes for routers
                if (device.type === 'router' && device.interfaces) {
                    device.interfaces.forEach(intf => {
                        if (intf.ip && intf.mask) {
                            state.routingTable.addConnectedRoute(
                                this.getNetworkAddress(intf.ip, intf.mask),
                                intf.mask,
                                intf.name
                            );
                        }
                    });
                }
                
                // Add static routes if configured
                if (device.type === 'router' && device.staticRoutes) {
                    device.staticRoutes.forEach(route => {
                        if (route.destination && route.mask) {
                            state.routingTable.addRoute(
                                route.destination,
                                route.mask,
                                route.gateway,
                                route.interface
                            );
                        }
                    });
                }
                
                this.deviceStates.set(device.id, state);
            }
        });
    }

    // Generate MAC address for device
    generateMAC(device) {
        const hash = device.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return '02:00:00:' + 
               (hash & 0xFF).toString(16).padStart(2, '0') + ':' +
               ((hash >> 8) & 0xFF).toString(16).padStart(2, '0') + ':' +
               ((hash >> 16) & 0xFF).toString(16).padStart(2, '0');
    }

    // Get network address from IP and mask
    getNetworkAddress(ip, mask) {
        const ipNum = this.ipToNumber(ip);
        const maskNum = this.ipToNumber(mask);
        const networkNum = ipNum & maskNum;
        return this.numberToIP(networkNum);
    }

    // Check if two IPs are in the same network
    isInSameNetwork(ip1, ip2, mask) {
        const network1 = this.getNetworkAddress(ip1, mask);
        const network2 = this.getNetworkAddress(ip2, mask);
        return network1 === network2;
    }

    // Convert IP to number
    ipToNumber(ip) {
        const parts = ip.split('.').map(Number);
        return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
    }

    // Convert number to IP
    numberToIP(num) {
        return [
            (num >>> 24) & 255,
            (num >>> 16) & 255,
            (num >>> 8) & 255,
            num & 255
        ].join('.');
    }

    // Send ICMP ping with realistic routing logic
    async sendPing(sourceDevice, targetDevice) {
        this.initializeDeviceStates();
        
        const sourceIP = this.getDeviceIP(sourceDevice);
        const targetIP = this.getDeviceIP(targetDevice);
        
        if (!sourceIP || !targetIP) {
            this.showDeviceNotification(sourceDevice, 'Errore: IP non configurato', 'error');
            return;
        }

        // Check if source has interface with mask
        const sourceInterface = this.getInterfaceWithIP(sourceDevice, sourceIP);
        if (!sourceInterface || !sourceInterface.mask) {
            this.showDeviceNotification(sourceDevice, 'Errore: Subnet mask non configurata', 'error');
            return;
        }

        // Check if destination is in same network
        const sameNetwork = this.isInSameNetwork(sourceIP, targetIP, sourceInterface.mask);

        let nextHopIP;
        let finalDestination = targetIP;

        if (sameNetwork) {
            // Same network - send directly
            nextHopIP = targetIP;
        } else {
            // Different network - use default gateway
            if (!sourceDevice.defaultGateway) {
                this.showDeviceNotification(sourceDevice, 'Errore: Default gateway non configurato', 'error');
                return;
            }
            nextHopIP = sourceDevice.defaultGateway;
        }

        // Calculate realistic path using routing logic
        const path = await this.calculateRoutingPath(sourceDevice, targetDevice, nextHopIP, finalDestination);
        
        if (path.length === 0) {
            this.showDeviceNotification(sourceDevice, 'No route to host', 'error');
            this.animateDeviceError(sourceDevice);
            return;
        }

        // Animate packet along the realistic path
        await this.animatePacketAlongPath(path, sourceIP, targetIP, 'request');
        
        // Send ICMP Echo Reply from destination back to source
        await this.sendICMPReply(targetDevice, sourceDevice, targetIP, sourceIP);
    }

    // Send ICMP Echo Reply
    async sendICMPReply(sourceDevice, targetDevice, sourceIP, targetIP) {
        this.showDeviceNotification(sourceDevice, 'ICMP Echo Reply inviato', 'success');
        
        // Check if destination (original source) is in same network as reply source
        const sourceInterface = this.getInterfaceWithIP(sourceDevice, sourceIP);
        if (!sourceInterface || !sourceInterface.mask) {
            this.showDeviceNotification(sourceDevice, 'Errore: Subnet mask non configurata', 'error');
            return;
        }

        const sameNetwork = this.isInSameNetwork(sourceIP, targetIP, sourceInterface.mask);
        
        let nextHopIP;
        
        if (sameNetwork) {
            nextHopIP = targetIP;
        } else {
            // Use default gateway
            if (!sourceDevice.defaultGateway) {
                this.showDeviceNotification(sourceDevice, 'Errore: Default gateway non configurato', 'error');
                this.animateDeviceError(sourceDevice);
                return;
            }
            nextHopIP = sourceDevice.defaultGateway;
        }

        // Calculate reverse path
        const reversePath = await this.calculateRoutingPath(sourceDevice, targetDevice, nextHopIP, targetIP);
        
        if (reversePath.length === 0) {
            this.showDeviceNotification(sourceDevice, 'Impossibile inviare reply', 'error');
            this.animateDeviceError(sourceDevice);
            return;
        }

        // Animate reply packet along reverse path
        await this.animatePacketAlongPath(reversePath, sourceIP, targetIP, 'reply');
        
        // Show final result on original source
        this.showDeviceNotification(targetDevice, 'Ping Reply ricevuto', 'success');
    }

    // Get device IP
    getDeviceIP(device) {
        if (device.interfaces && device.interfaces.length > 0) {
            for (const iface of device.interfaces) {
                if (iface.ip) {
                    return iface.ip;
                }
                if (iface.ipAddress) {
                    return iface.ipAddress;
                }
            }
        }
        return null;
    }

    // Get interface with specific IP
    getInterfaceWithIP(device, ip) {
        if (device.interfaces && device.interfaces.length > 0) {
            for (const iface of device.interfaces) {
                if (iface.ip === ip || iface.ipAddress === ip) {
                    return iface;
                }
            }
        }
        return null;
    }

    // Calculate realistic routing path
    async calculateRoutingPath(sourceDevice, targetDevice, nextHopIP, finalDestination) {
        const path = [];
        let currentDevice = sourceDevice;
        let currentDestinationIP = nextHopIP;
        const visited = new Set();
        const maxHops = 20; // Prevent infinite loops
        let hops = 0;

        while (currentDevice && hops < maxHops) {
            if (visited.has(currentDevice.id)) {
                console.log('Routing loop detected');
                this.showDeviceNotification(currentDevice, 'Routing loop!', 'error');
                this.animateDeviceError(currentDevice);
                return [];
            }
            
            visited.add(currentDevice.id);
            path.push(currentDevice);

            // Check if we reached the target
            if (currentDevice.id === targetDevice.id) {
                return path;
            }

            // Get next hop device
            const nextDevice = this.getNextHop(currentDevice, currentDestinationIP, finalDestination);
            
            if (!nextDevice) {
                console.log('No route found at', currentDevice.name);
                this.showDeviceNotification(currentDevice, 'No route to host', 'error');
                this.animateDeviceError(currentDevice);
                return [];
            }

            // If next device is a router, update destination based on routing table
            if (nextDevice.type === 'router') {
                const routerState = this.deviceStates.get(nextDevice.id);
                if (routerState && routerState.routingTable) {
                    const route = routerState.routingTable.findRoute(finalDestination);
                    if (route && route.gateway) {
                        currentDestinationIP = route.gateway;
                    } else if (route && !route.gateway) {
                        // Directly connected - find the target device
                        currentDestinationIP = finalDestination;
                    } else {
                        // No route - try to find device with target IP
                        const targetByIP = this.findDeviceByIP(finalDestination);
                        if (targetByIP) {
                            currentDestinationIP = finalDestination;
                        } else {
                            this.showDeviceNotification(nextDevice, 'No route to network', 'error');
                            this.animateDeviceError(nextDevice);
                            return [];
                        }
                    }
                }
            }

            currentDevice = nextDevice;
            hops++;
        }

        return path;
    }

    // Get next hop device based on device type and routing logic
    getNextHop(currentDevice, destinationIP, finalDestination) {
        const state = this.deviceStates.get(currentDevice.id);
        if (!state) return null;

        // For PC: send to default gateway or directly if same network
        if (currentDevice.type === 'pc') {
            const sourceInterface = this.getInterfaceWithIP(currentDevice, this.getDeviceIP(currentDevice));
            if (sourceInterface && this.isInSameNetwork(this.getDeviceIP(currentDevice), destinationIP, sourceInterface.mask)) {
                // Same network - find device with destination IP
                const targetDevice = this.findDeviceByIP(destinationIP);
                if (!targetDevice) {
                    // Destination not reachable on local network
                    this.showDeviceNotification(currentDevice, 'Host unreachable', 'error');
                    this.animateDeviceError(currentDevice);
                }
                return targetDevice;
            } else {
                // Use default gateway
                const gatewayDevice = this.findDeviceByIP(currentDevice.defaultGateway);
                if (!gatewayDevice) {
                    // Default gateway not found
                    this.showDeviceNotification(currentDevice, 'Default gateway unreachable', 'error');
                    this.animateDeviceError(currentDevice);
                }
                return gatewayDevice;
            }
        }

        // For Router: use routing table
        if (currentDevice.type === 'router' && state.routingTable) {
            const route = state.routingTable.findRoute(destinationIP);
            if (route) {
                if (route.gateway) {
                    // Forward to gateway
                    const gatewayDevice = this.findDeviceByIP(route.gateway);
                    if (!gatewayDevice) {
                        // Gateway not reachable
                        this.showDeviceNotification(currentDevice, `Gateway ${route.gateway} unreachable`, 'error');
                        this.animateDeviceError(currentDevice);
                    }
                    return gatewayDevice;
                } else {
                    // Directly connected - find device with destination IP
                    const targetDevice = this.findDeviceByIP(destinationIP);
                    if (!targetDevice) {
                        // Destination not reachable on directly connected network
                        this.showDeviceNotification(currentDevice, `Host ${destinationIP} unreachable`, 'error');
                        this.animateDeviceError(currentDevice);
                    }
                    return targetDevice;
                }
            } else {
                // No route found
                this.showDeviceNotification(currentDevice, `No route to ${destinationIP}`, 'error');
                this.animateDeviceError(currentDevice);
                return null;
            }
        }

        // For Switch: use CAM table or flood
        if (currentDevice.type === 'switch' && state.camTable) {
            const connectedDevices = this.getConnectedDevices(currentDevice);
            
            // Try to find device with destination IP
            for (const device of connectedDevices) {
                const deviceIP = this.getDeviceIP(device);
                if (deviceIP === destinationIP) {
                    return device;
                }
            }
            
            // If not found, try to find device that can route to destination
            for (const device of connectedDevices) {
                if (device.type === 'router') {
                    return device;
                }
            }
            
            // No device can route to destination - discard frame
            this.showDeviceNotification(currentDevice, 'Frame discarded (no route)', 'error');
            this.animateDeviceError(currentDevice);
            return null;
        }

        return null;
    }

    // Find device by IP address
    findDeviceByIP(ip) {
        for (const device of this.app.devices) {
            const deviceIP = this.getDeviceIP(device);
            if (deviceIP === ip) {
                return device;
            }
        }
        return null;
    }

    // Get devices connected via cables
    getConnectedDevices(device) {
        const connected = [];
        this.app.cables.forEach(cable => {
            if (cable.startDevice === device) {
                connected.push(cable.endDevice);
            } else if (cable.endDevice === device) {
                connected.push(cable.startDevice);
            }
        });
        return connected;
    }

    // Animate packet along calculated path
    async animatePacketAlongPath(path, sourceIP, targetIP, packetType = 'request') {
        for (let i = 0; i < path.length - 1; i++) {
            const fromDevice = path[i];
            const toDevice = path[i + 1];
            
            // Find the cable between these devices
            const cable = this.findCableBetween(fromDevice, toDevice);
            
            await this.animatePacketHop(fromDevice, toDevice, cable, packetType);
            
            // Simulate processing delay
            await this.delay(100);
        }
    }

    // Find cable between two devices
    findCableBetween(device1, device2) {
        return this.app.cables.find(cable =>
            (cable.startDevice === device1 && cable.endDevice === device2) ||
            (cable.startDevice === device2 && cable.endDevice === device1)
        );
    }

    // Animate single packet hop following cable path
    async animatePacketHop(fromDevice, toDevice, cable, packetType = 'request') {
        return new Promise(resolve => {
            const duration = 500; // ms per hop
            const startTime = performance.now();
            
            // Get cable start and end positions (port positions)
            let startPos, endPos;
            let hasCablePath = false;
            
            if (cable) {
                startPos = cable.getStartPosition();
                endPos = cable.getEndPosition();
                
                // Validate positions
                if (startPos && endPos && startPos.x !== undefined && startPos.y !== undefined) {
                    hasCablePath = true;
                } else {
                    console.warn('Cable positions invalid, no cable path available');
                }
            }
            
            if (!hasCablePath) {
                console.warn('No valid cable path, using device centers with error indicator');
                startPos = { x: fromDevice.x, y: fromDevice.y };
                endPos = { x: toDevice.x, y: toDevice.y };
            }
            
            // Highlight cable during packet transit
            if (cable && hasCablePath) {
                cable.highlighted = true;
                cable.highlightColor = packetType === 'reply' ? '#10b981' : '#3b82f6';
                this.app.canvasManager.draw();
            }
            
            const packetEl = document.createElement('div');
            // Show PDU with red X if no valid cable path
            packetEl.innerHTML = hasCablePath 
                ? (packetType === 'reply' ? '↩️' : '✉️')
                : '<span style="position:relative;display:inline-block;">✉️<span style="position:absolute;top:-8px;right:-8px;color:#f85149;font-weight:bold;font-size:16px;">✗</span></span>';
            
            packetEl.style.cssText = `
                position: absolute;
                font-size: 24px;
                pointer-events: none;
                z-index: 1000;
                transition: none;
                color: ${hasCablePath ? (packetType === 'reply' ? '#10b981' : '#c9d1d9') : '#f85149'};
            `;
            document.body.appendChild(packetEl);
            
            const animate = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Interpolate along the cable path using port positions
                const currentX = startPos.x + (endPos.x - startPos.x) * progress;
                const currentY = startPos.y + (endPos.y - startPos.y) * progress;
                
                const screenPos = this.app.canvasManager.worldToScreen(currentX, currentY);
                
                packetEl.style.left = screenPos.x + 'px';
                packetEl.style.top = screenPos.y + 'px';
                packetEl.style.transform = 'translate(-50%, -50%)';
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    // Remove packet and unhighlight cable
                    document.body.removeChild(packetEl);
                    if (cable && hasCablePath) {
                        cable.highlighted = false;
                        cable.highlightColor = null;
                        this.app.canvasManager.draw();
                    }
                    resolve();
                }
            };
            
            requestAnimationFrame(animate);
        });
    }

    // Delay helper
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Show notification message on device
    showDeviceNotification(device, message, type = 'info') {
        if (!this.debugNotificationsEnabled) return;
        
        const screenPos = this.app.canvasManager.worldToScreen(device.x, device.y);
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: absolute;
            left: ${screenPos.x + 40}px;
            top: ${screenPos.y - 20}px;
            background: ${type === 'error' ? '#f85149' : type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            padding: 6px 10px;
            border-radius: 4px;
            font-family: 'Fira Code', monospace;
            font-size: 11px;
            z-index: 1000;
            pointer-events: none;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 3000);
    }

    // Animate red X on device when packet is dropped
    animateDeviceError(device) {
        if (!this.debugNotificationsEnabled) return;
        
        const screenPos = this.app.canvasManager.worldToScreen(device.x, device.y);
        
        const errorX = document.createElement('div');
        errorX.innerHTML = '✗';
        errorX.style.cssText = `
            position: absolute;
            left: ${screenPos.x + 30}px;
            top: ${screenPos.y}px;
            font-size: 28px;
            color: #f85149;
            font-weight: bold;
            z-index: 1000;
            pointer-events: none;
            animation: blinkError 0.5s ease-in-out 3;
        `;
        
        // Add animation keyframes if not exists
        if (!document.getElementById('error-animation-style')) {
            const style = document.createElement('style');
            style.id = 'error-animation-style';
            style.textContent = `
                @keyframes blinkError {
                    0%, 100% { opacity: 1; transform: translateX(0); }
                    50% { opacity: 0.5; transform: translateX(5px); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(errorX);

        setTimeout(() => {
            if (document.body.contains(errorX)) {
                document.body.removeChild(errorX);
            }
        }, 1500);
    }

    // Get device state
    getDeviceState(deviceId) {
        return this.deviceStates.get(deviceId);
    }

    // Set default gateway for a device
    setDefaultGateway(deviceId, gatewayIP) {
        const device = this.app.devices.find(d => d.id === deviceId);
        if (device) {
            device.defaultGateway = gatewayIP;
        }
    }
}
