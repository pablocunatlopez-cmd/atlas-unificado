import {readFile} from 'node:fs/promises';
import {importRepositoryCatalog,openRepositoryLibrary,DEFAULT_LIBRARY_PATH} from './repo-library.mjs';

const sourcePath=process.argv[2];if(!sourcePath)throw Error('Indica el archivo de catálogo que quieres importar.');
const dbPath=process.argv[3]||DEFAULT_LIBRARY_PATH;
const text=await readFile(sourcePath,'utf8');
const imported=importRepositoryCatalog(text,{sourcePath,dbPath,expectedEntries:117});
const library=openRepositoryLibrary({dbPath});
try{console.log(JSON.stringify({import:imported,summary:library.summary()},null,2));}
finally{library.close();}
