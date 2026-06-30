const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const finalScoreElement = document.getElementById('final-score');
const scoreListElement = document.getElementById('score-list');
const restartBtn = document.getElementById('restart-btn');
const menuButtons = document.querySelectorAll('.menu-btn');

canvas.width = 600;
canvas.height = 700;

// Initialize Background Music Object Instance
const bgMusic = new Audio('music.mp3');
bgMusic.loop = true;      
bgMusic.volume = 0.35;    

let selectedDifficulty = 'easy';
let score = 0;
let baseSpeed = 0.4;
let wordSpawnInterval = 3500;
let speedIncrement = 0.01;
let lastSpawnTime = 0;
let gameActive = false; 

let fallingWords = [];
let lasers = [];
let particles = []; // Particle explosion vector tracker array
let targetWord = null;

const dictionary = {
    easy: [
        "cat", "dog", "run", "sky", "blue", "ship", "laser", "star", "fire", "moon", "orbit",
        "game", "code", "space", "blast", "speed", "fast", "type", "keys", "text", "planet",
        "alien", "solar", "comet", "beam", "glow", "neon", "jump", "wave", "time", "score"
    ],
    medium: [
        "galaxy", "nebula", "meteor", "rocket", "quantum", "gravity", "vector", "matrix", "arcade",
        "computer", "keyboard", "software", "internet", "database", "variable", "function", "universe"
    ],
    hard: [
        "syntactical", "atmospheric", "gravitational", "astrophysics", "exoplanetary", "supernova",
        "constellation", "interstellar", "cryptography", "cybersecurity", "development", "programming"
    ]
};

const difficultySettings = {
    easy: { startSpeed: 0.4, spawnRate: 3500, scaling: 0.01 },
    medium: { startSpeed: 0.8, spawnRate: 2200, scaling: 0.03 },
    hard: { startSpeed: 1.3, spawnRate: 1400, scaling: 0.06 }
};

const shipX = canvas.width / 2;
const shipY = canvas.height - 40;

class FallingWord {
    constructor() {
        const pool = dictionary[selectedDifficulty];
        this.text = pool[Math.floor(Math.random() * pool.length)];
        this.x = Math.max(50, Math.random() * (canvas.width - 150));
        this.y = -20;
        this.speed = baseSpeed + Math.random() * 0.2;
        this.typedIndex = 0;
    }

    update() {
        this.y += this.speed;
        if (this.y > shipY - 10) endGame();
    }

    draw() {
        ctx.font = "20px 'Courier New'";
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.fillText(this.text, this.x, this.y);

        if (this.typedIndex > 0) {
            ctx.fillStyle = "#00ffcc";
            ctx.fillText(this.text.substring(0, this.typedIndex), this.x, this.y);
        }
    }
}

class Laser {
    constructor(startX, startY, targetX, targetY) {
        this.x = startX; this.y = startY; this.targetX = targetX; this.targetY = targetY; this.life = 5;
    }
    draw() {
        if (this.life > 0) {
            ctx.beginPath(); ctx.strokeStyle = "#ff3366"; ctx.lineWidth = 3;
            ctx.moveTo(this.x, this.y); ctx.lineTo(this.targetX, this.targetY); ctx.stroke();
            this.life--;
        }
    }
}

// Particle Explosion Shard Class
class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 3 + 2; // Particle size between 2px and 5px
        
        // Random direction and explosion velocity calculations
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        this.alpha = 1; // Transparency level for fadeout mechanics
        this.decay = Math.random() * 0.02 + 0.015; // Speed of fadeout
        this.color = Math.random() > 0.5 ? "#00ffcc" : "#ff3366"; // Alternates neon colors
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.98; // Friction calculation to slow down shards
        this.vy *= 0.98;
        this.alpha -= this.decay;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        
        // Apply retro glow side effects
        ctx.shadowBlur = 6;
        ctx.shadowColor = this.color;
        
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.restore();
    }
}

// Creates an explosion of 15 distinct shards at a word's location
function createExplosion(x, y, wordLength) {
    const approximateWidth = wordLength * 12; // Estimate center of the text string
    const centerX = x + (approximateWidth / 2);
    
    for (let i = 0; i < 15; i++) {
        particles.push(new Particle(centerX, y - 8));
    }
}

menuButtons.forEach(button => {
    button.addEventListener('click', () => {
        selectedDifficulty = button.getAttribute('data-diff');
        startScreen.classList.add('hidden');
        bgMusic.currentTime = 0; 
        bgMusic.play().catch(err => console.log("Audio playback blocked:", err));
        resetGame();
    });
});

window.addEventListener('keydown', (e) => {
    if (!gameActive) return;
    const pressedKey = e.key.toLowerCase();
    if (pressedKey.length > 1) return;

    if (targetWord === null) {
        for (let word of fallingWords) {
            if (word.text.startsWith(pressedKey)) {
                targetWord = word; targetWord.typedIndex = 1;
                fireLaser(targetWord.x + 10, targetWord.y);
                checkWordCompletion();
                break;
            }
        }
    } else {
        if (pressedKey === targetWord.text[targetWord.typedIndex].toLowerCase()) {
            targetWord.typedIndex++;
            fireLaser(targetWord.x + (targetWord.typedIndex * 10), targetWord.y);
            checkWordCompletion();
        }
    }
});

function fireLaser(tx, ty) { lasers.push(new Laser(shipX, shipY, tx, ty)); }

function checkWordCompletion() {
    if (targetWord && targetWord.typedIndex >= targetWord.text.length) {
        score += targetWord.text.length * 10;
        
        // TRIGGER PARTICLE BLAST ON WORD COMPLETION
        createExplosion(targetWord.x, targetWord.y, targetWord.text.length);
        
        fallingWords = fallingWords.filter(w => w !== targetWord);
        targetWord = null;
        baseSpeed += speedIncrement;
    }
}

function drawShip() {
    ctx.beginPath(); ctx.fillStyle = "#3399ff";
    ctx.moveTo(shipX, shipY - 15); ctx.lineTo(shipX - 15, shipY + 15); ctx.lineTo(shipX + 15, shipY + 15);
    ctx.fill();
}

function drawScore() {
    ctx.fillStyle = "#ffffff"; ctx.font = "16px 'Courier New'";
    ctx.fillText(`SCORE: ${score} (${selectedDifficulty.toUpperCase()})`, 20, 30);
}

function endGame() { 
    gameActive = false; 
    finalScoreElement.innerText = score; 
    bgMusic.pause();
    saveAndShowLeaderboard();
    gameOverScreen.classList.remove('hidden'); 
}

function saveAndShowLeaderboard() {
    let localScores = JSON.parse(localStorage.getItem('ztype_high_scores')) || [];
    const currentRun = {
        value: score,
        difficulty: selectedDifficulty.toUpperCase(),
        date: new Date().toLocaleDateString()
    };
    localScores.push(currentRun);
    localScores.sort((a, b) => b.value - a.value);
    localScores = localScores.slice(0, 5);
    localStorage.setItem('ztype_high_scores', JSON.stringify(localScores));
    
    scoreListElement.innerHTML = '';
    localScores.forEach((run, index) => {
        const li = document.createElement('li');
        li.className = 'score-item';
        li.innerHTML = `
            <div><span class="score-rank">#${index + 1}</span> <span>${run.value}</span></div>
            <span class="score-diff">(${run.difficulty})</span>
        `;
        scoreListElement.appendChild(li);
    });
}

function resetGame() {
    const config = difficultySettings[selectedDifficulty];
    baseSpeed = config.startSpeed; wordSpawnInterval = config.spawnRate; speedIncrement = config.scaling;
    score = 0; fallingWords = []; lasers = []; particles = []; targetWord = null; gameActive = true;
    gameOverScreen.classList.add('hidden'); lastSpawnTime = performance.now();
    requestAnimationFrame(gameLoop);
}

restartBtn.addEventListener('click', () => { 
    gameOverScreen.classList.add('hidden'); startScreen.classList.remove('hidden'); 
});

function gameLoop(currentTime) {
    if (!gameActive) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (currentTime - lastSpawnTime > wordSpawnInterval) { fallingWords.push(new FallingWord()); lastSpawnTime = currentTime; }
    
    // Update and draw live lasers
    lasers = lasers.filter(laser => laser.life > 0); lasers.forEach(laser => laser.draw());
    
    // Core Engine Loop: Manage particle mechanics, physics, and fadeouts
    particles = particles.filter(p => p.alpha > 0);
    particles.forEach(p => {
        p.update();
        p.draw();
    });

    fallingWords.forEach(word => { word.update(); word.draw(); });
    drawShip(); drawScore();
    requestAnimationFrame(gameLoop);
}
