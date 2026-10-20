// GLSL kept in one place. Everything samples the same revealMap.
export const NOISE = /* glsl */ `
float h13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float vn3(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  float a = mix(mix(h13(i), h13(i+vec3(1,0,0)), f.x), mix(h13(i+vec3(0,1,0)), h13(i+vec3(1,1,0)), f.x), f.y);
  float b = mix(mix(h13(i+vec3(0,0,1)), h13(i+vec3(1,0,1)), f.x), mix(h13(i+vec3(0,1,1)), h13(i+vec3(1,1,1)), f.x), f.y);
  return mix(a, b, f.z);
}
float fbm3(vec3 p){ return 0.55*vn3(p) + 0.3*vn3(p*2.03+7.1) + 0.15*vn3(p*4.1+3.7); }
float h12(vec2 p){ vec3 q = fract(vec3(p.xyx)*0.1031); q += dot(q, q.yzx+33.33); return fract((q.x+q.y)*q.z); }
`;

// ---- revealMap accumulation (rendered by the top-down orthographic camera) ----
export const decayVert = /* glsl */ `void main(){ gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
export const decayFrag = /* glsl */ `
uniform float uK;
void main(){ gl_FragColor = vec4(0.0, 0.0, 0.0, uK); }   // NormalBlending: dst *= (1-k)
`;
export const footVert = /* glsl */ `
varying vec3 vW;
void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }
`;
export const footFrag = /* glsl */ `
uniform vec3 uLP; uniform vec3 uLD; uniform vec2 uCos; uniform float uAdd;
varying vec3 vW;
void main(){
  float c = dot(normalize(vW - uLP), uLD);
  float f = smoothstep(uCos.x, uCos.y, c);
  gl_FragColor = vec4(f*uAdd, 0.0, 0.0, 1.0);          // AdditiveBlending
}
`;

// ---- shared pieces injected into MeshStandardMaterial ----
export const revealPars = /* glsl */ `
uniform sampler2D uReveal; uniform vec4 uRect; uniform float uTime;
uniform float uDone[10]; uniform float uHover[10]; uniform vec3 uGhost;
varying vec3 vWorld;
#ifdef SLAB
varying float vSlab;
varying vec3 vLoc;
#endif
float revealAt(vec3 w){
  vec2 uv = vec2((w.x-uRect.x)/uRect.z, (uRect.y+uRect.w-w.z)/uRect.w);
  float inside = step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0);
  return clamp(texture2D(uReveal, uv).r, 0.0, 1.0)*inside;
}
float revealSoft(vec3 w){   // the same map, softened over ~0.6 m so the transition band is wide enough for the rim to be eaten in readable bites
  float s = revealAt(w)*0.28;
  for (int k = 0; k < 6; k++) { float a = float(k)*1.0472 + 0.3; s += revealAt(w + 0.6*vec3(cos(a), 0.0, sin(a)))*0.12; }
  return s;
}
float doneOf(){
#ifdef SLAB
  return uDone[int(vSlab+0.5)];
#else
  return 0.0;
#endif
}
`;

export const revealFragHead = /* glsl */ `
  float rvRaw = revealAt(vWorld);
  float rvDone = doneOf();
  #ifdef SLAB
    float rvR = max(rvRaw*(1.14 - 0.34*clamp(vWorld.y/1.7,0.0,1.0)), rvDone);
    float rvN = fbm3(vWorld*1.8 + 11.0);                        // ~0.5 m features: organic, never speckle
    float rvE = rvR + (rvN - 0.5)*0.42;
    float rvVis = max(smoothstep(0.06, 0.60, rvE), rvDone);
    float rvRim = 0.0;
  #else
    // ground: the rim of the lit area is eaten away and regrows. Only the transition band (revealed 0.05..0.45) is touched:
    // a slow low-frequency 3D noise (x, z, time) moves the cut-off inside that band. Below it nothing exists, above it the ground is whole.
    float rvR = revealSoft(vWorld);
    float rvN = fbm3(vec3(vWorld.x*0.85, vWorld.z*0.85, uTime*0.032) + 3.1);   // ~1.2 m bays; time axis ~3.7 cm/s of edge travel
    float rvC = mix(0.05, 0.45, smoothstep(0.30, 0.70, rvN));                    // per-place cut-off threshold
    float rvGr = vn3(vec3(vWorld.xz*34.0, 5.0)) - 0.5;                           // fine dust grain (~3 cm), world-fixed
    float rvGf = vn3(vec3(vWorld.xz*9.0, 9.0)) - 0.5;                            // coarser clumps (~11 cm)
    rvC += (rvGr*0.9 + rvGf*0.5) * 0.10;                                          // the cut-off itself crumbles: a grainy edge, not a ground-down curve
    if (rvR < rvC) discard;                                                      // eaten: the surface does not exist here
    float rvVis = smoothstep(rvC, rvC + 0.07, rvR) * smoothstep(0.05, 0.60, rvR*1.35);
    float rvRim = 1.0 - smoothstep(rvC, rvC + 0.10, rvR);                        // damp, darker lip just inside the cut
  #endif
  #ifndef SLAB
  if (rvVis < 0.003) discard;
  #endif
`;

export const revealFragTail = /* glsl */ `
  {
    vec3 survey = vec3(0.42, 0.68, 1.0);
    #if defined(SLAB)
      float rim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
      gl_FragColor.rgb += survey * rim * 0.056 * rvR;           // hairline outline only; the body is lit by the lamp or it is black
      {   // dark stone: the face stays black, only the arrises catch the lamp. Distance to the nearest box edge in slab-local space, so a surveyed slab always reads as one whole block.
        vec3 ad = vec3(0.275 - abs(vLoc.x), min(vLoc.y, 1.7 - vLoc.y), 0.1 - abs(vLoc.z));
        float m1 = min(ad.x, min(ad.y, ad.z)), m3 = max(ad.x, max(ad.y, ad.z)), m2 = ad.x + ad.y + ad.z - m1 - m3;
        float edge = exp(-m2/0.008);
        float up = smoothstep(0.2, 1.7, vLoc.y);                                   // the lamp is above: top arrises catch more
        gl_FragColor.rgb += mix(survey, vec3(1.0, 0.80, 0.55), 0.35 + 0.65*up) * edge * (0.10 + 0.32*up) * 0.7 * rvR;
      }
    #else
      gl_FragColor.rgb += diffuseColor.rgb * 0.20 * rvR;            // ground already surveyed keeps a faint tone, so the eaten rim is readable against black
    #endif
    gl_FragColor.rgb *= 1.0 - 0.45*rvRim;
    #ifndef SLAB
      gl_FragColor.rgb *= 1.0 + (rvGr*1.5 + rvGf*0.8) * (0.18 + 0.82*(1.0 - smoothstep(rvC + 0.04, rvC + 0.45, rvR)));   // dust grain, strongest in the erosion band, faint inside the pool
    #endif
    gl_FragColor.rgb *= rvVis;
  }
`;

// ---- engraving line (the charge gauge) ----
export const lineVert = /* glsl */ `
attribute float aSlab;
varying float vSlab; varying float vT; varying vec3 vWorld;
void main(){
  vSlab = aSlab;
  vT = position.y/1.5 + 0.5;
  vec4 w = modelMatrix*instanceMatrix*vec4(position,1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix*viewMatrix*w;
}
`;
export const lineFrag = /* glsl */ `
uniform sampler2D uReveal; uniform vec4 uRect;
uniform float uCharge[10]; uniform float uDone[10]; uniform float uHover[10]; uniform float uPulse[10];
uniform float uSteady;
varying float vSlab; varying float vT; varying vec3 vWorld;
void main(){
  int i = int(vSlab+0.5);
  float ch = uCharge[i]; float dn = uDone[i];
  vec2 uv = vec2((vWorld.x-uRect.x)/uRect.z, (uRect.y+uRect.w-vWorld.z)/uRect.w);
  float rv = clamp(texture2D(uReveal, uv).r, 0.0, 1.0);
  float vis = smoothstep(0.45, 0.9, max(rv, dn));
  float t = vT;
  float fill = 1.0 - smoothstep(ch - 0.006, ch + 0.006, t);
  float head = exp(-pow((t - ch)/0.022, 2.0)) * step(0.004, ch) * (1.0 - dn);
  float groove = 0.05;
  float e = groove + fill * (0.80 + 0.30*t) + head * 0.9;
  e *= 1.0 + uHover[i]*0.9;
  float p = uPulse[i];
  e *= 1.0 + 0.6*p;
  vec3 amber = vec3(1.0, 0.58, 0.20);
  vec3 hot = vec3(1.0, 0.74, 0.40);
  vec3 c = mix(amber, hot, clamp(head*0.8 + p*0.8 + uHover[i]*0.3, 0.0, 1.0));
  // tips of the line fade so it reads as an incision, not a bar
  float ends = smoothstep(0.0, 0.03, t) * smoothstep(1.0, 0.97, t);
  gl_FragColor = vec4(c * e * 1.25 * vis * ends, 1.0);
}
`;

// ---- volumetric cone ----
export const coneVert = /* glsl */ `
varying float vAx; varying float vNdv; varying vec2 vUv; varying vec3 vWorld;
void main(){
  vAx = -position.y;
  vUv = uv;
  vec4 w = modelMatrix*vec4(position,1.0);
  vWorld = w.xyz;
  vec4 mv = viewMatrix*w;
  vec3 n = normalize(mat3(viewMatrix)*mat3(modelMatrix)*normal);
  vNdv = abs(dot(n, normalize(-mv.xyz)));
  gl_Position = projectionMatrix*mv;
}
`;
export const coneFrag = /* glsl */ `
uniform float uPow; uniform vec3 uColor; uniform float uStrength; uniform float uTime; uniform float uNoise;
varying float vAx; varying float vNdv; varying vec2 vUv; varying vec3 vWorld;
`+ NOISE + `
void main(){
  float t = clamp(vAx, 0.0, 1.0);                                   // 0 at the lamp, 1 at the cone base
  float atten = smoothstep(0.0, 0.10, t) / (1.0 + 5.5*t*t);          // bright near the source, falls off non-linearly
  vec3 q = vWorld*vec3(2.3, 0.8, 2.3) + vec3(0.0, -uTime*0.07, uTime*0.04);   // stretched along the beam: shafts, not blobs
  float dens = mix(1.0, clamp(1.0 + 4.8*(fbm3(q) - 0.47), 0.02, 3.4), uNoise);        // strong contrast around a similar mean: dense banks and thin gaps
  float fres = pow(clamp(vNdv, 0.0, 1.0), 3.0);                // soft shoulder: silhouette fades out, core stays thick
  float ground = smoothstep(-0.02, 0.10, vWorld.y);
  float cam = smoothstep(1.2, 6.0, length(vWorld - cameraPosition));    // surfaces right at the eye thin out: no warm veil over the whole screen from inside the beam
  float a = atten * dens * fres * ground * cam;
  gl_FragColor = vec4(uColor * a * uPow * uStrength, 1.0);
}
`;

// ---- dust ----
export const dustVert = /* glsl */ `
attribute float aSeed;
uniform float uTime; uniform float uPR; uniform float uSize; uniform float uDrift; uniform float uPow;
uniform vec3 uLP; uniform vec3 uLD; uniform vec2 uCos;
varying float vA;
void main(){
  vec3 p = position + uDrift * 0.14 * vec3(sin(uTime*0.07 + aSeed*17.0), 0.6*sin(uTime*0.05 + aSeed*9.0), cos(uTime*0.06 + aSeed*13.0));
  vec4 mv = viewMatrix*modelMatrix*vec4(p,1.0);
  gl_Position = projectionMatrix*mv;
  float c = dot(normalize(p - uLP), uLD);
  float cone = smoothstep(uCos.x, uCos.y, c);
  vA = cone * uPow * (0.3 + 0.7*fract(aSeed*7.13));
  gl_PointSize = uSize * uPR * (0.55 + fract(aSeed*3.7)) / max(-mv.z, 0.5);
}
`;
export const dustFrag = /* glsl */ `
varying float vA;
void main(){
  if (vA < 0.01) discard;
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, r);
  gl_FragColor = vec4(vec3(1.0, 0.86, 0.62) * a*a * vA * 0.8, 1.0);
}
`;

// ---- finishing pass: vignette + fine grain (runs after OutputPass, in display space) ----
export const finishShader = {
  uniforms: { tDiffuse: { value: null }, uVig: { value: 0.62 }, uGrain: { value: 0.026 }, uSeed: { value: 0 }, uAspect: { value: 1.6 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uVig; uniform float uGrain; uniform float uSeed; uniform float uAspect;
    varying vec2 vUv;
    float h(vec2 p){ vec3 q = fract(vec3(p.xyx)*0.1031); q += dot(q, q.yzx+33.33); return fract((q.x+q.y)*q.z); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
      float v = smoothstep(0.35, 1.05, length(q));
      c.rgb *= 1.0 - uVig*v;
      float g = h(gl_FragCoord.xy + uSeed*37.0) - 0.5;
      float l = dot(c.rgb, vec3(0.299,0.587,0.114));
      c.rgb += g * uGrain * (0.25 + 1.6*sqrt(l));
      gl_FragColor = vec4(max(c.rgb, 0.0), 1.0);
    }
  `,
};
