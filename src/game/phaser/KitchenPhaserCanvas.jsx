/**
 * Panorama interattivo 2D in Phaser 4 per "Il Banco del Gambero".
 * Progettato come fascia panoramica compatta (`960×230`) che rappresenta in tempo reale
 * la paninoteca napoletana senza duplicare i pannelli testuali né spingere i comandi fuori schermo:
 * - Zona Sinistra: Bancone maiolicato con i clienti in attesa (volto con espressione reale
 *   legata alla pazienza, fumetto ordine, badge Banco 1/2 collegato).
 * - Zona Centrale: Piastra in ghisa a 4 fuochi (stati Libero / Sfrigola / Pronto / Sta bruciando! / Bruciato)
 *   + contatore del Vassoio Caldo condiviso.
 * - Zona Destra: I 2 Taglieri condivisi (Banco 1 e Banco 2) con il panino che cresce a strati,
 *   il cuoco della brigata al lavoro e il segnale verde "PRONTO! SERVI" quando la ricetta è completa.
 */
import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { COOK_STATES, getIngredient } from '../data/ingredients.js';
import {
  getGrillSlotStatus,
  getMatchPhase,
  getScalingForPlayers,
  inspectBoardAgainstTicket,
} from '../engine/gameEngine.js';

const CANVAS_W = 960;
const CANVAS_H = 228;

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
    };
  }, [onSelectBoard, onSelectTicket, onCollectGrill, onServeOrder]);

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
          fontSize: '12px',
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

        // Parete maiolicata calda
        g.fillStyle(0xfff3e2, 1);
        g.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const tileSize = 28;
        for (let x = 0; x < CANVAS_W; x += tileSize) {
          for (let y = 0; y < 84; y += tileSize) {
            const isAlt = ((x / tileSize) + (y / tileSize)) % 2 === 0;
            g.fillStyle(isAlt ? 0xfff9f1 : 0xf6e4cb, 1);
            g.fillRect(x, y, tileSize, tileSize);
            g.lineStyle(1, 0x3a2a22, 0.05);
            g.strokeRect(x, y, tileSize, tileSize);
          }
        }

        // Bancone in legno massello che attraversa la paninoteca
        g.fillStyle(0x8c5332, 1);
        g.fillRect(0, 80, CANVAS_W, 10);
        g.fillStyle(0x6b3d22, 1);
        g.fillRect(0, 88, CANVAS_W, 4);

        // Area 1: Sala & Bancone Clienti (Sinistra: x 10..426)
        g.fillStyle(0xfdf5e8, 1);
        g.fillRoundedRect(10, 10, 418, 208, 12);
        g.lineStyle(1.5, 0x3a2a22, 0.16);
        g.strokeRoundedRect(10, 10, 418, 208, 12);

        // Area 2: Piastra in Ghisa a 4 Fuochi (Centro: x 438..688)
        g.fillStyle(0x281f1b, 1);
        g.fillRoundedRect(438, 10, 250, 208, 12);
        g.lineStyle(2, 0x5a473e, 0.8);
        g.strokeRoundedRect(438, 10, 250, 208, 12);

        // Area 3: Banchi Tagliere & Pass Consegna (Destra: x 700..950)
        g.fillStyle(0xecd8be, 1);
        g.fillRoundedRect(700, 10, 250, 208, 12);
        g.lineStyle(1.5, 0x3a2a22, 0.2);
        g.strokeRoundedRect(700, 10, 250, 208, 12);
      }

      createInteractiveZones() {
        // 1. Zone interattive per fino a 6 clienti (griglia 3x2 a sinistra)
        for (let i = 0; i < 6; i += 1) {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const cx = 18 + col * 134;
          const cy = 36 + row * 88;
          const zone = this.add
            .zone(cx + 64, cy + 40, 128, 80)
            .setInteractive({ useHandCursor: true });
          zone.on('pointerdown', () => {
            const st = stateRef.current;
            if (st.disabled) return;
            const tickets = st.snapshot?.game?.activeTickets || [];
            const ticket = tickets[i];
            if (!ticket) return;
            const board = st.snapshot?.game?.prepBoards?.[st.selectedBoardIndex];
            const check = inspectBoardAgainstTicket(board?.ingredients || [], ticket);
            if (check.ok && !(ticket.thinkingUntilMs && Date.now() + st.serverTimeOffsetMs < ticket.thinkingUntilMs)) {
              callbacksRef.current.onServeOrder?.(st.selectedBoardIndex, ticket.id);
            } else {
              callbacksRef.current.onSelectTicket?.(ticket.id);
            }
          });
          this.hitZones.push(zone);
        }

        // 2. Zone interattive per i 4 fuochi della piastra (centro)
        for (let idx = 0; idx < 4; idx += 1) {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const sx = 448 + col * 118;
          const sy = 38 + row * 74;
          const zone = this.add
            .zone(sx + 56, sy + 33, 112, 66)
            .setInteractive({ useHandCursor: true });
          zone.on('pointerdown', () => {
            const st = stateRef.current;
            if (st.disabled) return;
            callbacksRef.current.onCollectGrill?.(idx);
          });
          this.hitZones.push(zone);
        }

        // 3. Zone interattive per i 2 Taglieri Condivisi (destra)
        for (let bIdx = 0; bIdx < 2; bIdx += 1) {
          const bx = 710 + bIdx * 118;
          const by = 38;
          const zone = this.add
            .zone(bx + 56, by + 84, 112, 168)
            .setInteractive({ useHandCursor: true });
          zone.on('pointerdown', () => {
            const st = stateRef.current;
            if (st.disabled) return;
            callbacksRef.current.onSelectBoard?.(bIdx);
            const board = st.snapshot?.game?.prepBoards?.[bIdx];
            const tickets = st.snapshot?.game?.activeTickets || [];
            const linked = tickets.find((t) => t.id === board?.targetTicketId) || tickets[0];
            if (linked && inspectBoardAgainstTicket(board?.ingredients || [], linked).ok) {
              callbacksRef.current.onServeOrder?.(bIdx, linked.id);
            }
          });
          this.hitZones.push(zone);
        }
      }

      update(time) {
        for (let i = 0; i < this.textPool.length; i += 1) {
          this.textPool[i].setVisible(false);
        }
        this.textCursor = 0;
        const g = this.dynamicGraphics;
        g.clear();

        const {
          snapshot: snap,
          selectedBoardIndex: activeBoardIdx,
          serverTimeOffsetMs: offsetMs,
          reducedMotion: noMotion,
        } = stateRef.current;

        const game = snap?.game;
        const players = snap?.players || [];
        const nowMs = Date.now() + (offsetMs || 0);
        const elapsedMs = game?.startedAtMs ? Math.max(0, nowMs - game.startedAtMs) : 0;
        const phase = getMatchPhase(elapsedMs);
        const maxSlots = getScalingForPlayers(game?.playerCount || players.length || 1).maxActiveTickets;

        // --- INTESTAZIONE COLONNA 1: SALA & CLIENTI ---
        this.getDynamicText(
          20,
          16,
          `SALA & COMANDE (${(game?.activeTickets || []).length}/${maxSlots}) · ${phase.label}`,
          { fontSize: '11px', color: '#6B564B' },
        );

        const tickets = game?.activeTickets || [];
        const boards = game?.prepBoards || [];

        for (let i = 0; i < 6; i += 1) {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const cx = 18 + col * 134;
          const cy = 36 + row * 88;
          const tkt = tickets[i];

          if (i >= maxSlots) {
            continue;
          }

          if (!tkt) {
            g.lineStyle(1, 0x3a2a22, 0.12);
            g.strokeRoundedRect(cx, cy, 128, 80, 10);
            this.getDynamicText(cx + 64, cy + 40, `Posto #${i + 1} libero`, {
              fontSize: '11px',
              color: '#8C7A70',
              originX: 0.5,
              originY: 0.5,
            });
            continue;
          }

          const linkedBoardIdx = boards.findIndex((b) => b.targetTicketId === tkt.id);
          const boardForCheck =
            linkedBoardIdx !== -1 ? boards[linkedBoardIdx] : boards[activeBoardIdx];
          const check = inspectBoardAgainstTicket(boardForCheck?.ingredients || [], tkt);
          const isReadyToServe = check.ok;
          const isSelected = linkedBoardIdx === activeBoardIdx || (linkedBoardIdx === -1 && i === 0);

          const remMs = Math.max(0, tkt.expiresAtMs - nowMs);
          const ratio = tkt.patienceMs > 0 ? Math.min(1, remMs / tkt.patienceMs) : 0;
          const isThinking = Boolean(tkt.thinkingUntilMs && nowMs < tkt.thinkingUntilMs);
          const barColor =
            ratio > 0.55 ? 0x5f8f3a : ratio > 0.28 ? 0xe39a2d : 0xb23b2e;

          const bobY = noMotion ? 0 : Math.sin(time / 260 + i) * 1.5;

          // Sfondo card cliente
          g.fillStyle(isReadyToServe ? 0xe9f5e1 : isSelected ? 0xfff9f1 : 0xf7ebd9, 1);
          g.fillRoundedRect(cx, cy, 128, 80, 10);
          g.lineStyle(
            isReadyToServe || isSelected ? 2.5 : 1.2,
            isReadyToServe ? 0x5f8f3a : isSelected ? 0xd96b32 : 0x3a2a22,
            isReadyToServe || isSelected ? 1 : 0.22,
          );
          g.strokeRoundedRect(cx, cy, 128, 80, 10);

          // Avatar Cliente con volto ed espressione reale (sorriso / neutro / arrabbiato)
          const app = tkt.appearance || {};
          const headX = cx + 22;
          const headY = cy + 24 + bobY;
          g.fillStyle(hexToNum(app.jacketHex, 0x4a6b82), 1);
          g.fillRoundedRect(cx + 8, cy + 32 + bobY, 28, 16, 5);
          g.fillStyle(hexToNum(app.skinHex, 0xe3b18a), 1);
          g.fillCircle(headX, headY, 10);
          g.lineStyle(1.4, 0x3a2a22, 0.85);
          g.strokeCircle(headX, headY, 10);
          // Capelli
          g.fillStyle(hexToNum(app.hairHex, 0x3a2a22), 1);
          g.fillRoundedRect(headX - 10, headY - 11, 20, 6, 3);
          // Occhi
          g.fillStyle(0x3a2a22, 1);
          g.fillCircle(headX - 3.5, headY - 1, 1.3);
          g.fillCircle(headX + 3.5, headY - 1, 1.3);
          // Bocca (felice / seria / arrabbiata)
          g.lineStyle(1.5, ratio <= 0.28 ? 0xb23b2e : 0x3a2a22, 1);
          if (ratio > 0.55) {
            g.beginPath();
            g.arc(headX, headY + 2, 3.5, 0.2, Math.PI - 0.2, false);
            g.strokePath();
          } else if (ratio > 0.28) {
            g.lineBetween(headX - 3, headY + 4, headX + 3, headY + 4);
          } else {
            g.beginPath();
            g.arc(headX, headY + 6, 3.5, Math.PI + 0.2, -0.2, false);
            g.strokePath();
          }

          // Nome, Timer e Badge Banco
          this.getDynamicText(cx + 40, cy + 7, `#${i + 1} ${tkt.customerName}`, {
            fontSize: '11px',
            color: '#3A2A22',
          });
          this.getDynamicText(cx + 122, cy + 7, `${Math.ceil(remMs / 1000)}s`, {
            fontSize: '11px',
            color: ratio <= 0.28 ? '#B23B2E' : '#3A2A22',
            originX: 1,
          });

          if (linkedBoardIdx !== -1) {
            g.fillStyle(linkedBoardIdx === 0 ? 0xd96b32 : 0x385c32, 1);
            g.fillRoundedRect(cx + 40, cy + 22, 42, 14, 4);
            this.getDynamicText(cx + 61, cy + 29, `BANCO ${linkedBoardIdx + 1}`, {
              fontSize: '9px',
              color: '#FFF9F1',
              originX: 0.5,
              originY: 0.5,
            });
          } else {
            this.getDynamicText(cx + 40, cy + 22, tkt.badgeLabel, {
              fontSize: '10px',
              color: '#BB5A20',
            });
          }

          // Ricetta o invito alla consegna immediata
          const orderLabel = isReadyToServe
            ? '✓ PRONTO! Tocca e servi'
            : isThinking
              ? '💭 Sta scegliendo…'
              : tkt.recipeName;
          this.getDynamicText(cx + 8, cy + 49, orderLabel, {
            fontSize: '11px',
            color: isReadyToServe ? '#2F6B22' : isThinking ? '#6B564B' : '#3A2A22',
          });

          // Barra pazienza
          g.fillStyle(0xe5d6c3, 1);
          g.fillRoundedRect(cx + 8, cy + 66, 112, 7, 3.5);
          g.fillStyle(barColor, 1);
          g.fillRoundedRect(cx + 8, cy + 66, Math.max(6, Math.round(112 * ratio)), 7, 3.5);
        }

        // --- INTESTAZIONE COLONNA 2: PIASTRA ROVENTE (4 FUOCHI) + VASSOIO CALDO ---
        this.getDynamicText(448, 16, 'PIASTRA IN GHISA (4 FUOCHI)', {
          fontSize: '11px',
          color: '#FFF3E2',
        });

        const grillSlots = game?.grillSlots || [];
        for (let idx = 0; idx < 4; idx += 1) {
          const slot = grillSlots[idx] || { slotIndex: idx, ingredientId: null };
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const sx = 448 + col * 118;
          const sy = 38 + row * 72;

          const status = getGrillSlotStatus(slot, nowMs);
          let borderCol = 0x5a473e;
          let bgCol = 0x362b26;
          if (status.state === COOK_STATES.COOKING) {
            borderCol = 0xe39a2d;
            bgCol = 0x4a3528;
          } else if (status.state === COOK_STATES.COOKED && status.aboutToBurn) {
            borderCol = 0xff6b4a;
            bgCol = 0x54281f;
          } else if (status.state === COOK_STATES.COOKED) {
            borderCol = 0x5f8f3a;
            bgCol = 0x294224;
          } else if (status.state === COOK_STATES.BURNED) {
            borderCol = 0xb23b2e;
            bgCol = 0x421d1a;
          }

          g.fillStyle(bgCol, 1);
          g.fillRoundedRect(sx, sy, 112, 66, 9);
          g.lineStyle(2, borderCol, 1);
          g.strokeRoundedRect(sx, sy, 112, 66, 9);

          const keyHint = ['Q', 'W', 'E', 'R'][idx];
          if (!slot.ingredientId) {
            this.getDynamicText(sx + 56, sy + 33, `Fuoco ${idx + 1} [${keyHint}]`, {
              fontSize: '11px',
              color: '#A9998E',
              originX: 0.5,
              originY: 0.5,
            });
          } else {
            const ing = getIngredient(slot.ingredientId);
            const pattyCol =
              status.state === COOK_STATES.BURNED
                ? 0x1a1311
                : hexToNum(ing?.color, 0x8a4233);
            g.fillStyle(pattyCol, 1);
            g.fillCircle(sx + 20, sy + 24, 11);
            g.lineStyle(1.5, 0xfff3e2, 0.65);
            g.strokeCircle(sx + 20, sy + 24, 11);

            this.getDynamicText(sx + 36, sy + 9, ing?.shortName || slot.ingredientId, {
              fontSize: '11px',
              color: '#FFF9F1',
            });

            const stateText =
              status.state === COOK_STATES.COOKING
                ? `${(status.remainingMs / 1000).toFixed(1)}s`
                : status.state === COOK_STATES.COOKED && status.aboutToBurn
                  ? 'ATTENTO!'
                  : status.state === COOK_STATES.COOKED
                    ? 'PRONTO!'
                    : 'BRUCIATO';

            this.getDynamicText(sx + 36, sy + 24, stateText, {
              fontSize: '10px',
              color:
                status.state === COOK_STATES.COOKED && !status.aboutToBurn
                  ? '#A9E37B'
                  : status.state === COOK_STATES.COOKING
                    ? '#F7D08A'
                    : '#FF9488',
            });

            const prog =
              status.state === COOK_STATES.COOKING
                ? status.progress
                : status.state === COOK_STATES.COOKED
                  ? 1 - status.burnProgress
                  : 1;
            g.fillStyle(0x1a1311, 1);
            g.fillRoundedRect(sx + 10, sy + 49, 92, 7, 3.5);
            g.fillStyle(borderCol, 1);
            g.fillRoundedRect(sx + 10, sy + 49, Math.max(5, Math.round(92 * prog)), 7, 3.5);
          }
        }

        // Striscia Vassoio Caldo sotto i 4 fuochi
        const trayItems = game?.cookedTray || [];
        g.fillStyle(0x3a2d27, 1);
        g.fillRoundedRect(448, 184, 230, 26, 7);
        this.getDynamicText(
          458,
          197,
          `Vassoio Caldo: ${trayItems.length}/6 pronti`,
          {
            fontSize: '11px',
            color: trayItems.length > 0 ? '#A9E37B' : '#C9B8AC',
            originY: 0.5,
          },
        );

        // --- INTESTAZIONE COLONNA 3: I 2 TAGLIERI CONDIVISI ---
        this.getDynamicText(710, 16, 'TAGLIERI DI ASSEMBLAGGIO', {
          fontSize: '11px',
          color: '#3A2A22',
        });

        for (let bIdx = 0; bIdx < 2; bIdx += 1) {
          const board = boards[bIdx] || { boardIndex: bIdx, ingredients: [], targetTicketId: null };
          const bx = 710 + bIdx * 118;
          const by = 38;
          const isCurrent = bIdx === activeBoardIdx;
          const linkedTicket = tickets.find((t) => t.id === board.targetTicketId) || null;
          const analysis = inspectBoardAgainstTicket(board.ingredients || [], linkedTicket);
          const chef = players.find((p) => p.id === board.updatedByPlayerId);

          g.fillStyle(
            analysis.ok ? 0xe9f5e1 : isCurrent ? 0xfff9f1 : 0xf6ead8,
            1,
          );
          g.fillRoundedRect(bx, by, 112, 172, 10);
          g.lineStyle(
            analysis.ok || isCurrent ? 2.5 : 1.4,
            analysis.ok ? 0x5f8f3a : isCurrent ? 0xd96b32 : 0x3a2a22,
            analysis.ok || isCurrent ? 1 : 0.25,
          );
          g.strokeRoundedRect(bx, by, 112, 172, 10);

          this.getDynamicText(bx + 10, by + 8, `BANCO ${bIdx + 1}`, {
            fontSize: '11px',
            color: isCurrent ? '#BB5A20' : '#3A2A22',
          });

          this.getDynamicText(
            bx + 10,
            by + 23,
            linkedTicket ? `Per ${linkedTicket.customerName}` : 'Nessun cliente',
            {
              fontSize: '10px',
              color: '#6B564B',
            },
          );

          // Tagliere in legno + pila panino
          g.fillStyle(0xd8b48a, 1);
          g.fillEllipse(bx + 56, by + 118, 88, 18);

          const ings = board.ingredients || [];
          if (ings.length === 0) {
            this.getDynamicText(bx + 56, by + 82, 'Tagliere vuoto', {
              fontSize: '10px',
              color: '#8C7A70',
              originX: 0.5,
              originY: 0.5,
            });
          } else {
            ings.slice(0, 7).forEach((ingId, layerIdx) => {
              const ing = getIngredient(ingId);
              const isExtra = analysis.assembledLayers[layerIdx]?.isExtra;
              const ly = by + 110 - layerIdx * 9;
              g.fillStyle(isExtra ? 0xb23b2e : hexToNum(ing?.color, 0xd96b32), 1);
              g.fillRoundedRect(bx + 20, ly, 72, 9, 4);
              g.lineStyle(1, 0x3a2a22, 0.5);
              g.strokeRoundedRect(bx + 20, ly, 72, 9, 4);
            });
          }

          // Stato sintetico del tagliere in basso
          const statusLabel = analysis.ok
            ? '✓ SERVI ORA!'
            : analysis.status === 'has_errors'
              ? '⚠ Errore ingr.'
              : chef
                ? `Cuoco: ${chef.nickname.slice(0, 8)}`
                : `${ings.length} strati`;

          g.fillStyle(
            analysis.ok ? 0x5f8f3a : analysis.status === 'has_errors' ? 0xb23b2e : 0xead8c0,
            1,
          );
          g.fillRoundedRect(bx + 8, by + 138, 96, 24, 6);
          this.getDynamicText(bx + 56, by + 150, statusLabel, {
            fontSize: '10px',
            color: analysis.ok || analysis.status === 'has_errors' ? '#FFF9F1' : '#3A2A22',
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
      className="surface overflow-hidden border border-brown/15 bg-cream-soft p-1.5 shadow-xs"
      aria-label="Panorama animato del bancone Il Banco del Gambero"
    >
      <div
        ref={containerRef}
        className="w-full overflow-hidden rounded-xl"
        style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
      />
    </div>
  );
}
