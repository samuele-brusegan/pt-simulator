// Palette Manager - Handles device palette and drag creation
export class PaletteManager {
    constructor(paletteElement, deviceFactory) {
        this.palette = paletteElement;
        this.deviceFactory = deviceFactory;
        this.draggedDeviceType = null;
        this.dragImage = null;

        this.bindEvents();
        this.loadDefaultDevices();
    }

    bindEvents() {
        // Prevent default drag behavior on palette items
        this.palette.addEventListener('dragstart', (e) => {
            // Find the device type from the dragged element
            const paletteItem = e.target.closest('.palette-item');
            if (paletteItem) {
                const deviceType = paletteItem.dataset.deviceType;
                this.draggedDeviceType = deviceType;

                // Set drag data (required for Firefox)
                e.dataTransfer.setData('text/plain', deviceType);

                // Create drag image
                this.createDragImage(e, paletteItem);

                // Effect allowed
                e.dataTransfer.effectAllowed = 'copy';
            }
        });

        // Handle click for device creation (no drag)
        this.palette.addEventListener('click', (e) => {
            const paletteItem = e.target.closest('.palette-item');
            if (paletteItem && this._onDeviceCreate) {
                const deviceType = paletteItem.dataset.deviceType;
                this._onDeviceCreate(deviceType);
            }
        });

        this.palette.addEventListener('dragend', (e) => {
            this.draggedDeviceType = null;
            this.dragImage = null;
        });
    }

    createDragImage(e, paletteItem) {
        // Create a custom drag image
        const dragImg = document.createElement('div');
        dragImg.style.position = 'fixed';
        dragImg.style.pointerEvents = 'none';
        dragImg.style.opacity = '0.7';
        dragImg.style.zIndex = '1000';

        // Clone the palette item content
        dragImg.innerHTML = paletteItem.innerHTML;
        dragImg.style.padding = '0.5rem';
        dragImg.style.backgroundColor = '#21262d';
        dragImg.style.borderRadius = '4px';
        dragImg.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';

        document.body.appendChild(dragImg);
        this.dragImage = dragImg;

        // Position it under cursor
        const updatePosition = (moveE) => {
            if (dragImg) {
                dragImg.style.left = `${moveE.clientX + 10}px`;
                dragImg.style.top = `${moveE.clientY + 10}px`;
            }
        };

        document.addEventListener('mousemove', updatePosition);

        // Clean up on drag end
        const cleanup = () => {
            document.removeEventListener('mousemove', updatePosition);
            if (dragImg && dragImg.parentNode) {
                dragImg.parentNode.removeChild(dragImg);
            }
        };

        e.dataTransfer.addElement ? e.dataTransfer.setDragImage(dragImg, 0, 0) : null;
        // For browsers that don't support setDragImage, we'll use the above approach

        // Auto cleanup after a short delay
        setTimeout(cleanup, 100);
    }

    loadDefaultDevices() {
        const deviceTypes = this.deviceFactory.getAvailableTypes();
        this.palette.innerHTML = ''; // Clear existing

        deviceTypes.forEach(type => {
            const deviceInfo = this.deviceFactory.getDeviceInfo(type);
            if (!deviceInfo) return;

            const paletteItem = document.createElement('div');
            paletteItem.className = 'palette-item';
            paletteItem.draggable = true;
            paletteItem.dataset.deviceType = type;
            paletteItem.innerHTML = `
                <div class="palette-icon">${deviceInfo.icon || '📦'}</div>
                <div class="palette-label">${deviceInfo.name}</div>
            `;

            this.palette.appendChild(paletteItem);
        });
    }

    // Event subscription for when a device should be created
    onDeviceCreate(callback) {
        this._onDeviceCreate = callback;
    }

    // This would be called by canvas when drop occurs
    handleDrop(x, y) {
        if (this.draggedDeviceType && this._onDeviceCreate) {
            this._onDeviceCreate(this.draggedDeviceType);
            this.draggedDeviceType = null;
        }
    }
}