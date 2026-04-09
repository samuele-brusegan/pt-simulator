// Canvas Manager - Handles rendering and user interaction
export class CanvasManager {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');

        // View transform (pan/zoom)
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;

        // Interaction state
        this.isPanning = false;
        this.lastPanX = 0;
        this.lastPanY = 0;

        // Grid settings
        this.gridSize = 20;
        this.gridColor = '#21262d';

        // Event handlers
        this.clickHandlers = [];
        this.deviceDragHandler = null;

        // References to objects to render
        this.devices = [];
        this.cables = [];

        this.bindEvents();
        this.resize();
    }

    bindEvents() {
        // Mouse down - start panning or device selection
        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Check if clicking on empty space (not on device/cable)
            const worldX = (x - this.offsetX) / this.scale;
            const worldY = (y - this.offsetY) / this.scale;

            // For now, treat as potential pan start
            this.isPanning = true;
            this.lastPanX = x;
            this.lastPanY = y;

            // Notify click handlers (they'll determine if it was on a device)
            this.clickHandlers.forEach(handler => handler(worldX, worldY));
        });

        // Mouse move - handle panning
        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isPanning) return;

            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const dx = x - this.lastPanX;
            const dy = y - this.lastPanY;

            this.offsetX += dx;
            this.offsetY += dy;

            this.lastPanX = x;
            this.lastPanY = y;
        });

        // Mouse up - end panning
        this.canvas.addEventListener('mouseup', () => {
            this.isPanning = false;
        });

        // Mouse leave - end panning if cursor leaves
        this.canvas.addEventListener('mouseleave', () => {
            this.isPanning = false;
        });

        // Wheel - handle zooming
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();

            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Zoom factor
            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
            const oldScale = this.scale;
            this.scale *= zoomFactor;

            // Limit zoom
            this.scale = Math.max(0.1, Math.min(5, this.scale));

            // Adjust offset to zoom toward mouse position
            const zoomRatio = this.scale / oldScale;
            this.offsetX = x - (x - this.offsetX) * zoomRatio;
            this.offsetY = y - (y - this.offsetY) * zoomRatio;
        }, { passive: false });

        // Touch support for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                const x = touch.clientX - rect.left;
                const y = touch.clientY - rect.top;

                this.isPanning = true;
                this.lastPanX = x;
                this.lastPanY = y;
            }
        });

        this.canvas.addEventListener('touchmove', (e) => {
            if (this.isPanning && e.touches.length === 1) {
                const touch = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                const x = touch.clientX - rect.left;
                const y = touch.clientY - rect.top;

                const dx = x - this.lastPanX;
                const dy = y - this.lastPanY;

                this.offsetX += dx;
                this.offsetY += dy;

                this.lastPanX = x;
                this.lastPanY = y;

                e.preventDefault();
            }
        });

        this.canvas.addEventListener('touchend', () => {
            this.isPanning = false;
        });

        // Handle resize
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    getContext() {
        return this.ctx;
    }

    getWidth() {
        return this.canvas.width;
    }

    getHeight() {
        return this.canvas.height;
    }

    // Convert screen coordinates to world coordinates
    screenToWorld(x, y) {
        return {
            x: (x - this.offsetX) / this.scale,
            y: (y - this.offsetY) / this.scale
        };
    }

    // Convert world coordinates to screen coordinates
    worldToScreen(x, y) {
        return {
            x: x * this.scale + this.offsetX,
            y: y * this.scale + this.offsetY
        };
    }

    // Render grid
    renderGrid() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        ctx.save();
        ctx.strokeStyle = this.gridColor;
        ctx.lineWidth = 1;

        // Vertical lines
        for (let x = 0; x <= width; x += this.gridSize * this.scale) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Horizontal lines
        for (let y = 0; y <= height; y += this.gridSize * this.scale) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        ctx.restore();
    }

    // Start render loop
    startRenderLoop() {
        const render = () => {
            this.clear();
            this.renderGrid();
            // Render cables first (behind devices)
            this.cables.forEach(cable => cable.render(this.ctx));
            // Render devices
            this.devices.forEach(device => device.render(this.ctx));
            requestAnimationFrame(render);
        };

        requestAnimationFrame(render);
    }

    // Event subscription
    onClick(callback) {
        this.clickHandlers.push(callback);
    }

    onDeviceDrag(callback) {
        this.deviceDragHandler = callback;
    }
}