import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {gameLibrary,readGameImage,gameLibraryContext} from './game-library.mjs';
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'atlas-games-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));await fs.mkdir(path.join(root,'Example Game'));return root;}
test('catalog indexes media and packages without executing or unpacking',async t=>{
 const root=await fixture(t),folder=path.join(root,'Example Game');
 for(const name of ['cover.png','intro.mp4','data.pak','installer.exe','archive.zip'])await fs.writeFile(path.join(folder,name),'not executed');
 const r=await gameLibrary(root);assert.equal(r.games.length,1);assert.equal(r.games[0].images.length,1);assert.equal(r.games[0].videos.length,1);
 assert.deepEqual(r.games[0].fileKinds,{archives:1,gamePackages:1,executables:1});
 await assert.rejects(readGameImage(r,r.games[0].images[0]),/contenido/);
 await assert.rejects(readGameImage(r,'../secret.png'),/catálogo/);
});
test('only catalogued images can be served and content type comes from bytes',async t=>{
 const root=await fixture(t),relative=path.join('Example Game','cover.png');
 await fs.writeFile(path.join(root,relative),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWuoAAAAASUVORK5CYII=','base64'));
 const r=await gameLibrary(root),picture=await readGameImage(r,relative);assert.equal(picture.mime,'image/png');assert.ok(picture.bytes.length>8);
 await assert.rejects(readGameImage(r,path.join(root,relative)),/catálogo/);
});
test('depth limits are reported and game context does not claim visual analysis',async t=>{
 const root=await fixture(t);await fs.mkdir(path.join(root,'Example Game','a','b','c','d'),{recursive:true});
 const r=await gameLibrary(root);assert.equal(r.limited,true);
 assert.match(gameLibraryContext(r,'estudia Example'),/No has visto escenas/);
 assert.equal(gameLibraryContext(r,'cuanto es dos mas dos'), '');
});
