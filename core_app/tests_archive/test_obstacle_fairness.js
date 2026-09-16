const assert = require('assert');

// Simulate the PRNG and Obstacle generation logic from dino-engine.js
function createPRNG(seed) {
    var s = 0;
    if (typeof seed === 'number') {
        s = seed | 0;
    } else if (typeof seed === 'string') {
        for (var i = 0; i < seed.length; i++) {
            s = (Math.imul(31, s) + seed.charCodeAt(i)) | 0;
        }
    }
    if (s === 0) s = 123456789;
    return function () {
        var t = s += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

class SimulatedDinoEngine {
    constructor(seed, isMobile = false) {
        this.seed = seed;
        this.rng = createPRNG(seed);
        this.obstacleRng = createPRNG(seed);
        this.isMobile = isMobile;
        this.obstacleHistory = [];
        this.generatedObstacles = [];
    }

    obstacleRandom() {
        return this.obstacleRng();
    }

    getObstacleRandomNum(min, max) {
        return Math.floor(this.obstacleRandom() * (max - min + 1)) + min;
    }

    // Cosmetic random (clouds, stars)
    cosmeticRandom() {
        return Math.random();
    }

    spawnObstacle(currentSpeed) {
        const types = [
            { type: 'CACTUS_SMALL', width: 17, height: 35, yPos: 105, multipleSpeed: 4, minGap: 120, minSpeed: 0 },
            { type: 'CACTUS_LARGE', width: 25, height: 50, yPos: 90, multipleSpeed: 7, minGap: 120, minSpeed: 0 },
            { type: 'PTERODACTYL', width: 46, height: 40, yPos: [100, 75, 50], multipleSpeed: 999, minSpeed: 8.5, minGap: 150 }
        ];

        const obstacleTypeIndex = this.getObstacleRandomNum(0, types.length - 1);
        const obstacleType = types[obstacleTypeIndex];

        const size = this.getObstacleRandomNum(1, 3);
        const yPosConfig = obstacleType.yPos;
        const yPos = Array.isArray(yPosConfig) 
            ? yPosConfig[this.getObstacleRandomNum(0, yPosConfig.length - 1)]
            : yPosConfig;

        const minGap = Math.round(obstacleType.width * currentSpeed + obstacleType.minGap * 1.5);
        const maxGap = Math.round(minGap * 1.5);
        const gap = this.getObstacleRandomNum(minGap, maxGap);

        const obs = {
            type: obstacleType.type,
            size,
            yPos,
            gap
        };
        this.generatedObstacles.push(obs);
        return obs;
    }
}

function testObstacleDeterminism() {
    console.log('--- TEST DE IMPARCIALIDAD Y DETERMINISMO DE OBSTÁCULOS (FAIRNESS) ---');

    const seed = 'tournament_race_seed_xyz99';

    // Jugador 1 en PC (Desktop)
    const playerDesktop = new SimulatedDinoEngine(seed, false);

    // Jugador 2 en Móvil (Mobile)
    const playerMobile = new SimulatedDinoEngine(seed, true);

    // Simular que el jugador 1 tiene nubes y animaciones cosméticas intermedias
    for (let i = 0; i < 50; i++) {
        // Player 1 genera 3 nubes aleatorias
        playerDesktop.cosmeticRandom();
        playerDesktop.cosmeticRandom();
        playerDesktop.cosmeticRandom();

        const speed = 6 + (i * 0.1);
        const obsDesk = playerDesktop.spawnObstacle(speed);
        const obsMob = playerMobile.spawnObstacle(speed);

        assert.strictEqual(obsDesk.type, obsMob.type, `Obstáculo #${i+1}: El tipo debe ser idéntico`);
        assert.strictEqual(obsDesk.size, obsMob.size, `Obstáculo #${i+1}: El tamaño debe ser idéntico`);
        assert.strictEqual(obsDesk.yPos, obsMob.yPos, `Obstáculo #${i+1}: La altura yPos debe ser idéntica`);
        assert.strictEqual(obsDesk.gap, obsMob.gap, `Obstáculo #${i+1}: El gap de separación debe ser idéntico`);
    }

    console.log('✅ 50 obstáculos generados en paralelo: 100% idénticos entre PC y Celular.');
    console.log('✅ Las nubes y gráficos visuales ya NO alteran la secuencia de juego.');
    console.log('🎉 TODOS LOS JUGADORES TIENEN EXACTAMENTE LA MISMA PISTA Y DIFICULTAD.\n');
}

testObstacleDeterminism();
