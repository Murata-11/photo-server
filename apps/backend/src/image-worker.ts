import { runImageJob } from './image-core.js';
const [input, output, mime, result] = process.argv.slice(2);
if (!input || !output || !mime || !result) process.exit(1);
await runImageJob(input, output, mime, result);
