// Show plugin UI inside standard iframe with a neat visual window frame size
figma.showUI(__html__, { width: 320, height: 350 });

// Handle messages from the UI (e.g., window resizing)
figma.ui.onmessage = (msg) => {
  if (msg.type === "resize" && typeof msg.width === "number" && typeof msg.height === "number") {
    figma.ui.resize(msg.width, msg.height);
  }
};

// Trigger selection analysis on start
analyzeSelection();

// Listen to selection changes dynamically
figma.on("selectionchange", () => {
  analyzeSelection();
});

// main function to extract selected node properties and build selection URLs
async function analyzeSelection() {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    // No selection
    figma.ui.postMessage({
      type: "selection-changed",
      count: 0
    });
    return;
  }

  if (selection.length > 1) {
    // Multiple selections warning
    figma.ui.postMessage({
      type: "selection-changed",
      count: selection.length
    });
    return;
  }

  // Exactly one node is selected
  const node = selection[0];

  // Try to read file attributes safely
  const fileName = figma.root.name || "Untitled Figma Design";
  const fileKey = figma.fileKey || "local-draft";

  // URL-safe encoded Node ID
  const nodeId = node.id;
  const encodedNodeId = nodeId.replace(/:/g, "-"); // Figma design link URL standard queries replacements

  // Build the clean design context selection URL
  let selectionUrl = "";
  if (figma.fileKey) {
    selectionUrl = `https://www.figma.com/design/${fileKey}/${encodeURIComponent(fileName)}?node-id=${encodeURIComponent(encodedNodeId)}`;
  } else {
    selectionUrl = `https://www.figma.com/design/local-draft?node-id=${encodeURIComponent(encodedNodeId)}`;
  }

  // Export high resolution selection image preview asynchronously (visual likeness check)
  let base64Preview = "";
  let svgContent = "";
  try {
    const previewBytes = await node.exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: 1 }
    });
    base64Preview = figma.base64Encode(previewBytes);
  } catch (err) {
    console.warn("[FIGMA CODE] Failed to export preview image:", err);
  }

  // Export selected node as SVG
  try {
    const svgBytes = await node.exportAsync({
      format: "SVG"
    });
    let svgText = "";
    for (let i = 0; i < svgBytes.length; i++) {
      svgText += String.fromCharCode(svgBytes[i]);
    }
    svgContent = svgText;
  } catch (err) {
    console.warn("[FIGMA CODE] Failed to export SVG:", err);
  }

  // Recursively extract all vector/shapes children
  const childVectors: Array<{ nodeId: string; nodeName: string; svgContent: string }> = [];
  try {
    await extractChildVectors(node, childVectors);
  } catch (err) {
    console.warn("[FIGMA CODE] Failed to extract child vectors:", err);
  }

  const figmaNode = serializeNode(node);
  if (base64Preview) {
    figmaNode.previewImage = `data:image/png;base64,${base64Preview}`;
  }

  const payload = {
    source: "figma-plugin",
    fileKey: figma.fileKey || undefined,
    fileName: fileName,
    nodeId: nodeId,
    nodeName: node.name,
    nodeType: node.type,
    width: Math.round(node.width),
    height: Math.round(node.height),
    selectionUrl: selectionUrl,
    timestamp: new Date().toISOString(),
    figmaNode: figmaNode, // Dynamic extraction of actual design layout, colors, and content tree
    svgContent: svgContent || undefined,
    childVectors: childVectors.length > 0 ? childVectors : undefined
  };

  console.log("[FIGMA CODE] Posting single selection payload to UI iframe:", payload);
  figma.ui.postMessage({
    type: "selection-changed",
    count: 1,
    payload: payload
  });
}

// Comprehensive recursive serializer to map exact Figma canvas selections directly to compliant Figma API JSON schema representations
function serializeNode(node: any): any {
  if (!node) return null;

  const result: any = {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: node.visible !== false,
    opacity: typeof node.opacity === "number" ? node.opacity : 1.0,
  };

  // absoluteBoundingBox mapping
  if (node.absoluteBoundingBox) {
    result.absoluteBoundingBox = {
      x: Math.round(node.absoluteBoundingBox.x),
      y: Math.round(node.absoluteBoundingBox.y),
      width: Math.round(node.absoluteBoundingBox.width),
      height: Math.round(node.absoluteBoundingBox.height)
    };
  } else if (typeof node.width === "number" && typeof node.height === "number") {
    result.absoluteBoundingBox = {
      x: 0,
      y: 0,
      width: Math.round(node.width),
      height: Math.round(node.height)
    };
  }

  // layout sizing
  if (typeof node.width === "number") result.width = Math.round(node.width);
  if (typeof node.height === "number") result.height = Math.round(node.height);
  if (node.layoutMode) result.layoutMode = node.layoutMode;
  if (node.primaryAxisSizingMode) result.primaryAxisSizingMode = node.primaryAxisSizingMode;
  if (node.counterAxisSizingMode) result.counterAxisSizingMode = node.counterAxisSizingMode;
  if (node.primaryAxisAlignItems) result.primaryAxisAlignItems = node.primaryAxisAlignItems;
  if (node.counterAxisAlignItems) result.counterAxisAlignItems = node.counterAxisAlignItems;
  if (typeof node.paddingLeft === "number") result.paddingLeft = node.paddingLeft;
  if (typeof node.paddingRight === "number") result.paddingRight = node.paddingRight;
  if (typeof node.paddingTop === "number") result.paddingTop = node.paddingTop;
  if (typeof node.paddingBottom === "number") result.paddingBottom = node.paddingBottom;
  if (typeof node.cornerRadius === "number") result.cornerRadius = node.cornerRadius;

  // solid & gradient fills color extraction
  if (Array.isArray(node.fills)) {
    result.fills = node.fills.map((fill: any) => {
      if (fill.type === "SOLID" && fill.color) {
        return {
          type: "SOLID",
          visible: fill.visible !== false,
          opacity: typeof fill.opacity === "number" ? fill.opacity : 1.0,
          color: { r: fill.color.r, g: fill.color.g, b: fill.color.b }
        };
      } else if (fill.type && fill.type.startsWith("GRADIENT") && Array.isArray(fill.gradientStops)) {
        return {
          type: fill.type,
          visible: fill.visible !== false,
          opacity: typeof fill.opacity === "number" ? fill.opacity : 1.0,
          gradientStops: fill.gradientStops.map((stop: any) => ({
            position: stop.position,
            color: { r: stop.color.r, g: stop.color.g, b: stop.color.b, a: stop.color.a }
          }))
        };
      }
      return { type: fill.type };
    });
  }

  // strokes color extraction (Solid & Gradients supported)
  if (Array.isArray(node.strokes)) {
    result.strokes = node.strokes.map((stroke: any) => {
      if (stroke.type === "SOLID" && stroke.color) {
        return {
          type: "SOLID",
          visible: stroke.visible !== false,
          opacity: typeof stroke.opacity === "number" ? stroke.opacity : 1.0,
          color: { r: stroke.color.r, g: stroke.color.g, b: stroke.color.b }
        };
      } else if (stroke.type && stroke.type.startsWith("GRADIENT") && Array.isArray(stroke.gradientStops)) {
        return {
          type: stroke.type,
          visible: stroke.visible !== false,
          opacity: typeof stroke.opacity === "number" ? stroke.opacity : 1.0,
          gradientStops: stroke.gradientStops.map((stop: any) => ({
            position: stop.position,
            color: { r: stop.color.r, g: stop.color.g, b: stop.color.b, a: stop.color.a }
          }))
        };
      }
      return { type: stroke.type };
    });
  }
  if (typeof node.strokeWeight === "number") result.strokeWeight = node.strokeWeight;

  // text layer specific characters and typography styles
  if (node.type === "TEXT" && typeof node.characters === "string") {
    result.characters = node.characters;
    result.style = {
      fontFamily: node.fontName && typeof node.fontName === "object" ? node.fontName.family : "Inter",
      fontSize: typeof node.fontSize === "number" ? node.fontSize : 12,
      fontWeight: node.fontName && typeof node.fontName === "object" ? node.fontName.style : "Regular"
    };
  }

  // recursive walk child layers (up to 40 nodes to maintain performance and prevent heavy payloads)
  if (Array.isArray(node.children)) {
    result.children = node.children.slice(0, 40).map((child: any) => serializeNode(child)).filter(Boolean);
  }

  return result;
}

async function extractChildVectors(node: SceneNode, results: Array<{ nodeId: string; nodeName: string; svgContent: string }>) {
  const promises: Promise<void>[] = [];
  
  function walk(n: SceneNode) {
    if (n.id !== node.id && (n.type === "VECTOR" || n.type === "BOOLEAN_OPERATION" || n.type === "LINE" || n.type === "STAR" || n.type === "POLYGON")) {
      const p = (async () => {
        try {
          const svgBytes = await n.exportAsync({ format: "SVG" });
          let svgText = "";
          for (let i = 0; i < svgBytes.length; i++) {
            svgText += String.fromCharCode(svgBytes[i]);
          }
          results.push({
            nodeId: n.id,
            nodeName: n.name,
            svgContent: svgText
          });
        } catch (err) {
          console.warn(`[FIGMA CODE] Failed to export child vector SVG for node ${n.id}:`, err);
        }
      })();
      promises.push(p);
    }
    
    if ("children" in n) {
      for (const child of n.children) {
        walk(child);
      }
    }
  }
  
  walk(node);
  await Promise.all(promises);
}
