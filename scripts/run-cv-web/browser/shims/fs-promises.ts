import fs from "./fs.js";

const promises = fs.promises;

export default promises;
export const { access, readFile, readdir, stat, writeFile, mkdir } = promises;
