import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {checkProductionBuild} from './check-production-build.mjs';

// The root .env also configures Express development. Vite treats its
// NODE_ENV=development as a request to ship React's development runtime unless
// NODE_ENV is explicitly supplied before Vite starts.
export function frontendBuildEnvironment(environment) {
  return {...environment, NODE_ENV: 'production'};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cli=fileURLToPath(new URL('./bin/vite.js',import.meta.resolve('vite/package.json')));
  const child=spawn(process.execPath,[cli,'build',...process.argv.slice(2)],{
    stdio:'inherit',env:frontendBuildEnvironment(process.env),
  });
  child.once('error',error=>{console.error(error.message);process.exitCode=1});
  child.once('exit',async(code,signal)=>{
    process.exitCode=code??(signal?1:0);
    if(process.exitCode===0){
      const args=process.argv.slice(2), index=args.indexOf('--outDir');
      const directory=index>=0?args[index+1]:args.find(value=>value.startsWith('--outDir='))?.slice(9)||'dist';
      try{await checkProductionBuild(directory);console.log('Production React runtime: PASS')}
      catch(error){console.error(error.message);process.exitCode=1}
    }
  });
}
