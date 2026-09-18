'use strict';

// ---------- combat ----------
function validTarget(owner,target){
  if(!target||!target.alive||target===owner)return false;
  if(game.mode==='boss'){
    if(target instanceof Monster)return false;
    return owner.bossFlag ? !target.bossFlag&&game.bossParticipants.includes(target) : target.bossFlag;
  }
  return true;
}
function attackables(owner){
  const arr=[];for(const f of fighters)if(validTarget(owner,f))arr.push(f);
  if(game.mode==='play')for(const m of monsters)if(m.alive)arr.push(m);
  return arr;
}
function nearestTarget(owner,maxD=Infinity){let best=null,bd=maxD;for(const t of attackables(owner)){const d=dist(owner,t);if(d<bd){bd=d;best=t;}}return best;}
function knock(t,vx,vy){if(t instanceof Fighter&&t.dashTime>0)return;t.x+=vx*.08;t.y+=vy*.08;}

function dealDamage(target,amount,source,kind='피해'){
  if(!target.alive||target.invuln>0)return 0;
  if(target instanceof Fighter)target.combatTimer=0;
  if(source instanceof Fighter)source.combatTimer=0;
  let reduction=target.armor?target.armor/(100+target.armor):0;
  if(target instanceof Fighter&&target.blocking&&target.stamina>0){reduction=1-(1-reduction)*(1-target.blockReduction);target.stamina=Math.max(0,target.stamina-5);if(source instanceof Fighter){source.stamina=Math.max(0,source.stamina-15);triggerExhaustion(source);}triggerExhaustion(target);effects.push({type:'block',x:target.x,y:target.y,a:target.angle,r:40,color:'#8dd6ff',life:.2,max:.2});}
  const final=Math.max(1,amount*(1-reduction));target.hp-=final;target.hurtAnim=1;
  if(source instanceof Fighter){
    if(source.lifesteal)source.hp=Math.min(source.maxHp,source.hp+final*source.lifesteal);
    if(game.mode==='play')addXp(source,Math.min(2,final*.028));
    if(game.mode==='boss'&&target===game.boss)source.bossDamage+=final;
  }
  floatTexts.push({x:target.x,y:target.y-25,text:String(Math.round(final)),color:kind==='치명타'?'#ffd75e':'#fff',life:.65,max:.65});
  burstParticles(target.x,target.y,kind==='치명타'?'#ffd75e':'#df566a',kind==='치명타'?10:5);
  if(source?.isPlayer||target.isPlayer){camera.shake=Math.min(12,camera.shake+final*.08);sfx('hit',source?.isPlayer?1:.45);}
  if(target.hp<=0)killTarget(target,source);
  return final;
}

function killTarget(target,killer){
  target.hp=0;target.alive=false;sfx('death',target.isPlayer?1:.2);burstParticles(target.x,target.y,'#ff5069',18);
  if(target instanceof Monster){
    target.respawnAt=game.time+rand(8,14);if(killer instanceof Fighter)addXp(killer,target.type==='brute'?48:28);return;
  }
  if(!(target instanceof Fighter))return;
  if(game.mode==='boss'){
    if(target===game.boss){setTimeout(()=>finishBossBattle(true),0);}
    else {if(killer===game.boss)game.boss.bossKills++;if(game.bossParticipants.filter(f=>f!==game.boss&&f.alive).length===0)setTimeout(()=>finishBossBattle(false),0);}
    return;
  }
  addFeed(killer?.name||'환경',target.name);
  if(killer instanceof Fighter){killer.kills++;addXp(killer,110+target.level*25);if(killer.isPlayer){game.kills++;game.runGold+=Math.round((70+target.level*20)*killer.goldBonus);}}
  if(target.isPlayer)endRun();
  else target.respawnAt=game.time+rand(5,9);
}

function spawnProjectile(owner,a,speed,radius,damage,life,color,pierce=1){
  projectiles.push({owner,x:owner.x+Math.cos(a)*35*owner.size,y:owner.y+Math.sin(a)*35*owner.size,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,radius,damage,life,max:life,color,pierce,hit:new Set()});
}
function areaAttack(owner,radius,damage,label,color){
  effects.push({type:'ring',x:owner.x,y:owner.y,r:radius,color,life:.38,max:.38});let n=0;
  for(const t of attackables(owner))if(dist(owner,t)<radius+(t.radius||18)){dealDamage(t,damage,owner,label);const a=Math.atan2(t.y-owner.y,t.x-owner.x);knock(t,Math.cos(a)*150,Math.sin(a)*150);n++;}
  return n;
}

function updateProjectiles(dt){
  for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;if(Math.random()<.35)particles.push({x:p.x,y:p.y,vx:0,vy:0,life:.25,max:.25,size:p.radius*.45,color:p.color});
    for(const t of attackables(p.owner)){if(p.hit.has(t.id))continue;if(Math.hypot(t.x-p.x,t.y-p.y)<p.radius+(t.radius||18)){p.hit.add(t.id);dealDamage(t,p.damage,p.owner,'기술');p.pierce--;burstParticles(p.x,p.y,p.color,6);if(p.pierce<=0){p.life=0;break;}}}
    if(p.life<=0||p.x<-50||p.y<-50||p.x>WORLD.w+50||p.y>WORLD.h+50)projectiles.splice(i,1);
  }
}

// ---------- leveling and evolution ----------
const STAT_CHOICES = [
  {icon:'🗡️',title:'날 세우기',desc:'공격력이 12% 증가합니다.',tag:'공격력 +12%',color:'#ff6d79',apply:f=>f.damage*=1.12},
  {icon:'❤️',title:'생명력',desc:'최대 체력이 15% 증가하고 그만큼 회복합니다.',tag:'최대 체력 +15%',color:'#ff5b75',apply:f=>{const old=f.maxHp;f.maxHp*=1.15;f.hp+=f.maxHp-old;}},
  {icon:'💨',title:'가벼운 갑옷',desc:'이동 속도가 9% 증가합니다.',tag:'이동 속도 +9%',color:'#69dfff',apply:f=>f.moveSpeed*=1.09},
  {icon:'⚡',title:'연속 베기',desc:'공격 속도가 13% 증가합니다.',tag:'공격 속도 +13%',color:'#ffd85e',apply:f=>f.attackSpeed*=1.13},
  {icon:'🛡️',title:'강철판',desc:'방어력이 8 증가합니다.',tag:'방어력 +8',color:'#7bb9e8',apply:f=>f.armor+=8},
  {icon:'🎯',title:'급소 감각',desc:'치명타 확률이 7%p 증가합니다.',tag:'치명타 +7%',color:'#f5a25e',apply:f=>f.crit=Math.min(.55,f.crit+.07)},
  {icon:'🩸',title:'흡혈',desc:'가한 피해의 4%만큼 회복합니다.',tag:'흡혈 +4%',color:'#ec4c6e',apply:f=>f.lifesteal=Math.min(.25,f.lifesteal+.04)},
  {icon:'✦',title:'비전 증폭',desc:'E·R·Q 기술 피해가 14% 증가합니다.',tag:'기술 위력 +14%',color:'#ac79ff',apply:f=>f.skillPower*=1.14},
  {icon:'➤',title:'짧은 발놀림',desc:'대시 재사용 시간이 14% 감소합니다.',tag:'대시 쿨타임 -14%',color:'#73e2ba',apply:f=>f.dashCdMult*=.86},
  {icon:'🔰',title:'지구력 훈련',desc:'최대 스태미나가 18 증가합니다.',tag:'스태미나 +18',color:'#8ce491',apply:f=>{f.maxStamina+=18;f.stamina+=18}}
];
const EVOLUTIONS = {
  5:[
    {id:'duelist',icon:'🗡️',title:'결투가',desc:'날렵한 검사가 됩니다. 검기가 적을 2명까지 관통합니다.',tag:'E · 관통 검기',color:'#6bd4ff',apply:f=>{f.attackSpeed*=1.15;f.moveSpeed*=1.07;}},
    {id:'guardian',icon:'🛡️',title:'수호 기사',desc:'단단한 전열 기사가 됩니다. E가 방패 폭발로 바뀝니다.',tag:'E · 방패 폭발',color:'#80c6ff',apply:f=>{const d=f.maxHp*.22;f.maxHp+=d;f.hp+=d;f.armor+=7;}},
    {id:'berserker',icon:'🪓',title:'광전사',desc:'세 갈래 핏빛 검기를 날리며 공격력이 크게 오릅니다.',tag:'E · 삼중 검기',color:'#ff6477',apply:f=>{f.damage*=1.2;f.maxHp*=.94;f.hp=Math.min(f.hp,f.maxHp);}}
  ],
  15:[
    {id:'lancer',icon:'🏇',title:'창기병',desc:'R로 전방을 꿰뚫는 초고속 돌진을 사용합니다.',tag:'R · 창기병 돌진',color:'#ffd56a',apply:f=>{f.moveSpeed*=1.1;f.damage*=1.08;}},
    {id:'sentinel',icon:'🏰',title:'성채 수호자',desc:'R로 넓은 대지 강타를 사용하고 방어력이 오릅니다.',tag:'R · 대지 강타',color:'#79caff',apply:f=>{f.armor+=12;f.blockReduction=Math.min(.82,f.blockReduction+.08);}},
    {id:'slayer',icon:'☠️',title:'학살자',desc:'R로 부채꼴 다섯 검기를 방출합니다.',tag:'R · 절멸의 칼날',color:'#ff6b83',apply:f=>{f.crit+=.1;f.attackSpeed*=1.08;}}
  ],
  25:[
    {id:'storm',icon:'🌩️',title:'폭풍 기사',desc:'Q로 모든 방향에 관통하는 폭풍 검기를 발사합니다.',tag:'Q · 검의 폭풍',color:'#73ddff',apply:f=>{f.skillPower*=1.2;f.cool.e=Math.max(0,f.cool.e-2);}},
    {id:'colossus',icon:'🗿',title:'철의 거신',desc:'Q로 거대한 심판을 내리고 잠시 무적이 됩니다.',tag:'Q · 철의 심판',color:'#f2da8c',apply:f=>{const d=f.maxHp*.3;f.maxHp+=d;f.hp+=d;f.size*=1.12;}},
    {id:'reaper',icon:'👑',title:'핏빛 왕',desc:'Q로 주위를 처형하고 체력을 회복합니다.',tag:'Q · 핏빛 왕관',color:'#ff496a',apply:f=>{f.damage*=1.18;f.lifesteal+=.06;}}
  ]
};

const BASE_HP_PER_LEVEL=300/39;
const BASE_STAMINA_PER_LEVEL=100/39;
function xpNeed(level){return Math.floor(38+level*15+Math.pow(level,1.28)*5);}
function applyLevelGrowth(f){
  f.maxHp+=BASE_HP_PER_LEVEL;f.maxStamina+=BASE_STAMINA_PER_LEVEL;
  f.stamina=Math.min(f.maxStamina,f.stamina+BASE_STAMINA_PER_LEVEL);
  f.baseStats.maxHp+=BASE_HP_PER_LEVEL;f.baseStats.maxStamina+=BASE_STAMINA_PER_LEVEL;
}
function addXp(f,amount){
  if(!f?.alive||game.mode==='boss'||f.level>=40)return;
  f.xp+=amount*f.xpGain;
  while(f.level<40&&f.xp>=xpNeed(f.level)){
    f.xp-=xpNeed(f.level);f.level++;applyLevelGrowth(f);
    const reward=Math.round((28+f.level*5)*f.goldBonus);
    if(f.isPlayer){game.runGold+=reward;sfx('level');announce(`LEVEL ${f.level}`,`골드 +${reward} · 새로운 힘을 선택하세요`);game.eventQueue.push({kind:'stat',level:f.level});if(EVOLUTIONS[f.level])game.eventQueue.unshift({kind:'evo',level:f.level});}
    else {autoStat(f);if(EVOLUTIONS[f.level])autoEvolve(f,f.level);}
    f.hp=Math.min(f.maxHp,f.hp+f.maxHp*.15);
  }
  if(f.isPlayer)processChoiceQueue();
}
function autoStat(f){choose(STAT_CHOICES).apply(f);}
function autoEvolve(f,level){const ev=choose(EVOLUTIONS[level]);ev.apply(f);f.evolutionIds.push(ev.id);f.evolutionNames.push(ev.title);f.evoTier++;}
function processChoiceQueue(){if(game.choiceOpen||game.paused||!game.eventQueue.length||!player?.alive)return;showChoice(game.eventQueue.shift());}
function showChoice(event){
  game.choiceOpen=true;$('choiceModal').classList.remove('hidden');
  const evo=event.kind==='evo';$('choiceEyebrow').textContent=evo?`EVOLUTION · LEVEL ${event.level}`:`LEVEL ${event.level} · STAT UPGRADE`;
  $('choiceTitle').textContent=evo?'진화할 계통을 선택하세요':'능력 하나를 선택하세요';
  $('choiceSubtitle').textContent=evo?'외형이 변화하고 새로운 기술이 해금됩니다.':'선택한 능력은 이번 생존 동안 계속 유지됩니다.';
  let choices=evo?[...EVOLUTIONS[event.level]]:shuffle([...STAT_CHOICES]).slice(0,3);
  $('choiceGrid').innerHTML='';
  choices.forEach((c,i)=>{const el=document.createElement('button');el.className='choice-card';el.style.setProperty('--accent',c.color);el.innerHTML=`<div class="choice-icon">${c.icon}</div><h3>${c.title}</h3><p>${c.desc}</p><small>${i+1} · ${c.tag}</small>`;el.onclick=()=>{
    c.apply(player);if(evo){player.evolutionIds.push(c.id);player.evolutionNames.push(c.title);player.evoTier++;announce(c.title,c.tag);}
    $('choiceModal').classList.add('hidden');game.choiceOpen=false;setTimeout(processChoiceQueue,80);
  };$('choiceGrid').appendChild(el);});
}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
