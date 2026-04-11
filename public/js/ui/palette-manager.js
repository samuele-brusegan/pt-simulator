export class PaletteManager {
    constructor(paletteElement, deviceFactory) {
        this.palette = paletteElement;
        this.deviceFactory = deviceFactory;
        this.draggedDeviceType = null;
        this.dragImage = null;
        this.activeTab = 'devices'; // 'devices' or 'connections'
        this.iconStyle = localStorage.getItem('pt-simulator-icon-style') || '2d';

        this.initUI();
        this.render();
    }

    initUI() {
        this.palette.innerHTML = `
            <div class="palette-tabs">
                <div class="palette-tab active" data-tab="devices">DEVICES</div>
                <div class="palette-tab" data-tab="connections">CONNECTIONS</div>
            </div>
            <div id="palette-controls" style="padding: 5px; background: #0d1117; display: flex; justify-content: flex-end; border-bottom: 1px solid #30363d;">
                <button id="toggle-icon-style" class="btn" style="padding: 2px 8px; font-size: 0.7rem; background: #30363d;">
                    MODE: ${this.iconStyle.toUpperCase()}
                </button>
            </div>
            <div class="palette-content" id="palette-content"></div>
        `;

        this.contentArea = this.palette.querySelector('#palette-content');
        
        // Tab switching logic
        this.palette.querySelectorAll('.palette-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.palette.querySelectorAll('.palette-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.activeTab = tab.dataset.tab;
                this.render();
            });
        });

        this.palette.querySelector('#toggle-icon-style').addEventListener('click', (e) => {
            this.iconStyle = this.iconStyle === '2d' ? '3d' : '2d';
            localStorage.setItem('pt-simulator-icon-style', this.iconStyle);
            e.target.textContent = `MODE: ${this.iconStyle.toUpperCase()}`;
            this.render();
            document.dispatchEvent(new CustomEvent('pt-simulator:iconStyleChanged', { detail: { style: this.iconStyle } }));
        });

        this.bindEvents();
    }

    bindEvents() {
        this.palette.addEventListener('dragstart', (e) => {
            if (this.activeTab !== 'devices') return;
            const paletteItem = e.target.closest('.palette-item');
            if (paletteItem) {
                const deviceType = paletteItem.dataset.deviceType;
                this.draggedDeviceType = deviceType;
                e.dataTransfer.setData('text/plain', deviceType);
                this.createDragImage(e, paletteItem);
                e.dataTransfer.effectAllowed = 'copy';
            }
        });

        this.palette.addEventListener('click', (e) => {
            const paletteItem = e.target.closest('.palette-item');
            if (!paletteItem) return;

            if (this.activeTab === 'devices') {
                if (this._onDeviceCreate) {
                    this._onDeviceCreate(paletteItem.dataset.deviceType);
                }
            } else {
                // Connection selection
                const cableType = paletteItem.dataset.cableType;
                this.selectCable(cableType, paletteItem);
            }
        });

        this.palette.addEventListener('dragend', () => {
            this.draggedDeviceType = null;
        });
    }

    selectCable(type, element) {
        this.activeCableType = type;
        this.contentArea.querySelectorAll('.palette-item').forEach(item => item.classList.remove('selected'));
        if (element) {
            element.classList.add('selected');
        } else {
            // Find by data attribute if element not provided
            const item = this.contentArea.querySelector(`.palette-item[data-cable-type="${type}"]`);
            if (item) item.classList.add('selected');
        }
        
        // Notify app about active cable type
        document.dispatchEvent(new CustomEvent('pt-simulator:cableTypeSelected', { detail: { type } }));
    }

    clearSelection() {
        this.activeCableType = null;
        if (this.contentArea) {
            this.contentArea.querySelectorAll('.palette-item').forEach(item => item.classList.remove('selected'));
            // Optionally select the 'pointer' tool if it exists
            const selectItem = this.contentArea.querySelector('.palette-item[data-cable-type=""]');
            if (selectItem) selectItem.classList.add('selected');
        }
    }

    createDragImage(e, paletteItem) {
        const dragImg = document.createElement('div');
        dragImg.style.position = 'fixed';
        dragImg.style.pointerEvents = 'none';
        dragImg.style.opacity = '0.7';
        dragImg.style.zIndex = '1000';
        dragImg.innerHTML = paletteItem.innerHTML;
        dragImg.style.padding = '0.5rem';
        dragImg.style.backgroundColor = '#21262d';
        dragImg.style.borderRadius = '4px';
        document.body.appendChild(dragImg);
        e.dataTransfer.setDragImage(dragImg, 0, 0);
        setTimeout(() => document.body.removeChild(dragImg), 100);
    }

    render() {
        this.contentArea.innerHTML = '';
        if (this.activeTab === 'devices') {
            this.renderDevices();
        } else {
            this.renderConnections();
        }
    }

    renderDevices() {
        const deviceTypes = this.deviceFactory.getAvailableTypes();
        deviceTypes.forEach(type => {
            const deviceInfo = this.deviceFactory.getDeviceInfo(type);
            if (!deviceInfo) return;

            const paletteItem = document.createElement('div');
            paletteItem.className = 'palette-item';
            paletteItem.draggable = true;
            paletteItem.dataset.deviceType = type;
            const iconPath = deviceInfo.icons[this.iconStyle] || deviceInfo.icons['2d'];
            
            paletteItem.innerHTML = `
                <img src="${iconPath}" class="palette-icon" alt="${deviceInfo.name}">
                <div class="palette-label">${deviceInfo.name}</div>
            `;
            this.contentArea.appendChild(paletteItem);
        });
    }

    renderConnections() {
        const cableTypes = [
            { id: null, name: 'Select', icon: '🖱️' },
            { id: 'ethernet-straight', name: 'Straight', color: '#000000' },
            { id: 'ethernet-cross', name: 'Cross', color: '#000000', dashed: true },
            { id: 'console', name: 'Console', color: '#58a6ff' },
            { id: 'serial-dce', name: 'Serial', color: '#d29922' }
        ];

        cableTypes.forEach(cable => {
            const paletteItem = document.createElement('div');
            paletteItem.className = 'palette-item';
            if (cable.id === this.activeCableType) paletteItem.classList.add('selected');
            paletteItem.dataset.cableType = cable.id || '';
            
            if (cable.id === null) {
                paletteItem.innerHTML = `
                    <div style="font-size: 1.5rem; height: 32px; display: flex; align-items: center; justify-content: center;">${cable.icon}</div>
                    <div class="palette-label">${cable.name}</div>
                `;
            } else {
                // Draw a symbolic line for cable
                paletteItem.innerHTML = `
                    <div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
                        <div style="width: 100%; height: 2px; background: ${cable.color}; ${cable.dashed ? 'border-top: 2px dashed #000; height: 0; background: none;' : ''}"></div>
                    </div>
                    <div class="palette-label">${cable.name}</div>
                `;
            }
            this.contentArea.appendChild(paletteItem);
        });
    }

    onDeviceCreate(callback) {
        this._onDeviceCreate = callback;
    }
}