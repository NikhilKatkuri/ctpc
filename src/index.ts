import Commander from "./commander/index.js";
import pkgJson from "../package.json" with { type: "json" };

const program = new Commander();

program
  .name(pkgJson.name)
  .description(pkgJson.description)
  .version(pkgJson.version);

program.parse(process.argv);
