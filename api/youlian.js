import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export const config = {
  runtime: 'edge',
};

// -------- 限流配置 --------
const LIMITS = {
  // 短时窗口：10分钟内同一邮箱最多2次（前端兜底）
  EMAIL_SHORT_WINDOW: 2,      // 次数
  EMAIL_SHORT_MINUTES: 10,    // 分钟

  // 日总量：24小时内同一邮箱最多3次（主力防线）
  EMAIL_DAILY_LIMIT: 3,       // 次数

  // IP辅助：24小时内同一IP最多8次（阈值宽，防误伤）
  IP_DAILY_LIMIT: 8,          // 次数
};

// -------- 工具函数 --------
function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('cf-connecting-ip') || 'unknown';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUrl(url) {
  return /^https?:\/\/[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}/.test(url);
}

function buildErrorResponse(message, status = 400) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function buildSuccessResponse(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// -------- 主 Handler --------
export default async function handler(request) {
  // 1. CORS 预检
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

  // 2. 方法校验
  if (request.method !== 'POST') {
    return buildErrorResponse('Method not allowed', 405);
  }

  try {
    // 3. 解析 Body
    const body = await request.json();
    const { name, url, email, desc = '', logo = '', feed = '', reason = '' } = body;

    // 4. 基础必填校验
    if (!name || !url || !email || !desc) {
      return buildErrorResponse('请填写完整信息（带 * 的必填）', 400);
    }

    // 5. 格式深度校验（挡掉垃圾请求，不耗数据库）
    if (!isValidEmail(email)) {
      return buildErrorResponse('邮箱格式不正确', 400);
    }
    if (!isValidUrl(url)) {
      return buildErrorResponse('网址格式不正确（需以 http:// 或 https:// 开头）', 400);
    }
    if (name.length > 50 || desc.length > 200) {
      return buildErrorResponse('名称不超过50字，简介不超过200字', 400);
    }

    // 6. 获取客户端 IP
    const ip = getClientIp(request);

    // 7. -------- 限流检查（并行查询，减少总耗时） --------
    const [shortCheck, dailyEmailCheck, dailyIpCheck] = await Promise.all([
      // 7-a. 短时防抖：10分钟内同邮箱提交次数
      sql`
        SELECT COUNT(*) as count
        FROM friend_applications
        WHERE contact_email = ${email}
          AND created_at > NOW() - INTERVAL '${sql(LIMITS.EMAIL_SHORT_MINUTES)} minutes'
      `,
      // 7-b. 日总量：24小时内同邮箱提交次数
      sql`
        SELECT COUNT(*) as count
        FROM friend_applications
        WHERE contact_email = ${email}
          AND created_at > NOW() - INTERVAL '24 hours'
      `,
      // 7-c. IP辅助：24小时内同IP提交次数
      sql`
        SELECT COUNT(*) as count
        FROM friend_applications
        WHERE ip_address = ${ip}
          AND created_at > NOW() - INTERVAL '24 hours'
      `,
    ]);

    const shortCount = Number(shortCheck[0]?.count || 0);
    const dailyEmailCount = Number(dailyEmailCheck[0]?.count || 0);
    const dailyIpCount = Number(dailyIpCheck[0]?.count || 0);

    // 短时防抖拦截（优先级最高）
    if (shortCount >= LIMITS.EMAIL_SHORT_WINDOW) {
      return buildErrorResponse(
        `提交过于频繁，请 ${LIMITS.EMAIL_SHORT_MINUTES} 分钟后再试`,
        429
      );
    }

    // 日邮箱限流拦截
    if (dailyEmailCount >= LIMITS.EMAIL_DAILY_LIMIT) {
      return buildErrorResponse(
        '该邮箱今日提交次数已达上限（3次），请明天再试',
        429
      );
    }

    // IP辅助限流拦截（仅当IP非unknown时生效）
    if (ip !== 'unknown' && dailyIpCount >= LIMITS.IP_DAILY_LIMIT) {
      return buildErrorResponse(
        '该IP提交次数过多，请明天再试',
        429
      );
    }

    // 8. -------- 写入数据库 --------
    await sql`
      INSERT INTO friend_applications
        (site_name, site_url, contact_email, site_desc, logo_url, feed_url, apply_reason, ip_address)
      VALUES
        (${name}, ${url}, ${email}, ${desc}, ${logo}, ${feed}, ${reason}, ${ip})
    `;

    return buildSuccessResponse({
      success: true,
      message: '提交成功，等待审核',
    });
  } catch (err) {
    console.error('数据库错误:', err);

    // 唯一约束冲突（URL 重复）
    if (err.message?.includes('duplicate key') || err.code === '23505') {
      return buildErrorResponse('该网址已提交过申请，请勿重复提交', 409);
    }

    return buildErrorResponse('服务器错误，请稍后重试', 500);
  }
}
