const canvas = document.getElementById('canvas-sequence');
const context = canvas.getContext('2d');
const frameCount = 479; // Total frames discovered in directory
const currentFrame = index => `./${index.toString().padStart(5, '0')}.png`;

const images = [];
const frames = {
    frame: 0
};

// Preload images
let loadedCount = 0;
for (let i = 1; i <= frameCount; i++) {
    const img = new Image();
    img.onload = () => {
        loadedCount++;
        const progress = Math.round((loadedCount / frameCount) * 100);
        document.querySelector('.progress').style.width = `${progress}%`;
        document.getElementById('loading-percentage').innerText = `${progress}%`;
        
        if (loadedCount === frameCount) {
            initScroll();
            // Hide loader after a short delay
            setTimeout(() => {
                document.getElementById('loader').style.opacity = '0';
                setTimeout(() => {
                    document.getElementById('loader').style.display = 'none';
                }, 500);
            }, 500);
        }
    };
    img.src = currentFrame(i);
    images.push(img);
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    render();
}

function render() {
    const img = images[frames.frame];
    if (!img) return;

    // Canvas object-fit: cover equivalent
    const canvasRatio = canvas.width / canvas.height;
    const imgRatio = img.width / img.height;
    let drawWidth, drawHeight, offsetX, offsetY;

    if (canvasRatio > imgRatio) {
        drawWidth = canvas.width;
        drawHeight = canvas.width / imgRatio;
        offsetX = 0;
        offsetY = (canvas.height - drawHeight) / 2;
    } else {
        drawWidth = canvas.height * imgRatio;
        drawHeight = canvas.height;
        offsetX = (canvas.width - drawWidth) / 2;
        offsetY = 0;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

function initScroll() {
    gsap.registerPlugin(ScrollTrigger);

    // Initial render
    resize();
    window.addEventListener('resize', resize);

    // Image sequence scroll
    gsap.to(frames, {
        frame: frameCount - 1,
        snap: "frame",
        ease: "none",
        scrollTrigger: {
            trigger: "#hero",
            start: "top top",
            end: "bottom bottom",
            scrub: 0.5, // Smooth transitions
            onLeave: () => { frames.frame = frameCount - 1; render(); } // Force last frame on scroll exit
        },
        onUpdate: render
    });

    // Content animation
    const tl = gsap.timeline({
        scrollTrigger: {
            trigger: "#hero",
            start: "top top",
            end: "bottom bottom",
            scrub: 1
        }
    });

    tl.to("#panel-1", { opacity: 1, duration: 1 })
      .to("#panel-1", { opacity: 0, duration: 1 }, "+=0.5")
      .to("#panel-2", { opacity: 1, duration: 1 })
      .to("#panel-2", { opacity: 0, duration: 1 }, "+=0.5")
      .to("#panel-3", { opacity: 1, duration: 1 })
      .to("#panel-3", { opacity: 0, duration: 1 }, "+=0.5")
      .to("#panel-4", { opacity: 1, duration: 1 });
}

// SMOOTH CURSOR SCRIPT
const dot = document.getElementById('cursor-dot');
const outline = document.getElementById('cursor-outline');
window.addEventListener('mousemove', e => {
    const { clientX: x, clientY: y } = e;
    dot.style.opacity = outline.style.opacity = 1;
    dot.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    outline.animate({ transform: `translate(${x}px, ${y}px) translate(-50%, -50%)` }, { duration: 500, fill: "forwards" });
    
    if (e.target.closest('a, button, .nav-logo, canvas')) document.body.classList.add('cursor-active');
    else document.body.classList.remove('cursor-active');
});
window.addEventListener('mousedown', () => { outline.style.transform += ' scale(0.85)'; });
window.addEventListener('mouseup', () => { outline.style.transform = outline.style.transform.replace(' scale(0.85)', ''); });
