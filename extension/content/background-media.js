(() => {
  const TOOL_NAME = "AetherBackgroundMedia";

  const requireDependency = (deps, name) => {
    const value = deps[name];
    if (value == null) {
      throw new Error(`${TOOL_NAME}: missing dependency "${name}"`);
    }
    return value;
  };

  const VIDEO_EXTENSIONS = Object.freeze([".mp4", ".webm", ".ogv"]);

  // Two-layer cross-fade engine for the ambient backdrop. One layer stays
  // visible while the next background (image, video, or special animated
  // preset) loads into the inactive layer; transitions queue so rapid preset
  // clicks settle on the last request instead of racing.
  const createBackgroundMediaEngine = (deps = {}) => {
    const document = requireDependency(deps, "document");
    const nodeId = requireDependency(deps, "nodeId");
    const sanitizeUrl = requireDependency(deps, "sanitizeUrl");
    const transitionDurationMs = deps.transitionDurationMs ?? 800;
    const defaultUrl = deps.defaultUrl || "";
    const specialLayerClasses = deps.specialLayerClasses || {};
    const specialClassList = Object.freeze(Object.values(specialLayerClasses));

    let node = null;
    let activeLayerId = "a";
    let isTransitioning = false;
    let currentUrl = null;
    let transitionTimer = null;
    let pendingMediaCleanup = null;
    let generation = 0;
    const transitionQueue = [];

    const getNode = () => {
      if (node?.isConnected) return node;
      node = document.getElementById(nodeId);
      return node;
    };

    const createLayerContent = () => `
      <div class="animated-bg">
        <div class="blob"></div><div class="blob"></div><div class="blob"></div>
      </div>
      <video playsinline autoplay muted loop></video>
      <picture>
        <source type="image/webp" srcset="">
        <img alt="" aria-hidden="true" sizes="100vw" loading="eager" fetchpriority="high" src="" srcset="">
      </picture>
    `;

    const createNode = () => {
      const wrap = document.createElement("div");
      wrap.id = nodeId;
      wrap.setAttribute("aria-hidden", "true");
      Object.assign(wrap.style, {
        position: "fixed",
        inset: "0",
        zIndex: "-1",
        pointerEvents: "none",
      });

      wrap.innerHTML = `
      <div class="media-layer active" data-layer-id="a">${createLayerContent()}</div>
      <div class="media-layer" data-layer-id="b">${createLayerContent()}</div>
      <div class="haze"></div>
      <div class="overlay"></div>
    `;
      node = wrap;
      return wrap;
    };

    const setNodeVisible = (visible) => {
      const bgNode = getNode();
      if (!bgNode) return;
      bgNode.classList.toggle("bg-visible", visible);
      bgNode.style.opacity = visible ? "1" : "0";
    };

    const setLayerActive = (layer, active) => {
      if (!layer) return;
      layer.classList.toggle("active", active);
      layer.style.opacity = active ? "1" : "0";
    };

    const enqueueTransition = (url) => {
      const nextUrl = url || "";
      const lastQueued = transitionQueue[transitionQueue.length - 1];
      if (lastQueued === nextUrl) return;
      if (!isTransitioning && transitionQueue.length === 0 && nextUrl === currentUrl) return;
      transitionQueue.push(nextUrl);
    };

    const drainTransitionQueue = () => {
      if (isTransitioning || transitionQueue.length === 0) return;
      update(transitionQueue.shift());
    };

    function update(requestedUrl) {
      const bgNode = getNode();
      if (!bgNode) return;

      const url = sanitizeUrl(requestedUrl || "");
      if (isTransitioning) {
        enqueueTransition(url);
        return;
      }
      if (url === currentUrl) return;

      const inactiveLayerId = activeLayerId === "a" ? "b" : "a";
      const activeLayer = bgNode.querySelector(`.media-layer[data-layer-id="${activeLayerId}"]`);
      const inactiveLayer = bgNode.querySelector(`.media-layer[data-layer-id="${inactiveLayerId}"]`);

      if (!activeLayer || !inactiveLayer) return;
      isTransitioning = true;
      const transitionGeneration = generation;

      specialClassList.forEach((className) => inactiveLayer.classList.remove(className));
      const inactiveImg = inactiveLayer.querySelector("img");
      const inactiveSource = inactiveLayer.querySelector("source");
      const inactiveVideo = inactiveLayer.querySelector("video");

      const transitionToInactive = () => {
        if (transitionGeneration !== generation) return;
        setLayerActive(inactiveLayer, true);
        setLayerActive(activeLayer, false);
        activeLayerId = inactiveLayerId;
        if (transitionTimer) {
          clearTimeout(transitionTimer);
        }
        transitionTimer = setTimeout(() => {
          transitionTimer = null;
          isTransitioning = false;
          currentUrl = url;
          drainTransitionQueue();
        }, transitionDurationMs);
      };

      const specialClass = specialLayerClasses[url];
      if (specialClass) {
        inactiveLayer.classList.add(specialClass);
        transitionToInactive();
        return;
      }

      const defaultWebpSrcset = defaultUrl ? `${defaultUrl} 1x` : "";

      const applyMedia = (mediaUrl) => {
        const isVideo = VIDEO_EXTENSIONS.some((ext) => mediaUrl.toLowerCase().includes(ext));
        inactiveImg.style.display = isVideo ? "none" : "block";
        inactiveVideo.style.display = isVideo ? "block" : "none";

        const mediaEl = isVideo ? inactiveVideo : inactiveImg;
        const eventType = isVideo ? "loadeddata" : "load";

        const cleanupMediaListeners = () => {
          mediaEl.removeEventListener(eventType, onMediaReady);
          mediaEl.removeEventListener("error", onMediaError);
          if (pendingMediaCleanup === cleanupMediaListeners) {
            pendingMediaCleanup = null;
          }
        };
        const onMediaReady = () => {
          cleanupMediaListeners();
          transitionToInactive();
        };
        const onMediaError = () => {
          cleanupMediaListeners();
          if (transitionGeneration !== generation) return;
          applyDefault();
        };

        mediaEl.addEventListener(eventType, onMediaReady, { once: true });
        mediaEl.addEventListener("error", onMediaError, { once: true });
        pendingMediaCleanup = cleanupMediaListeners;

        if (isVideo) {
          inactiveVideo.src = mediaUrl;
          inactiveVideo.load();
          inactiveVideo.play().catch((_e) => {});
          inactiveImg.src = "";
          inactiveImg.srcset = "";
          inactiveSource.srcset = "";
        } else {
          inactiveImg.src = mediaUrl;
          inactiveImg.srcset = "";
          inactiveSource.srcset = "";
          inactiveVideo.src = "";
        }
      };

      const applyDefault = () => {
        inactiveImg.style.display = "block";
        inactiveVideo.style.display = "none";
        inactiveVideo.src = "";

        const cleanupMediaListeners = () => {
          inactiveImg.removeEventListener("load", onMediaReady);
          inactiveImg.removeEventListener("error", onMediaReady);
          if (pendingMediaCleanup === cleanupMediaListeners) {
            pendingMediaCleanup = null;
          }
        };
        const onMediaReady = () => {
          cleanupMediaListeners();
          transitionToInactive();
        };
        inactiveImg.addEventListener("load", onMediaReady, { once: true });
        inactiveImg.addEventListener("error", onMediaReady, { once: true });
        pendingMediaCleanup = cleanupMediaListeners;

        inactiveImg.src = defaultUrl;
        inactiveImg.srcset = defaultWebpSrcset;
        inactiveSource.srcset = defaultWebpSrcset;
      };

      if (url) {
        applyMedia(url);
      } else {
        applyDefault();
      }
    }

    const syncMediaPlayback = (isHidden) => {
      const bgNode = getNode();
      if (!bgNode) return;
      bgNode.querySelectorAll("video").forEach((video) => {
        if (isHidden) {
          video.pause();
        } else if (video.style.display !== "none") {
          video.play().catch((_e) => {
            console.debug("Aether: Background video autoplay was blocked.");
          });
        }
      });
    };

    const reset = () => {
      generation += 1;
      if (transitionTimer) {
        clearTimeout(transitionTimer);
        transitionTimer = null;
      }
      if (pendingMediaCleanup) {
        pendingMediaCleanup();
        pendingMediaCleanup = null;
      }
      node?.querySelectorAll("video").forEach((video) => {
        video.pause();
        video.removeAttribute("src");
        video.load();
      });
      node?.querySelectorAll("img, source").forEach((media) => {
        media.removeAttribute("src");
        media.removeAttribute("srcset");
      });
      transitionQueue.length = 0;
      currentUrl = null;
      activeLayerId = "a";
      isTransitioning = false;
      node = null;
    };

    return Object.freeze({
      createNode,
      getNode,
      setNodeVisible,
      update,
      syncMediaPlayback,
      reset,
    });
  };

  const AetherBackgroundMedia = Object.freeze({
    createBackgroundMediaEngine,
  });

  globalThis.AetherBackgroundMedia = AetherBackgroundMedia;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = AetherBackgroundMedia;
  }
})();
