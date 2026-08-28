(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.AetherRefractiveGlass = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const FILTER_BANK_ID = "aether-refractive-filter-bank";
  const FILTER_ID = "aether-refractive-soft";
  const FILTER_VARIABLE = "--aether-refractive-filter";

  const setAttributes = (node, attributes) => {
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, String(value)));
    return node;
  };

  const createSvgNode = (document, name, attributes = {}) =>
    setAttributes(document.createElementNS(SVG_NS, name), attributes);

  const createFilterBank = (document) => {
    const bank = createSvgNode(document, "svg", {
      id: FILTER_BANK_ID,
      width: 0,
      height: 0,
      "aria-hidden": "true",
      focusable: "false",
    });
    bank.style.cssText = "position:fixed;inline-size:0;block-size:0;overflow:hidden;pointer-events:none";

    const defs = createSvgNode(document, "defs");
    const filter = createSvgNode(document, "filter", {
      id: FILTER_ID,
      x: "-18%",
      y: "-18%",
      width: "136%",
      height: "136%",
      "color-interpolation-filters": "sRGB",
    });
    const turbulence = createSvgNode(document, "feTurbulence", {
      type: "fractalNoise",
      baseFrequency: "0.011 0.018",
      numOctaves: 2,
      seed: 12,
      result: "aether-refractive-noise",
    });
    const blur = createSvgNode(document, "feGaussianBlur", {
      in: "aether-refractive-noise",
      stdDeviation: 1.25,
      result: "aether-refractive-map",
    });
    const displacement = createSvgNode(document, "feDisplacementMap", {
      in: "SourceGraphic",
      in2: "aether-refractive-map",
      scale: 8,
      xChannelSelector: "R",
      yChannelSelector: "G",
    });

    filter.append(turbulence, blur, displacement);
    defs.appendChild(filter);
    bank.appendChild(defs);
    return bank;
  };

  const ensureRefractiveGlassFilter = (document) => {
    if (!document?.documentElement) {
      throw new TypeError("Aether refractive glass requires a document element.");
    }

    let bank = document.getElementById(FILTER_BANK_ID);
    if (!bank) {
      bank = createFilterBank(document);
      document.documentElement.appendChild(bank);
    }
    document.documentElement.style.setProperty(FILTER_VARIABLE, `url("#${FILTER_ID}")`);
    return bank;
  };

  const removeRefractiveGlassFilter = (document) => {
    document?.getElementById(FILTER_BANK_ID)?.remove();
    document?.documentElement?.style.removeProperty(FILTER_VARIABLE);
  };

  return Object.freeze({
    FILTER_BANK_ID,
    FILTER_ID,
    FILTER_VARIABLE,
    ensureRefractiveGlassFilter,
    removeRefractiveGlassFilter,
  });
});
