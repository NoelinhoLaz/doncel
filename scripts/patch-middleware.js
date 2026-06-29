const fs = require("fs");
const path = require("path");

function patchManifest() {
  const manifestPath = path.join(process.cwd(), ".next", "server", "middleware-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.log("No middleware manifest found to patch.");
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!manifest.middleware) {
    console.log("No middleware configuration in manifest.");
    return;
  }

  // Define the relative path to our shim
  const shimRelativePath = "server/edge/chunks/shim.js";

  // Prepend the shim to the files array for all middleware routes
  let patched = false;
  for (const route in manifest.middleware) {
    const middlewareEntry = manifest.middleware[route];
    if (middlewareEntry && Array.isArray(middlewareEntry.files)) {
      if (!middlewareEntry.files.includes(shimRelativePath)) {
        middlewareEntry.files.unshift(shimRelativePath);
        patched = true;
        console.log(`Prepended shim to middleware files for route: ${route}`);
      }
    }
  }

  if (patched) {
    // Write back the updated manifest
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    // Ensure the edge/chunks directory exists
    const chunksDir = path.join(process.cwd(), ".next", "server", "edge", "chunks");
    if (!fs.existsSync(chunksDir)) {
      fs.mkdirSync(chunksDir, { recursive: true });
    }

    // Write the shim file content
    const shimContent = `// Global shims for Vercel Edge Runtime to prevent __dirname and __filename ReferenceErrors
globalThis.__dirname = "";
globalThis.__filename = "";
`;
    fs.writeFileSync(path.join(chunksDir, "shim.js"), shimContent, "utf8");
    console.log("Successfully wrote Edge Runtime shim.js file.");
  } else {
    console.log("Middleware manifest was already patched.");
  }
}

patchManifest();
