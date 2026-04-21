import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const scanTargets = ["App.tsx", "src"];
const allowedExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);
const knownBooleanObjectProps = [
  "headerShown",
  "headerShadowVisible",
  "editable",
  "disabled",
  "visible",
  "secureTextEntry",
  "transparent",
  "horizontal",
  "pagingEnabled",
  "showsVerticalScrollIndicator",
  "showsHorizontalScrollIndicator",
  "autoFocus",
  "multiline",
  "useNativeDriver",
];

const jsxStringBooleanPattern =
  /\b([A-Za-z_][\w.]*)\s*=\s*["'](?:true|false)["']/;
const objectStringBooleanPattern = new RegExp(
  `\\b(?:${knownBooleanObjectProps.join("|")})\\s*:\\s*["'](?:true|false)["']`
);
const booleanStringCoercionPattern = new RegExp(
  `\\b(?:${knownBooleanObjectProps.join("|")})\\s*[=:]\\s*\\{[^}]*?(?:String\\(|\\.toString\\()`
);

const issues = [];

const visit = (relativePath) => {
  const absolutePath = path.join(rootDir, relativePath);
  const stat = fs.statSync(absolutePath);

  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(absolutePath)) {
      visit(path.join(relativePath, entry));
    }
    return;
  }

  if (!allowedExtensions.has(path.extname(relativePath))) {
    return;
  }

  const source = fs.readFileSync(absolutePath, "utf8");
  const lines = source.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (
      jsxStringBooleanPattern.test(line) ||
      objectStringBooleanPattern.test(line) ||
      booleanStringCoercionPattern.test(line)
    ) {
      issues.push({
        file: relativePath.replace(/\\/g, "/"),
        lineNumber: index + 1,
        content: line.trim(),
      });
    }
  });
};

scanTargets.forEach(visit);

if (issues.length > 0) {
  console.error("String boolean props found:");

  for (const issue of issues) {
    console.error(`${issue.file}:${issue.lineNumber} ${issue.content}`);
  }

  process.exit(1);
}

console.log("No string boolean props found.");
