// ---------- vertex / fragment shaders for neuron point cloud ----------

export const neuronVertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aActivation;
  attribute float aIsAttn;
  attribute float aSelected;

  varying float vActivation;
  varying float vIsAttn;
  varying float vSelected;

  void main() {
    vActivation = aActivation;
    vIsAttn = aIsAttn;
    vSelected = aSelected;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (220.0 / -mvPosition.z);
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

    // Color mapping: star-galaxy palette
    vec3 darkBlue = vec3(0.04, 0.08, 0.13);      // inactive
    vec3 coldBlue = vec3(0.24, 0.91, 1.0);        // low activation
    vec3 white = vec3(0.93, 0.97, 1.0);           // mid activation
    vec3 warmGold = vec3(1.0, 0.98, 0.88);        // high activation
    vec3 amber = vec3(1.0, 0.72, 0.37);           // attention heads
    vec3 selectedGreen = vec3(0.84, 1.0, 0.39);   // selected

    vec3 color;
    if (vSelected > 0.5) {
      color = mix(selectedGreen, vec3(1.0), act * 0.4);
    } else if (vIsAttn > 0.5) {
      color = mix(darkBlue, amber, act);
    } else if (act < 0.15) {
      color = mix(darkBlue, coldBlue * 0.3, act / 0.15);
    } else if (act < 0.5) {
      color = mix(coldBlue, white, (act - 0.15) / 0.35);
    } else {
      color = mix(white, warmGold, (act - 0.5) / 0.5);
    }

    float alpha = mix(0.04, 0.92, act) * glow;
    if (vSelected > 0.5) alpha = max(alpha, 0.7);

    gl_FragColor = vec4(color * (0.3 + intensity * 1.4), alpha);
  }
`;
