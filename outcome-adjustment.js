/* Display adjustment, separate from the trained model. See docs/trajectory.md. */
(function (root) {
  'use strict';
  function assess(flight, stadium) {
    const geometry = root.BaseballStadium3D;
    const fair = p => p.y >= 0 && Math.abs(p.x) <= p.y + 1e-7;
    const margin = p => Math.hypot(p.x, p.y) - geometry.fenceDistance(Math.atan2(p.x, p.y), stadium);
    // Use the first outward fence crossing, rather than the eventual landing:
    // a ball can curl foul after already clearing a fair part of the wall.
    for (let i = 1; i < flight.points.length; i++) {
      const a = flight.points[i - 1], b = flight.points[i];
      if (margin(a) < 0 && margin(b) >= 0) {
        let lo = 0, hi = 1;
        const interpolate = t => ({x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t, z:a.z+(b.z-a.z)*t});
        for (let j = 0; j < 24; j++) {
          const mid = (lo + hi) / 2;
          if (margin(interpolate(mid)) < 0) lo = mid; else hi = mid;
        }
        const crossing = interpolate((lo + hi) / 2);
        if (!fair(crossing)) return {isFoul:true, homeRunProbability:0};
        const clearance = crossing.z - geometry.fenceHeight(Math.atan2(crossing.x, crossing.y), stadium);
        return {isFoul:clearance < 0 && flight.isFoul, clearance,
          homeRunProbability:chance(clearance)};
      }
    }
    // Extend the local descending slope only to express a negative wall margin.
    // This does not extend the displayed path or simulate a bounce.
    const p = flight.landing, radius = Math.hypot(p.x,p.y);
    const radialSpeed = radius > 0 ? (p.x*p.vx+p.y*p.vy)/radius : 0;
    const shortfall = Math.max(0, -margin(p));
    const clearance = -geometry.fenceHeight(Math.atan2(p.x,p.y),stadium)
      - shortfall * Math.max(.2, -p.vz / Math.max(1,radialSpeed));
    return {isFoul:flight.isFoul, clearance, homeRunProbability:chance(clearance)};
  }
  function chance(clearance) {
    // A heuristic 2m transition scale allows for uncertainty in estimated spin.
    // These are display probabilities, not fitted or validated calibration.
    if (clearance <= -12) return 0;
    if (clearance >= 12) return .999;
    return Math.min(.999, 1 / (1 + Math.exp(-clearance / 2)));
  }
  function adjust(data, probabilities, flight, stadium) {
    const assessment = assess(flight,stadium);
    if (assessment.isFoul) return {...assessment,probabilities:data.classes.map(()=>0)};
    const index = data.classes.indexOf('home_run');
    if (index < 0) return {...assessment,probabilities:probabilities.slice()};
    const target = assessment.homeRunProbability;
    const remaining = probabilities.reduce((sum,p,i)=>sum+(i===index?0:p),0);
    const flyOut = data.classes.indexOf('fly_out');
    const fallback = flyOut >= 0 ? flyOut : data.classes.findIndex((_,i)=>i!==index);
    const result = probabilities.map((p,i)=>i===index?target:
      remaining>0 ? p*(1-target)/remaining : i===fallback ? 1-target : 0);
    return {...assessment,probabilities:result};
  }
  root.HitPredictOutcomes = {assess,adjust};
})(typeof window === 'undefined' ? globalThis : window);
