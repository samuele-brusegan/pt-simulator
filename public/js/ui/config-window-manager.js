// Config Window Manager - Handles opening and syncing with separate config windows
export class ConfigWindowManager {
    constructor(simulator) {
        this.simulator = simulator;
        this.windows = new Map(); // deviceId -> Window object
        this.channel = new BroadcastChannel('pt-simulator-sync');
        
        this.setupChannel();
    }

    setupChannel() {
        this.channel.onmessage = (event) => {
            const { type, deviceId, data } = event.data;

            switch (type) {
                case 'READY':
                    // A config window is ready, send it the current device data
                    this.sendDeviceUpdate(deviceId);
                    break;
                case 'UPDATE_DEVICE':
                    // Config window changed something (e.g. hostname)
                    this.handleDeviceUpdateFromWindow(deviceId, data);
                    break;
                case 'CLI_COMMAND':
                    // Config window sent a CLI command
                    this.handleCLICommandFromWindow(deviceId, data.command);
                    break;
            }
        };
    }

    openWindow(deviceId) {
        if (this.windows.has(deviceId) && !this.windows.get(deviceId).closed) {
            this.windows.get(deviceId).focus();
            return;
        }

        const width = 900;
        const height = 700;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);

        const win = window.open(
            `config.html?deviceId=${deviceId}`,
            `config_${deviceId}`,
            `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=no,personalbar=no,directories=no`
        );

        if (win) {
            this.windows.set(deviceId, win);
            
            // Set configured state when window gets focus
            win.addEventListener('focus', () => {
                const device = this.simulator.devices.find(d => d.id === deviceId);
                if (device) {
                    device.setConfigured(true);
                }
            });

            // Reset configured state when window loses focus
            win.addEventListener('blur', () => {
                const device = this.simulator.devices.find(d => d.id === deviceId);
                if (device) {
                    device.setConfigured(false);
                }
            });
            
            // Reset configured state when window closes
            win.addEventListener('beforeunload', () => {
                this.windows.delete(deviceId);
                const device = this.simulator.devices.find(d => d.id === deviceId);
                if (device) {
                    device.setConfigured(false);
                }
                console.log('Config window closed for device:', deviceId);
            });
        } else {
            alert('Per favore abilita i pop-up per aprire la configurazione del dispositivo.');
        }
    }

    sendDeviceUpdate(deviceId) {
        const device = this.simulator.devices.find(d => d.id === deviceId);
        if (device) {
            this.channel.postMessage({
                type: 'DEVICE_DATA',
                deviceId: deviceId,
                data: device.serialize()
            });
        }
    }

    handleDeviceUpdateFromWindow(deviceId, data) {
        const device = this.simulator.devices.find(d => d.id === deviceId);
        if (device) {
            // Apply updates (e.g. hostname)
            if (data.name) device.name = data.name;
            if (data.interfaces) {
                data.interfaces.forEach(updatedIntf => {
                    const intf = device.interfaces.find(i => i.id === updatedIntf.id);
                    if (intf) {
                        intf.ip = updatedIntf.ip;
                        intf.mask = updatedIntf.mask;
                        intf.status = updatedIntf.status;
                    }
                });
            }
            
            // Notify system for re-render (render loop handles it automatically)
            this.simulator.saveNetwork();
            
            // Broadcast the update back to other windows if needed (optional)
            this.sendDeviceUpdate(deviceId);
        }
    }

    handleCLICommandFromWindow(deviceId, command) {
        // CLI commands are now handled entirely within the config window's TerminalManager.
        // No sync needed to main app since terminalManager was removed from PTSimulator.
    }
}
