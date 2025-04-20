/**
 * Dependency visualization module
 * Renders dependency parsing visualization similar to the example image
 */

// Global reference to the current visualization instance
window.dependencyVisualization = null;

/**
 * Renders a dependency parse graph
 * @param {Object} parseData - The dependency parse data from spaCy
 */
function renderDependencyGraph(parseData) {
    const container = document.getElementById('dependency-visualization');
    container.innerHTML = '';  // Clear previous visualization
    
    if (!parseData || !parseData.tokens || parseData.tokens.length === 0) {
        container.innerHTML = '<p>No parsing data available.</p>';
        return;
    }
    
    // Create a new visualization instance
    const visualization = new DependencyVisualization(container, parseData);
    visualization.render();
    
    // Store reference for zoom controls
    window.dependencyVisualization = visualization;
}

/**
 * DependencyVisualization class
 */
class DependencyVisualization {
    constructor(container, parseData) {
        this.container = container;
        this.parseData = parseData;
        this.svg = null;
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        
        // Visualization settings
        this.settings = {
            width: Math.max(800, 80 * parseData.tokens.length),  // Increased width per token
            height: 400,
            tokenSpacing: 80,  // Increased spacing between tokens
            yStart: 250,       // Adjusted vertical position 
            tokenHeight: 30,
            arcHeight: 120,
            fontSize: 14,
            posTagSize: 11
        };
    }
    
    render() {
        // Create SVG element
        this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this.svg.setAttribute('width', this.settings.width);
        this.svg.setAttribute('height', this.settings.height);
        this.svg.setAttribute('class', 'dependency-svg');
        
        // Add root group for transformations
        this.rootGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.rootGroup.setAttribute('transform', 'translate(0,0) scale(1)');
        this.svg.appendChild(this.rootGroup);
        
        // Calculate positions for tokens
        const tokenPositions = this.calculateTokenPositions();
        
        // Draw arcs first (so they're behind the tokens)
        this.drawArcs(tokenPositions);
        
        // Draw tokens
        this.drawTokens(tokenPositions);
        
        // Add the SVG to the container
        this.container.appendChild(this.svg);
    }
    
    calculateTokenPositions() {
        const { tokenSpacing, yStart } = this.settings;
        const positions = [];
        const tokens = this.parseData.tokens;
        
        // Calculate center point for the visualization
        const totalWidth = tokenSpacing * (tokens.length - 1);
        const startX = (this.settings.width - totalWidth) / 2;
        
        // Calculate position for each token
        tokens.forEach((token, index) => {
            positions.push({
                id: token.id,
                x: startX + index * tokenSpacing,
                y: yStart,
                token
            });
        });
        
        return positions;
    }
    
    drawTokens(positions) {
        const { fontSize, posTagSize, tokenHeight } = this.settings;
        
        positions.forEach(pos => {
            const { x, y, token } = pos;
            
            // Create token group
            const tokenGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            tokenGroup.setAttribute('class', 'token');
            tokenGroup.setAttribute('data-id', token.id);
            
            // Add token text
            const tokenText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            tokenText.setAttribute('x', x);
            tokenText.setAttribute('y', y);
            tokenText.setAttribute('text-anchor', 'middle');
            tokenText.setAttribute('font-size', fontSize);
            tokenText.setAttribute('font-weight', 'bold');
            tokenText.textContent = token.text;
            tokenGroup.appendChild(tokenText);
            
            // Add POS tag
            const posTag = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            posTag.setAttribute('x', x);
            posTag.setAttribute('y', y + 30); // Increased vertical spacing
            posTag.setAttribute('text-anchor', 'middle');
            posTag.setAttribute('font-size', posTagSize);
            posTag.setAttribute('class', 'pos-tag');
            posTag.textContent = token.pos;
            tokenGroup.appendChild(posTag);
            
            this.rootGroup.appendChild(tokenGroup);
        });
    }
    
    drawArcs(positions) {
        const arcs = this.parseData.arcs;
        const tokens = this.parseData.tokens;
        const positionMap = {};
        
        // Create lookup for positions by token id
        positions.forEach(pos => {
            positionMap[pos.id] = pos;
        });
        
        // Draw each arc
        arcs.forEach(arc => {
            const startPos = positionMap[arc.start];
            const endPos = positionMap[arc.end];
            
            if (!startPos || !endPos) {
                console.error('Token position not found for arc:', arc);
                return;
            }
            
            // Determine arc height based on distance between tokens
            const distance = Math.abs(arc.end - arc.start);
            const arcHeight = Math.min(this.settings.arcHeight, 30 + distance * 15); // Increased arc height
            
            // Draw the arc with appropriate height
            this.drawArc(
                startPos.x, 
                startPos.y - 5, // Adjusted starting point
                endPos.x, 
                endPos.y - 5,   // Adjusted ending point
                arcHeight, 
                arc.label,
                arc.dir
            );
        });
    }
    
    drawArc(x1, y1, x2, y2, height, label, direction) {
        const arcGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        arcGroup.setAttribute('class', 'dependency-arc');
        
        // Calculate control point for the curve
        const midX = (x1 + x2) / 2;
        const controlY = y1 - height;
        
        // Draw the arc path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M${x1},${y1} Q${midX},${controlY} ${x2},${y2}`);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', '#666');  // Darker line color
        path.setAttribute('stroke-width', '1.5');
        arcGroup.appendChild(path);
        
        // Add the arrow at appropriate end
        const arrowX = direction === 'left' ? x1 : x2;
        const arrowY = y1; // Same y level as tokens
        const arrowPath = this.createArrow(arrowX, arrowY, direction);
        arcGroup.appendChild(arrowPath);
        
        // Add label at the top of the arc
        const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        labelText.setAttribute('x', midX);
        labelText.setAttribute('y', controlY - 8); // Position label above the arc
        labelText.setAttribute('text-anchor', 'middle');
        labelText.setAttribute('font-size', '12');
        labelText.setAttribute('font-weight', 'bold'); // Make label bolder
        labelText.setAttribute('class', 'arc-label');
        labelText.textContent = label;
        arcGroup.appendChild(labelText);
        
        this.rootGroup.appendChild(arcGroup);
    }
    
    createArrow(x, y, direction) {
        const arrowSize = 6; // Slightly larger arrow
        let points;
        
        if (direction === 'left') {
            points = `${x},${y} ${x + arrowSize},${y - arrowSize} ${x + arrowSize},${y + arrowSize}`;
        } else {
            points = `${x},${y} ${x - arrowSize},${y - arrowSize} ${x - arrowSize},${y + arrowSize}`;
        }
        
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow.setAttribute('points', points);
        arrow.setAttribute('fill', '#666'); // Darker arrow color
        arrow.setAttribute('class', 'arrow');
        
        return arrow;
    }
    
    // Zoom functions
    zoomIn() {
        this.scale *= 1.2;
        this.updateTransform();
    }
    
    zoomOut() {
        this.scale /= 1.2;
        if (this.scale < 0.1) this.scale = 0.1;
        this.updateTransform();
    }
    
    resetZoom() {
        this.scale = 1;
        this.translateX = 0;
        this.translateY = 0;
        this.updateTransform();
    }
    
    updateTransform() {
        if (this.rootGroup) {
            this.rootGroup.setAttribute(
                'transform', 
                `translate(${this.translateX},${this.translateY}) scale(${this.scale})`
            );
        }
    }
}