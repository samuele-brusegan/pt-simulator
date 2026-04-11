// Terminal Manager - Handles the CLI interface
export class TerminalManager {
    constructor(terminalElement, simulator = null) {
        this.terminal = terminalElement;
        this.simulator = simulator;
        this.output = null;
        this.input = null;
        this.inputField = null;
        this.history = [];
        this.historyIndex = -1;
        this.isFocused = false;
        this.activeDevice = null; // Currently selected device for CLI
        this.cliMode = 'user'; // 'user', 'privileged', 'global', 'interface'
        this.currentInterface = null;

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
        this.cliMode = 'user';
        this.currentInterface = null;
        
        // When device changes, reset output and prompt
        this.clearOutput();
        this.updatePrompt();
    }

    updatePrompt() {
        if (!this.activeDevice) {
            this.output.textContent = 'No device selected. Click on a device to configure it.';
            return;
        }

        // Determine prompt based on device state/mode
        let suffix = '>';
        if (this.cliMode === 'privileged') suffix = '#';
        else if (this.cliMode === 'global') suffix = '(config)#';
        else if (this.cliMode === 'interface') suffix = '(config-if)#';

        const prompt = `${this.activeDevice.name}${suffix} `;
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
        const parts = command.trim().split(/\s+/);
        const cmdRaw = parts[0].toLowerCase();
        const args = parts.slice(1);

        // Global commands available from anywhere
        if (this.isMatch(cmdRaw, 'exit')) {
            if (this.cliMode === 'interface') {
                this.cliMode = 'global';
                this.currentInterface = null;
            } else if (this.cliMode === 'global') {
                this.cliMode = 'privileged';
            } else if (this.cliMode === 'privileged') {
                this.cliMode = 'user';
            }
            this.updatePrompt();
            return;
        } else if (this.isMatch(cmdRaw, 'end')) {
            if (this.cliMode !== 'user' && this.cliMode !== 'privileged') {
                this.cliMode = 'privileged';
                this.currentInterface = null;
                this.updatePrompt();
            }
            return;
        } else if (this.isMatch(cmdRaw, 'disable')) {
            this.cliMode = 'user';
            this.currentInterface = null;
            this.updatePrompt();
            return;
        } else if (cmdRaw === 'help' || cmdRaw === '?') {
            this.printHelp();
            return;
        }

        // Mode-specific command parsing
        switch (this.cliMode) {
            case 'user':
                this.processUserMode(cmdRaw, args);
                break;
            case 'privileged':
                this.processPrivilegedMode(cmdRaw, args);
                break;
            case 'global':
                this.processGlobalMode(cmdRaw, args);
                break;
            case 'interface':
                this.processInterfaceMode(cmdRaw, args);
                break;
        }
    }

    // Utility for matching command shortcuts
    isMatch(input, fullCommand) {
        if (!input) return false;
        return fullCommand.startsWith(input.toLowerCase());
    }

    processUserMode(cmd, args) {
        if (this.isMatch(cmd, 'enable')) {
            this.cliMode = 'privileged';
            this.updatePrompt();
        } else if (this.isMatch(cmd, 'show')) {
            this.handleShowCommand(args);
        } else {
            this.printError(`% Unknown command or computer name, or unable to find computer address`);
        }
    }

    processPrivilegedMode(cmd, args) {
        if (this.isMatch(cmd, 'configure')) {
            if (args[0] && this.isMatch(args[0], 'terminal')) {
                this.cliMode = 'global';
                this.print('Enter configuration commands, one per line. End with CNTL/Z.');
                this.updatePrompt();
            } else {
                this.printError('% Incomplete command.');
            }
        } else if (this.isMatch(cmd, 'show')) {
            this.handleShowCommand(args);
        } else if (this.isMatch(cmd, 'write') || cmd === 'wr') {
            this.print('Building configuration...');
            this.print('[OK]');
            this.simulator.saveNetwork(); // Use the global reference if available, otherwise just print
        } else if (this.isMatch(cmd, 'copy')) {
            if (args[0] && this.isMatch(args[0], 'running-config') && args[1] && this.isMatch(args[1], 'startup-config')) {
                this.print('Destination filename [startup-config]?');
                this.print('Building configuration...');
                this.print('[OK]');
            } else {
                this.printError('% Incomplete command.');
            }
        } else {
            this.printError(`% Invalid input detected at '^' marker.`);
        }
    }

    processGlobalMode(cmd, args) {
        if (cmd === 'hostname') {
            if (args[0]) {
                const newName = args[0];
                this.activeDevice.name = newName;
                if (this.activeDevice.config) this.activeDevice.config.hostname = newName;
                document.dispatchEvent(new CustomEvent('deviceUpdated', { detail: this.activeDevice }));
                this.updatePrompt();
            } else {
                this.printError('Incomplete command.');
            }
        } else if (cmd === 'interface' || cmd === 'int') {
            if (args[0]) {
                // Find interface (handle shorthand like fa0/1 or GigabitEthernet0/0)
                let searchName = args[0];
                if (searchName.startsWith('fa')) searchName = searchName.replace('fa', 'FastEthernet');
                if (searchName.startsWith('gi')) searchName = searchName.replace('gi', 'GigabitEthernet');
                if (searchName.startsWith('se')) searchName = searchName.replace('se', 'Serial');

                const intf = this.activeDevice.interfaces.find(i => 
                    i.name.toLowerCase() === searchName.toLowerCase()
                );

                if (intf) {
                    this.cliMode = 'interface';
                    this.currentInterface = intf;
                    this.updatePrompt();
                } else {
                    this.printError(`% Invalid interface ${args[0]}`);
                }
            } else {
                this.printError('Incomplete command.');
            }
        } else if (cmd === 'do' && args[0] === 'show') {
             this.handleShowCommand(args.slice(1));
        } else {
            this.printError(`% Invalid input detected at '^' marker.`);
        }
    }

    processInterfaceMode(cmd, args) {
        if (cmd === 'ip') {
            if (args[0] === 'address' || args[0] === 'add') {
                if (args.length >= 3) {
                    const ip = args[1];
                    const mask = args[2];
                    this.currentInterface.ip = ip;
                    this.currentInterface.mask = mask; // assuming interface objects save mask too
                    
                    // Dispatch general event if UI needs to redraw
                    document.dispatchEvent(new CustomEvent('deviceUpdated', { detail: this.activeDevice }));
                    // IOS doesn't normally print a confirmation on valid IP address
                } else {
                    this.printError('Incomplete command.');
                }
            } else {
                this.printError(`% Invalid input detected at '^' marker.`);
            }
        } else if (cmd === 'shutdown' || cmd === 'shut') {
            this.currentInterface.status = 'down';
            this.print(`\n%LINK-5-CHANGED: Interface ${this.currentInterface.name}, changed state to administratively down`);
            document.dispatchEvent(new CustomEvent('deviceUpdated', { detail: this.activeDevice }));
        } else if (cmd === 'no') {
            if (args[0] === 'shutdown' || args[0] === 'shut') {
                this.currentInterface.status = 'up';
                this.print(`\n%LINK-3-UPDOWN: Interface ${this.currentInterface.name}, changed state to up`);
                document.dispatchEvent(new CustomEvent('deviceUpdated', { detail: this.activeDevice }));
            } else {
                this.printError(`% Invalid input detected at '^' marker.`);
            }
        } else if (cmd === 'do' && args[0] === 'show') {
            this.handleShowCommand(args.slice(1));
        } else {
            this.printError(`% Invalid input detected at '^' marker.`);
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
        
        switch (this.cliMode) {
            case 'user':
                this.print('  enable                    Turn on privileged commands');
                this.print('  show version              Display system version');
                this.print('  exit                      Exit from the EXEC');
                break;
            case 'privileged':
                this.print('  configure terminal        Enter configuration mode');
                this.print('  disable                   Turn off privileged commands');
                this.print('  copy running-config ...   Copy configuration');
                this.print('  write/wr                  Write configuration');
                this.print('  show ...                  Show running system information');
                this.print('  exit                      Exit from the EXEC');
                break;
            case 'global':
                this.print('  hostname <name>           Set system\'s network name');
                this.print('  interface <id>            Select an interface to configure');
                this.print('  no ...                    Negate a command or set its defaults');
                this.print('  exit                      Exit from the configuration mode');
                break;
            case 'interface':
                this.print('  ip address <ip> <mask>    Interface IP address and mask');
                this.print('  shutdown                  Shutdown the selected interface');
                this.print('  no shutdown               Enable the selected interface');
                this.print('  exit                      Exit from the interface configuration mode');
                break;
        }
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
        const current = this.inputField.value.trim();
        if (!current) return;

        const parts = current.split(/\s+/);
        const lastPart = parts[parts.length - 1];
        
        // Commands available in current mode
        let commands = ['help', 'exit', 'end', 'show', 'do'];
        if (this.cliMode === 'user') commands.push('enable');
        if (this.cliMode === 'privileged') commands.push('configure', 'disable', 'copy', 'write');
        if (this.cliMode === 'global') commands.push('hostname', 'interface', 'no');
        if (this.cliMode === 'interface') commands.push('ip', 'shutdown', 'no');

        const matches = commands.filter(cmd => cmd.startsWith(lastPart));

        if (matches.length === 1) {
            parts[parts.length - 1] = matches[0];
            this.inputField.value = parts.join(' ') + ' ';
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