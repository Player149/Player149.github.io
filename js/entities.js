'use strict';

const BOT_NAMES = ['회색 늑대','청동 방패','별 없는 밤','랜스롯','참새 기사','붉은 장미','철갑 상어','달빛 검객','낡은 투구','까마귀','미늘창','북풍','검은 토끼','왕관 사냥꾼','초록 망토','작은 거인','방패벌레','마지막 촛불'];
const COLORS = ['#54b8e8','#e65f71','#8c72e8','#51c99b','#e5a94d','#d46fd0','#7596e8','#d1784f'];

class Fighter {
  constructor(name,x,y,isPlayer=false) {
    this.id=idSeed++; this.name=name; this.x=x; this.y=y; this.isPlayer=isPlayer;
    this.angle=rand(0,TAU); this.color=isPlayer?'#f0b84a':choose(COLORS); this.radius=25; this.size=1;
    this.level=1; this.xp=0; this.kills=0; this.alive=true; this.respawnAt=0;
    this.maxHp=100; this.hp=this.maxHp; this.damage=18; this.moveSpeed=178; this.attackSpeed=1;
    this.armor=3; this.crit=.06; this.lifesteal=0; this.skillPower=1; this.xpGain=1;
    this.maxStamina=100; this.stamina=100; this.blockReduction=.64; this.dashCdMult=1;
    this.cool={attack:0,dash:0,e:0,r:0,q:0}; this.attackAnim=0; this.hurtAnim=0;
    this.dashTime=0; this.dashVX=0; this.dashVY=0; this.invuln=0; this.blocking=false;
    this.evoTier=0; this.evolutionIds=[]; this.evolutionNames=[];
    this.ai={retarget:0,target:null,strafe:Math.random()<.5?-1:1,block:0};
    this.bossFlag=false; this.bossDamage=0; this.bossKills=0;
    this.zoneGlow=0; this.goldBonus=1; this.combatTimer=999;
    this.baseStats={maxHp:this.maxHp,damage:this.damage,moveSpeed:this.moveSpeed,attackSpeed:this.attackSpeed,armor:this.armor,crit:this.crit,lifesteal:this.lifesteal,skillPower:this.skillPower,xpGain:this.xpGain,maxStamina:this.maxStamina};
    if (isPlayer) applyRunes(this);
  }

  update(dt) {
    if (!this.alive) return;
    for (const k in this.cool) this.cool[k]=Math.max(0,this.cool[k]-dt);
    this.attackAnim=Math.max(0,this.attackAnim-dt*5); this.hurtAnim=Math.max(0,this.hurtAnim-dt*5);
    this.invuln=Math.max(0,this.invuln-dt); this.ai.block=Math.max(0,this.ai.block-dt);
    this.blocking=false;

    if (this.dashTime>0) {
      this.dashTime-=dt; this.x+=this.dashVX*dt; this.y+=this.dashVY*dt;
      if (Math.random()<.65) trailParticle(this.x,this.y,this.color);
    } else if (this.isPlayer) this.playerControl(dt);
    else this.botControl(dt);

    const b=currentBounds(), margin=this.radius*this.size;
    this.x=clamp(this.x,b.x+margin,b.x+b.w-margin); this.y=clamp(this.y,b.y+margin,b.y+b.h-margin);
    this.combatTimer+=dt;
    this.stamina=clamp(this.stamina+10*dt,0,this.maxStamina);
    if(this.combatTimer>=5&&this.hp<this.maxHp)this.hp=Math.min(this.maxHp,this.hp+this.maxHp*.1*dt);
    if (input.left && this.isPlayer && isGameplayReady()) this.attack();
  }

  playerControl(dt) {
    let mx=(input.keys.KeyD?1:0)-(input.keys.KeyA?1:0)+input.touchMove.x;
    let my=(input.keys.KeyS?1:0)-(input.keys.KeyW?1:0)+input.touchMove.y;
    const ml=Math.hypot(mx,my); if (ml>1){mx/=ml;my/=ml;}
    let speed=this.moveSpeed;
    if ((input.keys.ShiftLeft||input.keys.ShiftRight) && ml>.1) speed*=1.42;
    if (input.right && this.stamina>=15) { this.blocking=true; speed*=.5; }
    this.x+=mx*speed*dt; this.y+=my*speed*dt;
    if (input.mobile) {
      const t=nearestTarget(this,520); if(t) this.angle=Math.atan2(t.y-this.y,t.x-this.x); else if(ml>.1)this.angle=Math.atan2(my,mx);
    } else {
      const wx=camera.x-viewW/2+input.mouseX, wy=camera.y-viewH/2+input.mouseY;
      this.angle=Math.atan2(wy-this.y,wx-this.x);
    }
  }

  botControl(dt) {
    this.ai.retarget-=dt;
    if (this.ai.retarget<=0 || !validTarget(this,this.ai.target)) {
      this.ai.target=nearestTarget(this,780); this.ai.retarget=rand(.25,.7);
      if(Math.random()<.25)this.ai.strafe*=-1;
    }
    const t=this.ai.target; if(!t)return;
    const dx=t.x-this.x,dy=t.y-this.y,d=Math.hypot(dx,dy)||1;
    this.angle=Math.atan2(dy,dx);
    let toward=d>92?1:d<58?-.4:0;
    if(this.hp/this.maxHp<.22 && !this.bossFlag)toward=-.75;
    const side=(d<230?this.ai.strafe*.42:0);
    this.x+=(dx/d*toward + -dy/d*side)*this.moveSpeed*dt;
    this.y+=(dy/d*toward + dx/d*side)*this.moveSpeed*dt;
    if(d<145 && Math.random()<.012) this.ai.block=rand(.25,.6);
    this.blocking=this.ai.block>0&&this.stamina>=15;
    if(d<92)this.attack();
    if(this.evoTier>=1&&d<430&&this.cool.e<=0&&Math.random()<.008)this.skillE();
    if(this.evoTier>=2&&d<220&&this.cool.r<=0&&Math.random()<.005)this.skillR();
    if(this.evoTier>=3&&d<260&&this.cool.q<=0&&Math.random()<.003)this.skillQ();
    if(d>210&&d<440&&this.cool.dash<=0&&Math.random()<.004)this.dash();
  }

  attack() {
    if(!this.alive||this.cool.attack>0||this.blocking||this.stamina<15)return;
    this.stamina-=15;
    this.cool.attack=.56/this.attackSpeed; this.attackAnim=1;
    sfx('swing',this.isPlayer?1:.25);
    const range=84*this.size, arc=1.28;
    effects.push({type:'slash',x:this.x,y:this.y,a:this.angle,r:range,color:attackColor(this),life:.18,max:.18,size:this.size});
    let hitCount=0;
    for(const t of attackables(this)){
      const d=dist(this,t), a=Math.atan2(t.y-this.y,t.x-this.x);
      if(d<range+(t.radius||18) && Math.abs(angleDiff(a,this.angle))<arc/2){
        const crit=Math.random()<this.crit; dealDamage(t,this.damage*(crit?1.7:1),this,crit?'치명타':'베기');
        knock(t,Math.cos(this.angle)*65,Math.sin(this.angle)*65);
        if(++hitCount>=2&&!this.evolutionIds.includes('reaper'))break;
      }
    }
    if(game.mode==='play') addXp(this,.35);
  }

  dash() {
    if(!this.alive||this.cool.dash>0)return;
    let dx,dy;
    if(this.isPlayer){ dx=(input.keys.KeyD?1:0)-(input.keys.KeyA?1:0)+input.touchMove.x; dy=(input.keys.KeyS?1:0)-(input.keys.KeyW?1:0)+input.touchMove.y; }
    else {dx=Math.cos(this.angle);dy=Math.sin(this.angle);}
    let l=Math.hypot(dx,dy); if(l<.1){dx=Math.cos(this.angle);dy=Math.sin(this.angle);l=1;}
    dx/=l;dy/=l; this.dashTime=.17; this.dashVX=dx*690;this.dashVY=dy*690;
    this.cool.dash=2.15*this.dashCdMult;this.invuln=.22;sfx('dash',this.isPlayer?1:.2);
  }

  skillE() {
    if(!this.alive||this.evoTier<1||this.cool.e>0||this.stamina<25)return;
    this.stamina-=25;
    this.cool.e=6.5; sfx('skill',this.isPlayer?1:.2); if(game.mode==='play')addXp(this,1.3);
    if(this.evolutionIds.includes('guardian')){
      areaAttack(this,135,this.damage*1.25*this.skillPower,'방패 폭발','#78c9ff');this.invuln=Math.max(this.invuln,.34);
    } else {
      const count=this.evolutionIds.includes('berserker')?3:1;
      for(let i=0;i<count;i++) spawnProjectile(this,this.angle+(i-(count-1)/2)*.18,420,14,this.damage*1.2*this.skillPower,1.15,attackColor(this),this.evolutionIds.includes('duelist')?2:1);
    }
  }

  skillR() {
    if(!this.alive||this.evoTier<2||this.cool.r>0||this.stamina<25)return;
    this.stamina-=25;
    this.cool.r=11; sfx('skill',this.isPlayer?1:.2); if(game.mode==='play')addXp(this,2);
    if(this.evolutionIds.includes('lancer')){
      this.dashTime=.38;this.dashVX=Math.cos(this.angle)*850;this.dashVY=Math.sin(this.angle)*850;this.invuln=.42;
      areaAttack(this,115,this.damage*1.65*this.skillPower,'창기병 돌진','#ffd66c');
    } else if(this.evolutionIds.includes('slayer')){
      for(let i=-2;i<=2;i++)spawnProjectile(this,this.angle+i*.13,520,12,this.damage*.78*this.skillPower,1.3,'#ff6880',1);
    } else areaAttack(this,205,this.damage*1.5*this.skillPower,'대지 강타','#7ed6ff');
  }

  skillQ() {
    if(!this.alive||this.evoTier<3||this.cool.q>0||this.stamina<25)return;
    this.stamina-=25;
    this.cool.q=23; sfx('skill',this.isPlayer?1:.2); if(game.mode==='play')addXp(this,3);
    if(this.evolutionIds.includes('storm')){
      for(let i=0;i<12;i++)spawnProjectile(this,i/12*TAU,490,13,this.damage*.95*this.skillPower,1.4,'#73d9ff',2);
    } else if(this.evolutionIds.includes('colossus')){
      areaAttack(this,310,this.damage*2.15*this.skillPower,'철의 심판','#f4d889');this.invuln=1.1;
    } else {
      areaAttack(this,230,this.damage*2.6*this.skillPower,'핏빛 왕관','#ff3f65');
      this.hp=Math.min(this.maxHp,this.hp+this.maxHp*.18);
    }
  }

  draw() {
    if(!this.alive)return;
    const s=this.size, flash=this.hurtAnim>0;
    ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this.angle);
    ctx.globalAlpha=this.invuln>0&&Math.floor(this.invuln*18)%2? .45:1;
    ctx.fillStyle='#0005';ctx.beginPath();ctx.ellipse(0,9,30*s,18*s,0,0,TAU);ctx.fill();
    if(this.evoTier>=2){ctx.fillStyle=this.evolutionIds.includes('slayer')?'#671e35':'#263750';ctx.beginPath();ctx.moveTo(-13*s,0);ctx.lineTo(-38*s,-20*s);ctx.lineTo(-33*s,24*s);ctx.closePath();ctx.fill();}
    ctx.fillStyle=flash?'#fff':this.color;ctx.beginPath();ctx.arc(0,0,25*s,0,TAU);ctx.fill();
    ctx.lineWidth=3*s;ctx.strokeStyle=this.bossFlag?'#ffcf52':'#dfe8f4';ctx.stroke();
    ctx.fillStyle='#d5deea';ctx.beginPath();ctx.arc(5*s,-4*s,16*s,Math.PI,TAU);ctx.fill();
    ctx.fillStyle='#56657a';ctx.fillRect(-10*s,-6*s,27*s,5*s);
    ctx.fillStyle='#f1d5b4';ctx.fillRect(6*s,-3*s,11*s,7*s);
    if(this.evoTier>=1){ctx.fillStyle=this.evolutionIds.includes('berserker')?'#e64c5f':'#ffd25c';ctx.beginPath();ctx.moveTo(-3*s,-20*s);ctx.lineTo(4*s,-37*s);ctx.lineTo(11*s,-20*s);ctx.fill();}
    if(this.evoTier>=3){ctx.strokeStyle='#ffd65d';ctx.lineWidth=3*s;ctx.beginPath();ctx.moveTo(-5*s,-29*s);ctx.lineTo(0,-39*s);ctx.lineTo(6*s,-30*s);ctx.lineTo(12*s,-40*s);ctx.lineTo(16*s,-27*s);ctx.stroke();}
    // weapon
    const swing=this.attackAnim>0?Math.sin((1-this.attackAnim)*Math.PI)*.85:0;
    ctx.save();ctx.translate(8*s,9*s);ctx.rotate(-.35+swing);
    ctx.strokeStyle='#e7edf7';ctx.lineWidth=4*s;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(42*s,0);ctx.stroke();
    ctx.strokeStyle='#a97932';ctx.lineWidth=5*s;ctx.beginPath();ctx.moveTo(-8*s,0);ctx.lineTo(8*s,0);ctx.stroke();ctx.restore();
    if(this.blocking){ctx.fillStyle='#506985';ctx.strokeStyle='#b9cce1';ctx.lineWidth=3*s;ctx.beginPath();ctx.arc(23*s,0,16*s,-1.15,1.15);ctx.lineTo(20*s,0);ctx.closePath();ctx.fill();ctx.stroke();}
    ctx.restore();
    drawNameplate(this);
  }
}

class Monster {
  constructor(x,y){
    this.id=idSeed++;this.x=x;this.y=y;this.radius=18;this.maxHp=60;this.hp=this.maxHp;this.alive=true;this.respawnAt=0;
    this.angle=rand(0,TAU);this.wander=rand(0,TAU);this.cool=0;this.hurtAnim=0;this.type=Math.random()<.25?'brute':'wisp';
    if(this.type==='brute'){this.radius=24;this.maxHp=105;this.hp=this.maxHp;}
  }
  update(dt){
    if(!this.alive){if(game.time>this.respawnAt&&game.mode==='play')this.respawn();return;}
    this.cool=Math.max(0,this.cool-dt);this.hurtAnim=Math.max(0,this.hurtAnim-dt*5);
    let t=null,best=360;
    for(const f of fighters)if(f.alive){const d=dist(this,f);if(d<best){best=d;t=f;}}
    if(t){this.angle=Math.atan2(t.y-this.y,t.x-this.x);if(best>45){this.x+=Math.cos(this.angle)*70*dt;this.y+=Math.sin(this.angle)*70*dt;}if(best<55&&this.cool<=0){dealDamage(t,this.type==='brute'?13:8,this,'몬스터');this.cool=1.15;}}
    else {this.wander+=rand(-.5,.5)*dt;this.x+=Math.cos(this.wander)*22*dt;this.y+=Math.sin(this.wander)*22*dt;}
    this.x=clamp(this.x,25,WORLD.w-25);this.y=clamp(this.y,25,WORLD.h-25);
  }
  respawn(){this.x=rand(80,WORLD.w-80);this.y=rand(80,WORLD.h-80);this.hp=this.maxHp;this.alive=true;}
  draw(){if(!this.alive)return;ctx.save();ctx.translate(this.x,this.y);ctx.rotate(game.time*1.5+this.id);ctx.fillStyle=this.hurtAnim>0?'#fff':(this.type==='brute'?'#b44d65':'#7658bf');ctx.strokeStyle='#dcbcff';ctx.lineWidth=2;const r=this.radius;ctx.beginPath();for(let i=0;i<6;i++){const a=i/6*TAU,rr=i%2?r:r*.72;const x=Math.cos(a)*rr,y=Math.sin(a)*rr;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();if(this.hp<this.maxHp)drawSmallBar(this.x,this.y-this.radius-11,this.hp/this.maxHp,35,'#c460c8');}
}

function applyRunes(f){
  for(const id of meta.equipped){const lv=runeLevel(id);if(id==='edge')f.damage*=1+.04*lv;if(id==='heart'){f.maxHp*=1+.05*lv;f.hp=f.maxHp;}if(id==='wind')f.moveSpeed*=1+.03*lv;if(id==='wisdom')f.xpGain*=1+.05*lv;if(id==='fortune')f.goldBonus*=1+.08*lv;}
}
function attackColor(f){if(f.isPlayer&&hasRune('ember'))return'#ff624f';if(f.isPlayer&&hasRune('frost'))return'#6bdcff';return f.bossFlag?'#ffd45b':'#ecf2ff';}
function trailParticle(x,y,color){const c=(player?.isPlayer&&hasRune('frost'))?'#80eaff':color;particles.push({x,y,vx:rand(-20,20),vy:rand(-20,20),life:.35,max:.35,size:rand(3,7),color:c});}
