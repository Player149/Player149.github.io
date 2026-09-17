'use strict';

// ---------- DOM / canvas ----------
const $ = (id) => document.getElementById(id);
const canvas = $('gameCanvas');
const ctx = canvas.getContext('2d');
const mini = $('minimap');
const mctx = mini.getContext('2d');
let viewW = innerWidth, viewH = innerHeight, dpr = 1;

function resize() {
  viewW = innerWidth; viewH = innerHeight; dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.floor(viewW * dpr); canvas.height = Math.floor(viewH * dpr);
  canvas.style.width = viewW + 'px'; canvas.style.height = viewH + 'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener('resize', resize); resize();

// ---------- helpers ----------
const TAU = Math.PI * 2;
const clamp = (v,a,b) => Math.max(a, Math.min(b,v));
const lerp = (a,b,t) => a + (b-a)*t;
const rand = (a,b) => a + Math.random()*(b-a);
const randi = (a,b) => Math.floor(rand(a,b+1));
const choose = (arr) => arr[Math.floor(Math.random()*arr.length)];
const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const fmt = (n) => Math.floor(n).toLocaleString('ko-KR');
const fmtTime = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const angleDiff = (a,b) => Math.atan2(Math.sin(a-b), Math.cos(a-b));
const escapeHtml = (s) => String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
let idSeed = 1;

const WORLD = { w: 3200, h: 2200 };
const BOSS_BOUNDS = { x: 500, y: 250, w: 2200, h: 1700 };
const camera = { x: WORLD.w/2, y: WORLD.h/2, shake: 0 };

// ---------- persistent meta progression ----------
const RUNE_DEFS = [
  {id:'edge', icon:'🗡️', name:'예리한 검날', desc:'공격력 +4% / 룬 레벨', kind:'stat'},
  {id:'heart', icon:'❤️', name:'거인의 심장', desc:'최대 체력 +5% / 룬 레벨', kind:'stat'},
  {id:'wind', icon:'💨', name:'순풍 각인', desc:'이동 속도 +3% / 룬 레벨', kind:'stat'},
  {id:'wisdom', icon:'📘', name:'전투 교본', desc:'경험치 획득 +5% / 룬 레벨', kind:'stat'},
  {id:'ember', icon:'🔥', name:'잿불 궤적', desc:'공격 궤적이 붉은 불꽃으로 변화', kind:'effect'},
  {id:'frost', icon:'❄️', name:'서리 궤적', desc:'대시 궤적이 푸른 서리로 변화', kind:'effect'},
  {id:'echo', icon:'🔔', name:'강철의 메아리', desc:'타격음이 더 묵직하게 변화', kind:'sound'},
  {id:'fortune', icon:'◆', name:'황금 손', desc:'레벨업 골드 +8% / 룬 레벨', kind:'stat'}
];
const defaultMeta = { gold: 2400, inventory:{}, equipped:[], boosts:0, name:'방랑 기사' };
function loadMeta() {
  try { return {...defaultMeta, ...JSON.parse(localStorage.getItem('ironCrownMeta') || '{}')}; }
  catch { return {...defaultMeta}; }
}
let meta = loadMeta();
function saveMeta() { try { localStorage.setItem('ironCrownMeta', JSON.stringify(meta)); } catch {} }
const runeDef = id => RUNE_DEFS.find(r=>r.id===id);
const runeLevel = id => meta.inventory[id] || 0;
const hasRune = id => meta.equipped.includes(id);

// ---------- input ----------
const input = {
  keys: {}, mouseX:viewW/2, mouseY:viewH/2, left:false, right:false,
  touchMove:{x:0,y:0}, mobile:false
};
addEventListener('keydown', e => {
  input.keys[e.code] = true;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Escape' && (game.mode==='play' || game.mode==='boss')) togglePause();
  if (!isGameplayReady()) return;
  if (e.code === 'Space') player?.dash();
  if (e.code === 'KeyE') player?.skillE();
  if (e.code === 'KeyR') player?.skillR();
  if (e.code === 'KeyQ') player?.skillQ();
  if (e.code === 'KeyL' && game.mode === 'play' && player.level < 40) addXp(player, xpNeed(player.level)-player.xp+1);
  if (e.code === 'KeyB' && game.mode === 'play') startBossBattle(true);
  if (['Digit1','Digit2','Digit3'].includes(e.code) && game.choiceOpen) {
    document.querySelectorAll('.choice-card')[Number(e.code.slice(-1))-1]?.click();
  }
});
addEventListener('keyup', e => input.keys[e.code] = false);
canvas.addEventListener('pointermove', e => { input.mouseX=e.clientX; input.mouseY=e.clientY; });
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') return;
  if (e.button===0) input.left=true;
  if (e.button===2) input.right=true;
});
addEventListener('pointerup', e => {
  if (e.pointerType === 'touch') return;
  if (e.button===0) input.left=false;
  if (e.button===2) input.right=false;
});
canvas.addEventListener('contextmenu', e=>e.preventDefault());
addEventListener('blur', ()=>{ input.left=false; input.right=false; input.keys={}; });

// ---------- synthesized sound ----------
let audioCtx = null;
function sfx(type, strength=1) {
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const heavy = hasRune('echo');
    const settings = {
      swing:[heavy?110:170, heavy?'sawtooth':'triangle', .07, .025],
      hit:[heavy?75:105, 'square', .055, .045],
      dash:[250,'sine',.1,.018], level:[520,'sine',.18,.035], skill:[310,'sawtooth',.15,.032], death:[95,'sawtooth',.28,.045]
    }[type] || [220,'sine',.08,.02];
    osc.type=settings[1]; osc.frequency.setValueAtTime(settings[0],now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40,settings[0]*.45),now+settings[2]);
    gain.gain.setValueAtTime(settings[3]*strength,now); gain.gain.exponentialRampToValueAtTime(.0001,now+settings[2]);
    osc.connect(gain).connect(audioCtx.destination); osc.start(now); osc.stop(now+settings[2]);
  } catch {}
}

// ---------- game state ----------
const game = {
  mode:'menu', paused:false, choiceOpen:false, time:0, runStart:0,
  bossCountdown:300, bossTimer:0, boss:null, bossParticipants:[], bossSnapshot:[], bossMaxHp:0,
  runGold:0, kills:0, revives:0, eventQueue:[], banked:false,
  announcementTimer:0, uiTick:0
};
let player = null;
let fighters = [], monsters = [], projectiles = [], effects = [], particles = [], floatTexts = [];
const zones = [
  {x:520,y:430,r:145},{x:1590,y:370,r:120},{x:2690,y:520,r:145},
  {x:750,y:1690,r:130},{x:1630,y:1320,r:155},{x:2700,y:1760,r:130}
];
const ruins = Array.from({length:32},(_,i)=>({x:rand(100,WORLD.w-100),y:rand(100,WORLD.h-100),r:rand(18,46),type:i%3}));

function isGameplayReady() {
  return (game.mode==='play'||game.mode==='boss') && !game.paused && !game.choiceOpen;
}
function currentBounds() { return game.mode==='boss' ? BOSS_BOUNDS : {x:0,y:0,w:WORLD.w,h:WORLD.h}; }

