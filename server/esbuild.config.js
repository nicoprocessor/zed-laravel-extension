const esbuild = require("esbuild");
const watch = process.argv.includes("--watch");

const buildOptions = {
  entryPoints: ["src/server.ts"],
  bundle: true,
  outfile: "dist/server.js",
  platform: "node",
  target: "node18",
  format: "cjs",
  sourcemap: true,
  external: [],
  minify: !watch,
};

if (watch) {
  esbuild.context(buildOptions).then((ctx) => {
    ctx.watch();
    console.log("Watching for changes...");
  });
} else {
  esbuild.build(buildOptions).then(() => {
    console.log("Build complete.");
  });
}
