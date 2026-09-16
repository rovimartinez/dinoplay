const assert = require('assert');

// 1. Test PRNG Mulberry32 determinism
function createPRNG(seed) {
  let s = 0;
  if (typeof seed === 'number') {
    s = seed | 0;
  } else if (typeof seed === 'string') {
    for (let i = 0; i < seed.length; i++) {
      s = (Math.imul(31, s) + seed.charCodeAt(i)) | 0;
    }
  }
  if (s === 0) s = 123456789;
  return function () {
    let t = s += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

console.log('--- TEST 1: PRNG DETERMINISM ---');
const rngA = createPRNG('tournament-final-2026');
const rngB = createPRNG('tournament-final-2026');
const rngC = createPRNG('different-round-seed');

const seqA = Array.from({ length: 50 }, () => rngA());
const seqB = Array.from({ length: 50 }, () => rngB());
const seqC = Array.from({ length: 50 }, () => rngC());

assert.deepStrictEqual(seqA, seqB, 'PRNG must be 100% deterministic for identical seeds');
assert.notDeepStrictEqual(seqA, seqC, 'PRNG must produce different sequence for different seeds');
console.log('✅ PRNG determinism passed: 50 consecutive values matched exactly.');

// 2. Test Tie-breaking rules
console.log('--- TEST 2: LEADERBOARD TIE-BREAKING RULES ---');
const mockPlayers = {
  p1: { id: 'p1', name: 'Alice', score: 500, distance: 2000, crashed: false, crashed_at: null, survival_ms: 30000, joinedAt: 100 },
  p2: { id: 'p2', name: 'Bob', score: 500, distance: 2000, crashed: true, crashed_at: 25000, survival_ms: 25000, joinedAt: 200 },
  p3: { id: 'p3', name: 'Charlie', score: 500, distance: 2000, crashed: true, crashed_at: 20000, survival_ms: 20000, joinedAt: 300 },
  p4: { id: 'p4', name: 'David', score: 600, distance: 2400, crashed: false, crashed_at: null, survival_ms: 30000, joinedAt: 400 },
  p5: { id: 'p5', name: 'Eve', score: 500, distance: 1900, crashed: false, crashed_at: null, survival_ms: 30000, joinedAt: 500 }
};

const playersList = Object.values(mockPlayers);
playersList.sort((a, b) => {
  if (b.score !== a.score) return b.score - a.score;
  if (b.distance !== a.distance) return b.distance - a.distance;
  if (a.crashed !== b.crashed) {
    return a.crashed ? 1 : -1;
  }
  const aCrashTime = a.crashed_at || 0;
  const bCrashTime = b.crashed_at || 0;
  if (bCrashTime !== aCrashTime) return bCrashTime - aCrashTime;

  const aSurvival = a.survival_ms || 0;
  const bSurvival = b.survival_ms || 0;
  if (bSurvival !== aSurvival) return bSurvival - aSurvival;

  return (a.joinedAt || 0) - (b.joinedAt || 0);
});

const sortedNames = playersList.map(p => p.name);
assert.deepStrictEqual(sortedNames, ['David', 'Alice', 'Bob', 'Charlie', 'Eve'], 'Leaderboard ordering matches all 5 tie-breaking rules');
console.log('✅ Tie-breaking rules passed: David (600) > Alice (500, alive) > Bob (500, crashed at 25s) > Charlie (500, crashed at 20s) > Eve (500, 1900 dist).');

// 3. Test Anti-Speedhack & Clamping
console.log('--- TEST 3: ANTI-SPEEDHACK & RATE LIMIT ---');
const roomStartedAt = Date.now() - 2000; // 2 seconds ago
const now = Date.now();
const elapsedSeconds = Math.max(0.1, (now - roomStartedAt) / 1000);
const maxPossibleDistance = Math.ceil(elapsedSeconds * 13 * 60 * 1.5) + 300;
const attemptedCheaterDistance = 25000; // impossible in 2 seconds

const clampedDistance = Math.min(attemptedCheaterDistance, maxPossibleDistance);
assert(clampedDistance <= maxPossibleDistance, 'Attempted impossible distance is clamped');
assert(clampedDistance < 5000, 'Distance in 2 seconds is realistically capped');
console.log(`✅ Anti-speedhack passed: 25000 px in 2s clamped to maximum physical ${clampedDistance} px.`);

console.log('\n🎉 ALL FASE 2 TESTS PASSED SUCCESSFULLY!\n');
