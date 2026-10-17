/**
 * Scena interattiva 2.5D in Phaser 4 per "Il Banco del Gambero" (`1280×510`).
 *
 * Architettura visiva e spaziale (camera dal bancone verso la sala e il vicolo napoletano):
 * 1. Sullo sfondo (`y: 0..242`): Sala della paninoteca con ingresso ad arco sul vicolo
 *    soleggiato (`sala_vicolo_bg.jpg`), scaffali con vasi, moka, rame e piastrelle vietresi.
 *    I clienti (`customer_01`..`customer_08`) sono in piedi davanti al bancone con espressione
 *    e posa dinamiche (`happy`, `thinking`, `impatient`, `angry`, `ready`) e con il proprio
 *    Ticket Comanda illustrato accanto (piatto finito 2.5D, icone ingredienti spuntati,
 *    modificatori `SENZA` / `EXTRA` / `CON`, barra pazienza verticale).
 * 2. In primo piano (`y: 242..510`): Unico bancone continuo in legno scuro consumato,
 *    fregio in maiolica vietrese, acciaio spazzolato e ghisa:
 *    - Stazione Sinistra: Piastra in Ghisa a 4 grandi fuochi (con texture reali crudo/cotto/bruciato,
 *      vapore, avviso pre-bruciatura, fumo) + 4 vaschette proteine crude + Vassoio Caldo condiviso.
 *    - Stazione Centrale: I 2 Taglieri in legno d'ulivo (`Banco 1` e `Banco 2`) con il panino
 *      che cresce visivamente strato per strato, l'indicatore del cuoco di brigata e il
 *      campanello d'ottone del Pass per consegnare.
 *    - Stazione Destra: Vaschette Gastronorm degli ingredienti richiesti dalla comanda attiva,
 *      cliccabili direttamente sul piano di lavoro.
 */
import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import {
  COOK_STATES,
  getIngredient,
  GRILLABLE_INGREDIENTS,
  INGREDIENTS,
} from '../data/ingredients.js';
import { RECIPES } from '../data/recipes.js';
import { CHEF_PERSONAS, getBrigadeRole } from '../data/characters.js';
import {
  GAME_ART_MANIFEST,
  getChefArtUrl,
  getCustomerArtUrl,
  getIngredientArtUrl,
  getRecipeArtUrl,
} from '../data/artManifest.js';
import {
  getGrillSlotStatus,
  getMatchPhase,
  getScalingForPlayers,
  inspectBoardAgainstTicket,
} from '../engine/gameEngine.js';

const CANVAS_W = 1280;
const CANVAS_H = 510;

function hexToNum(hex, fallback = 0xd96b32) {
  if (typeof hex !== 'string') return fallback;
  const clean = hex.replace('#', '');
  const n = Number.parseInt(clean, 16);
  return Number.isFinite(n) ? n : fallback;
}

function getCustomerMoodKey(ratio = 1, isThinking = false, isReady = false) {
  if (isReady) return 'ready';
  if (isThinking) return 'thinking';
  if (ratio > 0.55) return 'happy';
  if (ratio > 0.28) return 'impatient';
  return 'angry';
}

export default function KitchenPhaserCanvas({
  snapshot,
  selectedBoardIndex = 0,
  serverTimeOffsetMs = 0,
  reducedMotion = false,
  disabled = false,
  onSelectBoard,
  onSelectTicket,
  onStartCook,
  onCollectGrill,
  onAddIngredient,
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
    onStartCook,
    onCollectGrill,
    onAddIngredient,
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
      onStartCook,
      onCollectGrill,
      onAddIngredient,
      onServeOrder,
    };
  }, [
    onSelectBoard,
    onSelectTicket,
    onStartCook,
    onCollectGrill,
    onAddIngredient,
    onServeOrder,
  ]);

  useEffect(() => {
    const parentEl = containerRef.current;
    if (!parentEl) return undefined;

    class BancoDelGamberoScene extends Phaser.Scene {
      constructor() {
        super({ key: 'BancoDelGamberoScene' });
        this.bgGraphics = null;
        this.dynamicGraphics = null;
        this.fgGraphics = null;
        this.textPool = [];
        this.textCursor = 0;
        this.spritePool = [];
        this.spriteCursor = 0;
        this.hitZones = [];
        this.quickTrayIngredientIds = [];
      }

      preload() {
        // Ignora silenziosamente eventuali errori di rete su singoli file senza bloccare la scena
        this.load.on('loaderror', () => {});

        // Fondale sala e vicolo
        if (GAME_ART_MANIFEST.scenes?.sala_vicolo_bg) {
          this.load.image('scene_sala_bg', GAME_ART_MANIFEST.scenes.sala_vicolo_bg);
        }

        // Ingredienti + stati cottura
        for (const ing of INGREDIENTS) {
          const url = getIngredientArtUrl(ing.id);
          if (url) this.load.svg(`ing_${ing.id}`, url, { width: 96, height: 96 });
          if (ing.requiresGrill) {
            for (const st of [
              COOK_STATES.RAW,
              COOK_STATES.COOKING,
              COOK_STATES.COOKED,
              COOK_STATES.BURNED,
            ]) {
              const stUrl = getIngredientArtUrl(ing.id, st);
              if (stUrl) {
                this.load.svg(`ing_${ing.id}_${st}`, stUrl, { width: 96, height: 96 });
              }
            }
          }
        }

        // Piatti finiti (8 ricette)
        for (const r of RECIPES) {
          const url = getRecipeArtUrl(r.id);
          if (url) this.load.svg(`recipe_${r.id}`, url, { width: 160, height: 140 });
        }

        // 4 Cuochi della brigata
        for (const p of CHEF_PERSONAS) {
          const url = getChefArtUrl(p.id);
          if (url) this.load.svg(`chef_${p.id}`, url, { width: 140, height: 160 });
        }

        // 8 Clienti × 5 umori
        for (let idx = 1; idx <= 8; idx += 1) {
          for (const mood of ['happy', 'thinking', 'impatient', 'angry', 'ready']) {
            const url = getCustomerArtUrl(idx - 1, mood);
            if (url) {
              this.load.svg(`cust_${idx}_${mood}`, url, { width: 140, height: 160 });
            }
          }
        }

        // Props & FX
        for (const [k, url] of Object.entries(GAME_ART_MANIFEST.props || {})) {
          this.load.svg(`prop_${k}`, url, { width: 64, height: 64 });
        }
        for (const [k, url] of Object.entries(GAME_ART_MANIFEST.fx || {})) {
          this.load.svg(`fx_${k}`, url, { width: 64, height: 64 });
        }
      }

      create() {
        this.bgGraphics = this.add.graphics().setDepth(1);
        this.dynamicGraphics = this.add.graphics().setDepth(10);
        this.fgGraphics = this.add.graphics().setDepth(20);
        this.drawStaticKitchenEnvironment();
        this.createInteractiveZones();
      }

      getDynamicSprite(key, x, y, displayW, displayH, depth = 12, alpha = 1) {
        if (!this.textures.exists(key)) return null;
        let spr = this.spritePool[this.spriteCursor];
        if (!spr) {
          spr = this.add.image(x, y, key);
          this.spritePool.push(spr);
        } else {
          spr.setTexture(key);
          spr.setPosition(x, y);
          spr.setVisible(true);
        }
        spr.setDisplaySize(displayW, displayH);
        spr.setDepth(depth);
        spr.setAlpha(alpha);
        spr.setAngle(0);
        this.spriteCursor += 1;
        return spr;
      }

      getDynamicText(x, y, content, style = {}, depth = 25) {
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
        txt.setDepth(depth);
        this.textCursor += 1;
        return txt;
      }

      drawStaticKitchenEnvironment() {
        const g = this.bgGraphics;
        g.clear();

        // 1. Fondale Sala & Vicolo Napoletano (y: 0..246)
        if (this.textures.exists('scene_sala_bg')) {
          const bgImg = this.add.image(CANVAS_W / 2, 124, 'scene_sala_bg');
          bgImg.setDisplaySize(CANVAS_W, 260);
          bgImg.setDepth(0);
        } else {
          g.fillStyle(0xf6e4cb, 1);
          g.fillRect(0, 0, CANVAS_W, 246);
        }

        // Velo atmosferico caldo pomeridiano sulla sala per far risaltare clienti e ticket
        g.fillStyle(0x281912, 0.18);
        g.fillRect(0, 0, CANVAS_W, 244);

        // 2. Soglia del Bancone Clienti + Fregio in Maiolica Vietrese (y: 232..262)
        g.fillStyle(0x4a2713, 1);
        g.fillRect(0, 230, CANVAS_W, 8);
        g.fillStyle(0x9b5d37, 1);
        g.fillRect(0, 236, CANVAS_W, 12);

        // Piastrelle di Vietri bianche e blu golfo
        const tileW = 32;
        for (let x = 0; x < CANVAS_W; x += tileW) {
          const isEven = (x / tileW) % 2 === 0;
          g.fillStyle(isEven ? 0xfffdf9 : 0xeaf2f8, 1);
          g.fillRect(x, 248, tileW, 14);
          g.lineStyle(1, 0x2d5a88, 0.45);
          g.strokeRect(x, 248, tileW, 14);
          g.fillStyle(isEven ? 0x2d5a88 : 0xd96b32, 0.85);
          g.fillCircle(x + tileW / 2, 255, 3.2);
        }

        // 3. Piano Principale di Lavoro in Legno Scuro Massello (y: 262..510)
        g.fillStyle(0x5c341d, 1);
        g.fillRect(0, 262, CANVAS_W, 248);
        g.fillStyle(0x704125, 1);
        g.fillRect(10, 266, CANVAS_W - 20, 236);
        g.lineStyle(2, 0x3a2010, 0.55);
        g.lineBetween(10, 345, CANVAS_W - 10, 345);
        g.lineBetween(10, 428, CANVAS_W - 10, 428);

        // --- STAZIONE SINISTRA: PIASTRA IN GHISA + VASCHETTE + VASSOIO CALDO (x: 18..478) ---
        g.fillStyle(0x1f1815, 1);
        g.fillRoundedRect(18, 272, 462, 226, 16);
        g.lineStyle(3, 0x6e5a4f, 0.9);
        g.strokeRoundedRect(18, 272, 462, 226, 16);

        // --- STAZIONE CENTRALE: I 2 TAGLIERI D'ASSEMBLAGGIO & PASS (x: 492..918) ---
        g.fillStyle(0xe5cfaeff, 1);
        g.fillRoundedRect(492, 272, 426, 226, 16);
        g.lineStyle(3, 0x4a2713, 0.85);
        g.strokeRoundedRect(492, 272, 426, 226, 16);

        // --- STAZIONE DESTRA: DISPENSA RAPIDA GASTRONORM SUL BANCO (x: 930..1262) ---
        g.fillStyle(0x3b281d, 1);
        g.fillRoundedRect(930, 272, 332, 226, 16);
        g.lineStyle(3, 0x8c583a, 0.85);
        g.strokeRoundedRect(930, 272, 332, 226, 16);
      }

      createInteractiveZones() {
        // 1. Zone interattive per fino a 6 Clienti + Ticket in Sala (x: 16..1264, y: 12..232)
        for (let i = 0; i < 6; i += 1) {
          const slotW = 204;
          const cx = 18 + i * 208;
          const cy = 14;
          const zone = this.add
            .zone(cx + slotW / 2, cy + 108, slotW, 214)
            .setInteractive({ useHandCursor: true })
            .setDepth(40);
          zone.on('pointerdown', () => {
            const st = stateRef.current;
            if (st.disabled) return;
            const tickets = st.snapshot?.game?.activeTickets || [];
            const ticket = tickets[i];
            if (!ticket) return;
            const board = st.snapshot?.game?.prepBoards?.[st.selectedBoardIndex];
            const check = inspectBoardAgainstTicket(board?.ingredients || [], ticket);
            const isThinking = Boolean(
              ticket.thinkingUntilMs &&
                Date.now() + st.serverTimeOffsetMs < ticket.thinkingUntilMs,
            );
            if (check.ok && !isThinking) {
              callbacksRef.current.onServeOrder?.(st.selectedBoardIndex, ticket.id);
            } else {
              callbacksRef.current.onSelectTicket?.(ticket.id);
            }
          });
          this.hitZones.push(zone);
        }

        // 2. Zone interattive per i 4 Fuochi della Piastra (griglia 2x2 a sinistra)
        for (let idx = 0; idx < 4; idx += 1) {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const sx = 30 + col * 142;
          const sy = 298 + row * 74;
          const zone = this.add
            .zone(sx + 67, sy + 34, 134, 68)
            .setInteractive({ useHandCursor: true })
            .setDepth(40);
          zone.on('pointerdown', () => {
            const st = stateRef.current;
            if (st.disabled) return;
            callbacksRef.current.onCollectGrill?.(idx);
          });
          this.hitZones.push(zone);
        }

        // 3. Zone interattive per le 4 Vaschette di Proteine Crude da mettere sulla piastra
        GRILLABLE_INGREDIENTS.forEach((ing, idx) => {
          const bx = 318;
          const by = 298 + idx * 37;
          const zone = this.add
            .zone(bx + 74, by + 17, 148, 34)
            .setInteractive({ useHandCursor: true })
            .setDepth(40);
          zone.on('pointerdown', () => {
            const st = stateRef.current;
            if (st.disabled) return;
            callbacksRef.current.onStartCook?.(ing.id);
          });
          this.hitZones.push(zone);
        });

        // 4. Zona interattiva per il Vassoio Caldo Condiviso (in basso nella piastra)
        const trayZone = this.add
          .zone(248, 469, 438, 38)
          .setInteractive({ useHandCursor: true })
          .setDepth(40);
        trayZone.on('pointerdown', () => {
          const st = stateRef.current;
          if (st.disabled) return;
          const tray = st.snapshot?.game?.cookedTray || [];
          if (tray.length > 0) {
            callbacksRef.current.onAddIngredient?.(tray[0].ingredientId);
          }
        });
        this.hitZones.push(trayZone);

        // 5. Zone interattive per i 2 Taglieri Condivisi (Banco 1 e Banco 2 al centro)
        for (let bIdx = 0; bIdx < 2; bIdx += 1) {
          const bx = 506 + bIdx * 204;
          const by = 298;
          const zone = this.add
            .zone(bx + 96, by + 94, 192, 188)
            .setInteractive({ useHandCursor: true })
            .setDepth(40);
          zone.on('pointerdown', () => {
            const st = stateRef.current;
            if (st.disabled) return;
            callbacksRef.current.onSelectBoard?.(bIdx);
            const board = st.snapshot?.game?.prepBoards?.[bIdx];
            const tickets = st.snapshot?.game?.activeTickets || [];
            const linked =
              tickets.find((t) => t.id === board?.targetTicketId) || tickets[0];
            const isThinking = Boolean(
              linked?.thinkingUntilMs &&
                Date.now() + st.serverTimeOffsetMs < linked.thinkingUntilMs,
            );
            if (
              linked &&
              !isThinking &&
              inspectBoardAgainstTicket(board?.ingredients || [], linked).ok
            ) {
              callbacksRef.current.onServeOrder?.(bIdx, linked.id);
            }
          });
          this.hitZones.push(zone);
        }

        // 6. Zone interattive per le 6 Vaschette Rapide della Dispensa (a destra sul banco)
        for (let pIdx = 0; pIdx < 6; pIdx += 1) {
          const col = pIdx % 2;
          const row = Math.floor(pIdx / 2);
          const px = 942 + col * 156;
          const py = 300 + row * 62;
          const zone = this.add
            .zone(px + 74, py + 28, 148, 56)
            .setInteractive({ useHandCursor: true })
            .setDepth(40);
          zone.on('pointerdown', () => {
            const st = stateRef.current;
            if (st.disabled) return;
            const ingId = this.quickTrayIngredientIds[pIdx];
            if (ingId) {
              callbacksRef.current.onAddIngredient?.(ingId);
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

        for (let i = 0; i < this.spritePool.length; i += 1) {
          this.spritePool[i].setVisible(false);
        }
        this.spriteCursor = 0;

        const g = this.dynamicGraphics;
        const fg = this.fgGraphics;
        g.clear();
        fg.clear();

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
        const maxSlots = getScalingForPlayers(
          game?.playerCount || players.length || 1,
        ).maxActiveTickets;

        const tickets = game?.activeTickets || [];
        const boards = game?.prepBoards || [];

        // Props sul bancone (Moka napoletana a sinistra, Campanello Pass al centro)
        this.getDynamicSprite('prop_moka', 462, 232, 38, 38, 18);
        this.getDynamicSprite('prop_bell_pass', 906, 234, 36, 36, 18);

        // =====================================================================
        // SEZIONE 1: SALA SULLO SFONDO — CLIENTI AL BANCONE CON TICKET ILLUSTRATO
        // =====================================================================
        g.fillStyle(0x23160f, 0.72);
        g.fillRoundedRect(16, 4, 340, 20, 6);
        this.getDynamicText(
          26,
          7,
          `SALA & BANCONE CLIENTI (${tickets.length}/${maxSlots}) · ${phase.label.toUpperCase()}`,
          { fontSize: '11px', color: '#FFF3E2' },
        );

        for (let i = 0; i < maxSlots; i += 1) {
          const slotW = Math.floor((CANVAS_W - 36) / maxSlots);
          const cx = 18 + i * slotW;
          const cy = 28;
          const tkt = tickets[i];

          if (!tkt) {
            // Posto libero discreto al bancone
            g.fillStyle(0x281912, 0.35);
            g.fillRoundedRect(cx + 8, cy + 128, slotW - 16, 62, 12);
            g.lineStyle(1.5, 0xfff3e2, 0.22);
            g.strokeRoundedRect(cx + 8, cy + 128, slotW - 16, 62, 12);
            this.getDynamicText(
              cx + slotW / 2,
              cy + 159,
              `Posto #${i + 1} libero`,
              { fontSize: '11px', color: '#E8D5B7', originX: 0.5, originY: 0.5 },
            );
            continue;
          }

          const linkedBoardIdx = boards.findIndex((b) => b.targetTicketId === tkt.id);
          const boardForCheck =
            linkedBoardIdx !== -1 ? boards[linkedBoardIdx] : boards[activeBoardIdx];
          const check = inspectBoardAgainstTicket(boardForCheck?.ingredients || [], tkt);
          const isReadyToServe = check.ok;
          const isSelected =
            linkedBoardIdx === activeBoardIdx || (linkedBoardIdx === -1 && i === 0);

          const remMs = Math.max(0, tkt.expiresAtMs - nowMs);
          const ratio = tkt.patienceMs > 0 ? Math.min(1, remMs / tkt.patienceMs) : 0;
          const isThinking = Boolean(tkt.thinkingUntilMs && nowMs < tkt.thinkingUntilMs);
          const moodKey = getCustomerMoodKey(ratio, isThinking, isReadyToServe);
          const barColor =
            ratio > 0.55 ? 0x5f8f3a : ratio > 0.28 ? 0xe39a2d : 0xb23b2e;

          const bobY = noMotion ? 0 : Math.sin(time / 280 + i * 1.3) * 2.2;
          const custIdx = (Math.abs(Math.trunc(Number(tkt.appearanceSeed) || i + 1)) % 8) + 1;

          // Personaggio Cliente in piedi davanti al bancone (a sinistra nello slot)
          const charX = cx + 46;
          const charY = cy + 142 + bobY;
          this.getDynamicSprite(
            `cust_${custIdx}_${moodKey}`,
            charX,
            charY,
            96,
            110,
            14,
          );

          // Targhetta nome cliente sul bordo del bancone
          g.fillStyle(0x2b1b12, 0.92);
          g.fillRoundedRect(cx + 6, cy + 182, 84, 20, 6);
          this.getDynamicText(
            cx + 48,
            cy + 192,
            `#${i + 1} ${tkt.customerName}`,
            { fontSize: '11px', color: '#FFF9F1', originX: 0.5, originY: 0.5 },
          );

          // FUMETTO / TICKET ORDINE ILLUSTRATO (stile Cooking Fever accanto al cliente)
          const bx = cx + 88;
          const by = cy + 6;
          const bw = Math.min(156, slotW - 92);
          const bh = 188;

          // Ombra fumetto
          g.fillStyle(0x1f140e, 0.28);
          g.fillRoundedRect(bx + 3, by + 4, bw, bh, 12);

          // Corpo fumetto comanda
          g.fillStyle(
            isReadyToServe ? 0xeaf7e1 : isSelected ? 0xfffdf9 : 0xf7eee0,
            0.97,
          );
          g.fillRoundedRect(bx, by, bw, bh, 12);
          g.lineStyle(
            isReadyToServe || isSelected ? 3 : 1.8,
            isReadyToServe ? 0x5f8f3a : isSelected ? 0xd96b32 : 0x5a4234,
            1,
          );
          g.strokeRoundedRect(bx, by, bw, bh, 12);

          // Codino del fumetto verso il cliente
          g.fillStyle(isReadyToServe ? 0xeaf7e1 : 0xfffdf9, 1);
          g.fillTriangle(bx - 8, by + 110, bx + 2, by + 100, bx + 2, by + 120);

          // Barra pazienza verticale sul lato destro del fumetto + secondi
          const pBarX = bx + bw - 10;
          const pBarY = by + 26;
          const pBarH = bh - 34;
          g.fillStyle(0xe2d2bd, 1);
          g.fillRoundedRect(pBarX, pBarY, 6, pBarH, 3);
          const fillH = Math.max(6, Math.round(pBarH * ratio));
          g.fillStyle(barColor, 1);
          g.fillRoundedRect(pBarX, pBarY + (pBarH - fillH), 6, fillH, 3);

          // Header del ticket: Badge Banco + Timer secondi
          if (linkedBoardIdx !== -1) {
            g.fillStyle(linkedBoardIdx === 0 ? 0xd96b32 : 0x385c32, 1);
            g.fillRoundedRect(bx + 6, by + 6, 52, 16, 5);
            this.getDynamicText(bx + 32, by + 14, `BANCO ${linkedBoardIdx + 1}`, {
              fontSize: '9px',
              color: '#FFF9F1',
              originX: 0.5,
              originY: 0.5,
            });
          } else {
            g.fillStyle(0xead8c0, 1);
            g.fillRoundedRect(bx + 6, by + 6, 54, 16, 5);
            this.getDynamicText(bx + 33, by + 14, tkt.badgeLabel.slice(0, 9), {
              fontSize: '9px',
              color: '#5A3826',
              originX: 0.5,
              originY: 0.5,
            });
          }

          this.getDynamicText(bx + bw - 6, by + 7, `${Math.ceil(remMs / 1000)}s`, {
            fontSize: '11px',
            color: ratio <= 0.28 ? '#B23B2E' : '#3A2A22',
            originX: 1,
          });

          if (isThinking) {
            this.getDynamicText(bx + (bw - 12) / 2, by + 76, 'Sta scegliendo…', {
              fontSize: '11px',
              color: '#6B564B',
              originX: 0.5,
            });
            this.getDynamicText(bx + (bw - 12) / 2, by + 98, 'Tocca per fissare', {
              fontSize: '10px',
              color: '#BB5A20',
              originX: 0.5,
            });
          } else {
            // Illustrazione 2.5D del piatto finito richiesto!
            this.getDynamicSprite(
              `recipe_${tkt.recipeId}`,
              bx + (bw - 14) / 2,
              by + 54,
              76,
              64,
              15,
            );

            // Nome ricetta compatto
            this.getDynamicText(
              bx + (bw - 12) / 2,
              by + 84,
              tkt.recipeName.length > 18
                ? `${tkt.recipeName.slice(0, 17)}…`
                : tkt.recipeName,
              {
                fontSize: '11px',
                color: '#3A2A22',
                originX: 0.5,
              },
            );

            // Eventuale variante (SENZA / EXTRA / CON)
            let modText = '';
            let modCol = 0x3a2a22;
            if (tkt.modifiers?.exclude) {
              modText = `NO ${getIngredient(tkt.modifiers.exclude)?.shortName || ''}`;
              modCol = 0xb23b2e;
            } else if (tkt.modifiers?.add) {
              modText = `+ ${getIngredient(tkt.modifiers.add)?.shortName || ''}`;
              modCol = 0xbb5a20;
            } else if (tkt.modifiers?.swap) {
              modText = `CON ${getIngredient(tkt.modifiers.swap.to)?.shortName || ''}`;
              modCol = 0x385c32;
            }

            if (modText) {
              g.fillStyle(modCol, 0.14);
              g.fillRoundedRect(bx + 6, by + 100, bw - 20, 16, 4);
              this.getDynamicText(bx + (bw - 14) / 2, by + 108, modText.toUpperCase(), {
                fontSize: '9px',
                color:
                  modCol === 0xb23b2e
                    ? '#B23B2E'
                    : modCol === 0xbb5a20
                      ? '#BB5A20'
                      : '#385C32',
                originX: 0.5,
                originY: 0.5,
              });
            }

            // Mini icone degli ingredienti richiesti con spunta verde quando presenti sul tagliere
            const chkList = check.checklist || [];
            const maxIcons = Math.min(6, chkList.length);
            const iconSpan = Math.min(22, Math.floor((bw - 20) / Math.max(1, maxIcons)));
            const startIconX =
              bx + (bw - 14) / 2 - ((maxIcons - 1) * iconSpan) / 2;

            for (let k = 0; k < maxIcons; k += 1) {
              const item = chkList[k];
              const ix = startIconX + k * iconSpan;
              const iy = by + 134;
              g.fillStyle(item.present ? 0x5f8f3a : 0xefe3d1, 1);
              g.fillCircle(ix, iy, 10);
              this.getDynamicSprite(`ing_${item.ingredientId}`, ix, iy, 18, 18, 16);
            }

            // Bottone stato in fondo al ticket
            g.fillStyle(isReadyToServe ? 0x5f8f3a : isSelected ? 0xd96b32 : 0xead8c0, 1);
            g.fillRoundedRect(bx + 6, by + 156, bw - 20, 24, 6);
            this.getDynamicText(
              bx + (bw - 14) / 2,
              by + 168,
              isReadyToServe
                ? '✓ SERVI ORA!'
                : isSelected
                  ? `In prep. Banco ${activeBoardIdx + 1}`
                  : `Tocca [${i + 1}]`,
              {
                fontSize: '10px',
                color: isReadyToServe || isSelected ? '#FFF9F1' : '#3A2A22',
                originX: 0.5,
                originY: 0.5,
              },
            );
          }
        }

        // =====================================================================
        // SEZIONE 2: STAZIONE SINISTRA — PIASTRA IN GHISA (4 FUOCHI) + VASSOIO
        // =====================================================================
        this.getDynamicText(30, 279, 'PIASTRA IN GHISA (4 FUOCHI) · [Q W E R]', {
          fontSize: '11px',
          color: '#FFF3E2',
        });

        const grillSlots = game?.grillSlots || [];
        for (let idx = 0; idx < 4; idx += 1) {
          const slot = grillSlots[idx] || { slotIndex: idx, ingredientId: null };
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          const sx = 30 + col * 142;
          const sy = 298 + row * 74;

          const status = getGrillSlotStatus(slot, nowMs);
          let borderCol = 0x5a473e;
          let bgCol = 0x2b221e;
          if (status.state === COOK_STATES.COOKING) {
            borderCol = 0xe39a2d;
            bgCol = 0x453022;
          } else if (status.state === COOK_STATES.COOKED && status.aboutToBurn) {
            borderCol = 0xff6b4a;
            bgCol = 0x57241c;
          } else if (status.state === COOK_STATES.COOKED) {
            borderCol = 0x5f8f3a;
            bgCol = 0x263f21;
          } else if (status.state === COOK_STATES.BURNED) {
            borderCol = 0xb23b2e;
            bgCol = 0x3b1916;
          }

          g.fillStyle(bgCol, 1);
          g.fillRoundedRect(sx, sy, 134, 68, 11);
          g.lineStyle(2.5, borderCol, 1);
          g.strokeRoundedRect(sx, sy, 134, 68, 11);

          // Nervature ghisa
          g.lineStyle(2, 0x16110f, 0.55);
          for (let rx = sx + 16; rx < sx + 56; rx += 10) {
            g.lineBetween(rx, sy + 10, rx, sy + 56);
          }

          const keyHint = ['Q', 'W', 'E', 'R'][idx];
          if (!slot.ingredientId) {
            this.getDynamicText(sx + 67, sy + 34, `Fuoco ${idx + 1} [${keyHint}]`, {
              fontSize: '11px',
              color: '#B5A499',
              originX: 0.5,
              originY: 0.5,
            });
          } else {
            const ing = getIngredient(slot.ingredientId);
            const texState =
              status.state === COOK_STATES.BURNED
                ? COOK_STATES.BURNED
                : status.state === COOK_STATES.COOKED
                  ? COOK_STATES.COOKED
                  : COOK_STATES.RAW;

            this.getDynamicSprite(
              `ing_${slot.ingredientId}_${texState}`,
              sx + 34,
              sy + 31,
              52,
              52,
              15,
            );

            // FX vapore / attenzione / bruciato
            if (status.state === COOK_STATES.COOKING) {
              const steamY = noMotion ? sy + 16 : sy + 16 + Math.sin(time / 180 + idx) * 3;
              this.getDynamicSprite('fx_steam', sx + 34, steamY, 28, 28, 16, 0.75);
            } else if (status.state === COOK_STATES.COOKED && status.aboutToBurn) {
              this.getDynamicSprite('fx_warning_badge', sx + 54, sy + 14, 22, 22, 17);
            } else if (status.state === COOK_STATES.COOKED) {
              this.getDynamicSprite('fx_ready_badge', sx + 54, sy + 14, 20, 20, 17);
            } else if (status.state === COOK_STATES.BURNED) {
              this.getDynamicSprite('fx_burned_smoke', sx + 34, sy + 20, 36, 36, 17);
            }

            this.getDynamicText(sx + 64, sy + 10, `${ing?.shortName || ''} [${keyHint}]`, {
              fontSize: '11px',
              color: '#FFF9F1',
            });

            const stateText =
              status.state === COOK_STATES.COOKING
                ? `Cuoce ${(status.remainingMs / 1000).toFixed(1)}s`
                : status.state === COOK_STATES.COOKED && status.aboutToBurn
                  ? `BRUCIA ${(status.remainingMs / 1000).toFixed(1)}s!`
                  : status.state === COOK_STATES.COOKED
                    ? 'PRONTO! Tocca'
                    : 'BRUCIATO!';

            this.getDynamicText(sx + 64, sy + 27, stateText, {
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
            g.fillStyle(0x140f0d, 1);
            g.fillRoundedRect(sx + 10, sy + 52, 114, 7, 3.5);
            g.fillStyle(borderCol, 1);
            g.fillRoundedRect(sx + 10, sy + 52, Math.max(6, Math.round(114 * prog)), 7, 3.5);
          }
        }

        // Vaschette Proteine Crude a destra dei 4 fuochi (x: 318..466)
        this.getDynamicText(320, 279, 'METTI SU PIASTRA:', {
          fontSize: '10px',
          color: '#E8D5B7',
        });
        GRILLABLE_INGREDIENTS.forEach((ing, idx) => {
          const bx = 318;
          const by = 298 + idx * 37;
          g.fillStyle(0x332722, 1);
          g.fillRoundedRect(bx, by, 148, 33, 8);
          g.lineStyle(1.5, 0x8c6d5e, 0.85);
          g.strokeRoundedRect(bx, by, 148, 33, 8);
          this.getDynamicSprite(`ing_${ing.id}_raw`, bx + 20, by + 16, 28, 28, 15);
          this.getDynamicText(bx + 38, by + 10, `+ ${ing.shortName}`, {
            fontSize: '11px',
            color: '#FFF9F1',
          });
        });

        // Vassoio Caldo Condiviso (in basso nella stazione piastra)
        const trayItems = game?.cookedTray || [];
        g.fillStyle(0x362b26, 1);
        g.fillRoundedRect(30, 450, 436, 38, 9);
        g.lineStyle(1.5, trayItems.length > 0 ? 0x5f8f3a : 0x6e5a4f, 0.9);
        g.strokeRoundedRect(30, 450, 436, 38, 9);
        this.getDynamicText(
          42,
          469,
          `VASSOIO CALDO (${trayItems.length}/6):`,
          {
            fontSize: '11px',
            color: trayItems.length > 0 ? '#A9E37B' : '#C9B8AC',
            originY: 0.5,
          },
        );
        if (trayItems.length === 0) {
          this.getDynamicText(195, 469, 'Usa "→ Vassoio" per tenere in caldo senza bruciare', {
            fontSize: '10px',
            color: '#A9998E',
            originY: 0.5,
          });
        } else {
          trayItems.slice(0, 6).forEach((item, tIdx) => {
            this.getDynamicSprite(
              `ing_${item.ingredientId}_cooked`,
              210 + tIdx * 40,
              469,
              32,
              32,
              16,
            );
          });
        }

        // =====================================================================
        // SEZIONE 3: STAZIONE CENTRALE — I 2 TAGLIERI D'ASSEMBLAGGIO 2.5D
        // =====================================================================
        this.getDynamicText(506, 279, 'TAGLIERI DI ASSEMBLAGGIO & PASS CONSEGNA', {
          fontSize: '11px',
          color: '#3A2A22',
        });

        for (let bIdx = 0; bIdx < 2; bIdx += 1) {
          const board = boards[bIdx] || {
            boardIndex: bIdx,
            ingredients: [],
            targetTicketId: null,
          };
          const bx = 506 + bIdx * 204;
          const by = 298;
          const isCurrent = bIdx === activeBoardIdx;
          const linkedTicket =
            tickets.find((t) => t.id === board.targetTicketId) ||
            (isCurrent ? tickets[0] : null);
          const analysis = inspectBoardAgainstTicket(board.ingredients || [], linkedTicket);
          const chef =
            players.find((p) => p.id === board.updatedByPlayerId) ||
            players.find((p) => p.avatar?.role === (bIdx === 0 ? 'banco1' : 'banco2'));

          // Card tagliere sul banco
          g.fillStyle(
            analysis.ok ? 0xe9f5e1 : isCurrent ? 0xfffdf9 : 0xf4e4cc,
            1,
          );
          g.fillRoundedRect(bx, by, 192, 190, 12);
          g.lineStyle(
            analysis.ok || isCurrent ? 3 : 1.6,
            analysis.ok ? 0x5f8f3a : isCurrent ? 0xd96b32 : 0x7d583a,
            1,
          );
          g.strokeRoundedRect(bx, by, 192, 190, 12);

          // Intestazione Banco 1 / Banco 2 + avatar mini cuoco
          this.getDynamicText(bx + 12, by + 9, `BANCO ${bIdx + 1}`, {
            fontSize: '12px',
            color: isCurrent ? '#BB5A20' : '#3A2A22',
          });

          if (chef) {
            const chefKey = `chef_${chef.avatar?.chefId || 'chef_gennaro'}`;
            this.getDynamicSprite(chefKey, bx + 166, by + 24, 34, 38, 16);
          }

          this.getDynamicText(
            bx + 12,
            by + 25,
            linkedTicket ? `Ordine: ${linkedTicket.customerName}` : 'Tocca un cliente',
            { fontSize: '10px', color: '#6B564B' },
          );

          // Disco Tagliere in legno d'ulivo 2.5D + carta paglia
          g.fillStyle(0xb87d4b, 1);
          g.fillEllipse(bx + 96, by + 132, 148, 30);
          g.fillStyle(0xd9a36c, 1);
          g.fillEllipse(bx + 96, by + 128, 138, 25);
          g.fillStyle(0xf7e4bc, 1);
          g.fillTriangle(bx + 46, by + 128, bx + 96, by + 116, bx + 146, by + 128);

          // Pila 2.5D degli ingredienti sul tagliere
          const ings = board.ingredients || [];
          if (ings.length === 0) {
            this.getDynamicText(bx + 96, by + 95, 'Tagliere vuoto', {
              fontSize: '11px',
              color: '#8C7A70',
              originX: 0.5,
              originY: 0.5,
            });
          } else {
            ings.slice(0, 8).forEach((ingId, layerIdx) => {
              const ly = by + 120 - layerIdx * 10;
              this.getDynamicSprite(`ing_${ingId}`, bx + 96, ly, 62, 50, 15 + layerIdx);
            });
          }

          // Pulsante stato / consegna alla base del tagliere
          const statusLabel = analysis.ok
            ? '🔔 PRONTO! TOCCA E SERVI'
            : analysis.status === 'has_errors'
              ? '⚠ Ingrediente errato!'
              : `${ings.length} strati sul banco`;

          g.fillStyle(
            analysis.ok
              ? 0x5f8f3a
              : analysis.status === 'has_errors'
                ? 0xb23b2e
                : isCurrent
                  ? 0xd96b32
                  : 0xdec7a8,
            1,
          );
          g.fillRoundedRect(bx + 10, by + 154, 172, 28, 8);
          this.getDynamicText(bx + 96, by + 168, statusLabel, {
            fontSize: '11px',
            color:
              analysis.ok || analysis.status === 'has_errors' || isCurrent
                ? '#FFF9F1'
                : '#3A2A22',
            originX: 0.5,
            originY: 0.5,
          });
        }

        // =====================================================================
        // SEZIONE 4: STAZIONE DESTRA — VASCHETTE RAPIDE DISPENSA SUL BANCO
        // =====================================================================
        this.getDynamicText(942, 279, `DISPENSA RAPIDA → BANCO ${activeBoardIdx + 1}`, {
          fontSize: '11px',
          color: '#FFF3E2',
        });

        const activeBoard = boards[activeBoardIdx] || { ingredients: [] };
        const activeTicket =
          tickets.find((t) => t.id === activeBoard.targetTicketId) || tickets[0] || null;
        const activeCheck = inspectBoardAgainstTicket(
          activeBoard.ingredients || [],
          activeTicket,
        );

        // Scegli i 6 ingredienti più utili in questo istante (prima i mancanti non-griglia, poi i classici)
        const neededNonGrill = activeCheck.missing.filter(
          (id) => !getIngredient(id)?.requiresGrill,
        );
        const defaultPantry = [
          'pane_burger',
          'pane_casereccio',
          'cuzzetiello',
          'provola',
          'friarielli',
          'salsa_casa',
          'polpette',
          'ragu',
        ];
        const quickList = [];
        for (const id of [...neededNonGrill, ...defaultPantry]) {
          if (!quickList.includes(id) && quickList.length < 6) {
            quickList.push(id);
          }
        }
        this.quickTrayIngredientIds = quickList;

        quickList.forEach((ingId, pIdx) => {
          const ing = getIngredient(ingId);
          const isNeeded = neededNonGrill.includes(ingId);
          const col = pIdx % 2;
          const row = Math.floor(pIdx / 2);
          const px = 942 + col * 156;
          const py = 300 + row * 62;

          g.fillStyle(isNeeded ? 0xfffdf9 : 0xead8c0, 1);
          g.fillRoundedRect(px, py, 148, 54, 10);
          g.lineStyle(isNeeded ? 2.5 : 1.5, isNeeded ? 0xd96b32 : 0x6e4a30, 1);
          g.strokeRoundedRect(px, py, 148, 54, 10);

          this.getDynamicSprite(`ing_${ingId}`, px + 28, py + 27, 42, 42, 16);
          this.getDynamicText(px + 52, py + 12, ing?.shortName || ingId, {
            fontSize: '11px',
            color: '#3A2A22',
          });
          this.getDynamicText(
            px + 52,
            py + 29,
            isNeeded ? '★ SERVE ORA' : '+ Aggiungi',
            {
              fontSize: '10px',
              color: isNeeded ? '#BB5A20' : '#6B564B',
            },
          );
        });
      }
    }

    const config = {
      type: Phaser.CANVAS,
      parent: parentEl,
      width: CANVAS_W,
      height: CANVAS_H,
      backgroundColor: '#3A2316',
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
      className="relative overflow-hidden rounded-2xl border-2 border-[#5C341D] bg-[#2B1911] shadow-md"
      aria-label="Scena interattiva 2.5D della paninoteca Il Banco del Gambero"
    >
      <div
        ref={containerRef}
        className="w-full overflow-hidden"
        style={{ aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
      />
    </div>
  );
}
