import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export const config = {
  runtime: 'edge',
};

const LIMITS = {
  EMAIL_SHORT_WINDOW: 2,
  EMAIL_SHORT_MINUTES: 10,
  EMAIL_DAILY_LIMIT: 3,
  IP_DAILY_LIMIT: 8,
};

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
    return buildErrorResponse('Method not allowed', 405);
  }

  try {
    const body = await request.json();
    const { name, url, email, desc = '', logo = '', feed = '', reason = '' } = body;

    if (!name || !url || !email || !desc) {
      return buildErrorResponse('请填写完整信息（带 * 的必填）', 400);
    }

    if (!isValidEmail(email)) {
      return buildErrorResponse('邮箱格式不正确', 400);
    }
    if (!isValidUrl(url)) {
      return buildErrorResponse('网址格式不正确（需以 http:// 或 https:// 开头）', 400);
    }
    if (name.length > 50 || desc.length > 200) {
      return buildErrorResponse('名称不超过50字，简介不超过200字', 400);
    }

    const ip = getClientIp(request);

    const [shortCheck, dailyEmailCheck, dailyIpCheck] = await Promise.all([
      sql`
        SELECT COUNT(*) as count
        FROM friend_applications
        WHERE contact_email = ${email}
          AND created_at > NOW() - INTERVAL '1 minute' * ${LIMITS.EMAIL_SHORT_MINUTES}
      `,
      sql`
        SELECT COUNT(*) as count
        FROM friend_applications
        WHERE contact_email = ${email}
          AND created_at > NOW() - INTERVAL '24 hours'
      `,
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

    if (shortCount >= LIMITS.EMAIL_SHORT_WINDOW) {
      return buildErrorResponse(
        `提交过于频繁，请 ${LIMITS.EMAIL_SHORT_MINUTES} 分钟后再试`,
        429
      );
    }

    if (dailyEmailCount >= LIMITS.EMAIL_DAILY_LIMIT) {
      return buildErrorResponse(
        '该邮箱今日提交次数已达上限（3次），请明天再试',
        429
      );
    }

    if (ip !== 'unknown' && dailyIpCount >= LIMITS.IP_DAILY_LIMIT) {
      return buildErrorResponse(
        '该IP提交次数过多，请明天再试',
        429
      );
    }

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

    if (err.message?.includes('duplicate key') || err.code === '23505') {
      return buildErrorResponse('该网址已提交过申请，请勿重复提交', 409);
    }

    return buildErrorResponse('服务器错误，请稍后重试', 500);
  }
}