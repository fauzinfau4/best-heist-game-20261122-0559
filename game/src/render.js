// The painter: everything the player sees, drawn on one 1280x720 canvas that scales
// to the window. The yard is painted in layers — floor and rails, lamplight, cover,
// tripwires, loot, the watchers and their cones, the thief, then the HUD — so safe
// cover, danger and loot each read at a glance. Annotation callouts (the leader-line
// labels the cover screenshot wears) are drawn only when a shot asks for them; they
// are part of the render, never pasted on afterwards.

import { FIELD, PALETTE, FONT, TOOLS } from './config.js';
import { RAILS } from './levels.js';
import { createRandom } from './random.js';
import { cameraCone } from './cameras.js';
import { guardCone, GUARD_STATE } from './guards.js';
import { playerInLight } from './world.js';
import { distance } from './geometry.js';

export const SCREEN = {
  TITLE: 'title',
  PLAY: 'play',
  PAUSED: 'paused',
  OVER: 'over',
};

/** Gravel speckles and rail ties, scattered once per job from a fixed seed. */
function scatterFor(jobIndex) {
  const random = createRandom(4100 + jobIndex * 97);
  const speckles = [];
  for (let i = 0; i < 420; i += 1) {
    speckles.push({
      x: random.range(30, FIELD.width - 30),
      y: random.range(76, FIELD.height - 46),
      r: random.range(0.8, 2.2),
      light: random.next() > 0.5,
    });
  }
  return speckles;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;
  const specklesByJob = new Map();

  function speckles(jobIndex) {
    if (!specklesByJob.has(jobIndex)) specklesByJob.set(jobIndex, scatterFor(jobIndex));
    return specklesByJob.get(jobIndex);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function text(str, x, y, size, color, align = 'left', weight = 600) {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function drawFloor(world) {
    ctx.fillStyle = PALETTE.floor;
    ctx.fillRect(0, 64, FIELD.width, FIELD.height - 100);
    // Gravel speckle.
    for (const s of speckles(world.jobIndex)) {
      ctx.fillStyle = s.light ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // Rails run through the yard, ties and all.
    for (const rail of RAILS) {
      ctx.fillStyle = PALETTE.tie;
      for (let x = rail.x; x < rail.x + rail.w; x += 26) {
        ctx.fillRect(x, rail.y - 9, 14, 18);
      }
      ctx.fillStyle = PALETTE.rail;
      ctx.fillRect(rail.x, rail.y - 7, rail.w, 3);
      ctx.fillRect(rail.x, rail.y + 4, rail.w, 3);
    }
    // Yard border.
    ctx.strokeStyle = PALETTE.wallTop;
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 68, FIELD.width - 48, FIELD.height - 108);
  }

  function drawLampPool(lamp) {
    const gradient = ctx.createRadialGradient(lamp.x, lamp.y, 8, lamp.x, lamp.y, lamp.r);
    gradient.addColorStop(0, 'rgba(255, 190, 90, 0.34)');
    gradient.addColorStop(0.6, 'rgba(255, 170, 70, 0.14)');
    gradient.addColorStop(1, 'rgba(255, 170, 70, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, lamp.r, 0, Math.PI * 2);
    ctx.fill();
    // The lamp post itself.
    ctx.fillStyle = '#2a2f42';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.lampGlow;
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBlocker(blocker) {
    if (blocker.kind === 'boxcar') {
      ctx.fillStyle = PALETTE.boxcarDark;
      ctx.fillRect(blocker.x, blocker.y, blocker.w, blocker.h);
      ctx.fillStyle = PALETTE.boxcar;
      ctx.fillRect(blocker.x + 3, blocker.y + 3, blocker.w - 6, blocker.h - 6);
      ctx.fillStyle = PALETTE.boxcarStripe;
      ctx.fillRect(blocker.x + 3, blocker.y + 3, blocker.w - 6, 5);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (let x = blocker.x + 14; x < blocker.x + blocker.w - 8; x += 26) {
        ctx.fillRect(x, blocker.y + 12, 4, blocker.h - 20);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.font = `700 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('EMB-7', blocker.x + blocker.w / 2, blocker.y + blocker.h / 2);
    } else if (blocker.kind === 'wall') {
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(blocker.x, blocker.y, blocker.w, blocker.h);
      ctx.fillStyle = PALETTE.wallTop;
      if (blocker.h <= 22) ctx.fillRect(blocker.x, blocker.y, blocker.w, 4);
      else ctx.fillRect(blocker.x, blocker.y, 4, blocker.h);
    } else if (blocker.kind === 'crate') {
      ctx.fillStyle = '#6b4d2a';
      ctx.fillRect(blocker.x, blocker.y, blocker.w, blocker.h);
      ctx.fillStyle = '#8a6537';
      ctx.fillRect(blocker.x + 3, blocker.y + 3, blocker.w - 6, blocker.h - 6);
      ctx.strokeStyle = '#4a3419';
      ctx.lineWidth = 2;
      ctx.strokeRect(blocker.x + 3, blocker.y + 3, blocker.w - 6, blocker.h - 6);
      ctx.beginPath();
      ctx.moveTo(blocker.x + 3, blocker.y + 3);
      ctx.lineTo(blocker.x + blocker.w - 3, blocker.y + blocker.h - 3);
      ctx.moveTo(blocker.x + blocker.w - 3, blocker.y + 3);
      ctx.lineTo(blocker.x + 3, blocker.y + blocker.h - 3);
      ctx.stroke();
    }
  }

  function drawCone(polygon, color, alpha) {
    ctx.beginPath();
    ctx.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < polygon.length; i += 1) ctx.lineTo(polygon[i].x, polygon[i].y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawGuard(guard, blockers) {
    const hunting = guard.state === GUARD_STATE.HUNT;
    const suspicious = guard.state === GUARD_STATE.SUSPICIOUS || guard.state === GUARD_STATE.INVESTIGATE;
    const coneColor = hunting ? PALETTE.coneDanger : suspicious ? '#ffb347' : PALETTE.cone;
    drawCone(guardCone(guard, blockers), coneColor, hunting ? 0.3 : 0.17);
    // Suspicion arc above the guard's head.
    if (guard.suspicion > 0.03) {
      ctx.beginPath();
      ctx.arc(guard.x, guard.y - 22, 9, -Math.PI / 2, -Math.PI / 2 + guard.suspicion * Math.PI * 2);
      ctx.strokeStyle = hunting ? PALETTE.coneDanger : PALETTE.hazard;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // Body: a lamplighter in a long coat, lantern in hand.
    ctx.save();
    ctx.translate(guard.x, guard.y);
    ctx.rotate(guard.facing);
    ctx.fillStyle = PALETTE.guardCoat;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.arc(5, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.lampGlow;
    ctx.beginPath();
    ctx.arc(16, 6, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (guard.mark) {
      text(guard.mark, guard.x, guard.y - 36, 22, hunting ? PALETTE.coneDanger : PALETTE.hazard, 'center', 800);
    }
  }

  function drawCamera(camera, blockers) {
    const hot = camera.suspicion >= 1;
    drawCone(cameraCone(camera, blockers), hot ? PALETTE.coneDanger : PALETTE.camera, hot ? 0.3 : 0.15);
    ctx.fillStyle = '#1d2438';
    ctx.beginPath();
    ctx.arc(camera.x, camera.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.rotate(camera.angle);
    ctx.fillStyle = hot ? PALETTE.coneDanger : PALETTE.camera;
    roundRect(0, -5, 16, 10, 3);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(14, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (camera.suspicion > 0.03) {
      ctx.beginPath();
      ctx.arc(camera.x, camera.y - 18, 7, -Math.PI / 2, -Math.PI / 2 + camera.suspicion * Math.PI * 2);
      ctx.strokeStyle = PALETTE.camera;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }

  function drawLoot(item, time) {
    if (item.taken) return;
    const bob = Math.sin(time * 2 + item.x) * 2;
    if (item.kind === 'prize') {
      // The prize glows gold and pulses: it is the reason you are here.
      const pulse = 0.5 + 0.3 * Math.sin(time * 3);
      const gradient = ctx.createRadialGradient(item.x, item.y, 4, item.x, item.y, 44);
      gradient.addColorStop(0, `rgba(255, 217, 77, ${0.5 + pulse * 0.3})`);
      gradient.addColorStop(1, 'rgba(255, 217, 77, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(item.x, item.y, 44, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.prize;
      ctx.save();
      ctx.translate(item.x, item.y + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-9, -9, 18, 18);
      ctx.restore();
      ctx.fillStyle = '#7a5b00';
      ctx.font = `800 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', item.x, item.y + bob);
    } else {
      ctx.fillStyle = PALETTE.loot;
      ctx.beginPath();
      ctx.arc(item.x, item.y + bob, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a5b00';
      ctx.font = `800 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', item.x, item.y + bob);
    }
    if (item.grab > 0) {
      const need = item.kind === 'prize' ? 1.2 : 0.5;
      ctx.beginPath();
      ctx.arc(item.x, item.y - 20, 10, -Math.PI / 2, -Math.PI / 2 + (item.grab / need) * Math.PI * 2);
      ctx.strokeStyle = PALETTE.loot;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  function drawTripwire(wire, time) {
    const pulse = wire.on ? 0.9 : 0.15;
    const alpha = wire.tripped ? 1 : 0.35 + 0.45 * Math.abs(Math.sin(time * 4)) * pulse;
    ctx.strokeStyle = wire.on ? '#ff4d4d' : '#7a2b2b';
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2;
    ctx.setLineDash(wire.on ? [] : [6, 6]);
    ctx.beginPath();
    ctx.moveTo(wire.x1, wire.y1);
    ctx.lineTo(wire.x2, wire.y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // Posts at each end.
    ctx.fillStyle = '#3a4157';
    ctx.fillRect(wire.x1 - 3, wire.y1 - 6, 6, 12);
    ctx.fillRect(wire.x2 - 3, wire.y2 - 6, 6, 12);
    ctx.fillStyle = wire.on ? '#ff4d4d' : '#7a2b2b';
    ctx.beginPath();
    ctx.arc(wire.x1, wire.y1 - 8, 3, 0, Math.PI * 2);
    ctx.arc(wire.x2, wire.y2 - 8, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawExit(world, time) {
    const exit = world.job.exit;
    const open = world.exitOpen;
    const pulse = 0.6 + 0.4 * Math.sin(time * 3);
    ctx.save();
    ctx.globalAlpha = open ? 0.75 + 0.25 * pulse : 0.4;
    ctx.fillStyle = open ? PALETTE.exit : '#3a4157';
    roundRect(exit.x - 26, exit.y - 22, 52, 44, 6);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = open ? '#062b16' : PALETTE.muted;
    ctx.font = `800 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(open ? 'EXIT' : 'LOCKED', exit.x, exit.y - 4);
    ctx.font = `600 9px ${FONT}`;
    ctx.fillText(world.job.exit.label, exit.x, exit.y + 11);
    if (open) {
      ctx.strokeStyle = PALETTE.exit;
      ctx.globalAlpha = 0.5 + 0.4 * pulse;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(exit.x, exit.y, 34 + 6 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawPlayer(world, time) {
    const player = world.player;
    // Noise rings, expanding and fading.
    for (const noise of player.noises) {
      const age = noise.clang ? 1 - noise.ttl / TOOLS.clangLinger : 0.5;
      ctx.strokeStyle = noise.clang ? PALETTE.hazard : 'rgba(255,255,255,0.5)';
      ctx.globalAlpha = Math.max(0, 0.7 - age);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(noise.x, noise.y, 12 + age * 46, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Smoke puff: a soft grey cloud you cannot be seen inside.
    if (player.smokeTimer > 0) {
      const gradient = ctx.createRadialGradient(player.x, player.y, 6, player.x, player.y, TOOLS.smokeRadius);
      gradient.addColorStop(0, 'rgba(154, 167, 189, 0.55)');
      gradient.addColorStop(1, 'rgba(154, 167, 189, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(player.x, player.y, TOOLS.smokeRadius, 0, Math.PI * 2);
      ctx.fill();
    }
    // Aim line and the flying spanner.
    if (player.thrown) {
      ctx.fillStyle = PALETTE.muted;
      ctx.beginPath();
      ctx.arc(player.thrown.x, player.thrown.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Wren: dark coat, flat cap, a pale face in the dark.
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.facing);
    ctx.fillStyle = player.sneaking ? '#1d2c4a' : PALETTE.playerCoat;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(4, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d2c4a';
    ctx.fillRect(-2, -8, 10, 4);
    ctx.restore();
    // Visibility ring: amber when lit, teal when hidden in shadow.
    const lit = playerInLight(world);
    ctx.strokeStyle = lit ? PALETTE.hazard : PALETTE.signalTeal;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function alarmColor(world) {
    if (world.alarm >= 75) return PALETTE.alarmHot;
    if (world.alarm >= 35) return PALETTE.alarmWarn;
    return PALETTE.alarmCalm;
  }

  function drawHud(world, best) {
    const job = world.job;
    const player = world.player;
    // Top bar.
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, 0, FIELD.width, 64);
    ctx.fillStyle = PALETTE.panelLine;
    ctx.fillRect(0, 63, FIELD.width, 1);
    text('EMBERLINE', 24, 22, 20, PALETTE.hazard, 'left', 800);
    text(job.name, 24, 46, 12, PALETTE.muted, 'left', 600);
    text(job.brief, FIELD.width / 2, 24, 13, PALETTE.text, 'center', 600);
    const lit = playerInLight(world);
    text(lit ? '◉ LIT — SEEN FROM AFAR' : '◉ SHADOW — HARD TO SEE', FIELD.width / 2, 46, 11, lit ? PALETTE.hazard : PALETTE.signalTeal, 'center', 700);
    // Alarm meter, right side.
    const ax = FIELD.width - 300;
    text('ALARM', ax, 20, 11, PALETTE.muted, 'left', 700);
    text(`${world.alarmState}  ${Math.round(world.alarm)}`, ax + 150, 20, 11, alarmColor(world), 'left', 800);
    ctx.fillStyle = '#0a0e1a';
    roundRect(ax, 30, 230, 12, 6);
    ctx.fill();
    ctx.fillStyle = alarmColor(world);
    roundRect(ax, 30, Math.max(4, (world.alarm / 100) * 230), 12, 6);
    ctx.fill();
    // Loot / tools / time, second row right.
    const lootTotal = world.loot.filter((i) => i.kind === 'crate').length;
    text(`LOOT ${world.cratesTaken}/${lootTotal}   $${world.lootValue}`, FIELD.width - 300, 54, 11, PALETTE.loot, 'left', 700);
    const minutes = Math.floor(world.timeLeft / 60);
    const seconds = Math.floor(world.timeLeft % 60);
    text(`${minutes}:${String(seconds).padStart(2, '0')}`, FIELD.width - 60, 54, 13, PALETTE.text, 'right', 800);
    // Bottom bar: tools and controls.
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(0, FIELD.height - 36, FIELD.width, 36);
    ctx.fillStyle = PALETTE.panelLine;
    ctx.fillRect(0, FIELD.height - 37, FIELD.width, 1);
    text(
      `SPANNERS ${'●'.repeat(player.spanners)}${'○'.repeat(TOOLS.spanners - player.spanners)}    SMOKE ${'●'.repeat(player.smoke)}${'○'.repeat(TOOLS.smoke - player.smoke)}`,
      24,
      FIELD.height - 18,
      12,
      PALETTE.text,
      'left',
      700,
    );
    text(
      'WASD move · SHIFT sneak · SPACE sprint · CLICK throw spanner · Q smoke · E grab · H notes · M mute · ESC pause',
      FIELD.width - 24,
      FIELD.height - 18,
      11,
      PALETTE.muted,
      'right',
      600,
    );
    // Flash message, centre screen.
    if (world.flash && world.flashTimer > 0) {
      ctx.globalAlpha = Math.min(1, world.flashTimer);
      text(world.flash, FIELD.width / 2, 110, 26, world.won ? PALETTE.exit : PALETTE.coneDanger, 'center', 800);
      ctx.globalAlpha = 1;
    } else if (world.message && world.messageTimer > 0) {
      ctx.globalAlpha = Math.min(1, world.messageTimer);
      text(world.message, FIELD.width / 2, 110, 16, PALETTE.loot, 'center', 700);
      ctx.globalAlpha = 1;
    }
  }

  function drawFieldNotes(world) {
    const x = 28;
    const y = 96;
    const w = 268;
    const h = 218;
    ctx.fillStyle = 'rgba(13, 18, 34, 0.92)';
    roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelLine;
    ctx.lineWidth = 1;
    roundRect(x, y, w, h, 8);
    ctx.stroke();
    text('FIELD NOTES', x + 14, y + 18, 13, PALETTE.hazard, 'left', 800);
    const rows = [
      ['●', PALETTE.cone, 'Guard + vision cone — what they see'],
      ['▨', PALETTE.signalTeal, 'Blind spot behind cover — safe'],
      ['◉', PALETTE.lampGlow, 'Lamplight — seen from afar'],
      ['▬', '#ff4d4d', 'Tripwire — pulses; cross in the gap'],
      ['◆', PALETTE.loot, 'Loot — grab it, then the prize'],
      ['★', PALETTE.prize, 'Prize — opens the getaway'],
      ['▣', PALETTE.exit, 'Exit — reach it with the prize'],
    ];
    rows.forEach((row, i) => {
      text(row[0], x + 16, y + 44 + i * 24, 13, row[1], 'left', 800);
      text(row[2], x + 38, y + 44 + i * 24, 11, PALETTE.text, 'left', 600);
    });
  }

  function drawAnnotation(note) {
    // A callout box with a leader line to the thing it names.
    ctx.font = `700 13px ${FONT}`;
    const width = ctx.measureText(note.text).width + 22;
    const height = 26;
    ctx.strokeStyle = 'rgba(255, 200, 90, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(note.bx + width / 2, note.by + height / 2);
    ctx.lineTo(note.x, note.y);
    ctx.stroke();
    ctx.fillStyle = 'rgba(10, 13, 26, 0.92)';
    roundRect(note.bx, note.by, width, height, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 200, 90, 0.7)';
    ctx.lineWidth = 1;
    roundRect(note.bx, note.by, width, height, 4);
    ctx.stroke();
    ctx.fillStyle = PALETTE.lampGlow;
    ctx.beginPath();
    ctx.arc(note.x, note.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    text(note.text, note.bx + 11, note.by + height / 2 + 1, 13, '#ffe9b0', 'left', 700);
  }

  function drawWorld(world, time, annotations, showNotes) {
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    drawFloor(world);
    // Night falls over the yard; the lamps cut pools out of it.
    ctx.fillStyle = 'rgba(4, 6, 12, 0.28)';
    ctx.fillRect(24, 68, FIELD.width - 48, FIELD.height - 108);
    for (const lamp of world.job.lamps) drawLampPool(lamp);
    for (const blocker of world.job.blockers) drawBlocker(blocker);
    for (const wire of world.tripwires) drawTripwire(wire, time);
    drawExit(world, time);
    for (const item of world.loot) drawLoot(item, time);
    for (const camera of world.cameras) drawCamera(camera, world.job.blockers);
    for (const guard of world.guards) drawGuard(guard, world.job.blockers);
    drawPlayer(world, time);
    if (showNotes) drawFieldNotes(world);
    if (annotations) {
      for (const note of annotations) drawAnnotation(note);
    }
    drawHud(world, 0);
  }

  function drawTitle(selectedJob, best) {
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // A quiet yard behind the title: rails and a lamp glow, no game running.
    ctx.fillStyle = PALETTE.floor;
    ctx.fillRect(0, 64, FIELD.width, FIELD.height - 100);
    for (const rail of RAILS) {
      ctx.fillStyle = PALETTE.tie;
      for (let x = rail.x; x < rail.x + rail.w; x += 26) ctx.fillRect(x, rail.y - 9, 14, 18);
      ctx.fillStyle = PALETTE.rail;
      ctx.fillRect(rail.x, rail.y - 7, rail.w, 3);
      ctx.fillRect(rail.x, rail.y + 4, rail.w, 3);
    }
    const glow = ctx.createRadialGradient(640, 360, 10, 640, 360, 420);
    glow.addColorStop(0, 'rgba(255, 180, 80, 0.16)');
    glow.addColorStop(1, 'rgba(255, 180, 80, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('EMBERLINE', FIELD.width / 2, 150, 64, PALETTE.hazard, 'center', 800);
    text('THE MIDNIGHT FREIGHT HEIST', FIELD.width / 2, 200, 18, PALETTE.text, 'center', 700);
    text(
      'Three jobs. One thief. Cross the yard unseen, lift the prize, and make the getaway before dawn.',
      FIELD.width / 2,
      236,
      14,
      PALETTE.muted,
      'center',
      600,
    );
    const jobs = [
      ['1', 'JOB 1 — THE SIDING YARD', 'Lift the Brass Seal · 2 guards · 1 camera'],
      ['2', 'JOB 2 — THE SORTING HALL', "Take the Conductor's Ledger · 3 guards · tripwires"],
      ['3', 'JOB 3 — THE VAULT CAR', 'Steal the Starlight Manifest · the full yard awake'],
    ];
    jobs.forEach((job, i) => {
      const y = 300 + i * 64;
      const selected = selectedJob === i;
      ctx.fillStyle = selected ? 'rgba(255, 179, 71, 0.16)' : 'rgba(22, 29, 49, 0.9)';
      roundRect(FIELD.width / 2 - 300, y, 600, 52, 8);
      ctx.fill();
      ctx.strokeStyle = selected ? PALETTE.hazard : PALETTE.panelLine;
      ctx.lineWidth = selected ? 2 : 1;
      roundRect(FIELD.width / 2 - 300, y, 600, 52, 8);
      ctx.stroke();
      text(job[0], FIELD.width / 2 - 278, y + 26, 20, PALETTE.hazard, 'left', 800);
      text(job[1], FIELD.width / 2 - 250, y + 18, 15, PALETTE.text, 'left', 800);
      text(job[2], FIELD.width / 2 - 250, y + 38, 12, PALETTE.muted, 'left', 600);
    });
    text(
      'WASD / arrows move · SHIFT sneak · SPACE sprint · CLICK throw a spanner · Q smoke · E grab loot',
      FIELD.width / 2,
      520,
      13,
      PALETTE.muted,
      'center',
      600,
    );
    text('Press 1–3 to choose a job, ENTER or CLICK to begin. Stay out of the cones. Mind the lamps.', FIELD.width / 2, 548, 13, PALETTE.muted, 'center', 600);
    if (best > 0) text(`BEST TAKE  $${best}`, FIELD.width / 2, 592, 14, PALETTE.loot, 'center', 800);
  }

  function drawPaused(world) {
    drawWorld(world, world.elapsed, null, true);
    ctx.fillStyle = 'rgba(5, 7, 15, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('PAUSED', FIELD.width / 2, 320, 44, PALETTE.text, 'center', 800);
    text('ESC to keep working · R to restart the job · H for field notes', FIELD.width / 2, 372, 14, PALETTE.muted, 'center', 600);
  }

  function drawOver(world, best) {
    drawWorld(world, world.elapsed, null, false);
    ctx.fillStyle = 'rgba(5, 7, 15, 0.78)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    if (world.won) {
      text('CLEAN GETAWAY', FIELD.width / 2, 250, 46, PALETTE.exit, 'center', 800);
      text(`${world.job.prizeName} is yours. The yard never saw you coming.`, FIELD.width / 2, 300, 15, PALETTE.text, 'center', 600);
      text(`LOOT  $${world.lootValue}`, FIELD.width / 2, 360, 16, PALETTE.loot, 'center', 700);
      text(`TIME BONUS  +$${world.timeBonus}`, FIELD.width / 2, 388, 16, PALETTE.text, 'center', 700);
      if (world.ghostBonus > 0) {
        text(`GHOST BONUS — NEVER SPOTTED  +$${world.ghostBonus}`, FIELD.width / 2, 416, 16, PALETTE.signalTeal, 'center', 700);
      }
      text(`TOTAL TAKE  $${world.score}`, FIELD.width / 2, 458, 22, PALETTE.prize, 'center', 800);
      if (world.score > best) text('NEW BEST TAKE!', FIELD.width / 2, 492, 14, PALETTE.hazard, 'center', 800);
      const next = world.jobIndex < 2 ? 'ENTER — next job' : 'ENTER — play again';
      text(`${next} · R — replay this job`, FIELD.width / 2, 540, 14, PALETTE.muted, 'center', 600);
    } else {
      text(world.flash || 'CAUGHT', FIELD.width / 2, 250, 46, PALETTE.coneDanger, 'center', 800);
      text('The yard swarms. Plan the route, watch the cones, try again.', FIELD.width / 2, 300, 15, PALETTE.text, 'center', 600);
      text(`You lifted $${world.lootValue} before it went wrong.`, FIELD.width / 2, 360, 16, PALETTE.loot, 'center', 700);
      text('R or ENTER — try the job again', FIELD.width / 2, 420, 14, PALETTE.muted, 'center', 600);
    }
  }

  return {
    draw(world, screen, options) {
      const { selectedJob = 0, best = 0, showNotes = true, annotations = null, time = 0 } = options || {};
      if (screen === SCREEN.TITLE) drawTitle(selectedJob, best);
      else if (screen === SCREEN.PAUSED) drawPaused(world);
      else if (screen === SCREEN.OVER) drawOver(world, best);
      else drawWorld(world, time, annotations, showNotes);
    },
  };
}
