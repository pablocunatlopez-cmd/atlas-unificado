import {createAtlasCpuDemoServer} from './atlas-cpu-demo-server.mjs';
const demo=createAtlasCpuDemoServer();
await demo.listen();
console.log('Atlas CPU demo: http://127.0.0.1:8765');
console.log('The diagnostic only runs when you press the button.');
const stop=async()=>{await demo.close();process.exit(0);};
process.once('SIGINT',stop);
process.once('SIGTERM',stop);
