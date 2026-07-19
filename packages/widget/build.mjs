import * as esbuild from 'esbuild';

const options = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'iife',
  target: ['es2019'],
  minify: true,
  sourcemap: true,
  outfile: 'dist/limechat-nps.js',
  legalComments: 'none',
};

if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('watching widget…');
} else {
  await esbuild.build(options);
  console.log('built dist/limechat-nps.js');
}
