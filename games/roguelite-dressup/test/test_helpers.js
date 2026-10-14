// helpers.js 自检：加载清单完整性 + 沙箱可启动
const h=require('./helpers.js');
let pass=0,fail=0;
const check=(n,c)=>{if(c){pass++;console.log('  ✓',n);}else{fail++;console.log('  ✗ FAIL:',n);}};

console.log('[helpers.js 自检]');
check('FILES 非空',h.FILES.length>30);
const {T}=h.buildSandbox();
T(`Meta.hardReset(); startGame('novice'); if(gameState==='levelup') applyUpgradeChoice(0)`);
check('沙箱可启动游戏',T(`gameState`)==='playing');
check('核心系统已注册到 SysReg',T(`SysReg._systems.length`)>=6);
check('TUNING 数值中心就位',T(`TUNING.xp.base`)===4);
console.log(`\n自检结果: ${pass} passed, ${fail} failed`);
process.exitCode=fail?1:0;
