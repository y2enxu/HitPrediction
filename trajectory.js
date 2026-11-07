/* SI units. Gravity, spin-dependent drag and Magnus lift; first ground contact.
   Nathan's published calculator coefficients: docs/trajectory.md. */
(function (root) {
  'use strict';
  const defaults = Object.freeze({ gravity: 9.80665, mass: 0.145, radius: 0.0366,
    airDensity: 1.225, dragCoefficient: 0.3008, spinDragCoefficient: 0.0292,
    backspinRpm: 0, sidespinRpm: 0, gyrospinRpm: 0,
    lift0: 0.583, lift1: 2.333, lift2: 1.120,
    launchHeight: 1, timeStep: 0.005 });
  const weatherDefaults=Object.freeze({temperatureC:20,relativeHumidity:50,pressureHpa:1013,
    windSpeedMps:0,windDirectionDeg:0});
  function atmosphere(options={}) {
    if(!options||typeof options!=='object')throw new Error('유효하지 않은 날씨 입력입니다.');
    const w={...weatherDefaults,...options};
    if(!Object.values(w).every(Number.isFinite)||w.temperatureC < -40||w.temperatureC>60||
      w.relativeHumidity<0||w.relativeHumidity>100||w.pressureHpa<800||w.pressureHpa>1100||
      w.windSpeedMps<0||w.windSpeedMps>30||Math.abs(w.windDirectionDeg)>360)
      throw new Error('유효하지 않은 날씨 입력입니다.');
    // NWS saturation-vapour-pressure approximation (hPa), then ideal gas mixture.
    const vapour=6.11*10**(7.5*w.temperatureC/(237.3+w.temperatureC))*w.relativeHumidity/100*100;
    const kelvin=w.temperatureC+273.15;
    const airDensity=(w.pressureHpa*100-vapour)/(287.05*kelvin)+vapour/(461.495*kelvin);
    // Direction means where the air moves: 0=home to centre, +90=left to right.
    const bearing=w.windDirectionDeg*Math.PI/180;
    return {...w,airDensity,windX:w.windSpeedMps*Math.sin(bearing),windY:w.windSpeedMps*Math.cos(bearing)};
  }
  function estimateSpin(speedKmh, launchAngle, direction, batterHand = 'R') {
    if (![speedKmh,launchAngle,direction].every(Number.isFinite) || speedKmh<0 ||
        Math.abs(launchAngle)>90 || Math.abs(direction)>180 || !['R','L'].includes(batterHand)) {
      throw new Error('유효하지 않은 회전 추정 입력입니다.');
    }
    // Nathan's average-spin relations (R=+1, L=-1):
    // wb=-763+120*theta+21*phi*hand; ws=-849*hand-94*phi.
    // Speed controls launch and aerodynamic forces, with no invented rpm scaling.
    const hand=batterHand==='R'?1:-1;
    const limit=value=>Math.max(-5000,Math.min(5000,value));
    return {backspinRpm:speedKmh===0?0:limit(-763+120*launchAngle+21*direction*hand),
      sidespinRpm:speedKmh===0?0:limit(-849*hand-94*direction),gyrospinRpm:0};
  }
  function simulate(speedKmh, launchAngle, direction, options = {}) {
    const {batterHand='R',weather,...physicalOptions}=options;
    const environment=weather===undefined?{airDensity:defaults.airDensity,windX:0,windY:0}:atmosphere(weather);
    const c = { ...defaults,airDensity:environment.airDensity,
      ...estimateSpin(speedKmh,launchAngle,direction,batterHand), ...physicalOptions };
    if (![speedKmh, launchAngle, direction, ...Object.values(c)].every(Number.isFinite) ||
        speedKmh < 0 || Math.abs(launchAngle) > 90 || Math.abs(direction) > 180 ||
        c.gravity <= 0 || c.mass <= 0 || c.radius <= 0 || c.airDensity < 0 ||
        c.dragCoefficient < 0 || c.spinDragCoefficient < 0 || Math.abs(c.backspinRpm) > 15000 ||
        Math.abs(c.sidespinRpm)>15000 || Math.abs(c.gyrospinRpm)>15000 ||
        c.lift0 <= 0 || c.lift1 < 0 || c.lift2 < 0 ||
        c.launchHeight < 0 || c.timeStep <= 0 || c.timeStep > 0.05) {
      throw new Error('유효하지 않은 비행 계산 입력입니다.');
    }
    const radians = Math.PI / 180;
    const v = speedKmh / 3.6, angle = launchAngle * radians, bearing = direction * radians;
    let state = [0, 0, c.launchHeight, v * Math.cos(angle) * Math.sin(bearing),
      v * Math.cos(angle) * Math.cos(bearing), v * Math.sin(angle)];
    const aerodynamic = c.airDensity * Math.PI * c.radius ** 2 / (2 * c.mass);
    const toOmega=Math.PI/30, wb=c.backspinRpm*toOmega,
      ws=c.sidespinRpm*toOmega, wg=c.gyrospinRpm*toOmega;
    // Rotate back/side/gyro spin from the launch frame into the world frame.
    const wx=wb*Math.cos(bearing)-ws*Math.sin(angle)*Math.sin(bearing)+wg*Math.cos(angle)*Math.sin(bearing);
    const wy=-wb*Math.sin(bearing)-ws*Math.sin(angle)*Math.cos(bearing)+wg*Math.cos(angle)*Math.cos(bearing);
    const wz=ws*Math.cos(angle)+wg*Math.sin(angle);
    function derivative(s) {
      const ux=s[3]-environment.windX,uy=s[4]-environment.windY,uz=s[5];
      const magnitude = Math.hypot(ux,uy,uz);
      const crossX=wy*uz-wz*uy,crossY=wz*ux-wx*uz,crossZ=wx*uy-wy*ux;
      const crossMagnitude=Math.hypot(crossX,crossY,crossZ);
      const perpendicularOmega=magnitude>1e-12?crossMagnitude/magnitude:0;
      const spinFactor = magnitude > 1e-12 ? c.radius * perpendicularOmega / magnitude : 0;
      const cl = c.lift2 * spinFactor / (c.lift0 + c.lift1 * spinFactor);
      const cd=c.dragCoefficient+c.spinDragCoefficient*(perpendicularOmega/toOmega)/1000;
      const drag = aerodynamic * cd * magnitude;
      const lift = crossMagnitude>1e-12 ? aerodynamic*cl*magnitude*magnitude/crossMagnitude : 0;
      // F_M is parallel to omega cross velocity, perpendicular to velocity.
      return [s[3], s[4], s[5], -drag * ux + lift * crossX,
        -drag * uy + lift * crossY, -c.gravity - drag * uz + lift * crossZ];
    }
    function step(s, dt) {
      const k1 = derivative(s);
      const k2 = derivative(s.map((value, i) => value + dt * k1[i] / 2));
      const k3 = derivative(s.map((value, i) => value + dt * k2[i] / 2));
      const k4 = derivative(s.map((value, i) => value + dt * k3[i]));
      return s.map((value, i) => value + dt * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]) / 6);
    }
    const point = (s, t) => ({ t, x: s[0], y: s[1], z: s[2], vx: s[3], vy: s[4], vz: s[5] });
    const points = [point(state, 0)];
    let t = 0, maxHeight = c.launchHeight;
    if (!(c.launchHeight === 0 && state[5] <= 0)) {
      for (let i = 0; i < Math.ceil(30 / c.timeStep); i++) {
        const next = step(state, c.timeStep);
        if (next[2] <= 0) {
          const fraction = state[2] / (state[2] - next[2]);
          const contact = state.map((value, j) => value + fraction * (next[j] - value));
          contact[2] = 0;
          t += fraction * c.timeStep;
          points.push(point(contact, t));
          state = contact;
          break;
        }
        state = next; t += c.timeStep;
        maxHeight = Math.max(maxHeight, state[2]);
        points.push(point(state, t));
      }
      if (state[2] > 0) throw new Error('지면 접촉까지의 계산 시간이 초과되었습니다.');
    }
    const isFoul=state[1]<-1e-7||Math.abs(state[0])>state[1]+1e-7;
    return { points, distance: Math.hypot(state[0], state[1]), duration: t, isFoul,
      maxHeight, landing: point(state, t), constants: c, batterHand,
      environment:{...environment,airDensity:c.airDensity} };
  }
  root.BaseballTrajectory = { simulate, estimateSpin, atmosphere, defaults, weatherDefaults };
})(typeof window === 'undefined' ? globalThis : window);
