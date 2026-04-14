// ---------- vertex / fragment shaders for neuron point cloud ----------

export const neuronVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uLerpFactor;
  
  attribute float aIndex;
  attribute float aPrevActivation;
  attribute float aTargetActivation;
  attribute float aIsAttn;
  attribute float aSelected;

  varying float vActivation;
  varying float vIsAttn;
  varying float vSelected;

  void main() {
    float posZ = position.z;
    float posY = position.y;
    // The saucer is in the X-Z plane, so the structural radius is from the center out
    float planarRadius = length(position.xz);
    float angle = atan(position.z, position.x);
    float time = uTime;
    
    // The "flow" moves from the dense galactic center outward through the flying saucer
    float flowWave = planarRadius * 0.8 - time * 3.5 + abs(posY) * 0.5;
    
    // sweeping animations radiating elegantly
    float sweepBase = sin(flowWave) * 0.5 + 0.5;
    
    // Fast, sharp pulses shooting outward through the disc
    float sweepPulse = sin(flowWave * 2.5 - angle * 0.5) * 0.5 + 0.5;
    
    // REDUCED BASE MULTIPLIERS FOR IDLE STATE: 
    // This stops thousands of points from summing to gray fog when they overlap
    float ambientGlow = pow(sweepBase, 8.0) * 0.02; // Very faint structured rings
    // RIPPLE EFFECT REMOVED/SMOOTHENED to prevent violent "strobe" bright flashes
    float ripple = pow(sweepPulse, 4.0); // Much smoother, wider wave
    
    // Sparkle effect bound to depth to look like active data nodes
    float starryTwinkle = (sin(time * 2.0 + posZ * 5.0 + aIndex * 0.5) * 0.5 + 0.5) * 0.01;
    
    // Asymmetric interpolation: 
    // Neurons light up extremely fast (within 160ms / 0.2 factor) to respond sharply to tokens,
    // but they decay slowly (800ms base factor) to leave gorgeous data trails!
    float actPrev = abs(aPrevActivation);
    float actTarget = abs(aTargetActivation);
    
    // Speed multiplier: 5.0 means it lights up 5x faster than it decays
    float lightUpFactor = min(uLerpFactor * 6.0, 1.0);
    float decayFactor = uLerpFactor;
    
    float act = actTarget > actPrev 
      ? mix(actPrev, actTarget, lightUpFactor)
      : mix(actPrev, actTarget, decayFactor);
    
    // Ripple only gently highlights activated neurons
    float dynamicAct = act + ambientGlow + (ripple * 0.5 * max(0.0, act - 0.05)) + starryTwinkle;
    
    // Smaller base particle sizes to reduce fuzzy overlapping, but intense when activated
    float sizeBase = 0.012 + mod(aIndex, 5.0) * 0.01;
    float sizeMod = pow(abs(dynamicAct), 1.6) * 0.4;
    float finalSize = min(sizeBase + sizeMod, 0.95);

    vActivation = dynamicAct;
    vIsAttn = aIsAttn;
    vSelected = aSelected;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = finalSize * (220.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const neuronFragmentShader = /* glsl */ `
  varying float vActivation;
  varying float vIsAttn;
  varying float vSelected;

  void main() {
    // Circular soft particle
    vec2 center = gl_PointCoord - vec2(0.5);
    float dist = length(center);
    if (dist > 0.5) discard;

    float glow = 1.0 - smoothstep(0.0, 0.5, dist);

    float act = abs(vActivation);
    float intensity = act * glow;

    // Colors: Pure fluid energy (No washing out, deep contrast, vibrant highlights)
    // Boosted RGB outputs to blast past the 1.0 threshold for Bloom catching
    vec3 voidSpace = vec3(0.002, 0.005, 0.02);
    vec3 iceBlue = vec3(0.1, 0.9, 2.5);          // Deep, ultra saturated neon blue (hdr)
    vec3 whiteCore = vec3(0.8, 1.9, 2.2);        // Sharp, luminous cyan pulse
    vec3 warmGold  = vec3(2.5, 1.2, 0.1);        // Molten intense orange/gold
    vec3 pureWhite = vec3(2.5, 2.3, 2.0);        // Blinding central heat

    vec3 hotPink = vec3(1.0, 0.05, 0.4);         // laser pink for attention heads
    vec3 yellowCore = vec3(1.0, 0.85, 0.0);
    vec3 selectLime = vec3(0.4, 1.0, 0.1);

    vec3 color;
    if (vSelected > 0.5) {
      color = mix(selectLime, pureWhite, clamp(act * 0.5, 0.0, 1.0));
    } else if (vIsAttn > 0.5) {
      color = mix(hotPink, yellowCore, clamp(act * 1.8, 0.0, 1.0));
      color = mix(voidSpace, color, clamp(act * 4.0, 0.0, 1.0));
    } else {
      // Much tighter transition ranges so light snaps fiercely against the dark void
      color = mix(voidSpace, iceBlue, smoothstep(0.0, 0.2, act));
      color = mix(color, whiteCore, smoothstep(0.2, 0.4, act));
      color = mix(color, warmGold, smoothstep(0.4, 0.8, act));
      color = mix(color, pureWhite, smoothstep(0.8, 1.3, act));
    }

    // Adjusted base alpha to 0.18 per user request for inactive neurons.
    float baseAlpha = mix(0.18, 1.0, smoothstep(0.01, 0.45, act));
    
    // Narrowing the glow curve prevents massive soft overlaps
    float alpha = baseAlpha * pow(glow, 3.0); 
    if (vSelected > 0.5) alpha = max(alpha, 0.95);

    // Multiplicative glow logic to bloom the entire scene aggressively on strong pulses
    // We increase pushing factor so active elements blast their energy out brightly
    float bloomMultiplier = 1.0 + pow(max(0.0, act - 0.1), 1.35) * 36.0;
    
    // Output RGB is un-premultiplied. The alpha channel controls the blend.
    gl_FragColor = vec4(color * bloomMultiplier, clamp(alpha, 0.0, 1.0));
  }
`;
