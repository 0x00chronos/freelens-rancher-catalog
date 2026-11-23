'use strict';
const esbuild=require('esbuild');
const common={bundle:true,sourcemap:false,legalComments:'eof'};
Promise.all([
  esbuild.build({...common,entryPoints:['src/main.js'],outfile:'dist/main.js',platform:'node',format:'cjs',target:'node22'}),
  esbuild.build({...common,entryPoints:['src/renderer.jsx'],outfile:'dist/renderer.mjs',platform:'browser',format:'esm',target:'es2022',jsxFactory:'React.createElement',jsxFragment:'React.Fragment'}),
]).catch(()=>process.exit(1));
