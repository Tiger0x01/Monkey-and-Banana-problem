// ── GAME CONSTANTS & VARIABLES ──
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const WINDOW_WIDTH = 800;
const WINDOW_HEIGHT = 600;
const GRAVITY = 1.2;
const JUMP_STRENGTH = -18;
const SPEED = 6;
const FLOOR_Y = 410;
const PUSH_DISTANCE = 72;

// --- FPS Limiter & Caching Variables ---
let lastTime = 0;
const FPS = 60;
const frameInterval = 1000 / FPS;
let cachedBackground = null;

let keys = { ArrowLeft: false, ArrowRight: false, Shift: false, Space: false };
let monkey_dy = 0;
let is_jumping = false;
let bananas_collected = 0;
let frame_index = 0;
let anim_counter = 0;
let facing_direction = 1; // 1: Right, -1: Left

let gameRunning = false;
let animationId;

// --- AI VARIABLES ---
let autoIsActive = false;
let autoPlan = [];
let currentActionText = "AI: Waiting...";

// Game Objects
let box = { x: 500, y: 415, width: 70, height: 70 };
let monkey = { x: 100, y: FLOOR_Y, width: 80, height: 80 };
let bananas = [];

// Assets Dictionary
const assets = { idle: [], move_1: [], move_2: [] };
let imagesLoaded = 0;

// Helper to load images
function loadImage(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = () => {
            console.warn("Could not load image: " + src);
            resolve(null);
        };
    });
}

// ── INIT ASSETS ──
async function loadAllAssets() {
    assets.idle[0] = await loadImage("Assets/monkey1.png");
    assets.idle[1] = await loadImage("Assets/monkey_b1.png");
    assets.idle[2] = await loadImage("Assets/monkey_b2.png");
    assets.idle[3] = await loadImage("Assets/monkey_b3.png");
    
    assets.push_1 = await loadImage("Assets/push_1.png");
    assets.push_2 = await loadImage("Assets/push_2.png");
    assets.jump = await loadImage("Assets/jump.png");
    assets.box = await loadImage("Assets/box.png");
    assets.banana = await loadImage("Assets/banana.png");
    
    assets.move_1_sheet = await loadImage("Assets/monkey_Movement_1.png");
    assets.move_2_sheet = await loadImage("Assets/monkey_Movement_2.png");
    
    initBackgroundCache();
    resetGameState();
    ctx.drawImage(cachedBackground, 0, 0);
    drawCenteredImage(assets.box, box.x, box.y, box.width, box.height);
    drawCenteredImage(assets.idle[0], monkey.x, monkey.y, monkey.width, monkey.height);
    bananas.forEach(b => drawCenteredImage(assets.banana, b.x, b.y, b.width, b.height));
}

// ── KEYBOARD EVENTS ──
window.addEventListener("keydown", (e) => {
    if(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(e.code) > -1) {
        e.preventDefault();
    }
    if(!autoIsActive) { 
        if(e.code === "ArrowLeft") keys.ArrowLeft = true;
        if(e.code === "ArrowRight") keys.ArrowRight = true;
        if(e.code === "ShiftLeft" || e.code === "ShiftRight") keys.Shift = true;
        if(e.code === "Space") keys.Space = true;
    }
});

window.addEventListener("keyup", (e) => {
    if(!autoIsActive) {
        if(e.code === "ArrowLeft") keys.ArrowLeft = false;
        if(e.code === "ArrowRight") keys.ArrowRight = false;
        if(e.code === "ShiftLeft" || e.code === "ShiftRight") keys.Shift = false;
        if(e.code === "Space") keys.Space = false;
    }
});

// ── BACKGROUND CACHING ──
function initBackgroundCache() {
    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = WINDOW_WIDTH;
    bgCanvas.height = WINDOW_HEIGHT;
    const bgCtx = bgCanvas.getContext("2d");

    for (let i = 0; i < 120; i++) {
        let r = Math.floor(20 + (135 - 20) * (i / 120));
        let g = Math.floor(100 + (206 - 100) * (i / 120));
        let b = Math.floor(200 + (250 - 200) * (i / 120));
        bgCtx.fillStyle = `rgb(${r},${g},${b})`;
        bgCtx.fillRect(0, i * 5, WINDOW_WIDTH, 5);
    }

    const glow_colors = ["#FFF7A1", "#FFEA00", "#FFB300", "#FF8C00", "#FF5E00"];
    const sizes = [80, 60, 45, 30, 20];
    glow_colors.forEach((color, idx) => {
        let size = sizes[idx];
        bgCtx.beginPath();
        bgCtx.arc(680, 100, size, 0, Math.PI * 2);
        bgCtx.fillStyle = color;
        bgCtx.fill();
    });

    const birds = [[150, 120], [190, 100], [130, 150], [550, 180], [590, 160]];
    bgCtx.strokeStyle = "#1A3A5A";
    bgCtx.lineWidth = 2;
    birds.forEach(([bx, by]) => {
        bgCtx.beginPath();
        bgCtx.moveTo(bx, by);
        bgCtx.quadraticCurveTo(bx + 10, by - 8, bx + 20, by);
        bgCtx.stroke();
    });

    function drawPoly(points, color) {
        bgCtx.beginPath();
        bgCtx.moveTo(points[0][0], points[0][1]);
        for(let i=1; i<points.length; i++) bgCtx.lineTo(points[i][0], points[i][1]);
        bgCtx.fillStyle = color;
        bgCtx.fill();
    }

    drawPoly([[50, 450], [150, 280], [250, 450]], "#D4B872");
    drawPoly([[150, 280], [250, 450], [200, 450]], "#B89B56");
    drawPoly([[120, 450], [280, 150], [440, 450]], "#F2D388");
    drawPoly([[280, 150], [440, 450], [340, 450]], "#C4A864");
    drawPoly([[300, 450], [450, 200], [600, 450]], "#E6C981");
    drawPoly([[450, 200], [600, 450], [500, 450]], "#B3934B");

    drawPoly([[-100, 450], [100, 280], [400, 450]], "#247854");
    drawPoly([[300, 450], [600, 250], [900, 450]], "#1D6646");
    drawPoly([[-50, 450], [200, 320], [500, 450]], "#2E8B57");
    drawPoly([[400, 450], [700, 300], [900, 450]], "#3CB371");

    const cloud_positions = [[180, 80], [450, 60], [750, 110]];
    cloud_positions.forEach(([cx, cy]) => {
        bgCtx.fillStyle = "#A5C6E6";
        bgCtx.beginPath(); bgCtx.arc(cx - 8, cy + 8, 20, 0, Math.PI*2); bgCtx.fill();
        bgCtx.beginPath(); bgCtx.arc(cx + 17, cy - 3, 25, 0, Math.PI*2); bgCtx.fill();
        bgCtx.beginPath(); bgCtx.arc(cx + 42, cy + 2, 20, 0, Math.PI*2); bgCtx.fill();
        bgCtx.fillStyle = "#FFFFFF";
        bgCtx.beginPath(); bgCtx.arc(cx - 10, cy + 5, 20, 0, Math.PI*2); bgCtx.fill();
        bgCtx.beginPath(); bgCtx.arc(cx + 15, cy - 10, 25, 0, Math.PI*2); bgCtx.fill();
        bgCtx.beginPath(); bgCtx.arc(cx + 40, cy, 20, 0, Math.PI*2); bgCtx.fill();
        bgCtx.beginPath(); bgCtx.arc(cx + 25, cy + 10, 25, 0, Math.PI*2); bgCtx.fill();
    });

    bgCtx.fillStyle = "#5C3A21"; bgCtx.fillRect(0, 450, WINDOW_WIDTH, WINDOW_HEIGHT - 450);
    bgCtx.fillStyle = "#5DBA40"; bgCtx.fillRect(0, 450, WINDOW_WIDTH, 30);
    bgCtx.fillStyle = "#4CA132"; bgCtx.fillRect(0, 450, WINDOW_WIDTH, 15);

    for (let i = 0; i < WINDOW_WIDTH; i += 15) {
        drawPoly([[i, 450], [i+7, 430], [i+15, 450]], "#4CA132");
        if (i % 40 !== 0) { 
            const flower_colors = ["#FF4081", "#FFEB3B", "#00BCD4", "#FFFFFF"];
            bgCtx.fillStyle = flower_colors[(i/15) % flower_colors.length];
            bgCtx.beginPath(); bgCtx.arc(i+6, 438, 3.5, 0, Math.PI*2); bgCtx.fill();
        }
    }

    const stones = [
        [30, 500], [120, 520], [250, 495], [380, 540], [450, 510], 
        [580, 560], [690, 505], [760, 530], [80, 570], [210, 550], 
        [310, 580], [420, 490], [520, 530], [640, 580], [730, 550]
    ];
    bgCtx.fillStyle = "#4A2F1D";
    stones.forEach(([sx, sy]) => {
        bgCtx.beginPath();
        bgCtx.ellipse(sx + 9, sy + 4.5, 9, 4.5, 0, 0, Math.PI*2);
        bgCtx.fill();
    });

    cachedBackground = bgCanvas;
}

function drawCenteredImage(img, x, y, w, h) {
    if (img) ctx.drawImage(img, x - w/2, y - h/2, w, h);
}

// ── GAME LOOP ──
function gameLoop(timestamp) {
    if (!gameRunning) return;

    if (!lastTime) lastTime = timestamp;
    let deltaTime = timestamp - lastTime;

    if (deltaTime < frameInterval) {
        animationId = requestAnimationFrame(gameLoop);
        return;
    }
    lastTime = timestamp - (deltaTime % frameInterval);



// --- AI CONTROLLER ---
    if (autoIsActive && autoPlan.length > 0) {
        let step = autoPlan[0];
        keys.ArrowRight = false; keys.ArrowLeft = false; keys.Shift = false; keys.Space = false;

        if (step.action === 'walk_to') {
            currentActionText = "Action: Move to (" + step.targetX + ")";
            if (Math.abs(monkey.x - step.targetX) > SPEED) {
                if (monkey.x < step.targetX) keys.ArrowRight = true;
                else keys.ArrowLeft = true;
            } else {
                autoPlan.shift();
            }
        } 
        else if (step.action === 'jump_up') {
            currentActionText = "Action: Jump for Banana";
            if (!step.started) {
                keys.Space = true;
                step.started = true;
            } else if (!is_jumping) {
                autoPlan.shift();
            }
        } 
        else if (step.action === 'jump_right') {
            currentActionText = "Action: Climb onto Box";
            if (monkey.x < step.targetX) {
                keys.ArrowRight = true; 
            }
            if (!step.started) {
                keys.Space = true;
                step.started = true;
            } else if (!is_jumping) {
                autoPlan.shift();
            }
        }
        else if (step.action === 'walk_off_left') {
            currentActionText = "Action: Get off Box";
            keys.ArrowLeft = true; 
            if (monkey.y === FLOOR_Y) {
                autoPlan.shift();
            }
        }
        else if (step.action === 'push_to') {
            currentActionText = "Action: Push Box to (" + step.targetBoxX + ")";
            if (Math.abs(box.x - step.targetBoxX) > SPEED) {
                keys.Shift = true; 
                if (box.x < step.targetBoxX) keys.ArrowRight = true;
                else keys.ArrowLeft = true;
            } else {
                autoPlan.shift();
            }
        }
    } else if (autoIsActive && autoPlan.length === 0) {
        currentActionText = "Goal Achieved!";
        keys.ArrowRight = false; keys.ArrowLeft = false; keys.Shift = false; keys.Space = false;
    }

    // --- PHYSICS ---
    monkey_dy += GRAVITY;
    monkey.y += monkey_dy;

    if (monkey.y >= FLOOR_Y) {
        monkey.y = FLOOR_Y;
        monkey_dy = 0;
        is_jumping = false;
    }

    if (monkey_dy > 0 && (monkey.x > box.x - 50 && monkey.x < box.x + 50)) {
        if (monkey.y >= box.y - 70 && (monkey.y - monkey_dy) <= box.y - 70) {
            monkey.y = box.y - 70;
            monkey_dy = 0;
            is_jumping = false;
        }
    }

    // --- MOVEMENT LOGIC ---
    let moving = false;
    let is_pushing = false;
    let intended_dx = 0;

    if (keys.ArrowLeft) {
        intended_dx = -SPEED;
        facing_direction = -1;
        moving = true;
    }
    if (keys.ArrowRight) {
        intended_dx = SPEED;
        facing_direction = 1;
        moving = true;
    }

    let shift_pressed = keys.Shift;

    if (moving && !is_jumping) {
        let distance_to_box = Math.abs(monkey.x - box.x);
        if (monkey.y === FLOOR_Y && distance_to_box <= PUSH_DISTANCE) {
            if ((facing_direction === 1 && monkey.x < box.x) || (facing_direction === -1 && monkey.x > box.x)) {
                if (shift_pressed) {
                    is_pushing = true;
                    let new_bx = box.x + (intended_dx * 0.8);
                    if (new_bx > 50 && new_bx < 750) {
                        box.x = new_bx;
                        monkey.x += (intended_dx * 0.8);
                    }
                } else {
                    monkey.x = box.x - (facing_direction * PUSH_DISTANCE);
                }
            } else {
                monkey.x += intended_dx;
            }
        } else {
            monkey.x += intended_dx;
        }
    } else {
        monkey.x += intended_dx;
    }

    if (keys.Space && !is_jumping) {
        monkey_dy = JUMP_STRENGTH;
        is_jumping = true;
    }

    monkey.x = Math.max(40, Math.min(monkey.x, WINDOW_WIDTH - 40));

    // --- ANIMATION ---
    let current_img = assets.idle[Math.min(bananas_collected, 3)];
    let draw_as_sprite = false;

    if (is_jumping) {
        current_img = assets.jump;
    } else if (is_pushing) {
        current_img = facing_direction === 1 ? assets.push_1 : assets.push_2;
    } else if (moving) {
        anim_counter++;
        if (anim_counter >= 3) {
            frame_index = (frame_index + 1) % 8; 
            anim_counter = 0;
        }
        draw_as_sprite = true;
    } else {
        frame_index = 0;
    }

    // --- BANANA COLLECTION ---
    for (let i = bananas.length - 1; i >= 0; i--) {
        let b = bananas[i];
        if (Math.abs(monkey.x - b.x) < 45 && Math.abs(monkey.y - b.y) < 45) {
            bananas.splice(i, 1);
            bananas_collected++;
            document.getElementById("scoreLabel").innerText = `Bananas: ${bananas_collected}/3`;
        }
    }

    // --- RENDER ---
    ctx.clearRect(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT);
    
    if (cachedBackground) {
        ctx.drawImage(cachedBackground, 0, 0);
    }
    
    drawCenteredImage(assets.box, box.x, box.y, box.width, box.height);
    bananas.forEach(b => drawCenteredImage(assets.banana, b.x, b.y, b.width, b.height));

    if (draw_as_sprite) {
        let sheet = facing_direction === 1 ? assets.move_1_sheet : assets.move_2_sheet;
        if (sheet) {
            let cols = 4;
            let rows = 2;
            let fw = sheet.width / cols;
            let fh = sheet.height / rows;
            let col = frame_index % cols;
            let row = Math.floor(frame_index / cols);
            
            ctx.drawImage(sheet, col * fw, row * fh, fw, fh, monkey.x - 35, monkey.y - 35, 70, 70);
        }
    } else {
        drawCenteredImage(current_img, monkey.x, monkey.y, monkey.width, monkey.height);
    }



    if (bananas_collected >= 3) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(0, 0, WINDOW_WIDTH, WINDOW_HEIGHT);
        ctx.fillStyle = "#4ecdc4";
        ctx.font = "bold 45px 'Cormorant Garamond', serif";
        ctx.textAlign = "center";
        ctx.fillText("GOAL STATE REACHED!", WINDOW_WIDTH/2, WINDOW_HEIGHT/2);
        gameRunning = false;
        
        let startBtn = document.getElementById("startGameBtn");
        if(startBtn) {
            startBtn.innerText = "Restart Game ↺";
            startBtn.disabled = false;
        }
        let autoBtn = document.getElementById("autoSolveBtn");
        if(autoBtn) autoBtn.disabled = false;
        return;
    }

    animationId = requestAnimationFrame(gameLoop);
}

// ── STATE RESET HELPER ──
function resetGameState() {
    monkey.x = 100;
    monkey.y = FLOOR_Y;
    box.x = 500;
    monkey_dy = 0;
    is_jumping = false;
    bananas_collected = 0;
    facing_direction = 1;
    let scoreLabel = document.getElementById("scoreLabel");
    if(scoreLabel) scoreLabel.innerText = `Bananas: 0/3`;
    bananas = [
        { x: 250, y: 320, width: 65, height: 65 },
        { x: 500, y: 240, width: 65, height: 65 },
        { x: 680, y: 200, width: 65, height: 65 }
    ];
    lastTime = 0;
    keys = { ArrowLeft: false, ArrowRight: false, Shift: false, Space: false };
}

// ── BUTTON LISTENERS ──
let startGameBtn = document.getElementById("startGameBtn");
let autoSolveBtn = document.getElementById("autoSolveBtn");

if (startGameBtn) {
    startGameBtn.addEventListener("click", () => {
        resetGameState();
        autoIsActive = false;
        startGameBtn.disabled = true;
        if(autoSolveBtn) autoSolveBtn.disabled = false;
        
        if (!gameRunning) {
            gameRunning = true;
            requestAnimationFrame(gameLoop);
        }
    });
}

if (autoSolveBtn) {
    autoSolveBtn.addEventListener("click", () => {
        resetGameState();
        autoIsActive = true;
        autoSolveBtn.disabled = true;
        if(startGameBtn) startGameBtn.disabled = false;

    
        autoPlan = [
            { action: 'walk_to', targetX: 250 },
            { action: 'jump_up' },
            
            { action: 'walk_to', targetX: 428 },
            { action: 'jump_right', targetX: 500 },
            
            
            { action: 'walk_off_left' }, 
            
            { action: 'push_to', targetBoxX: 680 }, 
            
            { action: 'jump_right', targetX: 680 }, 
            
            { action: 'jump_up' } 
        ];
        if (!gameRunning) {
            gameRunning = true;
            requestAnimationFrame(gameLoop);
        }
    });
}
loadAllAssets();

// ── SCROLL ANIMATION ──
const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1 }); 

document.querySelectorAll('.fade-in').forEach((el) => {
    observer.observe(el);
});
