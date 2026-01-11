/**
 * Graph View Module - Obsidian-style Knowledge Graph
 * Shows notes as nodes connected by shared terms and patterns
 */

class GraphView {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.nodes = [];
        this.edges = [];
        this.selectedNode = null;
        this.hoveredNode = null;
        this.isDragging = false;
        this.isPanning = false;
        this.dragNode = null;
        this.panStart = { x: 0, y: 0 };
        this.offset = { x: 0, y: 0 };
        this.zoom = 1;
        this.animationFrame = null;
        
        // Physics simulation parameters
        this.simulation = {
            running: true,
            friction: 0.9,
            repulsion: 500,
            attraction: 0.01,
            centerGravity: 0.02,
            linkDistance: 120
        };
        
        // Color palette for nodes based on notebook
        this.colors = [
            '#8b5cf6', // Purple
            '#06b6d4', // Cyan
            '#10b981', // Emerald
            '#f59e0b', // Amber
            '#ef4444', // Red
            '#ec4899', // Pink
            '#6366f1', // Indigo
            '#14b8a6', // Teal
        ];
        
        this.notebookColors = {};
        this.searchQuery = '';
        this.showOrphans = true;
        
        this.tooltip = null;
    }

    init() {
        this.canvas = document.getElementById('graph-canvas');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        
        // Event listeners
        window.addEventListener('resize', () => this.resizeCanvas());
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        
        // Search input
        const searchInput = document.getElementById('graph-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.render();
            });
        }
        
        // Show orphans checkbox
        const orphansCheckbox = document.getElementById('graph-show-orphans');
        if (orphansCheckbox) {
            orphansCheckbox.addEventListener('change', (e) => {
                this.showOrphans = e.target.checked;
                this.render();
            });
        }
        
        // Clean up any old tooltips (not used anymore, labels drawn on canvas)
        document.querySelectorAll('.graph-node-tooltip').forEach(el => el.remove());
    }

    resizeCanvas() {
        if (!this.canvas) return;
        const container = this.canvas.parentElement;
        const rect = container.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.render();
    }

    // Build graph from notes data
    buildGraph(notebooks) {
        this.nodes = [];
        this.edges = [];
        this.notebookColors = {};
        
        let colorIndex = 0;
        const allNotes = [];
        
        // Collect all notes from all notebooks
        notebooks.forEach(notebook => {
            // Assign color to notebook
            if (!this.notebookColors[notebook.id]) {
                this.notebookColors[notebook.id] = this.colors[colorIndex % this.colors.length];
                colorIndex++;
            }
            
            const collectNotes = (notes, parentNotebook) => {
                notes.forEach(note => {
                    allNotes.push({
                        note: note,
                        notebook: parentNotebook,
                        color: this.notebookColors[parentNotebook.id]
                    });
                    if (note.children && note.children.length > 0) {
                        collectNotes(note.children, parentNotebook);
                    }
                });
            };
            
            if (notebook.notes) {
                collectNotes(notebook.notes, notebook);
            }
        });
        
        // Create nodes
        const canvasWidth = this.canvas.width / window.devicePixelRatio;
        const canvasHeight = this.canvas.height / window.devicePixelRatio;
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        
        allNotes.forEach((item, index) => {
            // Random initial position in a circle
            const angle = (index / allNotes.length) * Math.PI * 2;
            const radius = Math.min(canvasWidth, canvasHeight) * 0.3;
            
            this.nodes.push({
                id: item.note.id,
                label: item.note.name,
                notebookId: item.notebook.id,
                notebookName: item.notebook.name,
                note: item.note,
                x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 50,
                y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 50,
                vx: 0,
                vy: 0,
                radius: 8,
                color: item.color,
                terms: this.extractKeyTerms(item.note)
            });
        });
        
        // Create edges based on shared terms
        this.createEdges();
        
        // Start physics simulation
        this.startSimulation();
    }

    // Extract key terms from note content
    extractKeyTerms(note) {
        const terms = new Set();
        
        // Add note name words
        const nameWords = note.name.toLowerCase().split(/\s+/);
        nameWords.forEach(word => {
            if (word.length > 3) {
                terms.add(word.replace(/[^a-z0-9]/g, ''));
            }
        });
        
        // Extract terms from text boxes
        if (note.textBoxes) {
            note.textBoxes.forEach(box => {
                if (box.content) {
                    // Remove HTML tags
                    const text = box.content.replace(/<[^>]*>/g, ' ').toLowerCase();
                    
                    // Extract words
                    const words = text.split(/\s+/);
                    words.forEach(word => {
                        const clean = word.replace(/[^a-z0-9]/g, '');
                        if (clean.length > 3 && !this.isCommonWord(clean)) {
                            terms.add(clean);
                        }
                    });
                    
                    // Extract hashtags
                    const hashtags = text.match(/#\w+/g);
                    if (hashtags) {
                        hashtags.forEach(tag => terms.add(tag.substring(1)));
                    }
                    
                    // Extract [[wiki links]]
                    const wikiLinks = box.content.match(/\[\[([^\]]+)\]\]/g);
                    if (wikiLinks) {
                        wikiLinks.forEach(link => {
                            const cleanLink = link.replace(/\[\[|\]\]/g, '').toLowerCase();
                            terms.add(cleanLink);
                        });
                    }
                }
            });
        }
        
        return Array.from(terms);
    }

    // Check if word is too common to be meaningful
    isCommonWord(word) {
        const commonWords = [
            'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'been',
            'were', 'they', 'their', 'what', 'when', 'where', 'which', 'there',
            'will', 'would', 'could', 'should', 'about', 'into', 'over', 'after',
            'before', 'under', 'between', 'through', 'during', 'without', 'also',
            'more', 'some', 'such', 'only', 'than', 'then', 'just', 'being', 'other'
        ];
        return commonWords.includes(word);
    }

    // Create edges between nodes with shared terms
    createEdges() {
        this.edges = [];
        
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                const nodeA = this.nodes[i];
                const nodeB = this.nodes[j];
                
                // Find shared terms
                const sharedTerms = nodeA.terms.filter(term => nodeB.terms.includes(term));
                
                if (sharedTerms.length > 0) {
                    // Stronger connections for more shared terms
                    const strength = Math.min(sharedTerms.length / 3, 1);
                    
                    this.edges.push({
                        source: nodeA,
                        target: nodeB,
                        sharedTerms: sharedTerms,
                        strength: strength
                    });
                }
            }
        }
    }

    // Physics simulation
    startSimulation() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        this.simulation.running = true;
        this.simulate();
    }

    stopSimulation() {
        this.simulation.running = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }

    simulate() {
        if (!this.simulation.running) return;
        
        const canvasWidth = this.canvas.width / window.devicePixelRatio;
        const canvasHeight = this.canvas.height / window.devicePixelRatio;
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        
        // Apply forces
        this.nodes.forEach(node => {
            if (node === this.dragNode) return;
            
            // Reset acceleration
            let ax = 0;
            let ay = 0;
            
            // Center gravity
            ax += (centerX - node.x) * this.simulation.centerGravity;
            ay += (centerY - node.y) * this.simulation.centerGravity;
            
            // Repulsion from other nodes
            this.nodes.forEach(other => {
                if (node === other) return;
                
                const dx = node.x - other.x;
                const dy = node.y - other.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                
                if (dist < 200) {
                    const force = this.simulation.repulsion / (dist * dist);
                    ax += (dx / dist) * force;
                    ay += (dy / dist) * force;
                }
            });
            
            // Attraction along edges
            this.edges.forEach(edge => {
                let other = null;
                if (edge.source === node) other = edge.target;
                else if (edge.target === node) other = edge.source;
                
                if (other) {
                    const dx = other.x - node.x;
                    const dy = other.y - node.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > this.simulation.linkDistance) {
                        const force = (dist - this.simulation.linkDistance) * this.simulation.attraction * edge.strength;
                        ax += (dx / dist) * force;
                        ay += (dy / dist) * force;
                    }
                }
            });
            
            // Update velocity
            node.vx = (node.vx + ax) * this.simulation.friction;
            node.vy = (node.vy + ay) * this.simulation.friction;
            
            // Update position
            node.x += node.vx;
            node.y += node.vy;
        });
        
        this.render();
        
        // Check if simulation should continue
        const totalVelocity = this.nodes.reduce((sum, node) => {
            return sum + Math.abs(node.vx) + Math.abs(node.vy);
        }, 0);
        
        if (totalVelocity > 0.1) {
            this.animationFrame = requestAnimationFrame(() => this.simulate());
        }
    }

    // Render the graph
    render() {
        if (!this.ctx) return;
        
        const canvasWidth = this.canvas.width / window.devicePixelRatio;
        const canvasHeight = this.canvas.height / window.devicePixelRatio;
        
        // Clear canvas
        this.ctx.fillStyle = '#0a0a0f';
        this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        // Apply transformations
        this.ctx.save();
        this.ctx.translate(this.offset.x, this.offset.y);
        this.ctx.scale(this.zoom, this.zoom);
        
        // Get visible nodes
        const visibleNodes = this.nodes.filter(node => {
            // Filter by search
            if (this.searchQuery) {
                const matchesSearch = node.label.toLowerCase().includes(this.searchQuery) ||
                    node.terms.some(term => term.includes(this.searchQuery));
                if (!matchesSearch) return false;
            }
            
            // Filter orphans
            if (!this.showOrphans) {
                const hasConnections = this.edges.some(edge => 
                    edge.source === node || edge.target === node
                );
                if (!hasConnections) return false;
            }
            
            return true;
        });
        
        const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
        
        // Draw edges
        this.edges.forEach(edge => {
            if (!visibleNodeIds.has(edge.source.id) || !visibleNodeIds.has(edge.target.id)) return;
            
            const isHighlighted = this.selectedNode && 
                (edge.source === this.selectedNode || edge.target === this.selectedNode);
            
            this.ctx.beginPath();
            this.ctx.moveTo(edge.source.x, edge.source.y);
            this.ctx.lineTo(edge.target.x, edge.target.y);
            
            if (isHighlighted) {
                this.ctx.strokeStyle = `rgba(139, 92, 246, ${0.5 + edge.strength * 0.5})`;
                this.ctx.lineWidth = 1.5 + edge.strength * 1.5;
            } else {
                this.ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 + edge.strength * 0.15})`;
                this.ctx.lineWidth = 0.5 + edge.strength;
            }
            
            this.ctx.stroke();
        });
        
        // Draw nodes
        visibleNodes.forEach(node => {
            const isSelected = node === this.selectedNode;
            const isHovered = node === this.hoveredNode;
            const isConnected = this.selectedNode && this.edges.some(edge => 
                (edge.source === this.selectedNode && edge.target === node) ||
                (edge.target === this.selectedNode && edge.source === node)
            );
            
            // Determine node appearance
            let radius = node.radius;
            let alpha = 1;
            
            if (this.selectedNode && !isSelected && !isConnected) {
                alpha = 0.3;
            }
            
            if (isHovered || isSelected) {
                radius = node.radius * 1.3;
            }
            
            // Count connections
            const connectionCount = this.edges.filter(edge => 
                edge.source === node || edge.target === node
            ).length;
            radius += connectionCount * 0.5;
            
            // Draw glow for selected/hovered
            if (isSelected || isHovered) {
                const gradient = this.ctx.createRadialGradient(
                    node.x, node.y, 0,
                    node.x, node.y, radius * 3
                );
                gradient.addColorStop(0, node.color + '60');
                gradient.addColorStop(1, 'transparent');
                this.ctx.fillStyle = gradient;
                this.ctx.beginPath();
                this.ctx.arc(node.x, node.y, radius * 3, 0, Math.PI * 2);
                this.ctx.fill();
            }
            
            // Draw node
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = this.hexToRgba(node.color, alpha);
            this.ctx.fill();
            
            // Draw border
            if (isSelected) {
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
            
            // Draw label for selected/hovered or large nodes
            if ((isSelected || isHovered || connectionCount > 2) && this.zoom > 0.5) {
                this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                this.ctx.font = '11px Inter, system-ui, sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(node.label, node.x, node.y + radius + 14);
            }
        });
        
        this.ctx.restore();
    }

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // Mouse event handlers
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - this.offset.x) / this.zoom,
            y: (e.clientY - rect.top - this.offset.y) / this.zoom
        };
    }

    getNodeAtPosition(x, y) {
        for (let i = this.nodes.length - 1; i >= 0; i--) {
            const node = this.nodes[i];
            const dx = x - node.x;
            const dy = y - node.y;
            if (dx * dx + dy * dy < node.radius * node.radius * 2) {
                return node;
            }
        }
        return null;
    }

    handleMouseDown(e) {
        const pos = this.getMousePos(e);
        const node = this.getNodeAtPosition(pos.x, pos.y);
        
        if (node) {
            this.isDragging = true;
            this.dragNode = node;
            this.selectedNode = node;
            this.updateInfoPanel(node);
        } else {
            this.isPanning = true;
            this.panStart = { x: e.clientX - this.offset.x, y: e.clientY - this.offset.y };
            this.selectedNode = null;
            this.hideInfoPanel();
        }
        
        this.render();
    }

    handleMouseMove(e) {
        const pos = this.getMousePos(e);
        
        if (this.isDragging && this.dragNode) {
            this.dragNode.x = pos.x;
            this.dragNode.y = pos.y;
            this.dragNode.vx = 0;
            this.dragNode.vy = 0;
            this.render();
        } else if (this.isPanning) {
            this.offset.x = e.clientX - this.panStart.x;
            this.offset.y = e.clientY - this.panStart.y;
            this.render();
        } else {
            // Check for hover
            const node = this.getNodeAtPosition(pos.x, pos.y);
            if (node !== this.hoveredNode) {
                this.hoveredNode = node;
                this.render();
                
                if (node) {
                    // Label is drawn on canvas, no need for HTML tooltip
                    this.canvas.style.cursor = 'pointer';
                } else {
                    this.canvas.style.cursor = 'grab';
                }
            }
        }
    }

    handleMouseUp(e) {
        if (this.isDragging) {
            // Re-run simulation to settle nodes
            this.startSimulation();
        }
        
        this.isDragging = false;
        this.isPanning = false;
        this.dragNode = null;
    }

    handleMouseLeave(e) {
        this.isDragging = false;
        this.isPanning = false;
        this.dragNode = null;
        this.hoveredNode = null;
        this.render();
    }

    handleWheel(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Zoom towards mouse position
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.2, Math.min(3, this.zoom * zoomFactor));
        
        // Adjust offset to zoom towards mouse
        const zoomChange = newZoom / this.zoom;
        this.offset.x = mouseX - (mouseX - this.offset.x) * zoomChange;
        this.offset.y = mouseY - (mouseY - this.offset.y) * zoomChange;
        
        this.zoom = newZoom;
        this.render();
    }

    handleDoubleClick(e) {
        const pos = this.getMousePos(e);
        const node = this.getNodeAtPosition(pos.x, pos.y);
        
        if (node && node.note) {
            // Navigate to the note
            if (typeof selectNoteById === 'function') {
                selectNoteById(node.notebookId, node.note.id);
            }
        }
    }

    // Info panel
    updateInfoPanel(node) {
        const panel = document.getElementById('graph-info-panel');
        const titleEl = panel.querySelector('.graph-info-title');
        const contentEl = panel.querySelector('.graph-info-content');
        
        titleEl.textContent = node.label;
        
        // Find connections
        const connections = this.edges
            .filter(edge => edge.source === node || edge.target === node)
            .map(edge => ({
                node: edge.source === node ? edge.target : edge.source,
                terms: edge.sharedTerms
            }));
        
        let html = `
            <div class="info-section">
                <div class="info-label">Notebook</div>
                <div>${node.notebookName}</div>
            </div>
        `;
        
        if (node.terms.length > 0) {
            html += `
                <div class="info-section">
                    <div class="info-label">Key Terms</div>
                    <div class="info-tags">
                        ${node.terms.slice(0, 10).map(term => `<span class="tag">${term}</span>`).join('')}
                    </div>
                </div>
            `;
        }
        
        if (connections.length > 0) {
            html += `
                <div class="info-section">
                    <div class="info-label">Connections (${connections.length})</div>
                    ${connections.slice(0, 8).map(conn => `
                        <div class="connection-item" onclick="graphView.focusNode('${conn.node.id}')">
                            <strong>${conn.node.label}</strong>
                            <div style="font-size:0.7rem;color:rgba(255,255,255,0.5);">
                                via: ${conn.terms.slice(0, 3).join(', ')}${conn.terms.length > 3 ? '...' : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            html += `
                <div class="info-section">
                    <div class="info-label">Connections</div>
                    <div style="color:rgba(255,255,255,0.4);">No connections found</div>
                </div>
            `;
        }
        
        html += `
            <button class="graph-btn" style="width:100%;margin-top:12px;justify-content:center;" 
                    onclick="selectNoteById('${node.notebookId}', '${node.note.id}')">
                Open Note
            </button>
        `;
        
        contentEl.innerHTML = html;
        panel.classList.add('visible');
    }

    hideInfoPanel() {
        const panel = document.getElementById('graph-info-panel');
        if (panel) {
            panel.classList.remove('visible');
        }
    }

    focusNode(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node) {
            this.selectedNode = node;
            
            // Center view on node
            const canvasWidth = this.canvas.width / window.devicePixelRatio;
            const canvasHeight = this.canvas.height / window.devicePixelRatio;
            
            this.offset.x = canvasWidth / 2 - node.x * this.zoom;
            this.offset.y = canvasHeight / 2 - node.y * this.zoom;
            
            this.updateInfoPanel(node);
            this.render();
        }
    }

    resetView() {
        this.zoom = 1;
        this.offset = { x: 0, y: 0 };
        this.selectedNode = null;
        this.hideInfoPanel();
        this.searchQuery = '';
        
        const searchInput = document.getElementById('graph-search');
        if (searchInput) searchInput.value = '';
        
        // Rebuild and restart simulation
        if (typeof state !== 'undefined' && state.notebooks) {
            this.buildGraph(state.notebooks);
        }
    }
}

// Global instance
const graphView = new GraphView();

// Show graph view function
function showGraphView() {
    // Hide other views
    document.getElementById('home-page').style.display = 'none';
    document.getElementById('canvas-container').style.display = 'none';
    document.getElementById('toolbar').style.display = 'none';
    document.getElementById('graph-view').style.display = 'flex';
    
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.getElementById('nav-graph').classList.add('active');
    
    // Initialize and build graph
    graphView.init();
    
    // Get notebooks from state
    if (typeof state !== 'undefined' && state.notebooks) {
        graphView.buildGraph(state.notebooks);
    }
}

// Reset graph view
function resetGraphView() {
    graphView.resetView();
}

// Make functions globally available
window.showGraphView = showGraphView;
window.resetGraphView = resetGraphView;
window.graphView = graphView;
