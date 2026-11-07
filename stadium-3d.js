/* Dependency-free perspective rendering of a metric 3D baseball field. */
(function (root) {
  'use strict';
  const PI = Math.PI;
  const stadiums = root.KBOStadiums;
  if (!stadiums || !stadiums.length) throw new Error('구장 정보를 불러올 수 없습니다.');
  const spec = Object.freeze({ foulDistance: 100, centerDistance: 125, fenceHeight: 2.6,
    baseDistance: 27.432, moundDistance: 18.44 });
  // Schematic neutral defense in metres; these markers are not prediction inputs.
  const defenders = Object.freeze([
    { role: '투수', position: [0, spec.moundDistance, 0.7] },
    { role: '포수', position: [0, -3, 0.7] },
    { role: '1루수', position: [23, 27, 0.7] },
    { role: '2루수', position: [12, 37, 0.7] },
    { role: '유격수', position: [-13, 36, 0.7] },
    { role: '3루수', position: [-24, 27, 0.7] },
    { role: '좌익수', position: [-49, 76, 0.7] },
    { role: '중견수', position: [0, 100, 0.7] },
    { role: '우익수', position: [49, 76, 0.7] }
  ]);
  function infieldGeometry() {
    const base = spec.baseDistance / Math.SQRT2;
    const diamond = [[0,0,.08],[base,base,.08],[0,2*base,.08],[-base,base,.08]];
    const grass = diamond.map(([x,y,z]) => [x*.78,base+(y-base)*.78,z]);
    // The old 34m arc was centred on home, leaving second base outside the dirt.
    // Centre the rear edge on the mound and intersect it with both foul lines.
    const dirtRadius = 29;
    const intersection = (spec.moundDistance + Math.sqrt(2*dirtRadius**2-spec.moundDistance**2))/2;
    const extent = Math.atan2(intersection,intersection-spec.moundDistance);
    const dirt = [[0,-3,.05]];
    for(let i=0;i<=48;i++) {
      const a=-extent+2*extent*i/48;
      dirt.push([dirtRadius*Math.sin(a),spec.moundDistance+dirtRadius*Math.cos(a),.05]);
    }
    return {base,diamond,grass,dirt};
  }
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  function fenceDistance(angle, stadium = stadiums[0]) {
    angle = clamp(angle, -PI/4, PI/4);
    if(stadium.curve) {
      // Shape-preserving Hermite interpolation through distance anchors. Unlike
      // straight chords, this keeps rounded parks rounded without overshooting.
      const points=stadium.curve,degrees=angle*180/PI;
      let i=0;while(i<points.length-2&&degrees>points[i+1][0])i++;
      const slope=j=>(points[j+1][1]-points[j][1])/(points[j+1][0]-points[j][0]);
      const tangent=j=>{
        if(j===0)return slope(0);if(j===points.length-1)return slope(j-1);
        const a=slope(j-1),b=slope(j);return a*b<=0?0:2*a*b/(a+b);
      };
      const h=points[i+1][0]-points[i][0],t=(degrees-points[i][0])/h;
      return (2*t**3-3*t*t+1)*points[i][1]+(t**3-2*t*t+t)*h*tangent(i)
        +(-2*t**3+3*t*t)*points[i+1][1]+(t**3-t*t)*h*tangent(i+1);
    }
    if (stadium.boundary) {
      // Ray/segment intersection keeps polygonal walls straight between anchors.
      const degrees = angle * 180 / PI;
      const anchors = stadium.boundary;
      let i = 0;
      while (i < anchors.length - 2 && degrees > anchors[i+1][0]) i++;
      const a = fieldPoint(anchors[i][0]*PI/180, anchors[i][1]);
      const b = fieldPoint(anchors[i+1][0]*PI/180, anchors[i+1][1]);
      const dx = b[0]-a[0], dy = b[1]-a[1];
      return (a[0]*dy-a[1]*dx)/(Math.sin(angle)*dy-Math.cos(angle)*dx);
    }
    // Circular reconstruction through the left/centre/right reference distances.
    const poleY = stadium.left / Math.SQRT2;
    const centerY = (stadium.left**2-stadium.center**2)/(2*(poleY-stadium.center));
    const radius = stadium.center-centerY;
    return centerY * Math.cos(angle) + Math.sqrt(radius ** 2 - centerY ** 2 * Math.sin(angle) ** 2);
  }
  function fenceHeight(angle, stadium = stadiums[0]) {
    return stadium.rightWallHeight && angle >= PI/8 ? stadium.rightWallHeight : stadium.fenceHeight;
  }
  function fieldPoint(angle, distance, height = 0) {
    return [Math.sin(angle) * distance, Math.cos(angle) * distance, height];
  }
  // Schematic architecture, intentionally separate from the collision boundary.
  function outfieldStructures(stadium) {
    const config=stadium.architecture,faces=[],lines=[];
    const rad=degrees=>degrees*PI/180;
    const point=(degree,offset,z)=>fieldPoint(rad(degree),fenceDistance(rad(degree),stadium)+offset,z);
    const face=(points,color)=>faces.push({points,color});
    const line=(points,color,width=1)=>lines.push({points,color,width});
    for(const section of config.stands) {
      const {from,to,rows,offset,depth,rise,base,color,kind='seats'}=section;
      const steps=Math.ceil((to-from)/2);
      for(let j=0;j<steps;j++) {
        let a=from+(to-from)*j/steps,b=from+(to-from)*(j+1)/steps;
        // Narrow radial aisles break the concrete bowl into recognizable blocks.
        if(kind==='seats'&&j%5===0)a+=.45;
        for(let row=0;row<rows;row++) {
          const d=offset+row*depth,z=base+row*rise;
          face([point(a,d,z),point(b,d,z),point(b,d+depth,z),point(a,d+depth,z)],color);
          face([point(a,d,z-rise),point(b,d,z-rise),point(b,d,z),point(a,d,z)],kind==='lawn'?'#375d3b':'#263c43');
          if(kind!=='lawn'&&row%2===0)line([point(a,d+depth*.65,z+.1),point(b,d+depth*.65,z+.1)],kind==='terrace'?'#c3ad87':'#b8c1bd55',.55);
        }
        const back=offset+rows*depth,z=base+(rows-1)*rise;
        line([point(a,back,z+1),point(b,back,z+1)],'#728387',.75);
      }
      // Walkway and light retaining wall behind each independently sized section.
      const cuts=Array.from({length:steps+1},(_,j)=>from+(to-from)*j/steps);
      for(let j=0;j<steps;j++) {
        const d=offset+rows*depth,z=base+(rows-1)*rise;
        face([point(cuts[j],d,z),point(cuts[j+1],d,z),point(cuts[j+1],d+2.5,z),point(cuts[j],d+2.5,z)],'#526166');
      }
    }
    const eye=config.eye;
    for(let a=-eye;a<eye;a+=1)face([point(a,1,0),point(a+1,1,0),point(a+1,1,9),point(a,1,9)],'#102f2a');
    for(const board of config.boards) {
      const a=rad(board.angle),center=point(board.angle,board.offset,board.bottom),tangent=[Math.cos(a),-Math.sin(a),0];
      const q=(x,z,behind=0)=>[center[0]+tangent[0]*x+Math.sin(a)*behind,center[1]+tangent[1]*x+Math.cos(a)*behind,center[2]+z];
      const w=board.width/2,h=board.height;
      face([q(-w-1,-1),q(w+1,-1),q(w+1,h+1),q(-w-1,h+1)],'#283c49');
      face([q(-w,0,-.1),q(w,0,-.1),q(w,h,-.1),q(-w,h,-.1)],'#102732');
      face([q(-w-1,h+1),q(w+1,h+1),q(w+1,h+1,2),q(-w-1,h+1,2)],'#617583');
      face([q(w+1,-1),q(w+1,h+1),q(w+1,h+1,2),q(w+1,-1,2)],'#172935');
      for(const x of [-w*.7,w*.7]) {
        const bottom=-board.bottom;
        face([q(x-1,bottom,1),q(x+1,bottom,1),q(x+1,0,1),q(x-1,0,1)],'#40545c');
      }
      // A restrained LED grid conveys a screen without adding advertising copy.
      for(let row=1;row<6;row++)line([q(-w+1,h*row/6,-.2),q(w-1,h*row/6,-.2)],'#548b9955',.7);
      line([q(-w+1,h*.78,-.3),q(w*.2,h*.78,-.3)],'#b9d8c9',1.5);
      if(config.boardCrown)line([q(-6,h+2),q(6,h+2),q(6,h+5),q(0,h+7),q(-6,h+5),q(-6,h+2)],'#b1c7d4',1.3);
    }
    for(const degree of config.lights) {
      const q=point(degree,30,0),z=37;
      face([[q[0]-.6,q[1],0],[q[0]+.6,q[1],0],[q[0]+.35,q[1],z],[q[0]-.35,q[1],z]],'#52636e');
      const a=rad(degree),t=[Math.cos(a),-Math.sin(a)];
      const lamp=(x,h)=>[q[0]+t[0]*x,q[1]+t[1]*x,h];
      face([lamp(-4,z),lamp(4,z),lamp(4,z+3),lamp(-4,z+3)],'#374e59');
      for(let x=-3;x<=3;x+=1.5)line([lamp(x,z+.6),lamp(x,z+2.4)],'#e0e9c4',1.4);
    }
    if(config.indoor) {
      // Open cutaway of the rear dome ribs keeps the ball and field visible.
      for(const offset of [23,29]) {
        const arch=Array.from({length:49},(_,i)=>{const a=-45+i*90/48;return point(a,offset,30+34*Math.cos(rad(a*2)));});
        line(arch,'#7a8c9e',1.5);
      }
      for(const a of [-45,-30,-15,0,15,30,45])line([point(a,23,18),point(a,23,30+34*Math.cos(rad(a*2)))],'#718697',1);
    }
    if(config.rightFrame) {
      for(const a of [25,31,37,43])line([point(a,3,8),point(a,3,16)],'#8d9491',1);
      line([point(25,3,16),point(43,3,16)],'#8d9491',1);
    }
    return {faces,lines};
  }
  const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const normalize = a => { const norm = Math.hypot(...a); return a.map(v => v / norm); };
  function cameraBasis(yaw, elevation, distance) {
    const target = [0, 56, 8];
    const eye = [target[0] + distance * Math.cos(elevation) * Math.sin(yaw),
      target[1] - distance * Math.cos(elevation) * Math.cos(yaw), target[2] + distance * Math.sin(elevation)];
    const forward = normalize(target.map((v, i) => v - eye[i]));
    const right = normalize(cross(forward, [0, 0, 1]));
    return { eye, forward, right, up: cross(right, forward) };
  }
  function project(point, basis, width, height) {
    const relative = point.map((v, i) => v - basis.eye[i]);
    const depth = dot(relative, basis.forward);
    if (depth <= 1) return null;
    const focal = Math.min(width, height * 1.5) * 1.05;
    return { x: width / 2 + dot(relative, basis.right) * focal / depth,
      y: height / 2 - dot(relative, basis.up) * focal / depth, depth };
  }
  function create(canvas, options = {}) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('3D 화면을 표시할 수 없습니다.');
    let yaw = -.24, elevation = .65, distance = 275;
    let width = 600, height = 470, flight = null, frame = 0, pixelRatio = 1;
    let stadium = stadiums[0], sceneDirty = true;
    let playing = false, playTime = 0, lastTick = null, lastNotified = -1, disposed = false;
    const motionPreference = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
    // Cache the field at device resolution; animation only redraws the ball and path.
    const layer = root.document ? root.document.createElement('canvas') : null;
    const layerCtx = layer ? layer.getContext('2d') : null;
    const infield = infieldGeometry(), pointers = new Map(), listeners = [];
    let pinch = 0;
    function listen(type, handler, settings) {
      canvas.addEventListener(type, handler, settings); listeners.push([type, handler, settings]);
    }
    function duration() { return flight ? flight.duration || flight.points.at(-1).t || 1 : 0; }
    function notify(force = false) {
      const bucket = Math.floor(playTime * 20);
      if (options.onPlayback && (force || bucket !== lastNotified)) {
        lastNotified = bucket; options.onPlayback({playing, time:playTime, duration:duration()});
      }
    }
    function schedule() {
      if (!frame && !disposed) frame = requestAnimationFrame(time => { frame=0; draw(time); });
    }
    function resize() {
      const bounds=canvas.getBoundingClientRect(); width=Math.max(1,bounds.width);height=Math.max(1,bounds.height);
      pixelRatio=Math.min(root.devicePixelRatio||1,2);
      canvas.width=Math.round(width*pixelRatio);canvas.height=Math.round(height*pixelRatio);
      ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
      if(layerCtx){layer.width=canvas.width;layer.height=canvas.height;layerCtx.setTransform(pixelRatio,0,0,pixelRatio,0,0);}
      sceneDirty=true;schedule();
    }
    function circle3(x,y,z,radius,segments=48) {
      return Array.from({length:segments},(_,i)=>[x+radius*Math.cos(i*2*PI/segments),y+radius*Math.sin(i*2*PI/segments),z]);
    }
    function drawLine(c,p,points,color,thickness=1,dashed=false) {
      c.beginPath();let started=false;
      for(const point of points){const q=p(point);if(!q){started=false;continue;}if(!started){c.moveTo(q.x,q.y);started=true;}else c.lineTo(q.x,q.y);}
      c.strokeStyle=color;c.lineWidth=thickness;c.setLineDash(dashed?[3,6]:[]);c.stroke();c.setLineDash([]);
    }
    function label(c,p,position,text,color='#c7dcd8') {
      const q=p(position);if(!q||q.x<26||q.x>width-26||q.y<18||q.y>height-12)return;
      c.font='10px "Segoe UI","Malgun Gothic",sans-serif';c.textAlign='center';
      c.lineWidth=4;c.strokeStyle='#0a1920';c.strokeText(text,q.x,q.y);c.fillStyle=color;c.fillText(text,q.x,q.y);
    }
    function renderScene(c,p) {
      c.clearRect(0,0,width,height);
      const bg=c.createLinearGradient(0,0,width,height);bg.addColorStop(0,'#112735');bg.addColorStop(.55,'#091721');bg.addColorStop(1,'#060e17');
      c.fillStyle=bg;c.fillRect(0,0,width,height);
      const faces=[],lines=[];
      const face=(points,color,stroke,layerOverride)=>{
        const projected=points.map(p);if(!projected.every(Boolean))return;
        const flat=points.every(q=>q[2]===points[0][2]);
        const layer=flat?(points[0][2]<0?0:points[0][2]===0?1:2+points[0][2]):4;
        faces.push({points:projected,color,stroke,layer:layerOverride===undefined?layer:layerOverride,depth:projected.reduce((s,q)=>s+q.depth,0)/projected.length});
      };
      const line=(points,color,thickness=1,dashed=false)=>lines.push({points,color,thickness,dashed});
      const angles=Array.from({length:73},(_,i)=>-PI/4+i*PI/144);
      for(const [degree] of [...(stadium.boundary||[]),...(stadium.curve||[])])angles.push(degree*PI/180);
      if(stadium.rightWallHeight)angles.push(PI/8);
      const breaks=[...new Set(angles)].sort((a,b)=>a-b);
      const outer=[[-12,-12,-.4],...breaks.map(a=>fieldPoint(a,fenceDistance(a,stadium)+40,-.4)),[12,-12,-.4]];
      // A floating architectural base and abstract tiers; not a surveyed seating plan.
      const bottom=outer.map(([x,y])=>[x,y,-3]);
      face(bottom,'#061219');
      for(let i=0;i<outer.length;i++)face([outer[i],outer[(i+1)%outer.length],bottom[(i+1)%outer.length],bottom[i]],'#10242c');
      face(outer,'#1b3536');
      for(let i=0;i<breaks.length-1;i++) {
        const a=breaks[i],b=breaks[i+1],da=fenceDistance(a,stadium),db=fenceDistance(b,stadium);
        // Mowing rings use ground distance, independent of angular mesh density.
        for(let band=0;band<12;band++) {
          const inner=band*12,ra=Math.min(da,(band+1)*12),rb=Math.min(db,(band+1)*12);
          if(inner>=Math.max(da,db))continue;
          face([fieldPoint(a,Math.min(inner,da)),fieldPoint(b,Math.min(inner,db)),fieldPoint(b,rb),fieldPoint(a,ra)],band%2?'#317859':'#286c4f');
        }
        // Warning track on the actual field side of the wall.
        face([fieldPoint(a,da-3.5,.015),fieldPoint(b,db-3.5,.015),fieldPoint(b,db,.015),fieldPoint(a,da,.015)],'#89745b');
        const pa=fieldPoint(a,da),pb=fieldPoint(b,db),wall=fenceHeight((a+b)/2,stadium);
        face([pa,pb,[pb[0],pb[1],wall],[pa[0],pa[1],wall]],stadium.architecture.wallColor,'#325b58');
        line([[pa[0],pa[1],wall],[pb[0],pb[1],wall]],'#c5b983',1.3);

      }
      const architecture=outfieldStructures(stadium);
      for(const f of architecture.faces)face(f.points,f.color,undefined,4);
      for(const l of architecture.lines)line(l.points,l.color,l.width);
      const {base,diamond,grass,dirt}=infield;
      face(dirt,'#bb8c62','#d1a578');face(circle3(0,0,.06,3.4),'#bb8c62');
      face(grass,'#3a8560','#80a774');
      // Dirt basepaths remain visible around the central grass diamond.
      line([...diamond,diamond[0]],'#d9b688',1.2);
      for(const sign of [-1,1]) {
        const pole=fieldPoint(sign*PI/4,sign<0?stadium.left:stadium.right);
        line([[0,0,.12],pole],'#edf0d7',1.4);line([pole,[pole[0],pole[1],14]],'#f4d076',2);
        // Batter boxes and coach boxes, understated but correctly on the ground plane.
        const x=sign*1.3;
        line([[x-.6,-1,.14],[x+.6,-1,.14],[x+.6,.8,.14],[x-.6,.8,.14],[x-.6,-1,.14]],'#e9ddc5',.8);
      }
      for(const [x,y] of [[base,base],[0,2*base],[-base,base]]) {
        face([[x-.45,y,.16],[x,y-.45,.16],[x+.45,y,.16],[x,y+.45,.16]],'#fff4dd');
      }
      face([[-.216,-.216,.17],[.216,-.216,.17],[.216,0,.17],[0,.216,.17],[-.216,0,.17]],'#fff8e9');
      face(circle3(0,spec.moundDistance,.22,2.7),'#c69a70');
      line([[-.3,spec.moundDistance,.28],[.3,spec.moundDistance,.28]],'#fff1dc',2);
      faces.sort((a,b)=>a.layer-b.layer||b.depth-a.depth);
      for(const f of faces) {
        c.beginPath();f.points.forEach((q,i)=>i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y));c.closePath();
        c.fillStyle=f.color;c.fill();if(f.stroke){c.strokeStyle=f.stroke;c.lineWidth=.5;c.stroke();}
      }
      c.lineJoin='round';c.lineCap='round';for(const l of lines)drawLine(c,p,l.points,l.color,l.thickness,l.dashed);
      for(const defender of defenders) {
        const q=p(defender.position);if(!q)continue;const size=clamp(800/q.depth,2.5,4);
        c.beginPath();c.arc(q.x,q.y,size+3,0,2*PI);c.fillStyle='#f6d69b20';c.fill();
        c.beginPath();c.arc(q.x,q.y,size,0,2*PI);c.fillStyle='#f2d29a';c.fill();c.strokeStyle='#203b38';c.lineWidth=1;c.stroke();
      }
      label(c,p,fieldPoint(-PI/4,stadium.left+9,9),'좌측 '+stadium.left+'m');
      label(c,p,[0,stadium.center+10,10],'중앙 '+stadium.center+'m');
      label(c,p,fieldPoint(PI/4,stadium.right+9,9),'우측 '+stadium.right+'m');
      c.textAlign='left';c.fillStyle='#74938f';c.font='10px "Segoe UI",sans-serif';
      c.fillText(stadium.left+' / '+stadium.center+' / '+stadium.right+'m',16,height-18);
    }
    function draw(timestamp) {
      const now=Number.isFinite(timestamp)?timestamp:0;
      if(playing&&flight) {
        if(lastTick!==null)playTime=Math.min(duration(),playTime+Math.min(.1,Math.max(0,(now-lastTick)/1000)));
        lastTick=now;if(playTime>=duration()){playing=false;lastTick=null;notify(true);}
      }
      const basis=cameraBasis(yaw,elevation,distance*(stadium.architecture.viewScale||1)),p=point=>project(point,basis,width,height);
      if(layerCtx) {
        if(sceneDirty){renderScene(layerCtx,p);sceneDirty=false;}
        ctx.clearRect(0,0,width,height);ctx.drawImage(layer,0,0,width,height);
      } else renderScene(ctx,p);
      if(flight)renderFlight(p);
      notify();if(playing)schedule();
    }
    function renderFlight(p) {
      const total=duration(),all=flight.points;
      // Sample the original time coordinate, so slow apex motion is preserved.
      const timeAt=i=>Number.isFinite(all[i].t)?all[i].t:total*i/(all.length-1);
      let high=1;while(high<all.length-1&&timeAt(high)<playTime)high++;
      const a=all[high-1],b=all[high],fraction=clamp((playTime-timeAt(high-1))/Math.max(1e-9,timeAt(high)-timeAt(high-1)),0,1);
      const ball={x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction,z:a.z+(b.z-a.z)*fraction};
      const sampled=all.filter((_,i)=>i%4===0||i===all.length-1);
      const completed=all.slice(0,high).filter((_,i)=>i%4===0).concat(ball);
      const to3=q=>[q.x,q.y,q.z];
      // The complete preview stays visible while a brighter trail reveals the flight.
      drawLine(ctx,p,sampled.map(q=>[q.x,q.y,.10]),'#85c8bf35',1,true);
      drawLine(ctx,p,sampled.map(to3),'#79c9ff38',1.5,true);
      ctx.lineCap='round';ctx.lineJoin='round';
      drawLine(ctx,p,completed.map(to3),'#79c9ff12',12);
      drawLine(ctx,p,completed.map(to3),'#79c9ff30',7);
      drawLine(ctx,p,completed.map(to3),'#79c9ff',2.4);
      const apex=all.reduce((best,q)=>q.z>best.z?q:best,all[0]);
      drawLine(ctx,p,[[apex.x,apex.y,0],[apex.x,apex.y,apex.z]],'#aacdc044',.8,true);
      label(ctx,p,[apex.x,apex.y,apex.z+4],flight.maxHeight.toFixed(1)+'m','#b7e5f1');
      const landing=flight.landing,land= p([landing.x,landing.y,.15]);
      const ringColor=flight.isFoul?'#ffbd92':'#8eeac9';
      drawLine(ctx,p,circle3(landing.x,landing.y,.15,2.3),ringColor,1.4);
      if(land){ctx.beginPath();ctx.arc(land.x,land.y,2,0,2*PI);ctx.fillStyle=ringColor;ctx.fill();}
      if(playTime>=total) {
        label(ctx,p,[landing.x,landing.y,4],flight.distance ? flight.distance.toFixed(1)+'m' : '',ringColor);
      }
      const q=p(to3(ball)),shadow=p([ball.x,ball.y,.15]);
      if(shadow){ctx.beginPath();ctx.ellipse(shadow.x,shadow.y,clamp(5+ball.z*.12,5,11),2.2,0,0,2*PI);ctx.fillStyle='#03171355';ctx.fill();}
      if(q) {
        const r=clamp(1250/q.depth,3.3,6);
        ctx.beginPath();ctx.arc(q.x,q.y,r+7,0,2*PI);ctx.fillStyle='#fff6cf14';ctx.fill();
        const fill=ctx.createRadialGradient(q.x-r*.4,q.y-r*.5,.1,q.x,q.y,r);
        fill.addColorStop(0,'#ffffff');fill.addColorStop(.5,'#fff3d8');fill.addColorStop(1,'#b5bdb5');
        ctx.beginPath();ctx.arc(q.x,q.y,r,0,2*PI);ctx.fillStyle=fill;ctx.fill();
        ctx.beginPath();ctx.arc(q.x+r*.35,q.y,r*.65,PI*.65,PI*1.35);ctx.strokeStyle='#be7466';ctx.lineWidth=.8;ctx.stroke();
      }
    }
    function zoom(factor) { distance=clamp(distance*factor,140,480);sceneDirty=true;schedule(); }
    function reset() { yaw=-.24;elevation=.65;distance=275;sceneDirty=true;schedule(); }
    const separation=()=>{const a=[...pointers.values()];return a.length>=2?Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y):0;};
    listen('pointerdown',event=>{pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');pinch=separation();canvas.focus({preventScroll:true});});
    listen('pointermove',event=>{
      const previous=pointers.get(event.pointerId);if(!previous)return;
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if(pointers.size===1){yaw-=(event.clientX-previous.x)*.008;elevation=clamp(elevation+(event.clientY-previous.y)*.006,.10,1.50);sceneDirty=true;schedule();}
      else {const next=separation();if(pinch>0&&next>0)zoom(pinch/next);pinch=next;}
    });
    const release=event=>{pointers.delete(event.pointerId);pinch=separation();if(!pointers.size)canvas.classList.remove('dragging');};
    listen('pointerup',release);listen('pointercancel',release);listen('lostpointercapture',release);
    listen('wheel',event=>{event.preventDefault();zoom(Math.exp(clamp(event.deltaY,-100,100)*.002));},{passive:false});
    listen('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(event.key))return;
      event.preventDefault();
      if(event.key==='Home')reset();else if(event.key==='+'||event.key==='=')zoom(.85);else if(event.key==='-')zoom(1.18);
      else {if(event.key==='ArrowLeft')yaw-=.12;if(event.key==='ArrowRight')yaw+=.12;if(event.key==='ArrowUp')elevation=clamp(elevation+.08,.10,1.50);if(event.key==='ArrowDown')elevation=clamp(elevation-.08,.10,1.50);sceneDirty=true;schedule();}
    });
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
    return {setFlight(value){
        const same=flight&&value&&flight.distance===value.distance&&flight.duration===value.duration&&
          flight.constants&&value.constants&&JSON.stringify(flight.constants)===JSON.stringify(value.constants)&&flight.batterHand===value.batterHand;
        flight=value;if(!same){playTime=motionPreference&&motionPreference.matches?duration():0;playing=!(motionPreference&&motionPreference.matches);lastTick=null;notify(true);}schedule();
      },
      togglePlayback(){if(!flight)return;if(playTime>=duration())playTime=0;playing=!playing;lastTick=null;notify(true);schedule();},
      replay(){if(!flight)return;playTime=0;playing=true;lastTick=null;notify(true);schedule();},
      seek(fraction){if(!Number.isFinite(fraction)||!flight)return;playTime=clamp(fraction,0,1)*duration();playing=false;lastTick=null;notify(true);schedule();},
      setStadium(id){
        const selected=stadiums.find(item=>item.id===id);
        if(!selected)throw new RangeError(`알 수 없는 구장: ${id}`);
        stadium=selected;sceneDirty=true;schedule();
      },reset,zoom,
      top(){elevation=1.50;yaw=0;distance=275;sceneDirty=true;schedule();},
      destroy(){disposed=true;playing=false;observer.disconnect();listeners.forEach(([type,fn,options])=>canvas.removeEventListener(type,fn,options));if(frame)cancelAnimationFrame(frame);}};
  }
  root.BaseballStadium3D={create,spec,stadiums,defenders,infieldGeometry,fenceDistance,fenceHeight,cameraBasis,project,outfieldStructures};
})(typeof window==='undefined'?globalThis:window);
