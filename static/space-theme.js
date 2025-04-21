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
        console.log('Space theme enabled');
    } else {
        // Disable space theme
        cleanupThemeElements();
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