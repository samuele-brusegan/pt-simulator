// Terminal Manager - Handles the CLI interface
export class TerminalManager {
    constructor(terminalElement) {
        this.terminal = terminalElement;
        this.output = null;
        this.input = null;
        this.inputField = null;
        this.history = [];
        this.historyIndex = -1;
        this.isFocused = false;
        this.activeDevice = null; // Currently selected device for CLI

        this.createTerminalUI();
        this.bindEvents();
    }

    createTerminalUI() {
        this.terminal.innerHTML = `
            <div class="terminal-output" id="terminal-output"></div>
            <div class="terminal-input">
                <span class="terminal-prompt" id="terminal-prompt">></span>
                <input type="text" id="terminal-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
            </div>
        `;

        this.output = this.terminal.querySelector('#terminal-output');
        this.input = this.terminal.querySelector('#terminal-input');
        this.inputField = this.terminal.querySelector('#terminal-input');
    }

    bindEvents() {
        // Handle input
        this.inputField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.executeCommand();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateHistory(-1);
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateHistory(1);
            } else if (e.key === 'Tab') {
                e.preventDefault();
                this.handleTabCompletion();
            }
        });

        this.inputField.addEventListener('focus', () => {
            this.isFocused = true;
        });

        this.inputField.addEventListener('blur', () => {
            this.isFocused = false;
        });

        // Click on terminal to focus input
        this.terminal.addEventListener('click', () => {
            this.inputField.focus();
        });
    }

    setActiveDevice(device) {
        this.activeDevice = device;
        this.updatePrompt();
        this.clearOutput(); // Clear output when device changes
    }

    updatePrompt() {
        if (!this.activeDevice) {
            this.output.textContent = 'No device selected. Click on a device to configure it.';
            return;
        }

        // Determine prompt based on device state/mode
        // For now, simple placeholder
        const prompt = `${this.activeDevice.name}> `;
        document.querySelector('.terminal-prompt').textContent = prompt;
    }

    executeCommand() {
        const command = this.inputField.value.trim();
        if (!command) return;

        // Add to history
        if (command !== this.history[this.history.length - 1]) {
            this.history.push(command);
        }
        this.historyIndex = this.history.length;

        // Clear input
        this.inputField.value = '';

        // Show command in output
        this.print(`>${command}`);

        // Process command
        if (this.activeDevice) {
            this.processDeviceCommand(command);
        } else {
            this.printError('No device selected. Please click on a device to configure it.');
        }

        // Scroll to bottom
        this.scrollToBottom();
    }

    processDeviceCommand(command) {
        // Basic command parsing - would be expanded significantly
        const parts = command.toLowerCase().split(/\s+/);
        const cmd = parts[0];
        const args = parts.slice(1);

        switch (cmd) {
            case 'help':
                this.printHelp();
                break;
            case 'exit':
            case 'disable':
                this.print('Exiting privileged mode');
                break;
            case 'enable':
                this.print(`%SYS-5-RELOAD: Reload requested`);
                break;
            case 'configure':
                if (args[0] === 'terminal') {
                    this.print('Enter configuration mode, one line per line. End with CNTL/Z.');
                } else {
                    this.printError('Invalid command');
                }
                break;
            case 'interface':
                if (args.length > 0) {
                    this.print(`%LINK-5-CHANGED: Interface ${args[0]}, changed state to administratively down`);
                } else {
                    this.printError('Please specify an interface');
                }
                break;
            case 'ip':
                if (args[0] === 'address' && args.length >= 3) {
                    const ip = args[1];
                    const mask = args[2];
                    // Find interface and set IP
                    this.print(`%IP-5-ADDRCHANGED: Address ${ip} ${mask} on interface ${args[3] || 'unknown'}`);
                } else {
                    this.printError('Usage: ip address <ip> <mask>');
                }
                break;
            case 'no':
                if (args[0] === 'shutdown') {
                    this.print(`%LINK-3-UPDOWN: Interface ${args[1] || 'unknown'}, changed state to up`);
                } else {
                    this.printError('Invalid command');
                }
                break;
            case 'shutdown':
                this.print(`%LINK-5-CHANGED: Interface ${args[0] || 'unknown'}, changed state to administratively down`);
                break;
            case 'show':
                this.handleShowCommand(args);
                break;
            default:
                this.printError(`% Invalid input detected at '^' marker.`);
                break;
        }
    }

    handleShowCommand(args) {
        if (!this.activeDevice) return;

        switch (args[0]) {
            case 'running-config':
                this.print(`Building configuration...\n\nCurrent configuration :\n!\nversion 1.0\n!\nhostname ${this.activeDevice.name}\n!\n`);
                // Show interface configs
                this.activeDevice.interfaces.forEach(intf => {
                    this.print(`interface ${intf.name}`);
                    if (intf.ip) {
                        this.print(` ip address ${intf.ip} ${intf.mask || '255.255.255.0'}`);
                    }
                    if (intf.status === 'up') {
                        this.print(` no shutdown`);
                    } else {
                        this.print(` shutdown`);
                    }
                    this.print(`!\n`);
                });
                this.print(`end`);
                break;
            case 'interfaces':
            case 'ip':
                if (args[1] === 'interface' && args[2] === 'brief') {
                    this.print('Interface              IP-Address      OK? Method Status                Protocol');
                    this.print('---------------------------------------------------------------------');
                    this.activeDevice.interfaces.forEach(intf => {
                        const ipAddr = intf.ip || 'unassigned';
                        const status = intf.status === 'up' ? 'UP' : 'down';
                        const protocol = status === 'up' ? 'UP' : 'down';
                        this.print(`${intf.name.padEnd(20)} ${ipAddr.padEnd(15)} YES manual ${status.padEnd(16)} ${protocol}`);
                    });
                }
                break;
            case 'version':
                this.print('Cisco IOS Software, C2911 Software (C2911-UNIVERSALK9-M), Version 15.2(4)M1, RELEASE SOFTWARE (fc1)');
                break;
            default:
                this.printError(`Invalid input detected at '${args[0]}' marker.`);
        }
    }

    printHelp() {
        this.print('Available commands:');
        this.print('  enable                    Turn on privileged mode');
        this.print('  configure terminal        Enter configuration mode');
        this.print('  interface <name>          Select an interface to configure');
        this.print('  ip address <ip> <mask>    Set IP address and subnet mask');
        this.print('  no shutdown               Enable interface');
        this.print('  shutdown                  Disable interface');
        this.print('  show running-config       Display current configuration');
        this.print('  show interfaces           Display interface status');
        this.print('  show ip interface brief   Display brief interface status');
        this.print('  show version              Display system version');
        this.print('  exit/disable              Exit privileged mode');
        this.print('  help                      Display this help message');
    }

    navigateHistory(direction) {
        if (this.history.length === 0) return;

        this.historyIndex += direction;

        if (this.historyIndex < 0) {
            this.historyIndex = 0;
        } else if (this.historyIndex >= this.history.length) {
            this.historyIndex = this.history.length - 1;
        }

        this.inputField.value = this.history[this.historyIndex] || '';
    }

    handleTabCompletion() {
        // Basic tab completion - would be much more sophisticated
        const current = this.inputField.value;
        if (!current) return;

        // Simple command completion
        const commands = ['help', 'enable', 'configure', 'exit', 'disable', 'interface', 'ip', 'no', 'shutdown', 'show'];
        const matches = commands.filter(cmd => cmd.startsWith(current));

        if (matches.length === 1) {
            this.inputField.value = matches[0] + ' ';
        } else if (matches.length > 1) {
            this.print('\n' + matches.join('  '));
            this.updatePrompt();
            this.inputField.value = current;
        }
    }

    print(text) {
        const line = document.createElement('div');
        line.textContent = text;
        line.style.fontFamily = "'Fira Code', 'Courier New', monospace";
        line.style.fontSize = '0.9rem';
        line.style.lineHeight = '1.4';
        this.output.appendChild(line);
    }

    printError(text) {
        const line = document.createElement('div');
        line.textContent = text;
        line.style.color = '#f85149';
        line.style.fontFamily = "'Fira Code', 'Courier New', monospace";
        line.style.fontSize = '0.9rem';
        line.style.lineHeight = '1.4';
        this.output.appendChild(line);
    }

    clearOutput() {
        this.output.innerHTML = '';
    }

    scrollToBottom() {
        this.output.scrollTop = this.output.scrollHeight;
    }

    // Focus management
    focus() {
        this.inputField.focus();
    }

    blur() {
        this.inputField.blur();
    }
}