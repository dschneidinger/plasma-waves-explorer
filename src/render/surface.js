// The "ocean" surface: height = Σ_j Re[ â_j exp(i(k_j x − θ_j)) ], evaluated in the
// vertex shader. One component is a plane wave; several make a wave packet.

import * as THREE from 'three';
import { WORLD } from './world.js';

export const MAX_COMPONENTS = 9;

const vertexShader = /* glsl */ `
  #define MAXC ${MAX_COMPONENTS}
  uniform int uCount;
  uniform float uK[MAXC];
  uniform float uPhase[MAXC];
  uniform vec2 uAmp[MAXC];   // complex amplitudes; Σ|uAmp| <= 1
  uniform float uH;
  varying float vH;
  varying vec3 vNormal;
  varying vec2 vXZ;
  void main() {
    vec3 p = position;
    float h = 0.0;
    float dh = 0.0;
    for (int j = 0; j < MAXC; j++) {
      if (j >= uCount) break;
      float th = uK[j] * p.x - uPhase[j];
      float c = cos(th), s = sin(th);
      h += uAmp[j].x * c - uAmp[j].y * s;
      dh += uK[j] * (-uAmp[j].x * s - uAmp[j].y * c);
    }
    p.y = uH * h;
    vH = h;
    vNormal = normalize(vec3(-uH * dh, 1.0, 0.0));
    vXZ = p.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uNeg;
  uniform vec3 uMid;
  uniform vec3 uPos;
  uniform vec3 uGrid;
  uniform float uLambda;
  varying float vH;
  varying vec3 vNormal;
  varying vec2 vXZ;

  float gridLine(float coord, float spacing) {
    float f = abs(fract(coord / spacing + 0.5) - 0.5) * spacing;
    float w = fwidth(coord);
    return 1.0 - smoothstep(0.0, 1.5 * w, f);
  }

  void main() {
    float t = clamp(vH, -1.0, 1.0);
    vec3 base = t < 0.0 ? mix(uMid, uNeg, -t) : mix(uMid, uPos, t);
    vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    float diffuse = max(dot(n, normalize(vec3(-0.4, 1.0, 0.6))), 0.0);
    vec3 col = base * (0.6 + 0.4 * diffuse);
    float g = max(gridLine(vXZ.x, uLambda / 4.0), gridLine(vXZ.y, WORLD_W / 8.0));
    col = mix(col, uGrid, 0.35 * g);
    gl_FragColor = vec4(col, 1.0);
  }
`.replace('WORLD_W', WORLD.W.toFixed(4));

export function createSurface() {
  const { L, W, H } = WORLD;
  const geometry = new THREE.PlaneGeometry(L, W, 720, 24);
  geometry.rotateX(-Math.PI / 2); // lie in x–z, height along +y

  const uniforms = {
    uCount: { value: 0 },
    uK: { value: new Array(MAX_COMPONENTS).fill(0) },
    uPhase: { value: new Array(MAX_COMPONENTS).fill(0) },
    uAmp: { value: Array.from({ length: MAX_COMPONENTS }, () => new THREE.Vector2()) },
    uH: { value: H },
    uLambda: { value: WORLD.L / 3 },
    uNeg: { value: new THREE.Color() },
    uMid: { value: new THREE.Color() },
    uPos: { value: new THREE.Color() },
    uGrid: { value: new THREE.Color() },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false; // vertices move in the shader

  return {
    mesh,
    /** comps: [{ kW (world wavenumber), amp: {re, im} }], lambdaW: world wavelength of k0. */
    setComponents(comps, lambdaW) {
      if (comps.length > MAX_COMPONENTS) throw new Error('too many components');
      uniforms.uCount.value = comps.length;
      comps.forEach((c, j) => {
        uniforms.uK.value[j] = c.kW;
        uniforms.uAmp.value[j].set(c.amp.re, c.amp.im);
      });
      uniforms.uLambda.value = lambdaW;
    },
    /** thetas[j] = ω_j t (radians, already reduced mod 2π). */
    setPhases(thetas) {
      thetas.forEach((th, j) => {
        uniforms.uPhase.value[j] = th;
      });
    },
    setTheme(c) {
      uniforms.uNeg.value.set(c.neg);
      uniforms.uMid.value.set(c.mid);
      uniforms.uPos.value.set(c.pos);
      uniforms.uGrid.value.set(c.grid);
    },
  };
}
