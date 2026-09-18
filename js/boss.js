'use strict';

// ---------- boss battle ----------
function startBossBattle(manual=false){
  if(game.mode!=='play'||game.paused||game.choiceOpen)return;
  let eligible=fighters.filter(f=>f.alive&&f.level>=10);
  // B키 데모에서는 플레이어가 Lv.10이면 가장 강한 AI 한 명도 Lv.10으로 보정한다.
  if(manual&&player?.alive&&player.level>=10&&eligible.length<2){
    const sparring=fighters.filter(f=>!f.isPlayer&&f.alive).sort((a,b)=>b.level-a.level)[0];
    if(sparring){while(sparring.level<10){sparring.level++;applyLevelGrowth(sparring);autoStat(sparring);if(EVOLUTIONS[sparring.level])autoEvolve(sparring,sparring.level);}eligible=fighters.filter(f=>f.alive&&f.level>=10);}
  }
  if(eligible.length<2){announce('보스전 참가 불가',manual?'레벨 10 이상 기사가 최소 2명 필요합니다.':'조건 충족 인원이 부족해 60초 연기됩니다.');game.bossCountdown=manual?game.bossCountdown:60;return;}
  game.mode='boss';game.bossTimer=180;game.bossParticipants=eligible;game.boss=choose(eligible);projectiles.length=0;
  game.bossSnapshot=fighters.map(f=>({f,values:{x:f.x,y:f.y,hp:f.hp,maxHp:f.maxHp,damage:f.damage,moveSpeed:f.moveSpeed,attackSpeed:f.attackSpeed,armor:f.armor,crit:f.crit,lifesteal:f.lifesteal,skillPower:f.skillPower,xpGain:f.xpGain,maxStamina:f.maxStamina,stamina:f.stamina,size:f.size,alive:f.alive,invuln:f.invuln}}));
  for(const f of fighters){f.bossFlag=false;f.bossDamage=0;f.bossKills=0;if(!eligible.includes(f)){f.alive=false;continue;}const base=f.baseStats;for(const k of ['damage','moveSpeed','attackSpeed','armor','crit','lifesteal','skillPower','xpGain','maxStamina'])f[k]=base[k]+(f[k]-base[k])*.1;f.maxHp=base.maxHp+(f.maxHp-base.maxHp)*.1;f.hp=f.maxHp;f.stamina=f.maxStamina;f.invuln=1;}
  const boss=game.boss, snap=game.bossSnapshot.find(s=>s.f===boss).values, challengers=eligible.length-1;
  boss.bossFlag=true;boss.damage=snap.damage*4;boss.attackSpeed=snap.attackSpeed*.55;boss.maxHp=snap.maxHp*(1+challengers*.7);boss.hp=boss.maxHp;boss.size=snap.size*1.62;game.bossMaxHp=boss.maxHp;
  boss.x=WORLD.w/2;boss.y=WORLD.h/2;
  const others=eligible.filter(f=>f!==boss);others.forEach((f,i)=>{const a=i/others.length*TAU;f.x=WORLD.w/2+Math.cos(a)*610;f.y=WORLD.h/2+Math.sin(a)*430;});
  announce('왕관의 폭주',`${boss.name} 님이 보스로 선정되었습니다!`);addFeed('BOSS',boss.name+' 등장');
}

function finishBossBattle(bossDied){
  if(game.mode!=='boss')return;
  const boss=game.boss, count=game.bossParticipants.length;let earned=0;
  if(player&&game.bossParticipants.includes(player)){
    if(player===boss)earned=Math.round(300000*boss.bossKills/count);
    else if(bossDied)earned=Math.round(100000*count*Math.min(1,player.bossDamage/game.bossMaxHp));
    game.runGold+=earned;
  }
  const pDamage=Math.round(player?.bossDamage||0),bKills=boss?.bossKills||0;
  for(const s of game.bossSnapshot)Object.assign(s.f,s.values);
  for(const f of fighters){f.bossFlag=false;f.bossDamage=0;f.bossKills=0;}
  game.mode='play';game.bossCountdown=300;projectiles.length=0;game.paused=true;
  $('bossResultTitle').textContent=bossDied?'도전자 승리':'보스 생존';
  $('bossResultText').textContent=bossDied?`${boss.name} 보스가 쓰러졌습니다.`:`${boss.name} 보스가 왕관을 지켰습니다.`;
  $('bossDamageResult').textContent=fmt(pDamage);$('bossKillsResult').textContent=String(bKills);$('bossGoldResult').textContent=fmt(earned);
  $('bossResultModal').classList.remove('hidden');
  game.boss=null;game.bossParticipants=[];game.bossSnapshot=[];
}

// ---------- run lifecycle ----------
function startGame(){
  audioCtx?.resume?.();meta.name=($('nameInput').value.trim()||'방랑 기사').slice(0,12);saveMeta();
  game.mode='play';game.paused=false;game.choiceOpen=false;game.time=0;game.runStart=0;game.bossCountdown=300;game.runGold=0;game.kills=0;game.revives=0;game.eventQueue=[];game.banked=false;
  fighters=[];monsters=[];projectiles=[];effects=[];particles=[];floatTexts=[];
  player=new Fighter(meta.name,WORLD.w/2,WORLD.h/2,true);fighters.push(player);
  for(let i=0;i<15;i++){const f=new Fighter(BOT_NAMES[i%BOT_NAMES.length],rand(120,WORLD.w-120),rand(120,WORLD.h-120));const levels=randi(0,4);for(let l=0;l<levels;l++){f.level++;applyLevelGrowth(f);autoStat(f);if(EVOLUTIONS[f.level])autoEvolve(f,f.level);}fighters.push(f);}
  for(let i=0;i<28;i++)monsters.push(new Monster(rand(80,WORLD.w-80),rand(80,WORLD.h-80)));
  if($('boostToggle').checked&&meta.boosts>0){meta.boosts--;for(let i=1;i<5;i++){player.level++;applyLevelGrowth(player);autoStat(player);if(EVOLUTIONS[player.level])autoEvolve(player,player.level);}saveMeta();}
  camera.x=player.x;camera.y=player.y;
  $('menu').classList.add('hidden');$('hud').classList.remove('hidden');$('mobileControls').classList.toggle('active',matchMedia('(pointer:coarse)').matches||innerWidth<700);
  $('gameOverModal').classList.add('hidden');$('pauseModal').classList.add('hidden');
  announce('전장 입장','살아남아 왕관을 차지하세요');updateMenuUI();
}
function bankRunGold(){if(game.runGold>0){meta.gold+=Math.floor(game.runGold);game.runGold=0;saveMeta();}game.banked=true;}
function endRun(){
  if(game.mode!=='play')return;game.mode='gameover';bankRunGold();
  $('overLevel').textContent=player.level;$('overKills').textContent=game.kills;$('overTime').textContent=fmtTime(game.time);
  updateReviveButton();$('gameOverModal').classList.remove('hidden');$('mobileControls').classList.remove('active');
}
function updateReviveButton(){const costs=[800,1800,4000],cost=costs[game.revives]||0,b=$('reviveBtn');b.textContent=game.revives<3?`◆ ${fmt(cost)} · 부활 (${game.revives}/3)`:'부활 한도 도달 (3/3)';b.disabled=game.revives>=3||meta.gold<cost;}
function revive(){const costs=[800,1800,4000],cost=costs[game.revives];if(game.revives>=3||meta.gold<cost)return;meta.gold-=cost;game.revives++;saveMeta();player.alive=true;player.hp=player.maxHp;player.x=WORLD.w/2+rand(-180,180);player.y=WORLD.h/2+rand(-180,180);player.invuln=3;game.mode='play';game.banked=false;$('gameOverModal').classList.add('hidden');$('mobileControls').classList.toggle('active',matchMedia('(pointer:coarse)').matches||innerWidth<700);announce('부활',`무적 3초 · 남은 부활 ${3-game.revives}회`);}
function returnMenu(){if((game.mode==='play'||game.mode==='gameover')&&!game.banked)bankRunGold();game.mode='menu';game.paused=false;game.choiceOpen=false;$('hud').classList.add('hidden');$('menu').classList.remove('hidden');for(const id of ['gameOverModal','pauseModal','bossResultModal','choiceModal'])$(id).classList.add('hidden');$('mobileControls').classList.remove('active');updateMenuUI();}
function respawnBots(){for(const f of fighters)if(!f.isPlayer&&!f.alive&&game.mode==='play'&&game.time>f.respawnAt){const nf=new Fighter(choose(BOT_NAMES),rand(80,WORLD.w-80),rand(80,WORLD.h-80));const idx=fighters.indexOf(f);fighters[idx]=nf;}}
