'use strict';

// ---------- particles / effects ----------
function burstParticles(x,y,color,count){for(let i=0;i<count;i++){const a=rand(0,TAU),sp=rand(50,220);particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:rand(.25,.65),max:.65,size:rand(2,6),color});}}
function updateFx(dt){
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.96;p.vy*=.96;if(p.life<=0)particles.splice(i,1);}
  for(let i=effects.length-1;i>=0;i--){effects[i].life-=dt;if(effects[i].life<=0)effects.splice(i,1);}
  for(let i=floatTexts.length-1;i>=0;i--){const f=floatTexts[i];f.life-=dt;f.y-=28*dt;if(f.life<=0)floatTexts.splice(i,1);}
}

// ---------- main update ----------
let last=performance.now();
function loop(now){const raw=Math.min(.04,(now-last)/1000||0);last=now;if(isGameplayReady())update(raw);draw();requestAnimationFrame(loop);}
requestAnimationFrame(loop);

function update(dt){
  game.time+=dt;game.uiTick-=dt;
  if(game.mode==='play'){game.bossCountdown-=dt;if(game.bossCountdown<=0)startBossBattle(false);}
  else if(game.mode==='boss'){game.bossTimer-=dt;if(game.bossTimer<=0)finishBossBattle(false);}
  for(const f of fighters)f.update(dt);
  if(game.mode==='play'){for(const m of monsters)m.update(dt);updateZones(dt);respawnBots();}
  updateProjectiles(dt);updateFx(dt);
  const target=(player?.alive?player:(game.boss?.alive?game.boss:null));if(target){camera.x=lerp(camera.x,target.x,1-Math.pow(.001,dt));camera.y=lerp(camera.y,target.y,1-Math.pow(.001,dt));}
  camera.shake=Math.max(0,camera.shake-dt*28);
  if(game.uiTick<=0){updateHUD();game.uiTick=.08;}
}

function updateZones(dt){
  for(const f of fighters){if(!f.alive)continue;let inside=false;for(const z of zones)if(Math.hypot(f.x-z.x,f.y-z.y)<z.r){addXp(f,3.2*dt);inside=true;}f.zoneGlow=lerp(f.zoneGlow,inside?1:0,.08);}
}

// ---------- drawing ----------
function draw(){
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,viewW,viewH);
  drawBackdrop();
  if(game.mode==='menu'||!player)return;
  const sx=rand(-camera.shake,camera.shake),sy=rand(-camera.shake,camera.shake);
  ctx.save();ctx.translate(viewW/2-camera.x+sx,viewH/2-camera.y+sy);
  if(game.mode==='boss')drawBossArena();else drawNormalWorld();
  for(const p of projectiles)drawProjectile(p);
  for(const m of monsters)if(game.mode==='play')m.draw();
  const ordered=fighters.filter(f=>f.alive).sort((a,b)=>a.y-b.y);for(const f of ordered)f.draw();
  drawEffects();ctx.restore();
  if(player&&player.hp/player.maxHp<.25&&player.alive){const g=ctx.createRadialGradient(viewW/2,viewH/2,viewH*.18,viewW/2,viewH/2,viewH*.72);g.addColorStop(0,'transparent');g.addColorStop(1,`rgba(130,0,25,${.34*(1-player.hp/player.maxHp/.25)})`);ctx.fillStyle=g;ctx.fillRect(0,0,viewW,viewH);}
}
function drawBackdrop(){const g=ctx.createLinearGradient(0,0,0,viewH);g.addColorStop(0,'#121d2a');g.addColorStop(1,'#081019');ctx.fillStyle=g;ctx.fillRect(0,0,viewW,viewH);}
function drawNormalWorld(){
  ctx.fillStyle='#182632';ctx.fillRect(0,0,WORLD.w,WORLD.h);
  ctx.strokeStyle='rgba(174,210,216,.045)';ctx.lineWidth=1;const step=80;const left=Math.max(0,Math.floor((camera.x-viewW/2)/step)*step),right=Math.min(WORLD.w,camera.x+viewW/2+step),top=Math.max(0,Math.floor((camera.y-viewH/2)/step)*step),bottom=Math.min(WORLD.h,camera.y+viewH/2+step);ctx.beginPath();for(let x=left;x<right;x+=step){ctx.moveTo(x,top);ctx.lineTo(x,bottom);}for(let y=top;y<bottom;y+=step){ctx.moveTo(left,y);ctx.lineTo(right,y);}ctx.stroke();
  for(const z of zones)drawZone(z);
  for(const r of ruins)drawRuin(r);
  ctx.strokeStyle='#5d6f79';ctx.lineWidth=8;ctx.strokeRect(4,4,WORLD.w-8,WORLD.h-8);
}
function drawZone(z){const pulse=1+Math.sin(game.time*2+z.x)*.035;ctx.save();ctx.translate(z.x,z.y);const g=ctx.createRadialGradient(0,0,12,0,0,z.r*pulse);g.addColorStop(0,'rgba(71,201,255,.23)');g.addColorStop(.72,'rgba(64,163,213,.09)');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,z.r*pulse,0,TAU);ctx.fill();ctx.strokeStyle='rgba(89,203,255,.35)';ctx.lineWidth=3;ctx.setLineDash([12,14]);ctx.beginPath();ctx.arc(0,0,z.r*.88*pulse,0,TAU);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='rgba(184,233,255,.65)';ctx.font='700 12px Noto Sans KR';ctx.textAlign='center';ctx.fillText('경험치 지대',0,4);ctx.restore();}
function drawRuin(r){ctx.save();ctx.translate(r.x,r.y);ctx.fillStyle=r.type===0?'#26343c':'#213039';ctx.strokeStyle='#344752';ctx.lineWidth=3;ctx.beginPath();if(r.type===2){ctx.rect(-r.r*.25,-r.r,r.r*.5,r.r*2);}else{ctx.arc(0,0,r.r,0,TAU);}ctx.fill();ctx.stroke();ctx.restore();}
function drawBossArena(){
  ctx.fillStyle='#21151d';ctx.fillRect(BOSS_BOUNDS.x,BOSS_BOUNDS.y,BOSS_BOUNDS.w,BOSS_BOUNDS.h);
  const g=ctx.createRadialGradient(WORLD.w/2,WORLD.h/2,80,WORLD.w/2,WORLD.h/2,900);g.addColorStop(0,'rgba(173,41,69,.16)');g.addColorStop(1,'rgba(0,0,0,.45)');ctx.fillStyle=g;ctx.fillRect(BOSS_BOUNDS.x,BOSS_BOUNDS.y,BOSS_BOUNDS.w,BOSS_BOUNDS.h);
  ctx.strokeStyle='#d2485f';ctx.lineWidth=12;ctx.strokeRect(BOSS_BOUNDS.x,BOSS_BOUNDS.y,BOSS_BOUNDS.w,BOSS_BOUNDS.h);
  ctx.strokeStyle='rgba(255,211,94,.25)';ctx.lineWidth=4;ctx.beginPath();ctx.arc(WORLD.w/2,WORLD.h/2,390,0,TAU);ctx.stroke();
  ctx.fillStyle='rgba(255,214,96,.09)';ctx.font='900 160px serif';ctx.textAlign='center';ctx.fillText('♛',WORLD.w/2,WORLD.h/2+55);
}
function drawProjectile(p){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy,p.vx));ctx.shadowColor=p.color;ctx.shadowBlur=18;ctx.strokeStyle=p.color;ctx.lineWidth=p.radius*.55;ctx.beginPath();ctx.moveTo(-p.radius*1.5,0);ctx.lineTo(p.radius*1.5,0);ctx.stroke();ctx.restore();}
function drawEffects(){
  for(const e of effects){const t=e.life/e.max;ctx.save();ctx.globalAlpha=clamp(t,0,1);ctx.strokeStyle=e.color;ctx.lineWidth=(e.type==='ring'?8:5)*t;
    if(e.type==='slash'){ctx.translate(e.x,e.y);ctx.rotate(e.a);ctx.beginPath();ctx.arc(0,0,e.r*(1.15-t*.15),-.68,.68);ctx.stroke();}
    else if(e.type==='ring'){ctx.beginPath();ctx.arc(e.x,e.y,e.r*(1-t*.45),0,TAU);ctx.stroke();}
    else {ctx.beginPath();ctx.arc(e.x,e.y,e.r*(1-t*.3),0,TAU);ctx.stroke();}ctx.restore();}
  for(const p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size*(p.life/p.max),0,TAU);ctx.fill();}
  ctx.globalAlpha=1;ctx.textAlign='center';ctx.font='900 13px Noto Sans KR';for(const f of floatTexts){ctx.globalAlpha=f.life/f.max;ctx.fillStyle=f.color;ctx.fillText(f.text,f.x,f.y);}ctx.globalAlpha=1;
}
function drawNameplate(f){const y=f.y-44*f.size;ctx.textAlign='center';ctx.font=`${f.bossFlag?900:700} ${f.bossFlag?14:11}px Noto Sans KR`;ctx.fillStyle=f.bossFlag?'#ffd45e':'#dce7f5';ctx.fillText(`${f.bossFlag?'♛ ':''}${f.name} · Lv.${f.level}`,f.x,y);drawSmallBar(f.x,y+8,f.hp/f.maxHp,62*f.size,f.bossFlag?'#ff3f65':(f.isPlayer?'#e8b647':'#db526b'));}
function drawSmallBar(x,y,p,w,color){ctx.fillStyle='#05080dbb';ctx.fillRect(x-w/2,y,w,5);ctx.fillStyle=color;ctx.fillRect(x-w/2,y,w*clamp(p,0,1),5);}

// ---------- HUD ----------
function updateHUD(){
  if(!player)return;
  $('hudName').textContent=`${player.name} · Lv.${player.level}`;$('hudClass').textContent=player.evolutionNames.at(-1)||'초보 기사';
  $('hpFill').style.width=`${clamp(player.hp/player.maxHp*100,0,100)}%`;$('hpText').textContent=`${Math.ceil(Math.max(0,player.hp))} / ${Math.ceil(player.maxHp)}`;
  $('staminaFill').style.width=`${clamp(player.stamina/player.maxStamina*100,0,100)}%`;$('staminaText').textContent=`${Math.floor(player.stamina)} / ${Math.ceil(player.maxStamina)}`;
  $('xpFill').style.width=`${player.level>=40?100:clamp(player.xp/xpNeed(player.level)*100,0,100)}%`;
  $('runGold').textContent=fmt(game.runGold);$('killCount').textContent=game.kills;$('damageStat').textContent=Math.round(player.damage);
  if(game.mode==='boss'&&game.boss){$('bossTitle').textContent=`♛ BOSS · ${game.boss.name}`;$('bossClock').textContent=fmtTime(game.bossTimer);$('bossHpWrap').classList.remove('hidden');$('bossHpFill').style.width=`${Math.max(0,game.boss.hp/game.boss.maxHp*100)}%`;}
  else {$('bossTitle').textContent='다음 보스 선정';$('bossClock').textContent=fmtTime(game.bossCountdown);$('bossHpWrap').classList.add('hidden');}
  const top=[...fighters].filter(f=>f.alive).sort((a,b)=>b.level-a.level||b.kills-a.kills).slice(0,5);$('boardRows').innerHTML=top.map((f,i)=>`<div class="board-row ${f===player?'me':''}"><span>${i+1}. ${escapeHtml(f.name)}</span><span>Lv.${f.level}</span></div>`).join('');
  updateSkillSlot('attack',player.cool.attack,true,'베기');updateSkillSlot('dash',player.cool.dash,true,'대시');
  updateSkillSlot('e',player.cool.e,player.evoTier>=1,player.evoTier>=1?skillName('e'):'Lv.5');updateSkillSlot('r',player.cool.r,player.evoTier>=2,player.evoTier>=2?skillName('r'):'Lv.15');updateSkillSlot('q',player.cool.q,player.evoTier>=3,player.evoTier>=3?skillName('q'):'Lv.25');drawMinimap();
}
function skillName(k){if(k==='e')return player.evolutionIds.includes('guardian')?'방패 폭발':player.evolutionIds.includes('berserker')?'삼중 검기':'관통 검기';if(k==='r')return player.evolutionIds.includes('lancer')?'창기병 돌진':player.evolutionIds.includes('slayer')?'절멸 칼날':'대지 강타';return player.evolutionIds.includes('storm')?'검의 폭풍':player.evolutionIds.includes('colossus')?'철의 심판':'핏빛 왕관';}
function updateSkillSlot(key,cd,unlocked,name){const el=document.querySelector(`[data-skill="${key}"]`);if(!el)return;el.classList.toggle('locked',!unlocked);el.querySelector('.skill-name').textContent=name;const shade=el.querySelector('.cooldown-shade');shade.classList.toggle('hidden',!unlocked||cd<=0);shade.textContent=cd>0?cd.toFixed(cd<1?1:0):'';}
function drawMinimap(){mctx.clearRect(0,0,mini.width,mini.height);mctx.fillStyle='#101b27';mctx.fillRect(0,0,mini.width,mini.height);for(const z of zones){mctx.fillStyle='#4cc8eb44';mctx.beginPath();mctx.arc(z.x/WORLD.w*mini.width,z.y/WORLD.h*mini.height,z.r/WORLD.w*mini.width,0,TAU);mctx.fill();}for(const f of fighters)if(f.alive){mctx.fillStyle=f===player?'#ffd358':f.bossFlag?'#ff315a':'#e7677c';mctx.beginPath();mctx.arc(f.x/WORLD.w*mini.width,f.y/WORLD.h*mini.height,f===player?4:2.5,0,TAU);mctx.fill();}mctx.strokeStyle='#ffffff33';mctx.strokeRect(1,1,mini.width-2,mini.height-2);}
function announce(title,sub=''){const el=$('announcement');el.querySelector('strong').textContent=title;el.querySelector('span').textContent=sub;el.classList.add('show');clearTimeout(game.announcementTimer);game.announcementTimer=setTimeout(()=>el.classList.remove('show'),2300);}
function addFeed(killer,victim){const item=document.createElement('div');item.className='feed-item';item.innerHTML=`${escapeHtml(killer)} ⚔ <b>${escapeHtml(victim)}</b>`;$('killFeed').prepend(item);while($('killFeed').children.length>5)$('killFeed').lastChild.remove();setTimeout(()=>item.remove(),5500);}
