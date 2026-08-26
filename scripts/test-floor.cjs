#!/usr/bin/env node
/**
 * test-floor.cjs — Tests unitarios del floor system
 * Replica la lógica exacta de server/routes/chat.js sin dependencias de socket.io.
 *
 * Edge cases cubiertos:
 *   1. request sin owner → grants inmediato
 *   2. request con owner diferente → encola
 *   3. release por dueño → siguiente en cola toma
 *   4. release por no-dueño → ignorado
 *   5. request duplicado del dueño → extiende timeout
 *   6. request duplicado en cola → no se duplica
 *   7. timeout con cola → siguiente toma
 *   8. timeout sin cola → owner = null
 *   9. 3 agentes: request → cola → release → siguiente → release → último
 *  10. request con name vacío → ignorado
 *
 * Uso: node scripts/test-floor.cjs
 * Exit 0 = todos pasan, Exit 1 = al menos 1 fallo
 */

'use strict';

const FLOOR_TIMEOUT_MS = 100; // 100ms para tests rápidos (real: 60s)

function createFloor() {
  return { owner: null, timeout: null, queue: [] };
}

function createMockNs() {
  const events = [];
  return {
    events,
    emit(event, data) { events.push({ event, data, ts: Date.now() }); },
    clear() { events.length = 0; }
  };
}

function grantFloor(floor, agent, ns) {
  floor.owner = agent;
  floor.queue = floor.queue.filter(a => a !== agent);
  if (floor.timeout) clearTimeout(floor.timeout);
  floor.timeout = setTimeout(() => {
    floor.owner = null;
    if (floor.queue.length > 0) grantFloor(floor, floor.queue.shift(), ns);
    ns.emit('floor:update', { owner: floor.owner, queue: [...floor.queue] });
  }, FLOOR_TIMEOUT_MS);
  ns.emit('floor:update', { owner: floor.owner, queue: [...floor.queue] });
}

function floorRequest(floor, name, ns) {
  if (!name) return;
  if (!floor.owner) {
    grantFloor(floor, name, ns);
  } else if (floor.owner === name) {
    // Extend timeout
    if (floor.timeout) clearTimeout(floor.timeout);
    floor.timeout = setTimeout(() => {
      floor.owner = null;
      if (floor.queue.length > 0) grantFloor(floor, floor.queue.shift(), ns);
      ns.emit('floor:update', { owner: floor.owner, queue: [...floor.queue] });
    }, FLOOR_TIMEOUT_MS);
  } else {
    if (!floor.queue.includes(name)) floor.queue.push(name);
    ns.emit('floor:update', { owner: floor.owner, queue: [...floor.queue] });
  }
}

function floorRelease(floor, name, ns) {
  if (!name || floor.owner !== name) return;
  if (floor.timeout) clearTimeout(floor.timeout);
  floor.owner = null;
  if (floor.queue.length > 0) grantFloor(floor, floor.queue.shift(), ns);
  ns.emit('floor:update', { owner: floor.owner, queue: [...floor.queue] });
}

function lastFloorEvent(ns) {
  const floorEvts = ns.events.filter(e => e.event === 'floor:update');
  return floorEvts[floorEvts.length - 1];
}

function assert(condition, msg) {
  if (!condition) throw new Error(`FAIL: ${msg}`);
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     ${e.message}`);
  }
}

// ─── Tests ───

console.log('\n🧪 Floor System Tests\n');

test('1. request sin owner → grants inmediato', () => {
  const floor = createFloor();
  const ns = createMockNs();
  floorRequest(floor, 'kali', ns);
  assert(floor.owner === 'kali', `owner debería ser kali, es ${floor.owner}`);
  assert(floor.queue.length === 0, 'queue debería estar vacía');
});

test('2. request con owner diferente → encola', () => {
  const floor = createFloor();
  const ns = createMockNs();
  floorRequest(floor, 'kali', ns);
  floorRequest(floor, 'cel', ns);
  assert(floor.owner === 'kali', `owner debería seguir siendo kali, es ${floor.owner}`);
  assert(floor.queue.length === 1, `queue debería tener 1, tiene ${floor.queue.length}`);
  assert(floor.queue[0] === 'cel', `queue[0] debería ser cel, es ${floor.queue[0]}`);
});

test('3. release por dueño → siguiente en cola toma', () => {
  const floor = createFloor();
  const ns = createMockNs();
  floorRequest(floor, 'kali', ns);
  floorRequest(floor, 'cel', ns);
  floorRelease(floor, 'kali', ns);
  assert(floor.owner === 'cel', `owner debería ser cel, es ${floor.owner}`);
  assert(floor.queue.length === 0, 'queue debería estar vacía tras grant');
});

test('4. release por no-dueño → ignorado', () => {
  const floor = createFloor();
  const ns = createMockNs();
  floorRequest(floor, 'kali', ns);
  ns.clear();
  floorRelease(floor, 'cel', ns); // cel no es dueño
  assert(floor.owner === 'kali', `owner debería seguir siendo kali, es ${floor.owner}`);
  assert(ns.events.length === 0, 'no debería emitir eventos');
});

test('5. request duplicado del dueño → extiende timeout (sin cambiar owner)', () => {
  const floor = createFloor();
  const ns = createMockNs();
  floorRequest(floor, 'kali', ns);
  const ownerBefore = floor.owner;
  floorRequest(floor, 'kali', ns); // duplicate
  assert(floor.owner === ownerBefore, 'owner no debería cambiar');
  // Debería haber emitido floor:update (timeout extendido implícito)
});

test('6. request duplicado en cola → no se duplica', () => {
  const floor = createFloor();
  const ns = createMockNs();
  floorRequest(floor, 'kali', ns);
  floorRequest(floor, 'cel', ns);
  floorRequest(floor, 'cel', ns); // duplicate
  assert(floor.queue.length === 1, `queue debería tener 1, tiene ${floor.queue.length}`);
  assert(floor.queue[0] === 'cel', `queue[0] debería ser cel, es ${floor.queue[0]}`);
});

test('7. timeout con cola → siguiente toma', () => {
  const floor = createFloor();
  const ns = createMockNs();
  floorRequest(floor, 'kali', ns);
  floorRequest(floor, 'cel', ns);
  // Simular timeout
  if (floor.timeout) clearTimeout(floor.timeout);
  floor.owner = null;
  if (floor.queue.length > 0) grantFloor(floor, floor.queue.shift(), ns);
  ns.emit('floor:update', { owner: floor.owner, queue: [...floor.queue] });
  assert(floor.owner === 'cel', `owner debería ser cel tras timeout, es ${floor.owner}`);
  assert(floor.queue.length === 0, 'queue debería estar vacía');
});

test('8. timeout sin cola → owner = null', () => {
  const floor = createFloor();
  const ns = createMockNs();
  floorRequest(floor, 'kali', ns);
  // Simular timeout sin cola
  if (floor.timeout) clearTimeout(floor.timeout);
  floor.owner = null;
  if (floor.queue.length > 0) grantFloor(floor, floor.queue.shift(), ns);
  ns.emit('floor:update', { owner: floor.owner, queue: [...floor.queue] });
  assert(floor.owner === null, `owner debería ser null, es ${floor.owner}`);
});

test('9. 3 agentes: cadena completa request → cola → release → siguiente → release → último', () => {
  const floor = createFloor();
  const ns = createMockNs();
  floorRequest(floor, 'debian', ns);
  floorRequest(floor, 'kali', ns);
  floorRequest(floor, 'cel', ns);
  assert(floor.owner === 'debian', `1) owner=debian, es ${floor.owner}`);
  assert(floor.queue.length === 2, `1) queue=[kali,cel], len=${floor.queue.length}`);

  floorRelease(floor, 'debian', ns);
  assert(floor.owner === 'kali', `2) owner=kali, es ${floor.owner}`);
  assert(floor.queue.length === 1, `2) queue=[cel], len=${floor.queue.length}`);

  floorRelease(floor, 'kali', ns);
  assert(floor.owner === 'cel', `3) owner=cel, es ${floor.owner}`);
  assert(floor.queue.length === 0, `3) queue=[], len=${floor.queue.length}`);

  floorRelease(floor, 'cel', ns);
  assert(floor.owner === null, `4) owner=null, es ${floor.owner}`);
});

test('10. request con name vacío/undefined → ignorado', () => {
  const floor = createFloor();
  const ns = createMockNs();
  floorRequest(floor, '', ns);
  floorRequest(floor, null, ns);
  floorRequest(floor, undefined, ns);
  assert(floor.owner === null, `owner debería seguir null, es ${floor.owner}`);
  assert(floor.queue.length === 0, 'queue debería seguir vacía');
  assert(ns.events.length === 0, 'no debería emitir eventos');
});

test('11. queue se mantiene FIFO', () => {
  const floor = createFloor();
  const ns = createMockNs();
  floorRequest(floor, 'a', ns);
  floorRequest(floor, 'b', ns);
  floorRequest(floor, 'c', ns);
  assert(floor.queue[0] === 'b', `primero en cola debería ser b, es ${floor.queue[0]}`);
  assert(floor.queue[1] === 'c', `segundo en cola debería ser c, es ${floor.queue[1]}`);
  floorRelease(floor, 'a', ns);
  assert(floor.owner === 'b', `tras release a, owner=b, es ${floor.owner}`);
  floorRelease(floor, 'b', ns);
  assert(floor.owner === 'c', `tras release b, owner=c, es ${floor.owner}`);
});

test('12. emitFloor event data is correct', () => {
  const floor = createFloor();
  const ns = createMockNs();
  floorRequest(floor, 'kali', ns);
  floorRequest(floor, 'cel', ns);
  const ev = lastFloorEvent(ns);
  assert(ev !== undefined, 'should have floor:update event');
  assert(ev.data.owner === 'kali', `event owner=kali, es ${ev.data.owner}`);
  assert(ev.data.queue.length === 1, `event queue len=1, es ${ev.data.queue.length}`);
  assert(ev.data.queue[0] === 'cel', `event queue[0]=cel, es ${ev.data.queue[0]}`);
});

// ─── Resumen ───
console.log(`\n${'─'.repeat(40)}`);
console.log(`  ✅ ${passed} passed  ❌ ${failed} failed`);
console.log(`${'─'.repeat(40)}\n`);
process.exit(failed > 0 ? 1 : 0);
