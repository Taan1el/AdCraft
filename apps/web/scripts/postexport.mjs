import fs from "node:fs";
import path from "node:path";

const outDir = path.join(process.cwd(), "out");
fs.writeFileSync(path.join(outDir, ".nojekyll"), "", "utf8");
