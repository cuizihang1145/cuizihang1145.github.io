import { pinyin } from 'pinyin-pro';

export const config = { runtime: 'edge' };

const BLOCKED_WORDS = [
  '赚钱','副业','兼职','日入','月入','暴富','投资','理财','中转',
  '贷款','加微','加V','客服','优惠','特价','免费领取',
  '彩票','博彩','赌','色情','成人','AV','三级',
  'SEO','排名','推广','营销','广告位','招商',
  '血腥','暴力','砍人','杀人','恐怖袭击','砍头',
  '点击链接','扫描二维码','加群','加QQ','加微信',
  '特价','促销','折扣','微信','绿泡泡','企鹅','广告',
  '傻逼','妈的','md','tmd','操','艹','提现',
  '庄家','真人发牌','澳门','赌场','百家乐','老虎机','棋牌','捕鱼',
  '电竞竞猜','体育下注','六合彩','跑马','牛牛','扎金花','21点','德州扑克','私彩','盘口','水位',
  '约炮','月抛','约跑','裸聊','同城','交友','上门','特殊','性感','荷官','桑拿','按摩',
  '寂寞','少妇','空姐','御姐','萝莉','嫩模','兼职',
  '引流','脚本','挂','桂','免流','破解','黑客','卡密','套现','办证','秒杀','互助','微商','代理','催收','贷',
  '阳痿','早泄','迷药','春药','包治百病','药','抗癌','延时','催情','祖传','秘方','办证','鸡','丰胸',
  '114514','1919810','325','9981','7749','180',
  '78','91','67','1225','13',
  '冰毒','大麻','海洛因','摇头丸','笑气','上头电子烟','毒品',
  '资金盘','杀猪盘','虚拟币','传销','刷单','返利','高利贷',
  '黑鬼','阿三','棒子','尼哥','白皮',
  '人肉','开盒','挂人','网暴','网络暴力',
  'fuck','shit','bitch','asshole',
  '代办','代考','枪手','作弊',
  '一夜情','换妻',
  'wx','vpn','v','q','qq','tb','taobao','jd','pdd','dy','ks','zfb','alipay'
];

const PINYIN_BLOCKED = [
  'sha bi',
  'wei',
  'zhi fu bao',
  'shua dan',
  'fan li',
  'sha pan shu',
  'zi jin pan',
  'chuan xiao',
  'bindu',
  'dama',
  'hai luo yin',
  'xiao qi'
];

const EXTRA_PINYIN = [];
for (const w of BLOCKED_WORDS) {
  if (/[\u4e00-\u9fa5]/.test(w)) {
    try {
      const p = pinyin(w, { toneType: 'none', type: 'array' }).join(' ').toLowerCase();
      const trimmed = p.replace(/\s+/g, ' ').trim();
      if (trimmed) EXTRA_PINYIN.push(trimmed);
    } catch (_) {}
  }
}
const PINYIN_BLOCKED_FULL = [...new Set([...PINYIN_BLOCKED, ...EXTRA_PINYIN])];

function containsBlocked(text) {
  if (!text) return { blocked: false, matched: [] };
  // 只替换符号，不碰数字
  let processed = text
    .replace(/\+/g, '加')
    .replace(/[Vv]/g, '微')
    .replace(/@/g, '艾特');
  const lower = processed.toLowerCase();
  const matched = [];
  for (const word of BLOCKED_WORDS) {
    if (lower.includes(word.toLowerCase())) {
      matched.push(word);
    }
  }
  const pinyinStr = pinyin(processed, { toneType: 'none', type: 'array' }).join(' ').toLowerCase();
  for (const p of PINYIN_BLOCKED_FULL) {
    if (pinyinStr.includes(p.toLowerCase())) {
      matched.push(p);
    }
  }
  return { blocked: matched.length > 0, matched };
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
  try {
    const { text } = await request.json();
    if (typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing text' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
    const result = containsBlocked(text);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}