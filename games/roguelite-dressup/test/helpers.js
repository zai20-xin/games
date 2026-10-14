// ===== 测试公共设施：唯一加载清单 + 标准沙箱 =====
const fs=require('fs'), vm=require('vm'), path=require('path');
// 新增 js 模块后只需在此处 FILES 追加文件名（不含 .js），所有测试自动生效。

const PROJ = path.resolve(__dirname, '..');
const JS_DIR = PROJ + '/js';

// 唯一事实源：与 index.html 加载顺序一致
const FILES = [
  'config','tuning','outfit_bias','utils','player','enemies','newenemies','skills','skills2',
  'relics','loot','meta',
  'outfit_glam','resonance','shop','biome','mirror','juice','evolution',
  'bgm','events',
  'challenge','challenge_ui','challenge_hooks','boss_special',
  'duel','duel_skills',
  'gadgets','gadget_ui',
  // 美术覆写层（依赖 main.js 的函数，必须最后）
  'art_player_v2','art_enemy_v2','art_newenemies','art_boss_special',
  'art_world_v2','art_hud_v2','art_vfx_v2','art_ui_v2','art_feel_v2','art_life_v2',
  'chapters','skill_branches','audio','ui','main'
];
// 美术层依赖 main.js 中定义的函数（drawWorld/drawHUD/render 等），
// 因此加载顺序修正：main 先于 art_* 覆写层
const LOAD_ORDER = FILES.filter(f=>!f.startsWith('art_')&&f!=='main')
  .concat(['main'])
  .concat(FILES.filter(f=>f.startsWith('art_')));

// 标准 stub
function makeGradient(){ return { addColorStop(){} }; }

function makeCtxProxy(hooks){
  hooks=hooks||{};
  return new Proxy({},{get(t,k){
    if(k==='measureText') return s=>({width:String(s).length*10});
    if(k==='createRadialGradient'||k==='createLinearGradient') return ()=>makeGradient();
    if(k==='createPattern') return ()=>{hooks.onCreatePattern&&hooks.onCreatePattern();return {p:1};};
    if(k==='canvas') return {width:1280,height:720};
    return typeof t[k]!=='undefined'?t[k]:(...a)=>undefined;
  },set(t,k,v){t[k]=v;return true;}});
}

function makeLS(){
  const m={};
  return { getItem:k=>(k in m?m[k]:null),
           setItem:(k,v)=>{m[k]=String(v);},
           removeItem:k=>{delete m[k];} };
}

function makeAudioCtor(){
  return function(){
    this.currentTime=0;this.sampleRate=44100;this.state="running";this.destination={};
    this.createGain=()=>({gain:{value:1,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}});
    this.createOscillator=()=>({type:"",frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}});
    this.createBuffer=(c,l)=>({getChannelData:()=>new Float32Array(l)});
    this.createBufferSource=()=>({buffer:null,connect(){},start(){}});
    this.createBiquadFilter=()=>({type:"",frequency:{value:0},connect(){}});
  };
}

// 组装完整沙箱并加载全部模块；返回 {T, sandbox}
function buildSandbox(opts){
  opts=opts||{};
  const gradient=makeGradient();
  let clickHandler=null;
  const ctxProxy=makeCtxProxy(opts.ctxHooks);
  const canvas={
    getContext:()=>ctxProxy,width:1280,height:720,
    addEventListener:(ev,fn)=>{if(ev==="click")clickHandler=fn;},
    getBoundingClientRect:()=>({left:0,top:0,width:1280,height:720}),
  };
  const offscreen={width:512,height:512,getContext:()=>makeCtxProxy()};
  const sb={console,Math,Date,JSON,
    performance:{now:()=>Date.now()},
    setTimeout:()=>0,clearTimeout(){},
    requestAnimationFrame(){},
    setInterval:(fn,ms)=>1,clearInterval(){},
    AudioContext:makeAudioCtor(),
    document:{
      getElementById:()=>canvas,
      createElement:(tag)=>{
        if(tag==="canvas")return offscreen;
        return {style:{},appendChild(){},setAttribute(){}};
      }},
    window:{addEventListener(){},dispatchEvent(){}},
  };
  vm.createContext(sb);
  for(const f of LOAD_ORDER){
    const src=fs.readFileSync(path.join(JS_DIR,f+'.js'),'utf8');
    vm.runInContext(src,sb,{filename:f+'.js'});
  }
  const T=e=>vm.runInContext(e,sb);
  T.__clickHandler=clickHandler;
  return {T,sb};
}

// 统一断言助手
function makeAssert(){
  let pass=0,fail=0;
  const failed=[];
  return {
    check(name,c){ if(c){pass++;console.log('  ✓',name);}
                   else {fail++;failed.push(name);console.log('  ✗ FAIL:',name);} },
    done(){ console.log(`\n结果: ${pass} passed, ${fail} failed`);
            if(fail)console.log('失败项:',failed.join(' | '));
            process.exitCode=fail?1:0;
            return {pass,fail}; },
    get pass(){return pass;}, get fail(){return fail;}
  };
}

module.exports={PROJ,JS_DIR,FILES,makeCtxProxy,makeLS,makeAudioCtor,buildSandbox,makeAssert};
