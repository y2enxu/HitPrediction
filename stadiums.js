/* Metres. Sources and reconstruction assumptions: docs/stadiums.md. */
(function (root) {
  'use strict';
  // The club's overhead guide shows two straight side walls and a flat centre
  // cut-off, rather than a pointed centre joining arbitrary 22.5-degree anchors.
  // Derive the corners from the published foul-line and centre distances.
  function clippedSquareBoundary(side, center) {
    const x = Math.SQRT2 * side - center;
    const angle = Math.atan2(x, center) * 180 / Math.PI;
    const cornerDistance = Math.hypot(x, center);
    return [[-45, side], [-angle, cornerDistance], [angle, cornerDistance], [45, side]];
  }
  const stadiums = [
    { id: 'jamsil', name: '잠실야구장', left: 100, center: 125, right: 100, fenceHeight: 2.6,
      curve: [[-45,100],[-22.5,120],[0,125],[22.5,120],[45,100]] },
    { id: 'gocheok', name: '고척스카이돔', left: 99, center: 122, right: 99, fenceHeight: 4 },
    { id: 'incheon', name: '인천 SSG 랜더스필드', left: 95, center: 120, right: 95, fenceHeight: 2.8,
      curve: [[-45,95],[-22.5,115],[0,120],[22.5,115],[45,95]] },
    { id: 'suwon', name: '수원 KT 위즈파크', left: 98, center: 120, right: 98, fenceHeight: 4,
      curve: [[-45,98],[-22.5,115],[0,120],[22.5,115],[45,98]] },
    { id: 'daejeon', name: '대전 한화생명 볼파크', left: 99, center: 122, right: 95, fenceHeight: 2.4,
      boundary: [[-45,99],[-22.5,115],[0,122],[22.5,112],[45,95]], rightWallHeight: 8 },
    // Height reports conflict (3.2 vs 3.6m); 3.2 is provisional, not verified.
    { id: 'daegu', name: '대구 삼성 라이온즈파크', left: 99.5, center: 122.5, right: 99.5, fenceHeight: 3.2,
      boundary: clippedSquareBoundary(99.5, 122.5) },
    { id: 'gwangju', name: '광주 기아 챔피언스필드', left: 99, center: 121, right: 99, fenceHeight: 2.6,
      curve: [[-45,99],[-22.5,116],[0,121],[22.5,116],[45,99]] },
    { id: 'sajik', name: '부산 사직야구장', left: 95.8, center: 120.5, right: 95.8, fenceHeight: 4.8,
      curve: [[-45,95.8],[-22.5,113],[0,120.5],[22.5,113],[45,95.8]] },
    // NC's published field markings; +/-22.5-degree gap directions are schematic.
    { id: 'changwon', name: '창원 NC파크', left: 101, center: 122, right: 101, fenceHeight: 3.3,
      boundary: [[-45,101],[-22.5,123],[0,122],[22.5,123],[45,101]] }
  ];
  // Rendering-only approximations from club guides/photos; never collision surfaces.
  // angles, row counts and building dimensions are schematic (docs/stadiums.md).
  const seating=(from,to,rows,color,extra={})=>({from,to,rows,color,offset:5,depth:.9,rise:.48,base:2.5,...extra});
  const lawn=(from,to,extra={})=>seating(from,to,7,'#528453',{kind:'lawn',depth:1.8,rise:.28,...extra});
  const deck=(from,to,extra={})=>seating(from,to,5,'#a18a69',{kind:'terrace',depth:1.7,rise:.45,...extra});
  const board=(angle,width,height,bottom=12,offset=22)=>({angle,width,height,bottom,offset});
  const architecture={
    jamsil:{eye:7,wallColor:'#225548',stands:[seating(-45,-7,19,'#577c6c'),seating(7,45,19,'#577c6c')],
      boards:[board(0,30,13,17,29)],lights:[-34,34]},
    gocheok:{eye:6,wallColor:'#263e48',indoor:true,viewScale:1.18,stands:[seating(-45,-6,13,'#774b5d'),seating(6,45,13,'#774b5d'),
      seating(-45,-6,12,'#86677e',{offset:19,base:13}),seating(6,45,12,'#86677e',{offset:19,base:13})],
      boards:[board(-19,18,10,17,29),board(19,18,10,17,29)],lights:[]},
    incheon:{eye:6,wallColor:'#284f41',stands:[lawn(-45,-14),deck(-14,-6),seating(6,45,16,'#786462')],
      boards:[board(20,43,15,14,29)],lights:[-37,37]},
    suwon:{eye:7,wallColor:'#344c40',stands:[seating(-45,-7,15,'#88665e'),seating(7,32,15,'#88665e'),deck(32,45,{base:8})],
      boards:[board(0,27,12,13,25)],lights:[-33,33]},
    daejeon:{eye:5,wallColor:'#34454a',stands:[lawn(-45,-32),seating(-32,-5,12,'#dd8b62'),seating(5,24,11,'#dd8b62'),deck(24,45,{base:8.5})],
      boards:[board(-19,28,14,13,23)],lights:[-35,35],rightFrame:true},
    daegu:{eye:5,wallColor:'#29484f',stands:[seating(-45,-5,12,'#52849a'),seating(5,27,12,'#52849a'),lawn(27,45)],
      boards:[board(23,25,14,11,24)],lights:[-36,36],boardCrown:true},
    gwangju:{eye:6,wallColor:'#24475d',stands:[lawn(-45,-27),deck(-27,-12),seating(-12,-6,10,'#7e6560'),seating(6,45,12,'#7e6560')],
      boards:[board(0,35,15,12,25)],lights:[-34,34]},
    sajik:{eye:7,wallColor:'#284d48',stands:[seating(-45,-7,23,'#6b968b',{base:4.8}),seating(7,45,23,'#6b968b',{base:4.8})],
      boards:[board(0,27,12,19,30)],lights:[-32,32]},
    changwon:{eye:5,wallColor:'#274653',stands:[lawn(-45,-28),seating(-28,-5,11,'#497188'),seating(5,25,12,'#497188'),deck(25,45)],
      boards:[board(0,33,18,11,22)],lights:[-35,34],boardCrown:true}
  };
  function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
  for(const stadium of stadiums){stadium.architecture=architecture[stadium.id];freeze(stadium);}
  root.KBOStadiums = Object.freeze(stadiums);
})(typeof window === 'undefined' ? globalThis : window);
