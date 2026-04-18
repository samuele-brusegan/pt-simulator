// OSI Layer Packet Architecture
// Represents network packets with proper layer encoding

export class Packet {
    constructor(options = {}) {
        this.id = crypto.randomUUID();
        this.timestamp = Date.now();
        
        // Layer 2 - Data Link (Ethernet II)
        this.ethernet = options.ethernet || {
            sourceMAC: null,
            destinationMAC: null,
            etherType: null, // 0x0800 for IPv4, 0x86DD for IPv6, 0x0806 for ARP
            frame: null
        };
        
        // Layer 3 - Network (IP)
        this.ip = options.ip || {
            version: 4,
            sourceIP: null,
            destinationIP: null,
            protocol: null, // 1 for ICMP, 6 for TCP, 17 for UDP
            ttl: 64,
            header: null
        };
        
        // Layer 4 - Transport (TCP/UDP/ICMP)
        this.transport = options.transport || null;
        
        // Layer 7 - Application (HTTP, etc.)
        this.application = options.application || null;
        
        // Packet metadata
        this.path = []; // Track the path the packet takes
        this.currentDevice = null;
        this.state = 'created'; // created, in-transit, delivered, dropped
    }
    
    // Create Ethernet II frame
    static createEthernetFrame(sourceMAC, destinationMAC, etherType, payload) {
        return {
            preamble: '1010101010101010101010101010101010101010101010101010101010101010',
            destinationMAC,
            sourceMAC,
            etherType: etherType.toString(16).padStart(4, '0'),
            payload: payload,
            fcs: '00000000' // Frame Check Sequence (simplified)
        };
    }
    
    // Create IP packet
    static createIPPacket(version, sourceIP, destinationIP, protocol, ttl, payload) {
        return {
            version: version,
            ihl: 5, // Internet Header Length
            dscp: 0,
            ecn: 0,
            totalLength: 20 + (payload ? payload.length : 0),
            identification: Math.floor(Math.random() * 65535),
            flags: 0,
            fragmentOffset: 0,
            ttl: ttl,
            protocol: protocol,
            headerChecksum: '0000', // Simplified
            sourceIP: sourceIP,
            destinationIP: destinationIP,
            payload: payload
        };
    }
    
    // Create ICMP packet
    static createICMPPacket(type, code, sequence, data) {
        return {
            type: type, // 8 for Echo Request, 0 for Echo Reply
            code: code,
            checksum: '0000', // Simplified
            identifier: Math.floor(Math.random() * 65535),
            sequence: sequence,
            data: data || 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
        };
    }
    
    // Create TCP segment
    static createTCPSegment(sourcePort, destinationPort, sequence, ack, flags, data) {
        return {
            sourcePort: sourcePort,
            destinationPort: destinationPort,
            sequenceNumber: sequence,
            acknowledgmentNumber: ack,
            dataOffset: 5,
            flags: flags, // SYN, ACK, FIN, etc.
            windowSize: 65535,
            checksum: '0000',
            urgentPointer: 0,
            data: data
        };
    }
    
    // Create HTTP request
    static createHTTPRequest(method, path, host, headers) {
        return {
            method: method,
            path: path,
            version: 'HTTP/1.1',
            headers: headers || {
                'Host': host,
                'User-Agent': 'PT-Simulator/1.0',
                'Accept': '*/*'
            },
            body: null
        };
    }
    
    // Build complete HTTP request packet
    static buildHTTPRequest(sourceMAC, destMAC, sourceIP, destIP, sourcePort, destPort, method, path, host) {
        const http = Packet.createHTTPRequest(method, path, host);
        const tcp = Packet.createTCPSegment(sourcePort, destPort, 0, 0, {SYN: true}, JSON.stringify(http));
        const ip = Packet.createIPPacket(4, sourceIP, destIP, 6, 64, JSON.stringify(tcp));
        const ethernet = Packet.createEthernetFrame(sourceMAC, destMAC, 0x0800, JSON.stringify(ip));
        
        return new Packet({
            ethernet: ethernet,
            ip: ip,
            transport: tcp,
            application: http
        });
    }
    
    // Build ICMP Echo Request (Ping)
    static buildICMPEchoRequest(sourceMAC, destMAC, sourceIP, destIP, sequence) {
        const icmp = Packet.createICMPPacket(8, 0, sequence, null);
        const ip = Packet.createIPPacket(4, sourceIP, destIP, 1, 64, JSON.stringify(icmp));
        const ethernet = Packet.createEthernetFrame(sourceMAC, destMAC, 0x0800, JSON.stringify(ip));
        
        return new Packet({
            ethernet: ethernet,
            ip: ip,
            transport: icmp
        });
    }
    
    // Build ICMP Echo Reply
    static buildICMPEchoReply(sourceMAC, destMAC, sourceIP, destIP, sequence, originalICMP) {
        const icmp = Packet.createICMPPacket(0, 0, sequence, originalICMP.data);
        const ip = Packet.createIPPacket(4, sourceIP, destIP, 1, 64, JSON.stringify(icmp));
        const ethernet = Packet.createEthernetFrame(sourceMAC, destMAC, 0x0800, JSON.stringify(ip));
        
        return new Packet({
            ethernet: ethernet,
            ip: ip,
            transport: icmp
        });
    }
    
    // Build ARP Request
    static buildARPRequest(sourceMAC, sourceIP, targetIP) {
        return {
            hardwareType: 1, // Ethernet
            protocolType: 0x0800, // IPv4
            hardwareSize: 6,
            protocolSize: 4,
            opcode: 1, // Request
            senderMAC: sourceMAC,
            senderIP: sourceIP,
            targetMAC: '00:00:00:00:00:00',
            targetIP: targetIP
        };
    }
    
    // Build ARP Reply
    static buildARPReply(sourceMAC, sourceIP, targetMAC, targetIP) {
        return {
            hardwareType: 1,
            protocolType: 0x0800,
            hardwareSize: 6,
            protocolSize: 4,
            opcode: 2, // Reply
            senderMAC: sourceMAC,
            senderIP: sourceIP,
            targetMAC: targetMAC,
            targetIP: targetIP
        };
    }
    
    // Get packet type description
    getTypeDescription() {
        if (this.ethernet.etherType === '0806') return 'ARP';
        if (this.ip.protocol === 1) return 'ICMP';
        if (this.ip.protocol === 6) return 'TCP';
        if (this.ip.protocol === 17) return 'UDP';
        return 'Unknown';
    }
    
    // Get summary for display
    getSummary() {
        return {
            type: this.getTypeDescription(),
            source: this.ip.sourceIP,
            destination: this.ip.destinationIP,
            protocol: this.ip.protocol === 1 ? 'ICMP' : this.ip.protocol === 6 ? 'TCP' : 'Other',
            state: this.state
        };
    }
    
    // Serialize for saving
    serialize() {
        return {
            id: this.id,
            timestamp: this.timestamp,
            ethernet: this.ethernet,
            ip: this.ip,
            transport: this.transport,
            application: this.application,
            path: this.path,
            state: this.state
        };
    }
    
    // Deserialize from saved data
    static deserialize(data) {
        const packet = new Packet({
            ethernet: data.ethernet,
            ip: data.ip,
            transport: data.transport,
            application: data.application
        });
        packet.id = data.id;
        packet.timestamp = data.timestamp;
        packet.path = data.path || [];
        packet.state = data.state || 'created';
        return packet;
    }
}
