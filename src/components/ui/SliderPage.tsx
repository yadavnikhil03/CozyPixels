'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';
import { Pane } from 'tweakpane';

// --- SHADERS ---
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture1;
  uniform sampler2D uTexture2;
  uniform float uProgress;
  uniform vec2 uResolution;
  uniform vec2 uTexture1Size;
  uniform vec2 uTexture2Size;
  uniform int uEffectType;
  
  // Global settings
  uniform float uGlobalIntensity;
  uniform float uSpeedMultiplier;
  uniform float uDistortionStrength;
  uniform float uColorEnhancement;
  
  // Specific Uniforms
  uniform float uGlassRefractionStrength;
  uniform float uGlassChromaticAberration;
  uniform float uGlassBubbleClarity;
  uniform float uGlassEdgeGlow;
  uniform float uGlassLiquidFlow;
  
  varying vec2 vUv;

  vec2 getCoverUV(vec2 uv, vec2 textureSize) {
    vec2 s = uResolution / textureSize;
    float scale = max(s.x, s.y);
    vec2 scaledSize = textureSize * scale;
    vec2 offset = (uResolution - scaledSize) * 0.5;
    return (uv * uResolution - offset) / scaledSize;
  }

  float noise(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float smoothNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(noise(i), noise(i + vec2(1.0, 0.0)), f.x), mix(noise(i + vec2(0.0, 1.0)), noise(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  // GLASS EFFECT LOGIC
  vec4 glassEffect(vec2 uv, float progress) {
    float glassStrength = 0.08 * uGlassRefractionStrength * uDistortionStrength * uGlobalIntensity;
    float chromaticAberration = 0.02 * uGlassChromaticAberration * uGlobalIntensity;
    float waveDistortion = 0.025 * uDistortionStrength;
    float clearCenterSize = 0.3 * uGlassBubbleClarity;
    float surfaceRipples = 0.004 * uDistortionStrength;
    float liquidFlow = 0.015 * uGlassLiquidFlow * uSpeedMultiplier;
    float rimLightWidth = 0.05;
    float glassEdgeWidth = 0.025;
    
    float brightnessPhase = smoothstep(0.8, 1.0, progress);
    float rimLightIntensity = 0.08 * (1.0 - brightnessPhase) * uGlassEdgeGlow * uGlobalIntensity;
    float glassEdgeOpacity = 0.06 * (1.0 - brightnessPhase) * uGlassEdgeGlow;

    vec2 center = vec2(0.5, 0.5);
    vec2 p = uv * uResolution;
    vec2 uv1 = getCoverUV(uv, uTexture1Size);
    vec2 uv2_base = getCoverUV(uv, uTexture2Size);
    
    float maxRadius = length(uResolution) * 0.85;
    float bubbleRadius = progress * maxRadius;
    vec2 sphereCenter = center * uResolution;
    
    float dist = length(p - sphereCenter);
    float normalizedDist = dist / max(bubbleRadius, 0.001);
    vec2 direction = (dist > 0.0) ? (p - sphereCenter) / dist : vec2(0.0);
    float inside = smoothstep(bubbleRadius + 3.0, bubbleRadius - 3.0, dist);
    float distanceFactor = smoothstep(clearCenterSize, 1.0, normalizedDist);
    float time = progress * 5.0 * uSpeedMultiplier;
    
    vec2 liquidSurface = vec2(smoothNoise(uv * 100.0 + time * 0.3), smoothNoise(uv * 100.0 + time * 0.2 + 50.0)) - 0.5;
    liquidSurface *= surfaceRipples * distanceFactor;

    vec2 distortedUV = uv2_base;
    if (inside > 0.0) {
      float refractionOffset = glassStrength * pow(distanceFactor, 1.5);
      vec2 flowDirection = normalize(direction + vec2(sin(time), cos(time * 0.7)) * 0.3);
      distortedUV -= flowDirection * refractionOffset;
      float combinedWave = (sin(normalizedDist * 22.0 - time * 3.5) + sin(normalizedDist * 35.0 + time * 2.8) * 0.7 + sin(normalizedDist * 50.0 - time * 4.2) * 0.5) / 3.0;
      float waveOffset = combinedWave * waveDistortion * distanceFactor;
      distortedUV -= direction * waveOffset + liquidSurface;
      vec2 flowOffset = vec2(sin(time + normalizedDist * 10.0), cos(time * 0.8 + normalizedDist * 8.0)) * liquidFlow * distanceFactor * inside;
      distortedUV += flowOffset;
    }

    vec4 newImg;
    if (inside > 0.0) {
      float aberrationOffset = chromaticAberration * pow(distanceFactor, 1.2);
      vec2 uv_r = distortedUV + direction * aberrationOffset * 1.2;
      vec2 uv_g = distortedUV + direction * aberrationOffset * 0.2;
      vec2 uv_b = distortedUV - direction * aberrationOffset * 0.8;
      newImg = vec4(texture2D(uTexture2, uv_r).r, texture2D(uTexture2, uv_g).g, texture2D(uTexture2, uv_b).b, 1.0);
    } else {
      newImg = texture2D(uTexture2, uv2_base);
    }

    if (inside > 0.0 && rimLightIntensity > 0.0) {
      float rim = smoothstep(1.0 - rimLightWidth, 1.0, normalizedDist) * (1.0 - smoothstep(1.0, 1.01, normalizedDist));
      newImg.rgb += rim * rimLightIntensity;
      float edge = smoothstep(1.0 - glassEdgeWidth, 1.0, normalizedDist) * (1.0 - smoothstep(1.0, 1.01, normalizedDist));
      newImg.rgb = mix(newImg.rgb, vec3(1.0), edge * glassEdgeOpacity);
    }
    
    newImg.rgb = mix(newImg.rgb, newImg.rgb * 1.2, (uColorEnhancement - 1.0) * 0.5);
    vec4 currentImg = texture2D(uTexture1, uv1);
    if (progress > 0.95) {
      vec4 pureNewImg = texture2D(uTexture2, uv2_base);
      float endTransition = (progress - 0.95) / 0.05;
      newImg = mix(newImg, pureNewImg, endTransition);
    }
    return mix(currentImg, newImg, inside);
  }

  vec4 genericEffect(vec2 uv, float progress) {
     vec2 uv1 = getCoverUV(uv, uTexture1Size);
     vec2 uv2 = getCoverUV(uv, uTexture2Size);
     float dist = uDistortionStrength * uGlobalIntensity * sin(progress * 3.14);
     vec2 disp = vec2(
        smoothNoise(uv * 10.0 + float(uEffectType) + progress),
        smoothNoise(uv * 15.0 - float(uEffectType) + progress)
     ) * dist * 0.1;
     vec4 t1 = texture2D(uTexture1, uv1 + disp * (1.0-progress));
     vec4 t2 = texture2D(uTexture2, uv2 + disp * progress);
     return mix(t1, t2, smoothstep(0.0, 1.0, progress));
  }

  void main() {
    if (uEffectType == 0) {
        gl_FragColor = glassEffect(vUv, uProgress);
    } else {
        gl_FragColor = genericEffect(vUv, uProgress); 
    }
  }
`;

// --- CONFIG ---
const SLIDES = [
    { title: 'Ethereal Glow', media: 'https://images.unsplash.com/photo-1608337343510-11e610203adb?q=80&w=1331&auto=format&fit=crop' },
    { title: 'Rose Mirage', media: 'https://images.unsplash.com/photo-1631248621162-b87af2118f2b?q=80&w=687&auto=format&fit=crop' },
    { title: 'Velvet Mystique', media: 'https://images.unsplash.com/photo-1681148108683-346ef8b96bb4?q=80&w=687&auto=format&fit=crop' },
    { title: 'Golden Hour', media: 'https://images.unsplash.com/photo-1590989866086-9afff1d1c312?q=80&w=686&auto=format&fit=crop' },
    { title: 'Midnight Dreams', media: 'https://images.unsplash.com/photo-1651651441982-b69f52985ff6?q=80&w=1951&auto=format&fit=crop' },
    { title: 'Silver Light', media: 'https://images.unsplash.com/photo-1752769479457-c158c473ce89?q=80&w=687&auto=format&fit=crop' },
];

const SLIDER_CONFIG = {
    settings: {
        transitionDuration: 2.5,
        autoSlideSpeed: 5000,
        currentEffect: 'glass',
        globalIntensity: 1.0,
        speedMultiplier: 1.0,
        distortionStrength: 1.0,
        colorEnhancement: 1.0,
        glassRefractionStrength: 1.0,
        glassChromaticAberration: 1.0,
        glassBubbleClarity: 1.0,
        glassEdgeGlow: 1.0,
        glassLiquidFlow: 1.0,
    }
};

// --- PRELOADER COMPONENT ---
const Preloader = ({ onLoadComplete }: { onLoadComplete: () => void }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationId: number;
        let startTime: number | null = null;
        const duration = 2500;

        const dotRings = [
            { radius: 20, count: 8 },
            { radius: 35, count: 12 },
            { radius: 50, count: 16 },
            { radius: 65, count: 20 },
            { radius: 80, count: 24 },
        ];

        const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
        const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const smoothstep = (e0: number, e1: number, x: number) => {
            const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
            return t * t * (3 - 2 * t);
        };

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const time = elapsed * 0.001;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            ctx.beginPath();
            ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fill();

            dotRings.forEach((ring, ringIndex) => {
                for (let i = 0; i < ring.count; i++) {
                    const angle = (i / ring.count) * Math.PI * 2;
                    const pulseTime = time * 2 - ringIndex * 0.4;
                    const radiusPulse = easeInOutSine((Math.sin(pulseTime) + 1) / 2) * 6 - 3;
                    const x = centerX + Math.cos(angle) * (ring.radius + radiusPulse);
                    const y = centerY + Math.sin(angle) * (ring.radius + radiusPulse);

                    const highlightPhase = (Math.sin(pulseTime) + 1) / 2;
                    const highlightIntensity = easeInOutCubic(highlightPhase);
                    const opacityBase = 0.3 + easeInOutSine((Math.sin(pulseTime + i * 0.2) + 1) / 2) * 0.7;

                    ctx.beginPath();
                    ctx.arc(x, y, 2, 0, Math.PI * 2);
                    const r = Math.round(255 + (221 - 255) * smoothstep(0.2, 0.8, highlightIntensity));
                    ctx.fillStyle = `rgba(${r},${r},${r},${opacityBase})`;
                    ctx.fill();
                }
            });

            if (elapsed < duration) {
                animationId = requestAnimationFrame(animate);
            } else {
                onLoadComplete();
            }
        };

        animationId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationId);
    }, [onLoadComplete]);

    return (
        <div className="fixed inset-0 z-[100] bg-black flex items-center justify-center">
            <canvas ref={canvasRef} width={300} height={300} />
        </div>
    );
};


// --- MAIN PAGE COMPONENT ---
export default function SliderPage() {
    const containerRef = useRef<HTMLElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [loaded, setLoaded] = useState(false);
    const [activeSlide, setActiveSlide] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // Refs to hold mutable logic state
    const logicRef = useRef({
        scene: null as THREE.Scene | null,
        camera: null as THREE.OrthographicCamera | null,
        renderer: null as THREE.WebGLRenderer | null,
        material: null as THREE.ShaderMaterial | null,
        textures: [] as THREE.Texture[],
        currentSlideIndex: 0,
        pane: null as Pane | null,
        autoSlideTimer: null as NodeJS.Timeout | null,
        progressInterval: null as NodeJS.Timeout | null,
        progress: 0
    });

    // --- LOGIC FUNCTIONS (Defined before usage in Effect) ---

    const startTimer = () => {
        const { current: logic } = logicRef;
        if (logic.autoSlideTimer) clearTimeout(logic.autoSlideTimer);
        if (logic.progressInterval) clearInterval(logic.progressInterval);

        logic.progress = 0;
        logic.progressInterval = setInterval(() => {
            logic.progress += (100 / SLIDER_CONFIG.settings.autoSlideSpeed) * 50;

            const bar = document.getElementById(`progress-${logic.currentSlideIndex}`);
            if (bar) bar.style.width = `${Math.min(logic.progress, 100)}%`;

            if (logic.progress >= 100) {
                clearInterval(logic.progressInterval!);
                if (!isTransitioning) nextSlide();
            }
        }, 50);
    };

    const stopTimer = () => {
        const { current: logic } = logicRef;
        if (logic.progressInterval) clearInterval(logic.progressInterval);
        if (logic.autoSlideTimer) clearTimeout(logic.autoSlideTimer);
        const bar = document.getElementById(`progress-${logic.currentSlideIndex}`);
        if (bar) bar.style.width = '0%';
    };

    const navigateTo = (index: number) => {
        const { current: logic } = logicRef;
        // Accessing state inside ref check usually fine, but strict logic might check the state ref directly
        if (logic.material && logic.material.uniforms.uProgress.value > 0) return;
        if (index === logic.currentSlideIndex) return;

        setIsTransitioning(true);
        stopTimer();

        const currTex = logic.textures[logic.currentSlideIndex];
        const nextTex = logic.textures[index];

        logic.material!.uniforms.uTexture1.value = currTex;
        logic.material!.uniforms.uTexture2.value = nextTex;
        logic.material!.uniforms.uTexture1Size.value = currTex.userData.size;
        logic.material!.uniforms.uTexture2Size.value = nextTex.userData.size;

        gsap.fromTo(logic.material!.uniforms.uProgress,
            { value: 0 },
            {
                value: 1,
                duration: SLIDER_CONFIG.settings.transitionDuration,
                ease: "power2.inOut",
                onComplete: () => {
                    logic.material!.uniforms.uProgress.value = 0;
                    logic.material!.uniforms.uTexture1.value = nextTex;
                    logic.material!.uniforms.uTexture1Size.value = nextTex.userData.size;

                    logic.currentSlideIndex = index;
                    setActiveSlide(index);
                    setIsTransitioning(false);
                    startTimer();
                }
            }
        );
        setActiveSlide(index);
    };

    const nextSlide = () => {
        const { current: logic } = logicRef;
        const next = (logic.currentSlideIndex + 1) % SLIDES.length;
        navigateTo(next);
    };

    const prevSlide = () => {
        const { current: logic } = logicRef;
        const prev = (logic.currentSlideIndex - 1 + SLIDES.length) % SLIDES.length;
        navigateTo(prev);
    };

    // --- WEBGL SETUP ---
    useEffect(() => {
        if (!canvasRef.current) return;
        const { current: logic } = logicRef;

        // 1. Initialize Three.js
        logic.scene = new THREE.Scene();

        // FIX: Camera setup to see the plane (z=1)
        logic.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
        logic.camera.position.z = 1;

        logic.renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current,
            antialias: false,
            alpha: false,
        });
        logic.renderer.setSize(window.innerWidth, window.innerHeight);
        logic.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // 2. Material
        logic.material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uTexture1: { value: null },
                uTexture2: { value: null },
                uProgress: { value: 0.0 },
                uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                uTexture1Size: { value: new THREE.Vector2(1, 1) },
                uTexture2Size: { value: new THREE.Vector2(1, 1) },
                uEffectType: { value: 0 },

                uGlobalIntensity: { value: SLIDER_CONFIG.settings.globalIntensity },
                uSpeedMultiplier: { value: SLIDER_CONFIG.settings.speedMultiplier },
                uDistortionStrength: { value: SLIDER_CONFIG.settings.distortionStrength },
                uColorEnhancement: { value: SLIDER_CONFIG.settings.colorEnhancement },
                uGlassRefractionStrength: { value: SLIDER_CONFIG.settings.glassRefractionStrength },
                uGlassChromaticAberration: { value: SLIDER_CONFIG.settings.glassChromaticAberration },
                uGlassBubbleClarity: { value: SLIDER_CONFIG.settings.glassBubbleClarity },
                uGlassEdgeGlow: { value: SLIDER_CONFIG.settings.glassEdgeGlow },
                uGlassLiquidFlow: { value: SLIDER_CONFIG.settings.glassLiquidFlow },

                // Dummy values for others to prevent warnings
                uFrostIntensity: { value: 0 },
                uFrostCrystalSize: { value: 0 },
                uFrostIceCoverage: { value: 0 },
                uFrostTemperature: { value: 0 },
                uFrostTexture: { value: 0 },
                uRippleFrequency: { value: 0 },
                uRippleAmplitude: { value: 0 },
                uRippleWaveSpeed: { value: 0 },
                uRippleRippleCount: { value: 0 },
                uRippleDecay: { value: 0 },
                uPlasmaIntensity: { value: 0 },
                uPlasmaSpeed: { value: 0 },
                uPlasmaEnergyIntensity: { value: 0 },
                uPlasmaContrastBoost: { value: 0 },
                uPlasmaTurbulence: { value: 0 },
                uTimeshiftDistortion: { value: 0 },
                uTimeshiftBlur: { value: 0 },
                uTimeshiftFlow: { value: 0 },
                uTimeshiftChromatic: { value: 0 },
                uTimeshiftTurbulence: { value: 0 },
            }
        });

        const geometry = new THREE.PlaneGeometry(2, 2);
        const mesh = new THREE.Mesh(geometry, logic.material);
        logic.scene.add(mesh);

        // 3. Load Textures
        const loadTextures = async () => {
            const loader = new THREE.TextureLoader().setCrossOrigin('anonymous');

            const loadPromises = SLIDES.map(slide => {
                return new Promise<THREE.Texture>((resolve, reject) => {
                    loader.load(slide.media, (tex) => {
                        tex.minFilter = THREE.LinearFilter;
                        tex.magFilter = THREE.LinearFilter;
                        tex.userData = { size: new THREE.Vector2(tex.image.width, tex.image.height) };
                        resolve(tex);
                    }, undefined, (err) => {
                        console.error("Failed to load texture:", slide.media);
                        reject(err);
                    });
                });
            });

            try {
                logic.textures = await Promise.all(loadPromises);

                if (logic.textures.length >= 2 && logic.material) {
                    logic.material.uniforms.uTexture1.value = logic.textures[0];
                    logic.material.uniforms.uTexture2.value = logic.textures[1];
                    logic.material.uniforms.uTexture1Size.value = logic.textures[0].userData.size;
                    logic.material.uniforms.uTexture2Size.value = logic.textures[1].userData.size;
                }

                const animate = () => {
                    if (logic.renderer && logic.scene && logic.camera) {
                        logic.renderer.render(logic.scene, logic.camera);
                    }
                    requestAnimationFrame(animate);
                };
                animate();

            } catch (err) {
                console.error("Error loading textures:", err);
            }
        };

        loadTextures();

        // 4. Setup Tweakpane
        if (!logic.pane) {
            logic.pane = new Pane({ title: 'Visual Effects', expanded: false });
            const f1 = logic.pane.addFolder({ title: 'General' });
            f1.addBinding(SLIDER_CONFIG.settings, 'globalIntensity', { min: 0.1, max: 2.0 }).on('change', (ev: any) => logic.material!.uniforms.uGlobalIntensity.value = ev.value);
            f1.addBinding(SLIDER_CONFIG.settings, 'distortionStrength', { min: 0.1, max: 3.0 }).on('change', (ev) => logic.material!.uniforms.uDistortionStrength.value = ev.value);

            const f2 = logic.pane.addFolder({ title: 'Glass Effect' });
            f2.addBinding(SLIDER_CONFIG.settings, 'glassRefractionStrength', { min: 0.1, max: 3.0 }).on('change', (ev: any) => {
                if (logic.material) logic.material.uniforms.uGlassRefractionStrength.value = ev.value;
            });

            logic.pane.element.style.display = 'none';
        }

        // 5. Events
        const handleResize = () => {
            if (logic.renderer && logic.material) {
                logic.renderer.setSize(window.innerWidth, window.innerHeight);
                logic.material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
            }
        };

        // Note: nextSlide/prevSlide rely on logicRef, so they are stable
        const handleKey = (e: KeyboardEvent) => {
            if (e.code === 'KeyH' && logic.pane) {
                logic.pane.element.style.display = logic.pane.element.style.display === 'none' ? 'block' : 'none';
            }
            if (e.code === 'ArrowRight' || e.code === 'Space') nextSlide();
            if (e.code === 'ArrowLeft') prevSlide();
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('keydown', handleKey);

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', handleKey);
            logic.pane?.dispose();
            logic.renderer?.dispose();
            if (logic.autoSlideTimer) clearTimeout(logic.autoSlideTimer);
            if (logic.progressInterval) clearInterval(logic.progressInterval);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount

    // Start timer once preloading is done
    useEffect(() => {
        if (loaded) startTimer();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loaded]);

    return (
        <main
            ref={containerRef}
            className={`relative w-screen h-screen overflow-hidden bg-black text-white font-sans transition-opacity duration-1000 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            onClick={(e) => {
                if (!(e.target as HTMLElement).closest('.slides-navigation')) nextSlide();
            }}
        >
            <style jsx global>{`
        @import url("https://fonts.cdnfonts.com/css/pp-neue-montreal");
        
        :root {
           --font-mono: "PPSupplyMono", monospace;
           --font-sans: "PP Neue Montreal", sans-serif;
        }
        
        .tp-dfwv {
            z-index: 1000 !important;
            top: 20px !important;
            right: 20px !important;
        }
      `}</style>

            {/* 1. Preloader */}
            {!loaded && <Preloader onLoadComplete={() => setLoaded(true)} />}

            {/* 2. WebGL Layer */}
            <canvas ref={canvasRef} className="block w-full h-full absolute inset-0 z-0" />

            {/* 3. UI Layer */}
            <div className="relative z-10 w-full h-full pointer-events-none select-none">

                {/* Slide Counter */}
                <span className="absolute top-1/2 left-4 md:left-8 -translate-y-1/2 font-mono text-xs font-semibold tracking-widest uppercase">
                    {String(activeSlide + 1).padStart(2, '0')}
                </span>

                {/* Total Counter */}
                <span className="absolute top-1/2 right-4 md:right-8 -translate-y-1/2 font-mono text-xs font-semibold tracking-widest uppercase">
                    {String(SLIDES.length).padStart(2, '0')}
                </span>

                {/* Help Text */}
                <span className="absolute top-4 left-4 md:left-8 font-mono text-[10px] md:text-xs tracking-wider uppercase text-white/60">
                    H: Settings • Space/→: Next • ←: Prev
                </span>

                {/* Navigation */}
                <nav className="slides-navigation absolute bottom-4 left-4 right-4 md:bottom-8 md:left-8 md:right-8 flex gap-0 pointer-events-auto">
                    {SLIDES.map((slide, idx) => (
                        <div
                            key={idx}
                            className={`group flex-1 flex flex-col cursor-pointer p-2 md:p-4 transition-colors ${idx === activeSlide ? 'text-white' : 'text-white/60 hover:text-white/80'}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                navigateTo(idx);
                            }}
                        >
                            <div className="w-full h-[2px] bg-white/20 mb-2 rounded-sm overflow-hidden">
                                <div
                                    id={`progress-${idx}`}
                                    className="h-full bg-white w-0 transition-all duration-100 ease-linear opacity-100"
                                    style={{ width: idx === activeSlide ? '0%' : '0%' }}
                                />
                            </div>
                            <div className="font-mono text-[10px] md:text-[11px] uppercase font-semibold tracking-wide truncate">
                                {slide.title}
                            </div>
                        </div>
                    ))}
                </nav>
            </div>
        </main>
    );
}