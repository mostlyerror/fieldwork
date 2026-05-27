import { writePlacements } from "./utils/placements.js";
writePlacements().then((n) => console.log(`Done: ${n} placements`)).catch(console.error);
