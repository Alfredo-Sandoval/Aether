// Neural Network Background Animation
// Uses p5.js to create flowing particle effects along neural network edges

(function() {
  'use strict';

  // Try to use p5 if available; otherwise fall back to Canvas2D.
  const initAnimation = () => {
    if (typeof p5 === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/p5@1.9.4/lib/p5.min.js';
      script.defer = true;
      let started = false;
      const startOnce = () => { if (!started) { started = true; startP5Animation(); } };
      script.onload = startOnce;
      script.onerror = () => { if (!started) { started = true; startFallbackAnimation(); } };
      // Safety timeout in case CSP blocks silently
      setTimeout(() => { if (!started && typeof p5 === 'undefined') { started = true; startFallbackAnimation(); } }, 2000);
      (document.head || document.documentElement).appendChild(script);
    } else {
      startP5Animation();
    }
  };

  const startP5Animation = () => {
    const container = document.getElementById('cgpt-neural-canvas');
    if (!container) return;

    new p5((sketch) => {
      let particles = [];
      let tick = 0;
      let nodes = [];
      let edges = [];

      const layerConfig = [5, 12, 15, 12, 5];

      sketch.setup = function() {
        const canvas = sketch.createCanvas(sketch.windowWidth, sketch.windowHeight);
        canvas.parent(container);
        sketch.background(0);

        // Build network structure
        const layerSpacing = sketch.width / (layerConfig.length + 1);

        layerConfig.forEach((count, layerIndex) => {
          const verticalSpan = 0.75;
          const ySpacing = (sketch.height * verticalSpan) / (count + 1);
          const offsetY = sketch.height * (1 - verticalSpan) * 0.5;

          for (let i = 0; i < count; i += 1) {
            const x = (layerIndex + 1) * layerSpacing;
            const y = offsetY + (i + 1) * ySpacing;
            nodes.push({ x, y });
          }
        });

        // Create edges between layers
        let nodeIdx = 0;
        for (let layer = 0; layer < layerConfig.length - 1; layer++) {
          const fromCount = layerConfig[layer];
          const toCount = layerConfig[layer + 1];
          const fromStart = nodeIdx;
          const toStart = nodeIdx + fromCount;

          for (let i = 0; i < fromCount; i++) {
            for (let j = 0; j < toCount; j++) {
              edges.push({
                from: fromStart + i,
                to: toStart + j
              });
            }
          }
          nodeIdx += fromCount;
        }
      };

      sketch.draw = function() {
        tick += 1;
        sketch.background(0, 14);

        // Spawn particles at source nodes
        const newcomers = Array.from({ length: 18 }, () => {
          const edge = sketch.random(edges);
          const from = nodes[edge.from];

          // Create 3D vector for hex-techno algorithm
          const vec = sketch.createVector(
            sketch.random(-1, 1),
            sketch.random(-1, 1),
            sketch.random(-1, 1)
          );
          vec.normalize();
          vec.mult(0.01);

          // Store edge info for following
          vec.edgeIndex = edges.indexOf(edge);
          vec.progress = 0;

          return vec;
        });

        particles = [...particles.slice(-5000), ...newcomers];

        sketch.stroke(255, 96);

        particles.forEach(vec => {
          // Get current edge
          const edge = edges[vec.edgeIndex];
          if (!edge) return;

          const from = nodes[edge.from];
          const to = nodes[edge.to];

          // Apply hex-techno flow algorithm
          const k = ((vec.x * 4 + 2) ^ (vec.y * 4)) | (2 + vec.z * 4);
          const r = (((vec.x * 2 * k) ^ (vec.y * k + tick / 299)) & 1) * 2 - 1;

          vec.x += (sketch.sin(r) / 99) * vec.z;
          vec.y += (sketch.cos(r) / 99) * vec.z;

          // Move along edge
          vec.progress += 0.008;

          // Calculate position along edge with hex-techno offset
          const baseX = sketch.lerp(from.x, to.x, vec.progress);
          const baseY = sketch.lerp(from.y, to.y, vec.progress);

          // Add hex-techno flow as offset perpendicular to edge
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const edgeLen = sketch.sqrt(dx * dx + dy * dy);

          // Apply offset based on hex-techno values
          const offsetScale = 25;
          const px = baseX + vec.x * offsetScale;
          const py = baseY + vec.y * offsetScale;

          sketch.point(px, py);

          // When particle reaches end, jump to new random edge
          if (vec.progress >= 1) {
            const newEdge = sketch.random(edges);
            vec.edgeIndex = edges.indexOf(newEdge);
            vec.progress = 0;
          }
        });

        // Draw nodes
        sketch.stroke(255, 120);
        sketch.strokeWeight(4);
        nodes.forEach(node => {
          sketch.point(node.x, node.y);
        });
        sketch.strokeWeight(1);
      };

      sketch.windowResized = function() {
        sketch.resizeCanvas(sketch.windowWidth, sketch.windowHeight);
        // Rebuild network on resize
        nodes = [];
        edges = [];
        particles = [];

        const layerSpacing = sketch.width / (layerConfig.length + 1);

        layerConfig.forEach((count, layerIndex) => {
          const verticalSpan = 0.75;
          const ySpacing = (sketch.height * verticalSpan) / (count + 1);
          const offsetY = sketch.height * (1 - verticalSpan) * 0.5;

          for (let i = 0; i < count; i += 1) {
            const x = (layerIndex + 1) * layerSpacing;
            const y = offsetY + (i + 1) * ySpacing;
            nodes.push({ x, y });
          }
        });

        let nodeIdx = 0;
        for (let layer = 0; layer < layerConfig.length - 1; layer++) {
          const fromCount = layerConfig[layer];
          const toCount = layerConfig[layer + 1];
          const fromStart = nodeIdx;
          const toStart = nodeIdx + fromCount;

          for (let i = 0; i < fromCount; i++) {
            for (let j = 0; j < toCount; j++) {
              edges.push({
                from: fromStart + i,
                to: toStart + j
              });
            }
          }
          nodeIdx += fromCount;
        }
      };
    });
  };

  // Simple Canvas2D fallback that does not require external libraries.
  const startFallbackAnimation = () => {
    const container = document.getElementById('cgpt-neural-canvas');
    if (!container) return;
    const canvas = document.createElement('canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    container.innerHTML = '';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const layerConfig = [5, 12, 15, 12, 5];
    let nodes = [];
    let edges = [];
    let particles = [];
    let tick = 0;

    const rebuild = () => {
      nodes = [];
      edges = [];
      particles = [];
      const w = canvas.width = window.innerWidth;
      const h = canvas.height = window.innerHeight;
      const layerSpacing = w / (layerConfig.length + 1);
      layerConfig.forEach((count, i) => {
        const verticalSpan = 0.75;
        const ySpacing = (h * verticalSpan) / (count + 1);
        const offsetY = h * (1 - verticalSpan) * 0.5;
        for (let j = 0; j < count; j++) {
          const x = (i + 1) * layerSpacing;
          const y = offsetY + (j + 1) * ySpacing;
          nodes.push({ x, y });
        }
      });
      let idx = 0;
      for (let l = 0; l < layerConfig.length - 1; l++) {
        const fromCount = layerConfig[l];
        const toCount = layerConfig[l + 1];
        const fromStart = idx;
        const toStart = idx + fromCount;
        for (let i = 0; i < fromCount; i++) {
          for (let j = 0; j < toCount; j++) {
            edges.push({ from: fromStart + i, to: toStart + j });
          }
        }
        idx += fromCount;
      }
    };

    rebuild();

    const spawn = () => {
      for (let n = 0; n < 18; n++) {
        const edge = edges[(Math.random() * edges.length) | 0];
        const v = {
          edgeIndex: edges.indexOf(edge),
          x: (Math.random() * 2 - 1) * 0.01,
          y: (Math.random() * 2 - 1) * 0.01,
          z: (Math.random() * 2 - 1) * 0.01,
          p: 0
        };
        particles.push(v);
      }
      if (particles.length > 5000) particles = particles.slice(-5000);
    };

    const step = () => {
      tick++;
      spawn();
      ctx.fillStyle = 'rgba(0,0,0,0.055)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      particles.forEach(v => {
        const e = edges[v.edgeIndex];
        if (!e) return;
        const a = nodes[e.from];
        const b = nodes[e.to];
        const k = (((v.x * 4 + 2) ^ (v.y * 4)) | (2 + v.z * 4));
        const r = ((((v.x * 2 * k) ^ (v.y * k + tick / 299)) & 1) * 2 - 1);
        v.x += (Math.sin(r) / 99) * v.z;
        v.y += (Math.cos(r) / 99) * v.z;
        v.p += 0.008;
        const baseX = a.x + (b.x - a.x) * v.p;
        const baseY = a.y + (b.y - a.y) * v.p;
        const px = baseX + v.x * 25;
        const py = baseY + v.y * 25;
        ctx.fillRect(px, py, 1, 1);
        if (v.p >= 1) {
          const ne = edges[(Math.random() * edges.length) | 0];
          v.edgeIndex = edges.indexOf(ne);
          v.p = 0;
        }
      });

      // nodes
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      nodes.forEach(n => ctx.fillRect(n.x - 1, n.y - 1, 2, 2));

      requestAnimationFrame(step);
    };

    window.addEventListener('resize', rebuild, { passive: true });
    requestAnimationFrame(step);
  };

  initAnimation();
})();
