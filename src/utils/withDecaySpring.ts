import Animated, { defineAnimation } from 'react-native-reanimated';

export function withDecaySpring(
  userConfig: Animated.WithDecayConfig & Animated.WithSpringConfig
) {
  'worklet';

  return defineAnimation(0, () => {
    'worklet';
    const config = {
      deceleration: 0.997,
      // SPRING CONFIG
      damping: 800,
      mass: 1,
      stiffness: 150,

      overshootClamping: false,
      restDisplacementThreshold: 0.02,
      restSpeedThreshold: 4,
      clamp: userConfig.clamp,
      velocity: userConfig.velocity,
    };

    const VELOCITY_EPS = 1;

    function decaySpring(animation: any, now: number) {
      const { lastTimestamp, current, velocity } = animation;

      const deltaTime = Math.min(now - lastTimestamp, 64);
      animation.lastTimestamp = now;

      const kv = Math.pow(config.deceleration, deltaTime);
      const kx = (config.deceleration * (1 - kv)) / (1 - config.deceleration);

      const v0 = velocity / 1000;
      let v = v0 * kv * 1000;
      const nextX = current + v0 * kx;

      let x = nextX;

      if (Array.isArray(config.clamp)) {
        if (animation.moveBack) {
          const toValue = animation.toValue;

          const c = config.damping;
          const m = config.mass;
          const k = config.stiffness;

          const v0 = -velocity;
          const x0 = toValue - current;

          const zeta = c / (2 * Math.sqrt(k * m)); // damping ratio
          const omega0 = Math.sqrt(k / m); // undamped angular frequency of the oscillator (rad/ms)
          const omega1 = omega0 * Math.sqrt(1 - zeta ** 2); // exponential decay

          const t = deltaTime / 1000;

          const sin1 = Math.sin(omega1 * t);
          const cos1 = Math.cos(omega1 * t);

          // under damped
          const underDampedEnvelope = Math.exp(-zeta * omega0 * t);
          const underDampedFrag1 =
            underDampedEnvelope *
            (sin1 * ((v0 + zeta * omega0 * x0) / omega1) + x0 * cos1);

          const underDampedPosition = toValue - underDampedFrag1;
          // This looks crazy -- it's actually just the derivative of the oscillation function
          const underDampedVelocity =
            zeta * omega0 * underDampedFrag1 -
            underDampedEnvelope *
              (cos1 * (v0 + zeta * omega0 * x0) - omega1 * x0 * sin1);

          // critically damped
          const criticallyDampedEnvelope = Math.exp(-omega0 * t);
          const criticallyDampedPosition =
            toValue - criticallyDampedEnvelope * (x0 + (v0 + omega0 * x0) * t);

          const criticallyDampedVelocity =
            criticallyDampedEnvelope *
            (v0 * (t * omega0 - 1) + t * x0 * omega0 * omega0);

          const isOvershooting = () => {
            if (config.overshootClamping && config.stiffness !== 0) {
              return current < toValue
                ? animation.current > toValue
                : animation.current < toValue;
            } else {
              return false;
            }
          };

          const isVelocity = Math.abs(velocity) < config.restSpeedThreshold;
          const isDisplacement =
            config.stiffness === 0 ||
            Math.abs(toValue - current) < config.restDisplacementThreshold;

          if (zeta < 1) {
            x = underDampedPosition;
            v = underDampedVelocity;
          } else {
            x = criticallyDampedPosition;
            v = criticallyDampedVelocity;
          }

          if (isOvershooting() || (isVelocity && isDisplacement)) {
            if (config.stiffness !== 0) {
              animation.current = 0;
              animation.velocity = toValue;
            }
            return true;
          }
        }

        if (nextX < config.clamp[0] || nextX > config.clamp[1]) {
          if (!animation.startTime) {
            animation.startTime = now;
            animation.progress = 0;
            animation.moveBack = true;

            animation.toValue =
              nextX <= config.clamp[0] ? config.clamp[0] : config.clamp[1];
          }
        }
      }

      animation.current = x;
      animation.velocity = v;

      return Math.abs(v) < VELOCITY_EPS;
    }

    function onStart(animation: any, value: number, now: number) {
      animation.current = value;
      animation.lastTimestamp = now;
      animation.initialVelocity = config.velocity;
    }

    return {
      onFrame: decaySpring,
      onStart,
      velocity: config.velocity || 0,
    };
  });
}
