import fs from "fs";

let content = fs.readFileSync("packages/official-traces/src/index.ts", "utf-8");

// We need to spice up the createMatrix calls
content = content.replace(/createMatrix\(16, 16, \(\) => 1\)/g, "createMatrix(16, 16, (x, y) => Math.abs(Math.sin(x*0.5 + y*0.5)) * 0.8 + 0.2)");


fs.writeFileSync("packages/official-traces/src/index.ts", content);
