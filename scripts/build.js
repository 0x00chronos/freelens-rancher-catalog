'use strict';
const esbuild=require('esbuild');
Promise.all(['main','renderer'].map(entry=>esbuild.build({entryPoints:[`src/${entry}${entry==='renderer'?'.jsx':'.js'}`],outfile:`dist/${entry}.js`,bundle:true,platform:'node',format:'cjs',target:'node22',external:['electron'],sourcemap:false,legalComments:'eof',jsxFactory:'React.createElement',jsxFragment:'React.Fragment'}))).catch(()=>process.exit(1));
