import express from "express";
import open from "open";
import path from "path";

let server: any = null;
const debugComponents: Map<string, string> = new Map();
let serverStarted = false;

export const startDebugServer = async (): Promise<void> => {
  if (server || serverStarted) return;

  return new Promise((resolve, reject) => {
    const app = express();

    app.use("/images", express.static(path.resolve(__dirname, "../../images")));
    app.get("/", (req, res) => {
      const componentsList = Array.from(debugComponents.keys())
        .map((key) => `<li><a href="/${key}">${key}</a></li>`)
        .join("");

      res.send(`
        <html>
          <body>
            <h1>Debug Components</h1>
            <ul>${componentsList}</ul>
          </body>
        </html>
      `);
    });

    app.get("/:componentId", (req, res) => {
      const html = debugComponents.get(req.params.componentId);
      if (html) {
        res.send(html);
      } else {
        res.status(404).send("Component not found");
      }
    });

    server = app.listen(3002, () => {
      serverStarted = true;
      resolve();
    });
    server.on("error", (err: unknown) => {
      reject(err);
    });
  });
};

export const debugInBrowser = async (element: HTMLElement, name: string) => {
  // Get all stylesheets from the document
  const getStyleSheets = () => {
    let styles = "";
    try {
      Array.from(document.styleSheets).forEach((sheet) => {
        try {
          Array.from(sheet.cssRules).forEach((rule) => {
            styles += rule.cssText + "\n";
          });
        } catch (e) {
          // Handle CORS issues with external stylesheets
          console.warn("Could not access stylesheet:", sheet.href);
        }
      });
    } catch (e) {
      console.warn("Could not access stylesheets");
    }
    return styles;
  };

  const stylesheetStyles = getStyleSheets();
  const rewrittenHTML = element.outerHTML
    // Rewrite relative image paths (images/..., ./images/..., ../images/...)
    .replace(
      /src=["']((?:\.{0,2}\/)?images\/[^"']+)["']/g,
      (_match, group1) => `src="/${group1.replace(/^(\.\/|..\/)?/, "")}"`
    )
    // Rewrite bare SVG/PNG/JPG filenames to /images/...
    .replace(
      // eslint-disable-next-line no-useless-escape
      /src=["']([^\/"']+\.(svg|png|jpg|jpeg|gif))["']/gi,
      (_match, filename) => `src="/images/${filename}"`
    );
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Debug: ${name}</title>
        <meta charset="utf-8">
        <style>
          /* Reset and base styles */
          * { box-sizing: border-box; }
          body { 
            font-family: system-ui, -apple-system, sans-serif; 
            margin: 0; 
            padding: 20px;
            background: #f8f9fa;
          }
          
          /* Debug info styles */
          .debug-info {
            background: #e9ecef;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 20px;
            font-size: 14px;
            font-family: system-ui, -apple-system, sans-serif !important;
          }
          
          /* Component container */
          .debug-component {
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }

          img {
            max-width: 100%;
            height: auto;
            display: block;
          }
          
          /* Original stylesheet styles */
          ${stylesheetStyles}
          
          /* Prevent broken modal padding on body */
          body {
            padding: 20px !important;
            padding-right: 20px !important;
            overflow: auto !important;
            transform: none !important;
            position: static !important;
          }

          /* Fix modals that might be position: fixed */
          [role="dialog"],
          [role="alertdialog"] {
            position: absolute !important;
            top: 50px !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            z-index: 1000 !important;
          }
        </style>
      </head>
      <body>
        <div class="debug-info">
          <strong>Component:</strong> ${name}<br>
          <strong>Rendered at:</strong> ${new Date().toLocaleString()}<br>
        </div>
        <div class="debug-component">
          ${rewrittenHTML}
        </div>
      </body>
    </html>
  `;

  debugComponents.set(name, html);

  await startDebugServer();
  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log(`🔍 ${name} available at http://localhost:3002/${name}`);

  if (debugComponents.size === 1) {
    try {
      await open(`http://localhost:3002/${name}`);
    } catch (error) {
      console.log(
        "Could not auto-open browser. Navigate to http://localhost:3002"
      );
    }
  }
};

// Simplest version - always uses same name so it overwrites previous
export const debugScreen = async () => {
  const container = document.body;
  if (!container) {
    console.warn("Could not find root container for debugging");
    return;
  }

  await debugInBrowser(container as HTMLElement, "current-screen");
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  setInterval(() => {}, 1000); // Keeps the process alive
};

// Cleanup function to stop server
export const stopDebugServer = () => {
  if (server) {
    server.close();
    server = null;
    serverStarted = false;    debugComponents.clear();
    console.log("🔍 Debug server stopped");
  }
};