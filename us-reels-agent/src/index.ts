import { runAgent } from './agent/run.js';

const keyword = process.argv.slice(2).join(' ').trim() || 'AirPods Pro';

runAgent(keyword)
    .then((out) => {
        console.log(JSON.stringify(out, null, 2));
    })
    .catch((err) => {
        console.error(err?.response?.data || err);
        process.exit(1);
    });
