'use strict';

// ---------- menu / shop ----------
function updateMenuUI(){
  $('menuGold').textContent=fmt(meta.gold);$('shopGold').textContent=fmt(meta.gold);$('nameInput').value=meta.name||'방랑 기사';$('boostCount').textContent=`(${meta.boosts||0}개)`;$('boostToggle').disabled=!meta.boosts;if(!meta.boosts)$('boostToggle').checked=false;
  $('equipCount').textContent=`${meta.equipped.length}/3`;$('equippedRunes').innerHTML=meta.equipped.length?meta.equipped.map(id=>{const r=runeDef(id);return `<div class="rune-chip"><span>${r.icon} ${r.name}</span><em>Lv.${runeLevel(id)}</em></div>`;}).join(''):'<div class="rune-chip"><span>장착된 룬이 없습니다</span><em>상점에서 획득</em></div>';
  renderInventory();
}
function renderInventory(){
  const ids=Object.keys(meta.inventory).sort((a,b)=>runeLevel(b)-runeLevel(a));$('inventory').innerHTML=ids.length?'':'<div style="padding:30px;text-align:center;color:#718096">아직 보유한 룬이 없습니다.</div>';
  for(const id of ids){const r=runeDef(id),eq=meta.equipped.includes(id);const el=document.createElement('div');el.className='inv-item';el.innerHTML=`<div class="ico">${r.icon}</div><div><h4>${r.name} · Lv.${runeLevel(id)}</h4><p>${r.desc}</p></div><button class="btn ${eq?'gold':''}">${eq?'해제':'장착'}</button>`;el.querySelector('button').onclick=()=>{if(eq)meta.equipped=meta.equipped.filter(x=>x!==id);else if(meta.equipped.length<3)meta.equipped.push(id);else{$('gachaResult').textContent='룬은 최대 3개까지 장착할 수 있습니다.';return;}saveMeta();updateMenuUI();};$('inventory').appendChild(el);}
}
function openGacha(){if(meta.gold<800){$('gachaResult').textContent='골드가 부족합니다.';return;}meta.gold-=800;const r=choose(RUNE_DEFS);meta.inventory[r.id]=Math.min(5,(meta.inventory[r.id]||0)+1);if(meta.equipped.length<3&&!meta.equipped.includes(r.id))meta.equipped.push(r.id);saveMeta();$('gachaResult').textContent=`${r.icon} ${r.name} Lv.${meta.inventory[r.id]} 획득!`;sfx('level');updateMenuUI();}
function buyBoost(){if(meta.gold<1400){$('gachaResult').textContent='골드가 부족합니다.';return;}meta.gold-=1400;meta.boosts=(meta.boosts||0)+1;saveMeta();$('gachaResult').textContent='🎫 Lv.5 시작권을 획득했습니다.';updateMenuUI();}

// ---------- pause / buttons ----------
function togglePause(){if(game.choiceOpen||game.mode==='gameover')return;game.paused=!game.paused;$('pauseModal').classList.toggle('hidden',!game.paused);}
$('startBtn').onclick=startGame;$('shopBtn').onclick=()=>{$('shopModal').classList.remove('hidden');updateMenuUI();};$('closeShop').onclick=()=>$('shopModal').classList.add('hidden');
$('gachaBtn').onclick=openGacha;$('boostBuyBtn').onclick=buyBoost;$('reviveBtn').onclick=revive;$('returnMenuBtn').onclick=returnMenu;
$('resumeBtn').onclick=togglePause;$('quitBtn').onclick=returnMenu;
$('bossContinue').onclick=()=>{$('bossResultModal').classList.add('hidden');game.paused=false;processChoiceQueue();};
$('nameInput').addEventListener('change',()=>{meta.name=($('nameInput').value.trim()||'방랑 기사').slice(0,12);saveMeta();});

// ---------- mobile controls ----------
const joy=$('joystick'),knob=$('joyKnob');let joyPointer=null;
function moveJoy(e){const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;let x=e.clientX-cx,y=e.clientY-cy,l=Math.hypot(x,y),max=43;if(l>max){x=x/l*max;y=y/l*max;}knob.style.transform=`translate(${x}px,${y}px)`;input.touchMove={x:x/max,y:y/max};}
joy.addEventListener('pointerdown',e=>{input.mobile=true;joyPointer=e.pointerId;joy.setPointerCapture(e.pointerId);moveJoy(e);});joy.addEventListener('pointermove',e=>{if(e.pointerId===joyPointer)moveJoy(e);});
const endJoy=e=>{if(e.pointerId!==joyPointer)return;joyPointer=null;input.touchMove={x:0,y:0};knob.style.transform='';};joy.addEventListener('pointerup',endJoy);joy.addEventListener('pointercancel',endJoy);
document.querySelectorAll('.m-btn').forEach(b=>{const a=b.dataset.action;b.addEventListener('pointerdown',e=>{e.preventDefault();input.mobile=true;b.setPointerCapture(e.pointerId);if(a==='attack')input.left=true;else if(a==='block')input.right=true;else if(a==='dash')player?.dash();else if(a==='e')player?.skillE();else if(a==='r')player?.skillR();else if(a==='q')player?.skillQ();});const end=()=>{if(a==='attack')input.left=false;if(a==='block')input.right=false;};b.addEventListener('pointerup',end);b.addEventListener('pointercancel',end);});


