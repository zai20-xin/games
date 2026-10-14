'use strict';
/* ============ 题库：30 关残局（初/中/高）+ 7 关走法教学 ============ */
const Levels = (function () {
  // 残局：side 为先行方（红先），目标为将死对方。全部经过强制杀验证（node test/levels.test.js）
  const LEVELS = [
    // ----- 初级 1-10（学基本杀法） -----
    { name: '独兵擒王', desc: '红兵过河步步紧逼，配合老帅捉死黑将', diff: 1, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4], ['red', 'p', 5, 4],
    ] },
    { name: '双兵攻营', desc: '双兵联手拱门，直捣黑将九宫', diff: 1, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'p', 4, 3], ['red', 'p', 4, 5],
      ['black', 'a', 0, 3], ['black', 'a', 0, 5], ['black', 'p', 1, 4],
    ] },
    { name: '马到成功', desc: '红马腾挪找位，练练马擒单士', diff: 1, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'h', 3, 5], ['black', 'a', 0, 5], ['black', 'a', 1, 4],
    ] },
    { name: '铁甲连环', desc: '车炮兵三路进逼，铁甲连环成杀', diff: 1, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'r', 4, 0], ['red', 'c', 3, 4], ['red', 'p', 4, 5], ['red', 'e', 6, 3],
    ] },
    { name: '车炮建功', desc: '车炮联手占中路，两步建功', diff: 1, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'r', 6, 5], ['red', 'c', 8, 4],
    ] },
    { name: '马踏连营', desc: '马跳卧槽锁喉，一步将死黑将', diff: 1, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'h', 3, 5], ['black', 'a', 0, 3], ['black', 'a', 0, 5], ['black', 'p', 1, 4],
    ] },
    { name: '摘星马炮', desc: '双马一炮，摘星锁喉', diff: 2, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'h', 9, 3], ['red', 'h', 1, 4], ['red', 'c', 4, 1],
    ] },
    { name: '车炮破阵', desc: '车炮联动，破阵擒王', diff: 2, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'r', 2, 7], ['red', 'c', 1, 3], ['red', 'c', 8, 6],
      ['black', 'r', 1, 4], ['black', 'p', 9, 2], ['black', 'h', 6, 4],
    ] },
    { name: '单兵捉将', desc: '一兵一帅，练练捉孤将的技巧', diff: 1, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4], ['red', 'p', 2, 4],
    ] },
    { name: '车马齐飞', desc: '车马配合，寻找杀招', diff: 1, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'r', 3, 2], ['red', 'h', 9, 5], ['black', 'a', 1, 4],
    ] },
    // ----- 中级 11-20（常见杀法组合） -----
    { name: '炮镇三军', desc: '炮借马势镇三军，两步定乾坤', diff: 1, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'c', 0, 6], ['red', 'r', 2, 1], ['red', 'h', 4, 4],
    ] },
    { name: '车兵探营', desc: '车兵配合，杀穿士角', diff: 1, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'r', 3, 0], ['red', 'p', 6, 2], ['red', 'e', 8, 0],
      ['black', 'a', 1, 4],
    ] },
    { name: '惊雷车阵', desc: '单车沉炮，惊雷一击', diff: 2, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'r', 2, 7], ['red', 'c', 1, 0],
      ['black', 'a', 1, 4], ['black', 'h', 1, 2], ['black', 'e', 0, 8],
    ] },
    { name: '破阵先锋', desc: '车炮马联合作战，先锋破阵', diff: 2, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'c', 7, 2], ['red', 'r', 3, 8], ['red', 'a', 9, 3], ['red', 'h', 0, 2],
      ['black', 'a', 2, 4], ['black', 'c', 0, 8],
    ] },
    { name: '兵车会', desc: '兵借车势直逼九宫', diff: 2, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'p', 1, 5], ['red', 'r', 3, 5],
      ['black', 'c', 4, 2], ['black', 'a', 2, 4],
    ] },
    { name: '马炮奇袭', desc: '马炮双兵奇袭中路', diff: 2, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'p', 2, 4], ['red', 'c', 8, 6], ['red', 'h', 1, 3], ['red', 'h', 0, 5],
      ['black', 'c', 5, 7],
    ] },
    { name: '双炮双马', desc: '四子归边，火力全开', diff: 2, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'c', 7, 3], ['red', 'h', 6, 4], ['red', 'c', 3, 4], ['red', 'h', 5, 8],
    ] },
    { name: '穿云炮', desc: '炮兵马车，穿云一击', diff: 2, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'p', 7, 4], ['red', 'c', 5, 2], ['red', 'h', 9, 3], ['red', 'r', 8, 4],
    ] },
    { name: '三子归边', desc: '双车一兵齐集一侧，围城打援', diff: 2, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'r', 3, 2], ['red', 'r', 3, 0], ['red', 'p', 6, 1], ['red', 'e', 7, 6],
      ['black', 'h', 0, 6], ['black', 'a', 1, 4],
    ] },
    { name: '车马炮', desc: '三子归心，一步一杀', diff: 2, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'p', 5, 1], ['red', 'r', 7, 7], ['red', 'c', 4, 2], ['red', 'h', 6, 8],
      ['black', 'e', 1, 4],
    ] },
    // ----- 高级 21-30（多子配合 / 三步杀） -----
    { name: '伏虎车阵', desc: '车兵伏虎，深挖九宫', diff: 2, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'r', 1, 6], ['red', 'e', 6, 1], ['red', 'p', 4, 1],
      ['black', 'a', 1, 4], ['black', 'e', 3, 3],
    ] },
    { name: '连环炮', desc: '双炮连环，隔山连打', diff: 2, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'c', 5, 3], ['red', 'c', 1, 5], ['red', 'r', 1, 8],
      ['black', 'a', 1, 4], ['black', 'e', 1, 7], ['black', 'r', 5, 5],
    ] },
    { name: '勒马听风', desc: '马炮左右开弓，三步取将', diff: 3, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'h', 9, 8], ['red', 'p', 4, 8], ['red', 'r', 1, 7], ['red', 'r', 5, 0],
      ['black', 'a', 1, 4], ['black', 'h', 9, 3], ['black', 'e', 3, 7],
    ] },
    { name: '破阵子', desc: '车车联手，炮在暗中', diff: 3, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'r', 9, 5], ['red', 'r', 7, 6], ['red', 'e', 8, 4], ['red', 'c', 2, 0],
      ['black', 'h', 1, 2],
    ] },
    { name: '六郎会师', desc: '车马炮三军会战，一击致命', diff: 3, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'e', 5, 0], ['red', 'h', 3, 2], ['red', 'r', 7, 7], ['red', 'h', 0, 5],
      ['black', 'c', 7, 6], ['black', 'e', 1, 4], ['black', 'a', 2, 5],
    ] },
    { name: '双炮破阵', desc: '双炮双马，四子成杀', diff: 3, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'c', 1, 7], ['red', 'c', 7, 6], ['red', 'h', 5, 4], ['red', 'h', 1, 0],
      ['black', 'a', 2, 4], ['black', 'a', 1, 3],
    ] },
    { name: '四车会盟', desc: '双车并线，步步紧逼', diff: 3, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'r', 1, 6], ['red', 'h', 5, 6], ['red', 'h', 5, 2], ['red', 'r', 2, 6],
      ['black', 'a', 1, 4], ['black', 'c', 6, 4],
    ] },
    { name: '单车猎士', desc: '单车入宫，猎取单士', diff: 2, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4], ['red', 'r', 1, 2],
      ['black', 'a', 2, 4],
    ] },
    { name: '铁骑破营', desc: '车炮兵马，铁骑踏营', diff: 2, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'r', 2, 7], ['red', 'p', 8, 4], ['red', 'e', 9, 6], ['red', 'h', 3, 4],
      ['black', 'a', 1, 5],
    ] },
    { name: '锁喉车阵', desc: '车马炮锁喉，直取将门', diff: 1, side: 'red', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4],
      ['red', 'h', 2, 4], ['red', 'r', 2, 3], ['red', 'c', 7, 2], ['red', 'c', 6, 3],
    ] },
  ];

  // 教学关卡：任务 = 把任务子走到目标星星处（每步一个 target，全部走完过关）
  const TUTORIAL = [
    { id: 't1', name: '车', desc: '横冲直撞', type: 'r', tip: '车走直线，横竖随便跑。把红车开到星星的位置吧！', pieces: [
      ['red', 'k', 9, 4], ['red', 'r', 5, 0], ['black', 'k', 0, 4], ['black', 'e', 2, 4],
    ], targets: [[5, 8], [2, 8], [5, 1]] },
    { id: 't2', name: '马', desc: '日字飞腿', type: 'h', tip: '马走日字，一跳一斜。小心别被蹩马腿！', pieces: [
      ['red', 'k', 9, 4], ['red', 'h', 5, 4], ['black', 'k', 0, 4], ['black', 'e', 2, 4],
    ], targets: [[3, 6], [1, 5]] },
    { id: 't3', name: '炮', desc: '隔山打牛', type: 'c', tip: '炮要吃子必须隔一个子，叫炮架。试试隔山打牛！', pieces: [
      ['red', 'k', 9, 4], ['red', 'c', 5, 0], ['black', 'k', 0, 4], ['black', 'e', 2, 4],
      ['black', 'p', 5, 3], ['black', 'p', 5, 6],
    ], targets: [[5, 2], [5, 6]] },
    { id: 't4', name: '兵', desc: '过河先锋', type: 'p', tip: '兵只能向前，过了河才能左右走，永远不能后退！', pieces: [
      ['red', 'k', 9, 4], ['red', 'p', 6, 4], ['black', 'k', 0, 4], ['black', 'e', 2, 4],
    ], targets: [[5, 4], [4, 4], [4, 3]] },
    { id: 't5', name: '象', desc: '田字巡边', type: 'e', tip: '象走田字，不能过河，中间被塞住就走不了啦！', pieces: [
      ['red', 'k', 9, 4], ['red', 'e', 9, 2], ['black', 'k', 0, 4], ['black', 'e', 2, 4],
    ], targets: [[7, 0], [5, 2]] },
    { id: 't6', name: '士', desc: '九宫护卫', type: 'a', tip: '士只能在九宫里斜走一格，是帅的贴身保镖！', pieces: [
      ['red', 'k', 9, 4], ['red', 'a', 9, 3], ['black', 'k', 0, 4], ['black', 'e', 2, 4],
    ], targets: [[8, 4], [7, 5]] },
    { id: 't7', name: '将', desc: '九五之尊', type: 'k', tip: '老帅一步一格，只能在九宫里活动。坐镇中央！', pieces: [
      ['red', 'k', 9, 4], ['black', 'k', 0, 4], ['black', 'e', 2, 4],
    ], targets: [[8, 4], [8, 5], [7, 5]] },
  ];

  return { LEVELS, TUTORIAL };
})();
