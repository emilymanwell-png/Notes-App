/**
 * Canvas Module - Handles all canvas drawing, layers, and transformation functionality
 */

// Canvas Layer Manager - Photoshop-like layer system
class LayerManager {
    constructor(canvasWrapper, width, height) {
        this.canvasWrapper = canvasWrapper;
        this.width = width;
        this.height = height;
        // Use capped devicePixelRatio to avoid extreme memory usage
        this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
        this.layers = [];
        this.activeLayerIndex = 0;
        this.layerCounter = 0;
        this.onLayerChange = null; // Callback for layer changes
    }

    // Create a new layer
    createLayer(name = null, insertIndex = null) {
        const layerId = `layer-${++this.layerCounter}`;
        const layerName = name || `Layer ${this.layerCounter}`;
        
        const canvas = document.createElement('canvas');
        canvas.id = layerId;
        canvas.className = 'layer-canvas';
        // High-DPI backing store while keeping CSS size constant
        canvas.width = Math.floor(this.width * this.pixelRatio);
        canvas.height = Math.floor(this.height * this.pixelRatio);
        canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: ${this.width}px;
            height: ${this.height}px;
            pointer-events: none;
        `;
        
        // Create a text/content container for this layer
        const contentContainer = document.createElement('div');
        contentContainer.id = `${layerId}-content`;
        contentContainer.className = 'layer-content';
        contentContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: ${this.width}px;
            height: ${this.height}px;
            pointer-events: none;
        `;
        
        const layerCtx = canvas.getContext('2d');
        // Note: We keep backing store at high-DPI but don't pre-scale context
        // The drawing code handles coordinate mapping

        const layer = {
            id: layerId,
            name: layerName,
            canvas: canvas,
            ctx: layerCtx,
            contentContainer: contentContainer, // For text boxes and media on this layer
            visible: true,
            opacity: 1,
            locked: false,
            blendMode: 'normal'
        };
        
        // Insert at specific index or push to end
        if (insertIndex !== null && insertIndex >= 0 && insertIndex <= this.layers.length) {
            this.layers.splice(insertIndex, 0, layer);
            this.activeLayerIndex = insertIndex;
        } else {
            this.layers.push(layer);
            this.activeLayerIndex = this.layers.length - 1;
        }
        
        this._updateLayerZIndices();
        this._insertCanvasIntoWrapper(layer.canvas, this.activeLayerIndex);
        this._insertContentContainer(layer.contentContainer);
        this._notifyChange();
        
        return layer;
    }

    // Insert canvas at correct position in DOM
    _insertCanvasIntoWrapper(canvas, index) {
        // Find the drawing canvas or grid overlay to insert before
        const gridOverlay = this.canvasWrapper.querySelector('.grid-overlay');
        const mediaLayer = this.canvasWrapper.querySelector('.media-layer');
        
        // Insert layer canvases before the grid overlay
        if (gridOverlay) {
            this.canvasWrapper.insertBefore(canvas, gridOverlay);
        } else if (mediaLayer) {
            this.canvasWrapper.insertBefore(canvas, mediaLayer);
        } else {
            this.canvasWrapper.appendChild(canvas);
        }
    }

    // Insert content container for text/media
    _insertContentContainer(container) {
        // First try by ID for more reliable lookup
        let textLayer = document.getElementById('text-layer');
        
        // Fallback to querySelector
        if (!textLayer && this.canvasWrapper) {
            textLayer = this.canvasWrapper.querySelector('.text-layer');
        }
        
        if (textLayer) {
            textLayer.appendChild(container);
        } else if (this.canvasWrapper) {
            this.canvasWrapper.appendChild(container);
        } else {
            console.error('No valid parent element found for content container!');
        }
    }

    // Update z-indices of all layers
    _updateLayerZIndices() {
        this.layers.forEach((layer, index) => {
            layer.canvas.style.zIndex = index + 10; // Start from 10 to leave room for base elements
            if (layer.contentContainer) {
                layer.contentContainer.style.zIndex = index + 10;
            }
        });
    }

    // Get the active layer
    getActiveLayer() {
        return this.layers[this.activeLayerIndex] || null;
    }

    // Get active layer's context
    getActiveContext() {
        const layer = this.getActiveLayer();
        return layer ? layer.ctx : null;
    }

    // Get active layer's content container (for text/media)
    getActiveContentContainer() {
        const layer = this.getActiveLayer();
        return layer ? layer.contentContainer : null;
    }

    // Set active layer by index
    setActiveLayer(index) {
        if (index >= 0 && index < this.layers.length) {
            this.activeLayerIndex = index;
            this._notifyChange();
            return true;
        }
        return false;
    }

    // Set active layer by id
    setActiveLayerById(layerId) {
        const index = this.layers.findIndex(l => l.id === layerId);
        if (index !== -1) {
            return this.setActiveLayer(index);
        }
        return false;
    }

    // Delete a layer
    deleteLayer(index) {
        if (this.layers.length <= 1) {
            console.warn('Cannot delete the last layer');
            return false;
        }
        
        if (index >= 0 && index < this.layers.length) {
            const layer = this.layers[index];
            layer.canvas.remove();
            if (layer.contentContainer) {
                layer.contentContainer.remove();
            }
            this.layers.splice(index, 1);
            
            // Adjust active layer index if necessary
            if (this.activeLayerIndex >= this.layers.length) {
                this.activeLayerIndex = this.layers.length - 1;
            } else if (this.activeLayerIndex > index) {
                this.activeLayerIndex--;
            }
            
            this._updateLayerZIndices();
            this._notifyChange();
            return true;
        }
        return false;
    }

    // Toggle layer visibility
    toggleVisibility(index) {
        if (index >= 0 && index < this.layers.length) {
            const layer = this.layers[index];
            layer.visible = !layer.visible;
            layer.canvas.style.display = layer.visible ? 'block' : 'none';
            if (layer.contentContainer) {
                layer.contentContainer.style.display = layer.visible ? 'block' : 'none';
            }
            this._notifyChange();
            return layer.visible;
        }
        return null;
    }

    // Set layer opacity
    setOpacity(index, opacity) {
        if (index >= 0 && index < this.layers.length) {
            const layer = this.layers[index];
            layer.opacity = Math.max(0, Math.min(1, opacity));
            layer.canvas.style.opacity = layer.opacity;
            if (layer.contentContainer) {
                layer.contentContainer.style.opacity = layer.opacity;
            }
            this._notifyChange();
            return true;
        }
        return false;
    }

    // Rename a layer
    renameLayer(index, newName) {
        if (index >= 0 && index < this.layers.length) {
            this.layers[index].name = newName;
            this._notifyChange();
            return true;
        }
        return false;
    }

    // Move layer up
    moveLayerUp(index) {
        if (index > 0 && index < this.layers.length) {
            [this.layers[index], this.layers[index - 1]] = [this.layers[index - 1], this.layers[index]];
            
            if (this.activeLayerIndex === index) {
                this.activeLayerIndex--;
            } else if (this.activeLayerIndex === index - 1) {
                this.activeLayerIndex++;
            }
            
            this._updateLayerZIndices();
            this._reorderCanvasElements();
            this._notifyChange();
            return true;
        }
        return false;
    }

    // Move layer down
    moveLayerDown(index) {
        if (index >= 0 && index < this.layers.length - 1) {
            [this.layers[index], this.layers[index + 1]] = [this.layers[index + 1], this.layers[index]];
            
            if (this.activeLayerIndex === index) {
                this.activeLayerIndex++;
            } else if (this.activeLayerIndex === index + 1) {
                this.activeLayerIndex--;
            }
            
            this._updateLayerZIndices();
            this._reorderCanvasElements();
            this._notifyChange();
            return true;
        }
        return false;
    }

    // Reorder canvas elements in DOM to match layer order
    _reorderCanvasElements() {
        const gridOverlay = this.canvasWrapper.querySelector('.grid-overlay');
        this.layers.forEach(layer => {
            if (gridOverlay) {
                this.canvasWrapper.insertBefore(layer.canvas, gridOverlay);
            }
        });
    }

    // Merge layer down
    mergeDown(index) {
        if (index > 0 && index < this.layers.length) {
            const upperLayer = this.layers[index];
            const lowerLayer = this.layers[index - 1];
            
            // Draw upper layer onto lower layer
            lowerLayer.ctx.globalAlpha = upperLayer.opacity;
            lowerLayer.ctx.drawImage(upperLayer.canvas, 0, 0);
            lowerLayer.ctx.globalAlpha = 1;
            
            // Delete upper layer
            this.deleteLayer(index);
            this._notifyChange();
            return true;
        }
        return false;
    }

    // Flatten all layers into one
    flattenLayers() {
        if (this.layers.length <= 1) return;
        
        // Create a new merged canvas
        const mergedCanvas = document.createElement('canvas');
        mergedCanvas.width = this.width;
        mergedCanvas.height = this.height;
        const mergedCtx = mergedCanvas.getContext('2d');
        
        // Draw all visible layers from bottom to top
        this.layers.forEach(layer => {
            if (layer.visible) {
                mergedCtx.globalAlpha = layer.opacity;
                // Draw scaled from high-DPI layer backing to CSS-sized merged canvas
                mergedCtx.drawImage(layer.canvas, 0, 0, this.width, this.height);
            }
        });
        mergedCtx.globalAlpha = 1;
        
        // Remove all layers
        this.layers.forEach(layer => layer.canvas.remove());
        this.layers = [];
        this.layerCounter = 0;
        
        // Create new base layer with merged content
        const newLayer = this.createLayer('Flattened');
        newLayer.ctx.drawImage(mergedCanvas, 0, 0);
        
        this._notifyChange();
    }

    // Duplicate a layer
    duplicateLayer(index) {
        if (index >= 0 && index < this.layers.length) {
            const sourceLayer = this.layers[index];
            const newLayer = this.createLayer(`${sourceLayer.name} copy`, index + 1);
            
            // Copy the canvas content
            newLayer.ctx.drawImage(sourceLayer.canvas, 0, 0);
            newLayer.opacity = sourceLayer.opacity;
            newLayer.canvas.style.opacity = newLayer.opacity;
            
            this._notifyChange();
            return newLayer;
        }
        return null;
    }

    // Clear all layers
    clearAll() {
        this.layers.forEach(layer => {
            layer.ctx.clearRect(0, 0, this.width, this.height);
        });
        this._notifyChange();
    }

    // Get flattened image as dataURL (for backward compatibility with single-canvas saves)
    getFlattenedDataURL() {
        const mergedCanvas = document.createElement('canvas');
        mergedCanvas.width = this.width;
        mergedCanvas.height = this.height;
        const mergedCtx = mergedCanvas.getContext('2d');
        
        // Draw all visible layers from bottom to top
        this.layers.forEach(layer => {
            if (layer.visible) {
                mergedCtx.globalAlpha = layer.opacity;
                mergedCtx.drawImage(layer.canvas, 0, 0, this.width, this.height);
            }
        });
        mergedCtx.globalAlpha = 1;
        
        return mergedCanvas.toDataURL();
    }

    // Async version of getFlattenedDataURL - doesn't block drawing
    async getFlattenedDataURLAsync() {
        return new Promise((resolve) => {
            const doWork = () => {
                const mergedCanvas = document.createElement('canvas');
                mergedCanvas.width = this.width;
                mergedCanvas.height = this.height;
                const mergedCtx = mergedCanvas.getContext('2d');
                
                // Draw all visible layers from bottom to top
                this.layers.forEach(layer => {
                    if (layer.visible) {
                        mergedCtx.globalAlpha = layer.opacity;
                        mergedCtx.drawImage(layer.canvas, 0, 0, this.width, this.height);
                    }
                });
                mergedCtx.globalAlpha = 1;
                
                resolve(mergedCanvas.toDataURL());
            };
            
            // Use requestIdleCallback to avoid blocking drawing, with setTimeout fallback
            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(doWork, { timeout: 1000 });
            } else {
                setTimeout(doWork, 0);
            }
        });
    }

    // Serialize layers for saving
    serialize() {
        return this.layers.map(layer => ({
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            locked: layer.locked,
            blendMode: layer.blendMode,
            imageData: layer.canvas.toDataURL()
        }));
    }

    // Async version of serialize - processes layers one at a time to avoid blocking
    async serializeAsync() {
        const results = [];
        
        for (const layer of this.layers) {
            // Process each layer in a separate task to avoid blocking the main thread
            const layerData = await new Promise((resolve) => {
                const doWork = () => {
                    resolve({
                        id: layer.id,
                        name: layer.name,
                        visible: layer.visible,
                        opacity: layer.opacity,
                        locked: layer.locked,
                        blendMode: layer.blendMode,
                        imageData: layer.canvas.toDataURL()
                    });
                };
                
                // Use requestIdleCallback to yield to drawing operations
                if (typeof requestIdleCallback !== 'undefined') {
                    requestIdleCallback(doWork, { timeout: 500 });
                } else {
                    setTimeout(doWork, 0);
                }
            });
            results.push(layerData);
        }
        
        return results;
    }

    // Deserialize and restore layers
    deserialize(data) {
        // Clear existing layers and their content containers
        this.layers.forEach(layer => {
            layer.canvas.remove();
            if (layer.contentContainer) {
                layer.contentContainer.remove();
            }
        });
        this.layers = [];
        this.layerCounter = 0;
        
        if (!data || data.length === 0) {
            // Create default layer if no data
            this.createLayer('Background');
            return;
        }
        
        data.forEach((layerData, index) => {
            const layer = this.createLayer(layerData.name);
            layer.visible = layerData.visible !== false;
            layer.opacity = layerData.opacity || 1;
            layer.locked = layerData.locked || false;
            layer.blendMode = layerData.blendMode || 'normal';
            
            layer.canvas.style.display = layer.visible ? 'block' : 'none';
            layer.canvas.style.opacity = layer.opacity;
            
            // Load image data
            if (layerData.imageData) {
                const img = new Image();
                img.onload = () => {
                    layer.ctx.drawImage(img, 0, 0);
                };
                img.src = layerData.imageData;
            }
        });
        
        this.activeLayerIndex = 0;
        this._notifyChange();
    }

    // Notify change callback
    _notifyChange() {
        if (typeof this.onLayerChange === 'function') {
            this.onLayerChange(this.layers, this.activeLayerIndex);
        }
    }

    // Get all layers info
    getLayers() {
        return this.layers.map((layer, index) => ({
            id: layer.id,
            name: layer.name,
            visible: layer.visible,
            opacity: layer.opacity,
            locked: layer.locked,
            isActive: index === this.activeLayerIndex
        }));
    }
}

// Canvas Manager - Handles canvas initialization, drawing, and transformations
class CanvasManager {
    constructor(options = {}) {
        this.canvasContainer = document.getElementById('canvas-container');
        this.canvasWrapper = document.getElementById('canvas-wrapper');
        this.gridCanvas = document.getElementById('grid-canvas');
        this.drawingCanvas = document.getElementById('drawing-canvas');
        this.textLayer = document.getElementById('text-layer');
        
        this.CANVAS_WIDTH = options.width || 4000;
        this.CANVAS_HEIGHT = options.height || 4000;
        // High-DPI rendering ratio (capped for memory safety)
        this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
        
        this.gridCtx = this.gridCanvas?.getContext('2d');
        this.drawCtx = this.drawingCanvas?.getContext('2d');
        
        // Initialize layer manager
        this.layerManager = new LayerManager(this.canvasWrapper, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
        
        // Drawing state
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.isPanning = false;
        this.panStart = { x: 0, y: 0 };
        this.lastMousePos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

        // Stroke smoothing buffer
        this.points = [];
        
        // State reference (will be set by main app)
        this.state = null;
        
        // Callbacks
        this.onUnsaved = null;
        this.onSaveToUndo = null;

        // Internal throttle for undo snapshots
        this._lastUndoAt = 0;
        this._UNDO_COOLDOWN_MS = 1200;
    }

    // Set state reference from main app
    setState(state) {
        this.state = state;
    }

    // Initialize canvases
    init() {
        if (!this.gridCanvas || !this.drawingCanvas) {
            console.error('Canvas elements not found');
            return;
        }
        
        // High-DPI backing store while keeping CSS dimensions constant
        this.gridCanvas.width = Math.floor(this.CANVAS_WIDTH * this.pixelRatio);
        this.gridCanvas.height = Math.floor(this.CANVAS_HEIGHT * this.pixelRatio);
        this.drawingCanvas.width = Math.floor(this.CANVAS_WIDTH * this.pixelRatio);
        this.drawingCanvas.height = Math.floor(this.CANVAS_HEIGHT * this.pixelRatio);
        this.gridCanvas.style.width = this.CANVAS_WIDTH + 'px';
        this.gridCanvas.style.height = this.CANVAS_HEIGHT + 'px';
        this.drawingCanvas.style.width = this.CANVAS_WIDTH + 'px';
        this.drawingCanvas.style.height = this.CANVAS_HEIGHT + 'px';
        // Note: We keep backing store at high-DPI but coordinate scaling is handled in draw functions
        
        // Set text layer and wrapper dimensions
        if (this.textLayer) {
            this.textLayer.style.width = this.CANVAS_WIDTH + 'px';
            this.textLayer.style.height = this.CANVAS_HEIGHT + 'px';
        }
        
        if (this.canvasWrapper) {
            this.canvasWrapper.style.width = this.CANVAS_WIDTH + 'px';
            this.canvasWrapper.style.height = this.CANVAS_HEIGHT + 'px';
            this.canvasWrapper.style.marginLeft = (-this.CANVAS_WIDTH / 2) + 'px';
            this.canvasWrapper.style.marginTop = (-this.CANVAS_HEIGHT / 2) + 'px';
        }
        
        const gridOverlay = document.getElementById('grid-overlay');
        if (gridOverlay) {
            gridOverlay.style.width = this.CANVAS_WIDTH + 'px';
            gridOverlay.style.height = this.CANVAS_HEIGHT + 'px';
        }
        
        const mediaLayer = document.getElementById('media-layer');
        if (mediaLayer) {
            mediaLayer.style.width = this.CANVAS_WIDTH + 'px';
            mediaLayer.style.height = this.CANVAS_HEIGHT + 'px';
        }
        
        // Create default layer if none exist
        if (this.layerManager.layers.length === 0) {
            this.layerManager.createLayer('Background');
        }
        
        this.updateGridVisibility();
    }

    // Draw dotted grid
    drawGrid() {
        if (!this.gridCtx) return;
        
        this.gridCtx.clearRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
        this.gridCtx.fillStyle = '#c0c0c0';
        const spacing = 30;
        const dotSize = 2;
        
        for (let x = 0; x < this.CANVAS_WIDTH; x += spacing) {
            for (let y = 0; y < this.CANVAS_HEIGHT; y += spacing) {
                this.gridCtx.fillRect(x, y, dotSize, dotSize);
            }
        }
    }

    // Toggle grid visibility
    toggleGrid() {
        if (this.state) {
            this.state.gridVisible = !this.state.gridVisible;
            this.updateGridVisibility();
        }
    }

    // Update grid visibility
    updateGridVisibility() {
        const gridBtn = document.getElementById('grid-btn');
        const gridOverlay = document.getElementById('grid-overlay');
        
        if (this.state?.gridVisible) {
            gridOverlay?.classList.add('visible');
            gridBtn?.classList.add('active');
        } else {
            gridOverlay?.classList.remove('visible');
            gridBtn?.classList.remove('active');
        }
    }

    // Get canvas coordinates from event
    getCoords(e) {
        if (!this.drawingCanvas || !this.state) return { x: 0, y: 0 };
        
        const rect = this.drawingCanvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.state.zoom;
        const y = (e.clientY - rect.top) / this.state.zoom;
        return { x, y };
    }

    // Start drawing
    startDrawing(e) {
        if (!this.state) return;
        
        // Deselect any selected media embeds
        document.querySelectorAll('.media-embed.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        if (this.state.tool === 'pan') {
            this.isPanning = true;
            this.panStart = { 
                x: e.clientX - this.state.panOffset.x, 
                y: e.clientY - this.state.panOffset.y 
            };
            return;
        }
        
        // Skip if not in draw/erase mode
        if (this.state.tool !== 'draw' && this.state.tool !== 'erase') {
            return;
        }
        
        // Do not push undo at stroke start; defer to stroke end
        
        this.isDrawing = true;
        const coords = this.getCoords(e);
        this.lastX = coords.x;
        this.lastY = coords.y;

        // Initialize smoothing buffer
        this.points = [coords];
    }

    // Draw on canvas
    draw(e) {
        if (!this.state) return;

        if (this.isPanning) {
            this.state.panOffset.x = e.clientX - this.panStart.x;
            this.state.panOffset.y = e.clientY - this.panStart.y;
            this.updateTransform();
            return;
        }

        if (!this.isDrawing) return;

        const coords = this.getCoords(e);
        this.points.push(coords);
        
        // Get the active layer's context
        const ctx = this.layerManager.getActiveContext() || this.drawCtx;
        if (!ctx) return;
        
        // Draw a smoothed segment using quadratic curves
        const points = this.points;
        const len = points.length;
        if (len < 3) {
            // Not enough points to smooth yet; draw a simple segment
            ctx.beginPath();
            ctx.moveTo(this.lastX, this.lastY);
            ctx.lineTo(coords.x, coords.y);
        } else {
            const p1 = points[len - 3];
            const p2 = points[len - 2];
            const p3 = points[len - 1];
            const mid1 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const mid2 = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 };
            ctx.beginPath();
            ctx.moveTo(mid1.x, mid1.y);
            ctx.quadraticCurveTo(p2.x, p2.y, mid2.x, mid2.y);
        }

        if (this.state.tool === 'erase') {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.strokeStyle = 'rgba(0,0,0,1)';
            // Keep erase width strong; scale slightly with zoom for feel
            ctx.lineWidth = this.state.thickness * 6 * (this.state.zoom || 1);
        } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = this.state.color;
            ctx.lineWidth = this.state.thickness;
        }

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        
        // Reset composite operation after stroke to avoid lingering erase mode
        ctx.globalCompositeOperation = 'source-over';

        this.lastX = coords.x;
        this.lastY = coords.y;
    }

    // Stop drawing
    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            if (this.onUnsaved) {
                this.onUnsaved();
            }

            // Clear smoothing buffer
            this.points = [];

            // Throttled undo snapshot at stroke end
            const now = Date.now();
            if (this.onSaveToUndo && (now - this._lastUndoAt > this._UNDO_COOLDOWN_MS)) {
                this.onSaveToUndo();
                this._lastUndoAt = now;
            }
        }
        if (this.isPanning) {
            this.isPanning = false;
        }
    }

    // Update canvas transform
    updateTransform() {
        if (!this.canvasWrapper || !this.state) return;
        this.canvasWrapper.style.transform = `translate(${this.state.panOffset.x}px, ${this.state.panOffset.y}px) scale(${this.state.zoom})`;
    }

    // Clear the active layer
    clearActiveLayer() {
        const layer = this.layerManager.getActiveLayer();
        if (layer) {
            layer.ctx.clearRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
        }
    }

    // Clear all layers
    clearAllLayers() {
        this.layerManager.clearAll();
    }

    // Get combined canvas data URL (all visible layers merged)
    getDataURL() {
        const mergedCanvas = document.createElement('canvas');
        mergedCanvas.width = this.CANVAS_WIDTH;
        mergedCanvas.height = this.CANVAS_HEIGHT;
        const mergedCtx = mergedCanvas.getContext('2d');
        
        // Draw all visible layers
        this.layerManager.layers.forEach(layer => {
            if (layer.visible) {
                mergedCtx.globalAlpha = layer.opacity;
                mergedCtx.drawImage(layer.canvas, 0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
            }
        });
        
        return mergedCanvas.toDataURL();
    }

    // Load canvas data
    loadFromDataURL(dataURL) {
        if (!dataURL) return;
        
        const img = new Image();
        img.onload = () => {
            // If using layers, load into active layer
            const ctx = this.layerManager.getActiveContext() || this.drawCtx;
            if (ctx) {
                ctx.clearRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);
                ctx.drawImage(img, 0, 0);
            }
        };
        img.src = dataURL;
    }

    // Serialize layer data
    serializeLayers() {
        return this.layerManager.serialize();
    }

    // Deserialize and restore layers
    deserializeLayers(data) {
        this.layerManager.deserialize(data);
    }

    // Center canvas view
    centerView() {
        if (this.state) {
            this.state.zoom = 1;
            this.state.panOffset = { x: 0, y: 0 };
            this.updateTransform();
        }
    }

    // Zoom in
    zoomIn() {
        if (this.state) {
            this.state.zoom = Math.min(4, this.state.zoom + 0.1);
            this.updateTransform();
        }
    }

    // Zoom out
    zoomOut() {
        if (this.state) {
            this.state.zoom = Math.max(0.25, this.state.zoom - 0.1);
            this.updateTransform();
        }
    }

    // Set zoom level
    setZoom(level) {
        if (this.state) {
            this.state.zoom = Math.max(0.25, Math.min(4, level));
            this.updateTransform();
        }
    }
}

// Layer Panel UI Component
class LayerPanelUI {
    constructor(layerManager, containerId = 'layer-panel') {
        this.layerManager = layerManager;
        this.containerId = containerId;
        this.container = null;
        
        // Set up change listener
        this.layerManager.onLayerChange = () => this.render();
    }

    // Create the layer panel UI
    create() {
        // Check if panel already exists
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = this.containerId;
            this.container.className = 'layer-panel';
            
            // Insert into canvas container
            const canvasContainer = document.getElementById('canvas-container');
            if (canvasContainer) {
                canvasContainer.appendChild(this.container);
            }
        }
        
        this._injectStyles();
        this.render();
    }

    // Inject panel styles
    _injectStyles() {
        if (document.getElementById('layer-panel-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'layer-panel-styles';
        styles.textContent = `
            .layer-panel {
                position: absolute;
                bottom: 20px;
                left: 20px;
                width: 220px;
                background: #fff;
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.1);
                z-index: 1000;
                font-family: 'Inter', sans-serif;
                font-size: 12px;
                overflow: hidden;
                display: none;
            }
            
            .layer-panel.visible {
                display: block;
            }
            
            .layer-panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 12px;
                background: #f5f5f5;
                border-bottom: 1px solid #e0e0e0;
                font-weight: 600;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                color: #666;
            }
            
            .layer-panel-actions {
                display: flex;
                gap: 4px;
            }
            
            .layer-panel-btn {
                background: none;
                border: none;
                cursor: pointer;
                padding: 4px 6px;
                border-radius: 4px;
                font-size: 14px;
                color: #666;
                transition: all 0.15s;
            }
            
            .layer-panel-btn:hover {
                background: #e0e0e0;
                color: #333;
            }
            
            .layer-list {
                max-height: 200px;
                overflow-y: auto;
            }
            
            .layer-item {
                display: flex;
                align-items: center;
                padding: 8px 12px;
                border-bottom: 1px solid #f0f0f0;
                cursor: pointer;
                transition: background 0.15s;
                gap: 8px;
            }
            
            .layer-item:hover {
                background: #f8f8f8;
            }
            
            .layer-item.active {
                background: #e8f4ff;
                border-left: 3px solid #007AFF;
                padding-left: 9px;
            }
            
            .layer-visibility {
                width: 18px;
                height: 18px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                color: #666;
                flex-shrink: 0;
            }
            
            .layer-visibility:hover {
                color: #333;
            }
            
            .layer-visibility.hidden {
                color: #ccc;
            }
            
            .layer-name {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                color: #333;
            }
            
            .layer-opacity {
                width: 40px;
                font-size: 10px;
                color: #999;
                text-align: right;
            }
            
            .layer-item-actions {
                display: flex;
                gap: 2px;
                opacity: 0;
                transition: opacity 0.15s;
            }
            
            .layer-item:hover .layer-item-actions {
                opacity: 1;
            }
            
            .layer-item-btn {
                background: none;
                border: none;
                cursor: pointer;
                padding: 2px 4px;
                border-radius: 3px;
                font-size: 10px;
                color: #999;
            }
            
            .layer-item-btn:hover {
                background: #e0e0e0;
                color: #333;
            }
            
            body.dark-mode .layer-panel {
                background: #2a2a2a;
                border-color: #444;
            }
            
            body.dark-mode .layer-panel-header {
                background: #333;
                border-color: #444;
                color: #aaa;
            }
            
            body.dark-mode .layer-panel-btn {
                color: #aaa;
            }
            
            body.dark-mode .layer-panel-btn:hover {
                background: #444;
                color: #fff;
            }
            
            body.dark-mode .layer-item {
                border-color: #333;
            }
            
            body.dark-mode .layer-item:hover {
                background: #333;
            }
            
            body.dark-mode .layer-item.active {
                background: #1a3a5c;
            }
            
            body.dark-mode .layer-name {
                color: #e0e0e0;
            }
            
            body.dark-mode .layer-visibility {
                color: #aaa;
            }
            
            body.dark-mode .layer-visibility.hidden {
                color: #555;
            }
        `;
        document.head.appendChild(styles);
    }

    // Render the layer panel
    render() {
        if (!this.container) return;
        
        const layers = this.layerManager.getLayers();
        
        this.container.innerHTML = `
            <div class="layer-panel-header">
                <span>Layers</span>
                <div class="layer-panel-actions">
                    <button class="layer-panel-btn" onclick="canvasModule.addLayer()" title="Add Layer">+</button>
                    <button class="layer-panel-btn" onclick="canvasModule.mergeDown()" title="Merge Down">⬇</button>
                    <button class="layer-panel-btn" onclick="canvasModule.flattenLayers()" title="Flatten">≡</button>
                </div>
            </div>
            <div class="layer-list">
                ${layers.slice().reverse().map((layer, reversedIndex) => {
                    const actualIndex = layers.length - 1 - reversedIndex;
                    return `
                        <div class="layer-item ${layer.isActive ? 'active' : ''}" onclick="canvasModule.selectLayer(${actualIndex})">
                            <div class="layer-visibility ${!layer.visible ? 'hidden' : ''}" onclick="event.stopPropagation(); canvasModule.toggleLayerVisibility(${actualIndex})">
                                ${layer.visible ? '👁' : '○'}
                            </div>
                            <span class="layer-name">${layer.name}</span>
                            <span class="layer-opacity">${Math.round(layer.opacity * 100)}%</span>
                            <div class="layer-item-actions">
                                <button class="layer-item-btn" onclick="event.stopPropagation(); canvasModule.duplicateLayer(${actualIndex})" title="Duplicate">📋</button>
                                <button class="layer-item-btn" onclick="event.stopPropagation(); canvasModule.deleteLayer(${actualIndex})" title="Delete">🗑</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // Show/hide the panel
    toggle() {
        if (this.container) {
            this.container.classList.toggle('visible');
        }
    }

    show() {
        if (this.container) {
            this.container.classList.add('visible');
        }
    }

    hide() {
        if (this.container) {
            this.container.classList.remove('visible');
        }
    }
}

// Create and export module instance
const canvasModule = {
    manager: null,
    layerPanel: null,
    
    init(options = {}) {
        this.manager = new CanvasManager(options);
        this.manager.init(); // Initialize canvases and create default layer
        this.layerPanel = new LayerPanelUI(this.manager.layerManager);
        return this.manager;
    },
    
    // Layer shortcuts
    addLayer(name) {
        return this.manager?.layerManager.createLayer(name);
    },
    
    selectLayer(index) {
        return this.manager?.layerManager.setActiveLayer(index);
    },
    
    deleteLayer(index) {
        return this.manager?.layerManager.deleteLayer(index);
    },
    
    toggleLayerVisibility(index) {
        return this.manager?.layerManager.toggleVisibility(index);
    },
    
    duplicateLayer(index) {
        return this.manager?.layerManager.duplicateLayer(index);
    },
    
    mergeDown() {
        const activeIndex = this.manager?.layerManager.activeLayerIndex;
        if (activeIndex !== undefined) {
            return this.manager?.layerManager.mergeDown(activeIndex);
        }
    },
    
    flattenLayers() {
        return this.manager?.layerManager.flattenLayers();
    },
    
    showLayerPanel() {
        this.layerPanel?.create();
        this.layerPanel?.show();
    },
    
    hideLayerPanel() {
        this.layerPanel?.hide();
    },
    
    toggleLayerPanel() {
        if (!this.layerPanel?.container) {
            this.layerPanel?.create();
        }
        this.layerPanel?.toggle();
    }
};

// Make available globally
window.canvasModule = canvasModule;
window.CanvasManager = CanvasManager;
window.LayerManager = LayerManager;
window.LayerPanelUI = LayerPanelUI;
