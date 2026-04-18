// Canvas Manager - Handles rendering and user interaction
import { Cable } from '../network/cable.js';

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
        this.isDraggingDevice = false;
        this.draggedDevice = null;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.lastPanX = 0;
        this.lastPanY = 0;

        // Grid settings
        this.gridSize = 20;
        this.gridColor = '#21262d';
        this.activeCableType = null; // Set when selected in palette

        // Event handlers
        this.clickHandlers = [];
        this.deviceDragHandler = null;
        this.dropHandler = null;
        this.cableStartHandler = null;
        this.cableEndHandler = null;

        // Cable creation state
        this.isCreatingCable = false;
        this.cableStartDevice = null;
        this.cableStartPort = null;
        this.tempCable = null;
        this.clickToConnectMode = false; // New: track if we're in click-to-connect mode

        // References to objects to render
        this.devices = [];
        this.cables = [];

        this.bindEvents();
        this.resize();
    }

    bindEvents() {
        // Prevent browser context menu on canvas to avoid blocking interactions
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Mouse down - start panning, device selection, or cable creation
        this.canvas.addEventListener('mousedown', (e) => {
            // Only handle left click
            if (e.button !== 0) return;
            
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Check if clicking on empty space (not on device/cable)
            const worldX = (x - this.offsetX) / this.scale;
            const worldY = (y - this.offsetY) / this.scale;

            // Check if clicking on a device port (for cable creation)
            const clickedDevice = this.devices.find(device =>
                device.containsPoint(worldX, worldY)
            );

            if (clickedDevice) {
                // Check for port ONLY if we want to create a cable
                if (this.activeCableType) {
                    // If a cable type is selected, use click-to-connect logic
                    const port = clickedDevice.interfaces.find(intf => {
                        // Check if port is already connected
                        return !this.cables.some(c => 
                            (c.startDevice === clickedDevice && c.startPort === intf) ||
                            (c.endDevice === clickedDevice && c.endPort === intf)
                        );
                    });

                    if (port) {
                        if (!this.clickToConnectMode) {
                            // First click - select start device
                            this.clickToConnectMode = true;
                            this.cableStartDevice = clickedDevice;
                            this.cableStartPort = port;
                            console.log('First device selected for connection:', clickedDevice.name, port.name);
                            // Visual feedback - select the device
                            clickedDevice.setSelected(true);
                            return;
                        } else {
                            // Second click - complete connection
                            if (clickedDevice !== this.cableStartDevice) {
                                console.log('Second device selected, creating connection:', clickedDevice.name, port.name);
                                
                                // Create cable
                                const cable = new Cable({
                                    startDevice: this.cableStartDevice,
                                    startPort: this.cableStartPort,
                                    endDevice: clickedDevice,
                                    endPort: port,
                                    type: this.activeCableType
                                });

                                // Validate and add cable
                                if (Cable.isValidConnection(
                                    this.cableStartDevice,
                                    this.cableStartPort,
                                    clickedDevice,
                                    port,
                                    this.activeCableType
                                )) {
                                    if (this.cableEndHandler) {
                                        this.cableEndHandler(cable);
                                    }
                                }

                                // Reset selection
                                this.cableStartDevice.setSelected(false);
                                this.clickToConnectMode = false;
                                this.cableStartDevice = null;
                                this.cableStartPort = null;
                                return;
                            } else {
                                // Clicked same device - cancel selection
                                console.log('Cancelled connection (same device)');
                                this.cableStartDevice.setSelected(false);
                                this.clickToConnectMode = false;
                                this.cableStartDevice = null;
                                this.cableStartPort = null;
                                return;
                            }
                        }
                    } else {
                        console.warn('No available ports on device:', clickedDevice.name);
                        return;
                    }
                }

                // Notify click handlers BEFORE drag logic (for delete mode, etc.)
                this.clickHandlers.forEach(handler => handler(worldX, worldY, e));

                // If not creating cable, start dragging the device (unless in delete mode)
                if (window.ptSimulator && window.ptSimulator.deleteMode) {
                    // Don't drag in delete mode, let the click handler handle it
                    return;
                }
                this.isDraggingDevice = true;
                this.draggedDevice = clickedDevice;
                this.dragOffsetX = worldX - clickedDevice.x;
                this.dragOffsetY = worldY - clickedDevice.y;
                console.log('Device drag started:', clickedDevice.name);
                return;
            }

            // For now, treat as potential pan start 
            this.isPanning = true;
            this.lastPanX = x;
            this.lastPanY = y;

            // Cancel click-to-connect mode if clicking on empty space
            if (this.clickToConnectMode) {
                console.log('Cancelled connection (clicked empty space)');
                if (this.cableStartDevice) {
                    this.cableStartDevice.setSelected(false);
                }
                this.clickToConnectMode = false;
                this.cableStartDevice = null;
                this.cableStartPort = null;
            }

            // Notify click handlers (they'll determine if it was on a device)
            this.clickHandlers.forEach(handler => handler(worldX, worldY, e));
        });

        // Mouse move - handle panning or cable creation
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isCreatingCable) {
                // Update temporary cable end position
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const worldX = (x - this.offsetX) / this.scale;
                const worldY = (y - this.offsetY) / this.scale;

                // Find device under mouse
                const hoveredDevice = this.devices.find(device =>
                    device.containsPoint(worldX, worldY)
                );

                if (hoveredDevice && hoveredDevice !== this.cableStartDevice) {
                    // If a cable type is selected, we just need ANY port on this device
                    const port = hoveredDevice.interfaces.find(intf => {
                        // Check if port is already connected
                        return !this.cables.some(c => 
                            (c.startDevice === hoveredDevice && c.startPort === intf) ||
                            (c.endDevice === hoveredDevice && c.endPort === intf)
                        );
                    });

                    if (port) {
                        // Valid end point found
                        if (this.tempCable) {
                            // Update existing temp cable
                            this.tempCable.setConnection(
                                this.cableStartDevice,
                                this.cableStartPort,
                                hoveredDevice,
                                port
                            );
                        } else {
                            // Create new temp cable with default type (will be set later)
                            this.tempCable = new Cable({
                                startDevice: this.cableStartDevice,
                                startPort: this.cableStartPort,
                                endDevice: hoveredDevice,
                                endPort: port,
                                type: this.activeCableType || 'ethernet-straight'
                            });
                        }
                    } else {
                        // Mouse not near a port, clear temp cable
                        this.tempCable = null;
                    }
                } else {
                    // Mouse not over a valid device, clear temp cable
                    this.tempCable = null;
                }
            } else if (this.isDraggingDevice && this.draggedDevice) {
                // Update device position
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const worldX = (x - this.offsetX) / this.scale;
                const worldY = (y - this.offsetY) / this.scale;

                // Snap to grid (20px)
                const newX = Math.round((worldX - this.dragOffsetX) / 20) * 20;
                const newY = Math.round((worldY - this.dragOffsetY) / 20) * 20;
                
                this.draggedDevice.setPosition(newX, newY);
                
                // Notify via callback for saving
                if (this.deviceDragHandler) {
                    this.deviceDragHandler(this.draggedDevice);
                }
                return;
            } else if (!this.isPanning) {
                // Not doing anything, return early
                return;
            }

            // Handle panning (if not creating cable)
            if (!this.isCreatingCable) {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                const dx = x - this.lastPanX;
                const dy = y - this.lastPanY;

                this.offsetX += dx;
                this.offsetY += dy;

                this.lastPanX = x;
                this.lastPanY = y;
            }
        });

        // Mouse up - end panning or complete cable creation
        this.canvas.addEventListener('mouseup', (e) => {
            if (this.isCreatingCable) {
                // Finish cable creation
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const worldX = (x - this.offsetX) / this.scale;
                const worldY = (y - this.offsetY) / this.scale;

                // Check if we have a valid temp cable and end point
                if (this.tempCable &&
                    this.tempCable.startDevice &&
                    this.tempCable.startPort &&
                    this.tempCable.endDevice &&
                    this.tempCable.endPort) {

                    // Validate the connection
                    if (Cable.isValidConnection(
                        this.tempCable.startDevice,
                        this.tempCable.startPort,
                        this.tempCable.endDevice,
                        this.tempCable.endPort,
                        this.tempCable.type
                    )) {
                        // Valid connection - add the cable
                        if (this.cableEndHandler) {
                            this.cableEndHandler(this.tempCable);
                        }
                    }
                    // Invalid connection - temp cable will be discarded
                }

                // Reset cable creation state
                this.isCreatingCable = false;
                this.cableStartDevice = null;
                this.cableStartPort = null;
                this.tempCable = null;
            } else if (this.isDraggingDevice) {
                this.isDraggingDevice = false;
                this.draggedDevice = null;
                // Final save notification
                document.dispatchEvent(new CustomEvent('deviceUpdated'));
            } else {
                // Normal mouse up - end panning
                this.isPanning = false;
            }
        });

        // Global mouse up to ensure state reset only if NOT handled by canvas
        // This prevents the global reset from stealing events needed for cable completion
        window.addEventListener('mouseup', (e) => {
            if (e.target === this.canvas) return; // Let the canvas listener handle it
            
            if (this.isCreatingCable) {
                this.resetInteractionState();
            } else if (this.isDraggingDevice) {
                this.isDraggingDevice = false;
                this.draggedDevice = null;
                document.dispatchEvent(new CustomEvent('deviceUpdated'));
            } else {
                this.isPanning = false;
            }
        });

        // Mouse leave - end interaction if cursor leaves canvas area
        this.canvas.addEventListener('mouseleave', () => {
            // We don't necessarily want to stop dragging if we leave, 
            // but for safety we'll reset panning
            this.isPanning = false;
        });

        // Ensure state is reset if window loses focus
        window.addEventListener('blur', () => this.resetInteractionState());

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

        // Handle cable type selection from palette
        document.addEventListener('pt-simulator:cableTypeSelected', (e) => {
            this.activeCableType = e.detail.type;
            // Cancel any pending click-to-connect
            if (this.clickToConnectMode && this.cableStartDevice) {
                this.cableStartDevice.setSelected(false);
            }
            this.clickToConnectMode = false;
            this.cableStartDevice = null;
            this.cableStartPort = null;
            // Optionally change cursor or visual state
            this.canvas.style.cursor = this.activeCableType ? 'crosshair' : 'default';
        });

        // Handle resize
        window.addEventListener('resize', () => this.resize());

        // Handle drop events for device creation
        this.canvas.addEventListener('dragenter', (e) => {
            e.preventDefault();
            this.canvas.style.outline = '2px dashed #58a6ff';
            this.canvas.style.outlineOffset = '-4px';
        });

        this.canvas.addEventListener('dragleave', (e) => {
            this.canvas.style.outline = 'none';
        });

        this.canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        this.canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            this.canvas.style.outline = 'none';
            
            const deviceType = e.dataTransfer.getData('text/plain');
            if (deviceType && this.dropHandler) {
                const rect = this.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                // Convert screen coordinates to world coordinates
                const worldX = (x - this.offsetX) / this.scale;
                const worldY = (y - this.offsetY) / this.scale;
                
                this.dropHandler(worldX, worldY, deviceType);
            }
        });
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
        
        // Grid should be drawn in world coordinates
        // We'll figure out the visible range
        const start = this.screenToWorld(0, 0);
        const end = this.screenToWorld(width, height);
        
        ctx.save();
        ctx.strokeStyle = this.gridColor;
        ctx.lineWidth = 1 / this.scale; // Keep grid lines thin

        // Vertical lines
        const firstX = Math.floor(start.x / this.gridSize) * this.gridSize;
        for (let x = firstX; x <= end.x; x += this.gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, start.y);
            ctx.lineTo(x, end.y);
            ctx.stroke();
        }

        // Horizontal lines
        const firstY = Math.floor(start.y / this.gridSize) * this.gridSize;
        for (let y = firstY; y <= end.y; y += this.gridSize) {
            ctx.beginPath();
            ctx.moveTo(start.x, y);
            ctx.lineTo(end.x, y);
            ctx.stroke();
        }

        ctx.restore();
    }

    // Start render loop
    startRenderLoop() {
        const render = () => {
            this.clear();
            
            this.ctx.save();
            // Apply global transformation
            this.ctx.translate(this.offsetX, this.offsetY);
            this.ctx.scale(this.scale, this.scale);
            
            this.renderGrid();
            
            // Render temporary cable (if creating)
            if (this.tempCable) {
                this.tempCable.render(this.ctx);
            }
            
            // Render cables first (behind devices)
            this.cables.forEach(cable => cable.render(this.ctx));
            
            // Render devices
            this.devices.forEach(device => device.render(this.ctx));
            
            this.ctx.restore();

            // Render UI overlays (not scaled/translated)
            if (this.activeCableType) {
                this.renderCableModeIndicator();
            }
            
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

    onDrop(callback) {
        this.dropHandler = callback;
    }

    onCableStart(callback) {
        this.cableStartHandler = callback;
    }

    onCableEnd(callback) {
        this.cableEndHandler = callback;
    }

    resetInteractionState() {
        this.isPanning = false;
        this.isDraggingDevice = false;
        this.draggedDevice = null;
        this.isCreatingCable = false;
        this.cableStartDevice = null;
        this.cableStartPort = null;
        this.tempCable = null;
        
        // Also cancel click-to-connect mode
        if (this.clickToConnectMode && this.cableStartDevice) {
            this.cableStartDevice.setSelected(false);
        }
        this.clickToConnectMode = false;
    }

    renderCableModeIndicator() {
        const ctx = this.ctx;
        ctx.save();
        
        const text = `CABLE MODE: ${this.activeCableType.toUpperCase()}`;
        ctx.font = 'bold 12px sans-serif';
        const width = ctx.measureText(text).width;
        
        ctx.fillStyle = 'rgba(248, 81, 73, 0.9)'; // Reddish
        ctx.fillRect(10, 10, width + 20, 24);
        
        ctx.fillStyle = 'white';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 20, 22);
        
        ctx.restore();
    }
}