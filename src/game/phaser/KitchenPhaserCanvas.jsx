/**
 * Scena interattiva 2D in Phaser 4 per "Il Banco del Gambero".
 * - Disegna la paninoteca napoletana (piastrelle maiolicate, bancone in legno caldo,
 *   clienti NPC con barra pazienza, piastra a 4 slot con stati crudo/cottura/pronto/bruciato,
 *   2 banchi di assemblaggio con strati del panino visibili e cuochi della squadra).
 * - Espone hit area interattive (tap/click) su clienti, slot griglia, banchi e campana di consegna.
 * - Si distrugge in modo pulito (`game.destroy(true)`) all'uscita da `/game`.
 */
import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { COOK_STATES, getIngredient } from '../data/ingredients.js';
import { getGrillSlotStatus, getMatchPhase } from '../engine/gameEngine.js';

const CANVAS_W = 960;
const CANVAS_H = 430;

function hexToNum(hex, fallback = 0xd96b32) {
  if (typeof hex !== 'string') return fallback;
  const clean = hex.replace('#', '');
  const n = Number.parseInt(clean, 16);
  return Number.isFinite(n) ? n : fallback;
}

export default function KitchenPhaserCanvas({
  snapshot,
  selectedBoardIndex = 0,
  serverTimeOffsetMs = 0,
  reducedMotion = false,
  disabled = false,
  onSelectBoard,
  onSelectTicket,
  onCollectGrill,
  onServeOrder,
  onRemoveLastIngredient,
}) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  const stateRef = useRef({
    snapshot,
    selectedBoardIndex,
    serverTimeOffsetMs,
    reducedMotion,
    disabled,
  });
  const callbacksRef = useRef({
    onSelectBoard,
    onSelectTicket,
    onCollectGrill,
    onServeOrder,
    onRemoveLastIngredient,
  });

  useEffect(() => {
    stateRef.current = {
      snapshot,
      selectedBoardIndex,
      serverTimeOffsetMs,
      reducedMotion,
      disabled,
    };
  }, [snapshot, selectedBoardIndex, serverTimeOffsetMs, reducedMotion, disabled]);

  useEffect(() => {
    callbacksRef.current = {
      onSelectBoard,
      onSelectTicket,
      onCollectGrill,
      onServeOrder,
      onRemoveLastIngredient,
    };
  }, [onSelectBoard, onSelectTicket, onCollectGrill, onServeOrder, onRemoveLastIngredient]);

  useEffect(() => {
    const parentEl = containerRef.current;
    if (!parentEl) return undefined;

    class BancoDelGamberoScene extends Phaser.Scene {
      constructor() {
        super({ key: 'BancoDelGamberoScene' });
        this.bgGraphics = null;
        this.dynamicGraphics = null;
        this.textPool = [];
        this.textCursor = 0;
        this.hitZones = [];
      }

      create() {
        this.bgGraphics = this.add.graphics();
        this.dynamicGraphics = this.add.graphics();
        this.drawStaticKitchenBackdrop();
        this.createInteractiveZones();
      }

      getDynamicText(x, y, content, style = {}) {
        let txt = this.textPool[this.textCursor];
        const mergedStyle = {
          fontFamily: 'Karla, sans-serif',
          fontSize: '13px',
          color: '#3A2A22',
          fontStyle: 'bold',
          ...style,
        };
        if (!txt) {
          txt = this.add.text(x, y, content, mergedStyle);
          this.textPool.push(txt);
        } else {
          txt.setVisible(true);
          txt.setPosition(x, y);
          txt.setText(content);
          txt.setStyle(mergedStyle);
        }
        txt.setOrigin(style.originX ?? 0, style.originY ?? 0);
        this.textCursor += 1;
        return txt;
      }

      drawStaticKitchenBackdrop() {
        const g = this.bgGraphics;
        g.clear();

        // Parete crema calda
        g.fillStyle(0xfff3e2, 1);
        g.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Fascia piastrelle maiolicate napoletane (Vietri / Centro Storico)
        const tileSize = 32;
        for (let x = 0; x < CANVAS_W; x += tileSize) {
          for (let y = 0; y < 185; y += tileSize) {
            const isAlt = ((x / tileSize) + (y / tileSize)) % 2 === 0;
            g.fillStyle(isAlt ? 0xfff9f1 : 0xf7e6ce, 1);
            g.fillRect(x, y, tileSize, tileSize);
            g.lineStyle(1, 0x3a2a22, 0.06);
            g.strokeRect(x, y, tileSize, tileSize);

            // Rombo decorativo discreto
            if ((x / tileSize) % 3 === 0 && (y / tileSize) % 2 === 0) {
              g.fillStyle(0xd96b32, 0.14);
              g.fillCircle(x + tileSize / 2, y + tileSize / 2, 4);
              g.fillStyle(0x5f8f3a, 0.14);
              g.fillCircle(x + tileSize / 2, y + tileSize / 2, 2);
            }
          }
        }

        // Insegna lavagna in alto al centro
        g.fillStyle(0x3a2a22, 1);
        g.fillRoundedRect(290, 8, 380, 34, 10);
        g.lineStyle(2, 0xd96b32, 0.85);
        g.strokeRoundedRect(290, 8, 380, 34, 10);

        // Bancone in legno vissuto (divisione tra sala clienti e cucina)
        g.fillStyle(0x8c5332, 1);
        g.fillRect(0, 176, CANVAS_W, 18);
        g.fillStyle(0x6b3d22, 1);
        g.fillRect(0, 190, CANVAS_W, 6);

        // Pavimento cucina inferiore
        g.fillStyle(0xf5e5d0, 1);
        g.fillRect(0, 196, CANVAS_W, CANVAS_H - 196);

        // Area Piastra in ghisa (sinistra, 4 slot)
        g.fillStyle(0x2c221e, 1);
        g.fillRoundedRect(16, 206, 430, 210, 14);
        g.lineStyle(2, 0x6b564b, 0.6);
        g.strokeRoundedRect(16, 206, 430, 210, 14);

        // Area Banchi di Assemblaggio (destra, 2 banchi condivisi)
        g.fillStyle(0xead4b8, 1);
        g.fillRoundedRect(462, 206, 482, 210, 14);
        g.lineStyle(2, 0x3a2a22, 0.18);
        g.strokeRoundedRect(462, 206, 482, 210, 14);
      }

      createInteractiveZones() {
        // 1. Zone per fino a 6 clienti al bancone (in alto)
        for (let i = 0; i < 6; i += 1) {
          const x = 18 + i * 155;
          const y = 48;
          const zone = this.add
            .zone(x + 72, y + 62, 146, 124)
            .setInteractive({ useHandCursor: true });
          zone.on('pointerdown', () => {
            const st = stateRef.current;
            if (st.disabled) return;
            const tickets = st.snapshot?.game?.activeTickets || [];
            const ticket = tickets[i];
            if (!ticket) return;
            callbacksRef.current.onSelectTicket?.(ticket.id);
          });
          this.hitZones.push(zone);
        }

        // 2. Zone per i 4 slot della piastra (in basso a sinistra)
        for (let idx = 0; idx < 4; idx += 1) {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const sx = 30 + col * 204;
          const sy = 240 + row * 84;
          const zone = this.add
            .zone(sx + 94, sy + 36, 190, 74)
            .setInteractive({ useHandCursor: true });
          zone.on('pointerdown', () => {
            const st = stateRef.current;
            if (st.disabled) return;
            callbacksRef.current.onCollectGrill?.(idx);
          });
          this.hitZones.push(zone);
        }

        // 3. Zone per i 2 Banchi di Assemblaggio + pulsanti rapidi "Togli" e "Consegna"
        for (let bIdx = 0; bIdx < 2; bIdx += 1) {
          const bx = 476 + bIdx * 232;
          const by = 236;

          // Selezione banco
          const selectZone = this.add
            .zone(bx + 108, by + 62, 218, 124)
            .setInteractive({ useHandCursor: true });
          selectZone.on('pointerdown', () => {
            const st = stateRef.current;
            if (st.disabled) return;
            callbacksRef.current.onSelectBoard?.(bIdx);
          });
          this.hitZones.push(selectZone);

          // Bottone "Togli ultimo" sul canvas
          const undoZone = this.add
            .zone(bx + 48, by + 152, 92, 34)
            .setInteractive({ useHandCursor: true });
          undoZone.on('pointerdown', () => {
            const st = stateRef.current;
            if (st.disabled) return;
            callbacksRef.current.onSelectBoard?.(bIdx);
            callbacksRef.current.onRemoveLastIngredient?.(bIdx);
          });
          this.hitZones.push(undoZone);

          // Bottone "Consegna" sul canvas
          const serveZone = this.add
            .zone(bx + 158, by + 152, 114, 34)
            .setInteractive({ useHandCursor: true });
          serveZone.on('pointerdown', () => {
            const st = stateRef.current;
            if (st.disabled) return;
            callbacksRef.current.onSelectBoard?.(bIdx);
            callbacksRef.current.onServeOrder?.(bIdx);
          });
          this.hitZones.push(serveZone);
        }
      }

      update(time) {
        this.textCursor = 0;
        const g = this.dynamicGraphics;
        g.clear();

        const {
          snapshot: snap,
          selectedBoardIndex: activeBoard,
          serverTimeOffsetMs: offsetMs,
          reducedMotion: noMotion,
        } = stateRef.current;

        const game = snap?.game;
        const nowMs = Date.now() + (offsetMs || 0);
        const elapsedMs = game?.startedAtMs ? Math.max(0, nowMs - game.startedAtMs) : 0;
        const phase = getMatchPhase(elapsedMs);

        // Header Insegna
        this.getDynamicText(480, 25, `BANCO DEL GAMBERO · ${phase.label.toUpperCase()}`, {
          fontFamily: 'Fraunces, Georgia, serif',
          fontSize: '14px',
          color: '#FFF3E2',
          originX: 0.5,
          originY: 0.5,
        });

        // Badge Combo squadra se attivo
        if ((game?.combo || 0) >= 2) {
          g.fillStyle(0xe39a2d, 1);
          g.fillRoundedRect(700, 10, 128, 30, 8);
          this.getDynamicText(764, 25, `COMBO SQUADRA ×${game.combo}`, {
            fontSize: '12px',
            color: '#3A2A22',
            originX: 0.5,
            originY: 0.5,
          });
        }

        // Indicatori cuochi attivi in alto a sinistra
        const players = snap?.players || [];
        players.slice(0, 4).forEach((p, idx) => {
          const px = 28 + idx * 64;
          const py = 24;
          g.fillStyle(p.isOnline ? 0x5f8f3a : 0x6b564b, 1);
          g.fillCircle(px, py, 12);
          g.lineStyle(2, 0xfff9f1, 1);
          g.strokeCircle(px, py, 12);
          this.getDynamicText(px, py, (p.nickname || 'C').slice(0, 2).toUpperCase(), {
            fontSize: '11px',
            color: '#FFF9F1',
            originX: 0.5,
            originY: 0.5,
          });
        });

        // --- 1. DISEGNO CLIENTI AL BANCONE ---
        const tickets = game?.activeTickets || [];
        const boardTargetId = game?.prepBoards?.[activeBoard]?.targetTicketId;

        for (let i = 0; i < 6; i += 1) {
          const tkt = tickets[i];
          const x = 18 + i * 155;
          const y = 48;

          if (!tkt) {
            g.lineStyle(1, 0x3a2a22, 0.1);
            g.strokeRoundedRect(x, y, 146, 122, 12);
            this.getDynamicText(x + 73, y + 61, 'Posto libero', {
              fontSize: '12px',
              color: '#8C7A70',
              originX: 0.5,
              originY: 0.5,
            });
            continue;
          }

          const isSelected = tkt.id === boardTargetId;
          const remMs = Math.max(0, tkt.expiresAtMs - nowMs);
          const ratio = tkt.patienceMs > 0 ? Math.min(1, remMs / tkt.patienceMs) : 0;
          const barColor =
            ratio > 0.5 ? 0x5f8f3a : ratio > 0.25 ? 0xe39a2d : 0xb23b2e;

          const bobY = noMotion ? 0 : Math.sin(time / 280 + i) * 2;

          // Card cliente sul bancone
          g.fillStyle(isSelected ? 0xfff9f1 : 0xfdf5e8, 1);
          g.fillRoundedRect(x, y, 146, 122, 12);
          g.lineStyle(isSelected ? 3 : 1.5, isSelected ? 0xd96b32 : 0x3a2a22, isSelected ? 1 : 0.22);
          g.strokeRoundedRect(x, y, 146, 122, 12);

          // Avatar busto NPC
          const app = tkt.appearance || {};
          g.fillStyle(hexToNum(app.jacketHex, 0x4a6b82), 1);
          g.fillRoundedRect(x + 12, y + 36 + bobY, 34, 24, 6);
          g.fillStyle(hexToNum(app.skinHex, 0xe3b18a), 1);
          g.fillCircle(x + 29, y + 25 + bobY, 12);
          g.fillStyle(hexToNum(app.hairHex, 0x3a2a22), 1);
          g.fillRect(x + 18, y + 13 + bobY, 22, 6);

          // Nome + Archetipo
          this.getDynamicText(x + 52, y + 12, tkt.customerName, {
            fontSize: '13px',
            color: '#3A2A22',
          });
          this.getDynamicText(x + 52, y + 28, tkt.badgeLabel, {
            fontSize: '11px',
            color: '#BB5A20',
          });

          // Nome ricetta richiesta
          const isThinking = Boolean(tkt.thinkingUntilMs && nowMs < tkt.thinkingUntilMs);
          this.getDynamicText(
            x + 10,
            y + 64,
            isThinking ? 'Sta scegliendo…' : tkt.recipeName,
            {
              fontSize: '12px',
              color: isThinking ? '#6B564B' : '#3A2A22',
              wordWrap: { width: 128 },
            },
          );

          // Nota modificatore visibile
          let modNote = '';
          if (tkt.modifiers?.exclude) {
            const exIng = getIngredient(tkt.modifiers.exclude);
            modNote = `SENZA ${exIng?.shortName || tkt.modifiers.exclude}`;
          } else if (tkt.modifiers?.add) {
            const addIng = getIngredient(tkt.modifiers.add);
            modNote = `EXTRA ${addIng?.shortName || tkt.modifiers.add}`;
          } else if (tkt.modifiers?.swap) {
            const toIng = getIngredient(tkt.modifiers.swap.to);
            modNote = `CON ${toIng?.shortName || tkt.modifiers.swap.to}`;
          }
          if (modNote) {
            this.getDynamicText(x + 10, y + 83, modNote, {
              fontSize: '10px',
              color: '#B23B2E',
            });
          }

          // Barra pazienza
          g.fillStyle(0xe5d6c3, 1);
          g.fillRoundedRect(x + 10, y + 102, 126, 10, 5);
          g.fillStyle(barColor, 1);
          g.fillRoundedRect(x + 10, y + 102, Math.max(8, Math.round(126 * ratio)), 10, 5);
        }

        // --- 2. DISEGNO PIASTRA A 4 SLOT ---
        this.getDynamicText(30, 214, 'PIASTRA ROVENTE (4 SLOT) · Tocca quando è PRONTO', {
          fontSize: '12px',
          color: '#FFF3E2',
        });

        const grillSlots = game?.grillSlots || [];
        for (let idx = 0; idx < 4; idx += 1) {
          const slot = grillSlots[idx] || { slotIndex: idx, ingredientId: null };
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const sx = 30 + col * 204;
          const sy = 240 + row * 84;

          const status = getGrillSlotStatus(slot, nowMs);
          let borderCol = 0x6b564b;
          let bgCol = 0x3b2f2a;
          if (status.state === COOK_STATES.COOKING) {
            borderCol = 0xe39a2d;
            bgCol = 0x4a3528;
          } else if (status.state === COOK_STATES.COOKED) {
            borderCol = 0x5f8f3a;
            bgCol = 0x2f4728;
          } else if (status.state === COOK_STATES.BURNED) {
            borderCol = 0xb23b2e;
            bgCol = 0x421d1a;
          }

          g.fillStyle(bgCol, 1);
          g.fillRoundedRect(sx, sy, 190, 74, 10);
          g.lineStyle(2, borderCol, 1);
          g.strokeRoundedRect(sx, sy, 190, 74, 10);

          if (!slot.ingredientId) {
            this.getDynamicText(sx + 95, sy + 37, `Slot ${idx + 1} · Libero`, {
              fontSize: '12px',
              color: '#B8A69B',
              originX: 0.5,
              originY: 0.5,
            });
          } else {
            const ing = getIngredient(slot.ingredientId);
            const pattyCol =
              status.state === COOK_STATES.BURNED
                ? 0x1f1715
                : hexToNum(ing?.color, 0x8a4233);

            g.fillStyle(pattyCol, 1);
            g.fillCircle(sx + 32, sy + 36, 18);
            g.lineStyle(2, 0xfff3e2, 0.5);
            g.strokeCircle(sx + 32, sy + 36, 18);

            this.getDynamicText(sx + 58, sy + 14, ing?.shortName || slot.ingredientId, {
              fontSize: '13px',
              color: '#FFF9F1',
            });

            const stateLabel =
              status.state === COOK_STATES.COOKING
                ? `In cottura (${(status.remainingMs / 1000).toFixed(1)}s)`
                : status.state === COOK_STATES.COOKED
                  ? 'PRONTO! Tocca per usare'
                  : 'BRUCIATO! Tocca (-15)';

            this.getDynamicText(sx + 58, sy + 33, stateLabel, {
              fontSize: '11px',
              color:
                status.state === COOK_STATES.COOKED
                  ? '#A9E37B'
                  : status.state === COOK_STATES.BURNED
                    ? '#FF9488'
                    : '#F7D08A',
            });

            // Barra progresso cottura / bruciatura
            const prog =
              status.state === COOK_STATES.COOKING
                ? status.progress
                : status.state === COOK_STATES.COOKED
                  ? 1 - status.burnProgress
                  : 1;
            g.fillStyle(0x1f1715, 1);
            g.fillRoundedRect(sx + 58, sy + 53, 118, 8, 4);
            g.fillStyle(borderCol, 1);
            g.fillRoundedRect(sx + 58, sy + 53, Math.max(6, Math.round(118 * prog)), 8, 4);
          }
        }

        // --- 3. DISEGNO DEI 2 BANCHI DI ASSEMBLAGGIO CONDIVISI ---
        this.getDynamicText(476, 214, 'BANCHI DI ASSEMBLAGGIO CONDIVISI', {
          fontSize: '12px',
          color: '#3A2A22',
        });

        const boards = game?.prepBoards || [];
        for (let bIdx = 0; bIdx < 2; bIdx += 1) {
          const board = boards[bIdx] || { boardIndex: bIdx, ingredients: [], targetTicketId: null };
          const bx = 476 + bIdx * 232;
          const by = 236;
          const isCurrent = bIdx === activeBoard;

          g.fillStyle(isCurrent ? 0xfff9f1 : 0xf5e8d6, 1);
          g.fillRoundedRect(bx, by, 218, 128, 12);
          g.lineStyle(isCurrent ? 3 : 1.5, isCurrent ? 0xd96b32 : 0x3a2a22, isCurrent ? 1 : 0.25);
          g.strokeRoundedRect(bx, by, 218, 128, 12);

          const linkedTicket = tickets.find((t) => t.id === board.targetTicketId);
          this.getDynamicText(
            bx + 12,
            by + 10,
            `BANCO ${bIdx + 1} ${linkedTicket ? `→ ${linkedTicket.customerName}` : ''}`,
            {
              fontSize: '12px',
              color: isCurrent ? '#BB5A20' : '#3A2A22',
            },
          );

          // Piatto / Tagliere centrale con gli strati del panino
          g.fillStyle(0xe2c49f, 1);
          g.fillEllipse(bx + 109, by + 95, 130, 26);

          const ings = board.ingredients || [];
          if (ings.length === 0) {
            this.getDynamicText(bx + 109, by + 68, 'Vuoto · Aggiungi pane e farcitura', {
              fontSize: '11px',
              color: '#8C7A70',
              originX: 0.5,
              originY: 0.5,
            });
          } else {
            ings.forEach((ingId, layerIdx) => {
              const ing = getIngredient(ingId);
              const ly = by + 88 - layerIdx * 9;
              g.fillStyle(hexToNum(ing?.color, 0xd96b32), 1);
              g.fillRoundedRect(bx + 54, ly, 110, 10, 5);
              g.lineStyle(1, 0x3a2a22, 0.45);
              g.strokeRoundedRect(bx + 54, ly, 110, 10, 5);
            });
            this.getDynamicText(bx + 12, by + 106, `${ings.length} ingr. sul tagliere`, {
              fontSize: '11px',
              color: '#3A2A22',
            });
          }

          // Pulsante Togli ultimo
          g.fillStyle(0xfff3e2, 1);
          g.fillRoundedRect(bx + 2, by + 135, 92, 34, 8);
          g.lineStyle(1.5, 0x3a2a22, 0.25);
          g.strokeRoundedRect(bx + 2, by + 135, 92, 34, 8);
          this.getDynamicText(bx + 48, by + 152, 'Togli ultimo', {
            fontSize: '11px',
            color: '#3A2A22',
            originX: 0.5,
            originY: 0.5,
          });

          // Pulsante Consegna
          g.fillStyle(0xbb5a20, 1);
          g.fillRoundedRect(bx + 101, by + 135, 114, 34, 8);
          this.getDynamicText(bx + 158, by + 152, 'Consegna panino', {
            fontSize: '11px',
            color: '#FFF9F1',
            originX: 0.5,
            originY: 0.5,
          });
        }
      }
    }

    const config = {
      type: Phaser.CANVAS,
      parent: parentEl,
      width: CANVAS_W,
      height: CANVAS_H,
      backgroundColor: '#FFF3E2',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
      },
      scene: [BancoDelGamberoScene],
      audio: { noAudio: true },
      banner: false,
    };

    const instance = new Phaser.Game(config);
    gameRef.current = instance;

    return () => {
      if (gameRef.current) {
        try {
          gameRef.current.destroy(true);
        } catch {
          // ignore cleanup errors
        }
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className="surface overflow-hidden border border-brown/15 bg-cream-soft p-2 shadow-sm"
      aria-label="Vista interattiva della cucina Il Banco del Gambero"
    >
      <div
        ref={containerRef}
        className="w-full overflow-hidden rounded-xl"
        style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
      />
    </div>
  );
}
