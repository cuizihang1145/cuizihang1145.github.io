const mathSessions = {};

function generateMathQuestion() {
  let a, b, answer, op, question;
  const operators = ['+', '-'];

  do {
    a = Math.floor(Math.random() * 89) + 10;
    b = Math.floor(Math.random() * 89) + 10;
    op = operators[Math.floor(Math.random() * operators.length)];

    if (op === '+') {
      answer = a + b;
      if (answer > 99) {
        a = Math.floor(Math.random() * (99 - 10 - b)) + 10;
        answer = a + b;
      }
      question = a + ' + ' + b + ' = ?';
    } else {
      if (a < b) {
        const temp = a;
        a = b;
        b = temp;
      }
      if (a === b) {
        b = a - Math.floor(Math.random() * 20) - 1;
        if (b < 10) b = 10;
        if (a <= b) { a = b + Math.floor(Math.random() * 20) + 5; }
      }
      answer = a - b;
      question = a + ' - ' + b + ' = ?';
    }
  } while (answer < 10 || answer > 99 || a === b || b === 0 || a === 0);

  return { question, answer };
}

function getSessionId(req) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || '';
  const raw = ip + '|' + ua.substring(0, 20);
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash = hash & hash;
  }
  return 's_' + Math.abs(hash).toString(36);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const sessionId = getSessionId(req);

  if (req.method === 'GET') {
    const { question, answer } = generateMathQuestion();
    mathSessions[sessionId] = {
      answer: answer,
      expires: Date.now() + 5 * 60 * 1000
    };
    return res.status(200).json({ question });
  }

  if (req.method === 'POST') {
    const { answer: userAnswer } = req.body || {};
    
    if (userAnswer === undefined || userAnswer === null) {
      return res.status(400).json({ valid: false, error: '请提供答案' });
    }

    const session = mathSessions[sessionId];
    if (!session) {
      return res.status(400).json({ valid: false, error: '会话已过期，请刷新获取新题目' });
    }

    if (session.expires < Date.now()) {
      delete mathSessions[sessionId];
      return res.status(400).json({ valid: false, error: '题目已过期，请刷新获取新题目' });
    }

    const valid = Number(userAnswer) === session.answer;
    delete mathSessions[sessionId];

    return res.status(200).json({
      valid: valid,
      message: valid ? '验证通过' : '答案错误，请重试'
    });
  }

  return res.status(405).json({ error: '方法不允许' });
          }
