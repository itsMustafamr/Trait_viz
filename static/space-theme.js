/**
 * Space Theme Toggle Functionality for Trait Explorer
 */

document.addEventListener('DOMContentLoaded', () => {
    // Add theme toggle button to the page
    addThemeToggleButton();
    
    // Create stars container if it doesn't exist
    if (!document.getElementById('stars-container')) {
        const starsContainer = document.createElement('div');
        starsContainer.id = 'stars-container';
        starsContainer.style.position = 'fixed';
        starsContainer.style.top = '0';
        starsContainer.style.left = '0';
        starsContainer.style.width = '100%';
        starsContainer.style.height = '100%';
        starsContainer.style.pointerEvents = 'none';
        starsContainer.style.zIndex = '-1';
        document.body.appendChild(starsContainer);
    }
    
    // Create ThreeJS container if it doesn't exist
    if (!document.getElementById('threejs-container')) {
        const threejsContainer = document.createElement('div');
        threejsContainer.id = 'threejs-container';
        document.body.appendChild(threejsContainer);
    }
    
    // Initialize theme from localStorage
    initializeTheme();
    
    // Observer for DOM changes to handle dynamically added entities
    const observer = new MutationObserver((mutations) => {
        let entitiesAdded = false;
        mutations.forEach(mutation => {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1 && (
                        node.classList.contains('entity') || 
                        node.querySelector('.entity')
                    )) {
                        entitiesAdded = true;
                    }
                });
            }
        });
        
        if (entitiesAdded && document.body.classList.contains('space-theme')) {
            updateEntityStyles();
        }
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
});

/**
 * Add the theme toggle button to the page
 */
function addThemeToggleButton() {
    const button = document.createElement('button');
    button.id = 'theme-toggle';
    button.innerHTML = '🚀';
    button.title = 'Toggle Space Theme';
    button.addEventListener('click', toggleTheme);
    document.body.appendChild(button);
}

/**
 * Toggle between space theme and default theme
 */
function toggleTheme() {
    const isSpaceTheme = document.body.classList.toggle('space-theme');
    
    // Save preference to localStorage
    localStorage.setItem('spaceTheme', isSpaceTheme ? 'enabled' : 'disabled');
    
    if (isSpaceTheme) {
        // Enable space theme
        createStars();
        createSpaceParticles();
        initThreeJS();
        updateEntityStyles();
        updateDisplaCyTheme();
        console.log('Space theme enabled');
    } else {
        // Disable space theme
        cleanupThemeElements();
        resetEntityStyles();
        updateDisplaCyTheme();
        console.log('Space theme disabled');
    }
}

/**
 * Initialize theme based on saved preference
 */
function initializeTheme() {
    const savedTheme = localStorage.getItem('spaceTheme');
    
    if (savedTheme === 'enabled') {
        document.body.classList.add('space-theme');
        createStars();
        createSpaceParticles();
        initThreeJS();
        updateEntityStyles();
        console.log('Space theme initialized from saved preference');
    }
}

/**
 * Create stars for the background
 */
function createStars() {
    const starsContainer = document.getElementById('stars-container');
    if (!starsContainer) return;
    
    // Clear existing stars
    starsContainer.innerHTML = '';
    
    const numStars = 200;
    
    for (let i = 0; i < numStars; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.animationDelay = `${Math.random() * 5}s`;
        starsContainer.appendChild(star);
    }
}

/**
 * Create space particles for the background
 */
function createSpaceParticles() {
    // Remove existing particles
    document.querySelectorAll('.loading-particles').forEach(el => el.remove());
    
    const container = document.createElement('div');
    container.className = 'loading-particles';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '-1';
    document.body.appendChild(container);
    
    const particleCount = 20;
    
    for (let i = 0; i < particleCount; i++) {
        setTimeout(() => {
            const particle = document.createElement('div');
            particle.className = 'space-particle';
            
            // Random position and delay
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.animationDelay = `${Math.random() * 8}s`;
            particle.style.opacity = `${0.5 + Math.random() * 0.5}`;
            
            container.appendChild(particle);
        }, i * 200);
    }
}

/**
 * Initialize ThreeJS space scene
 */
function initThreeJS() {
    // Check if ThreeJS is available
    if (typeof THREE === 'undefined') {
        console.warn('THREE.js is not loaded. Skipping ThreeJS initialization.');
        return;
    }
    
    const container = document.getElementById('threejs-container');
    if (!container) return;
    
    // Check if already initialized
    if (container.querySelector('canvas')) return;
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    
    // Add space background
    scene.background = new THREE.Color(0x000000);
    
    // Add stars
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.1,
        transparent: true,
        opacity: 0.8
    });
    
    const starsVertices = [];
    for (let i = 0; i < 5000; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = (Math.random() - 0.5) * 2000;
        const z = (Math.random() - 0.5) * 2000;
        starsVertices.push(x, y, z);
    }
    
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
    
    // Create planets (simplified for performance)
    const planets = [];
    
    for (let i = 0; i < 2; i++) {
        const geometry = new THREE.SphereGeometry(2 + Math.random() * 1, 32, 32);
        const material = new THREE.MeshBasicMaterial({ 
            color: i === 0 ? 0x4facfe : 0x31a7ff,
            wireframe: true
        });
        const planet = new THREE.Mesh(geometry, material);
        
        // Position
        const angle = (i / 2) * Math.PI * 2;
        const distance = 30 + Math.random() * 10;
        planet.position.x = Math.cos(angle) * distance;
        planet.position.z = Math.sin(angle) * distance;
        planet.position.y = (Math.random() - 0.5) * 10;
        
        scene.add(planet);
        planets.push({
            mesh: planet,
            angle: angle,
            distance: distance,
            speed: 0.001 + Math.random() * 0.001
        });
    }
    
    // Camera position
    camera.position.y = 5;
    camera.position.z = 30;
    
    // Store animation frame ID for cleanup
    let animationFrame;
    
    // Handle window resize
    function handleResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    window.addEventListener('resize', handleResize);
    
    // Store resize handler for cleanup
    container.resizeHandler = handleResize;
    
    // Animation loop
    function animate() {
        animationFrame = requestAnimationFrame(animate);
        
        // Only animate if space theme is active
        if (!document.body.classList.contains('space-theme')) return;
        
        // Rotate planets
        planets.forEach(planet => {
            planet.angle += planet.speed;
            planet.mesh.position.x = Math.cos(planet.angle) * planet.distance;
            planet.mesh.position.z = Math.sin(planet.angle) * planet.distance;
            planet.mesh.rotation.y += 0.005;
            planet.mesh.rotation.x += 0.002;
        });
        
        // Rotate stars
        stars.rotation.x += 0.0001;
        stars.rotation.y += 0.0001;
        
        renderer.render(scene, camera);
    }
    
    animate();
    
    // Store animation frame for cleanup
    container.animationFrame = animationFrame;
}

/**
 * Clean up theme elements when disabling space theme
 */
function cleanupThemeElements() {
    // Clear ThreeJS elements
    const threejsContainer = document.getElementById('threejs-container');
    if (threejsContainer) {
        // Cancel animation frame
        if (threejsContainer.animationFrame) {
            cancelAnimationFrame(threejsContainer.animationFrame);
        }
        
        // Remove resize handler
        if (threejsContainer.resizeHandler) {
            window.removeEventListener('resize', threejsContainer.resizeHandler);
        }
        
        // Clear container
        threejsContainer.innerHTML = '';
    }
    
    // Remove particles
    document.querySelectorAll('.loading-particles').forEach(el => el.remove());
    
    // Clear stars
    const starsContainer = document.getElementById('stars-container');
    if (starsContainer) {
        starsContainer.innerHTML = '';
    }
}

/**
 * Update entity styles for space theme
 */
function updateEntityStyles() {
    document.querySelectorAll('.entity').forEach(entity => {
        // Get the entity label
        const entityType = entity.getAttribute('data-entity-label');
        if (!entityType) return;
        
        // Add enhanced visibility
        entity.style.display = 'inline-block';
        entity.style.boxShadow = '0 0 5px rgba(79, 172, 254, 0.3)';
        
        // Ensure text is visible - keep black text for readability on colored backgrounds
        entity.style.color = '#000000';
        
        // Handle entity background colors based on type
        switch(entityType) {
            case 'TRAIT':
                entity.style.backgroundColor = '#e0e0ff';
                entity.style.border = '1px solid #a0a0cc';
                break;
            case 'GENE_OR_GENE_PRODUCT':
                entity.style.backgroundColor = '#fff8e1';
                entity.style.border = '1px solid #e6c849';
                break;
            case 'SIMPLE_CHEMICAL':
                entity.style.backgroundColor = '#e0f7fa';
                entity.style.border = '1px solid #b2ebf2';
                break;
            case 'CANCER':
                entity.style.backgroundColor = '#ffebee';
                entity.style.border = '1px solid #ffcdd2';
                break;
            case 'ORGANISM':
                entity.style.backgroundColor = '#f0f8f0';
                entity.style.border = '1px solid #c0d0c0';
                break;
            case 'CELLULAR_COMPONENT':
                entity.style.backgroundColor = '#e8eaf6';
                entity.style.border = '1px solid #c5cae9';
                break;
            case 'IMMATERIAL_ANATOMICAL_ENTITY':
                entity.style.backgroundColor = '#f3e5f5';
                entity.style.border = '1px solid #e1bee7';
                break;
            case 'ORGANISM_SUBSTANCE':
                entity.style.backgroundColor = '#e0f2f1';
                entity.style.border = '1px solid #b2dfdb';
                break;
            case 'AMINO_ACID':
                entity.style.backgroundColor = '#fce4ec';
                entity.style.border = '1px solid #f8bbd0';
                break;
            case 'ORGAN':
                entity.style.backgroundColor = '#fbe9e7';
                entity.style.border = '1px solid #ffccbc';
                break;
            case 'CELL':
                entity.style.backgroundColor = '#f1f8e9';
                entity.style.border = '1px solid #c5e1a5';
                break;
            default:
                // Default light background and border for unknown entity types
                entity.style.backgroundColor = '#f8f9fa';
                entity.style.border = '1px solid #dee2e6';
        }
        
        // Style the label
        const label = entity.querySelector('.label');
        if (label) {
            label.style.color = '#ffffff';
            label.style.textShadow = '0 0 2px rgba(0,0,0,0.7)';
            
            // Apply specific styling based on entity type
            switch(entityType) {
                case 'TRAIT':
                    label.style.backgroundColor = '#4a6dd6';
                    break;
                case 'GENE_OR_GENE_PRODUCT':
                    label.style.backgroundColor = '#e6c849';
                    break;
                case 'CANCER':
                    label.style.backgroundColor = '#dc3545';
                    break;
                case 'SIMPLE_CHEMICAL':
                    label.style.backgroundColor = '#008000';
                    break;
                case 'ORGANISM':
                    label.style.backgroundColor = '#6ba36b';
                    break;
                case 'CELLULAR_COMPONENT':
                    label.style.backgroundColor = '#5c6bc0';
                    break;
                case 'IMMATERIAL_ANATOMICAL_ENTITY':
                    label.style.backgroundColor = '#9575cd';
                    break;
                case 'ORGANISM_SUBSTANCE':
                    label.style.backgroundColor = '#26a69a';
                    break;
                case 'AMINO_ACID':
                    label.style.backgroundColor = '#ec407a';
                    break;
                case 'ORGAN':
                    label.style.backgroundColor = '#ff7043';
                    break;
                case 'CELL':
                    label.style.backgroundColor = '#8bc34a';
                    break;
                default:
                    label.style.backgroundColor = '#6c757d';
            }
        }
    });
}

/**
 * Reset entity styles for light theme
 */
function resetEntityStyles() {
    document.querySelectorAll('.entity').forEach(entity => {
        // Clear enhanced space theme styling
        entity.style.boxShadow = '';
        entity.style.display = '';
        entity.style.color = '';
        
        // Reset background and border
        entity.style.backgroundColor = '';
        entity.style.border = '';
        
        // Reset label styles
        const label = entity.querySelector('.label');
        if (label) {
            label.style.color = '';
            label.style.textShadow = '';
            label.style.backgroundColor = '';
        }
    });
}

/**
 * Update displaCy theme
 */
function updateDisplaCyTheme() {
    const svg = document.querySelector('#displacy-container svg');
    if (svg) {
        // Remove DisplaCy's inline background and apply theme color
        svg.style.background = 'transparent';
        svg.style.color = document.body.classList.contains('space-theme') 
            ? '#4facfe'   // light blue for dark mode
            : '#000000';  // black for light mode
        
        // Update tag colors
        const tags = document.querySelectorAll('#displacy-container .displacy-tag');
        if (tags.length > 0) {
            const tagColor = document.body.classList.contains('space-theme') 
                ? '#4facfe'   // light blue for dark mode
                : '#333333';  // dark gray for light mode
            
            tags.forEach(tag => {
                tag.setAttribute('fill', tagColor);
                if (document.body.classList.contains('space-theme')) {
                    tag.style.textShadow = '0 0 5px #4facfe';
                } else {
                    tag.style.textShadow = '';
                }
            });
        }
    }
}

// Export the functions for use in other scripts
window.themeToggle = {
    toggle: toggleTheme,
    enable: function() {
        if (!document.body.classList.contains('space-theme')) {
            toggleTheme();
        }
    },
    disable: function() {
        if (document.body.classList.contains('space-theme')) {
            toggleTheme();
        }
    }
};

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    // Get the original toggleTheme function
    const originalToggleTheme = window.themeToggle.toggle;
    
    // Override the toggle function to add credits animation
    window.themeToggle.toggle = function() {
        // Call the original toggle first
        originalToggleTheme();
        
        // Check if theme is now active
        const isSpaceTheme = document.body.classList.contains('space-theme');
        
        // Get developer cards
        const developerCards = document.querySelectorAll('.developer-card');
        if (!developerCards.length) return;
        
        if (isSpaceTheme) {
            // When switching to space theme
            
            // Reset animation by removing and adding the elements
            developerCards.forEach((card, index) => {
                const parent = card.parentNode;
                const cardClone = card.cloneNode(true);
                
                // Remove the original
                card.remove();
                
                // Add the clone back (forces animation to restart)
                setTimeout(() => {
                    parent.appendChild(cardClone);
                }, 50 * index); // Stagger the re-adding
            });
            
            // Change avatar text to space-themed emoji
            setTimeout(() => {
                const avatars = document.querySelectorAll('.avatar-circle');
                if (avatars[0]) avatars[0].innerHTML = '🚀';
                if (avatars[1]) avatars[1].innerHTML = '✨';
            }, 300);
            
        } else {
            // When switching back to regular theme
            
            // Reset animations
            developerCards.forEach(card => {
                card.style.animation = 'none';
                card.offsetHeight; // Force reflow
                card.style.animation = '';
            });
            
            // Change avatar text back to initials
            const avatars = document.querySelectorAll('.avatar-circle');
            if (avatars[0]) avatars[0].innerHTML = 'MR';
            if (avatars[1]) avatars[1].innerHTML = 'SR';
        }
    };
});