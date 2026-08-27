import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export const config = {
  runtime: 'edge',
};

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
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await request.json();
    const { name, url, email, desc = '', logo = '', feed = '', reason = '' } = body;

    if (!name || !url || !email || !desc) {
      return new Response(
        JSON.stringify({ message: '请填写完整信息' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await sql`
      INSERT INTO friend_applications (site_name, site_url, contact_email, site_desc, logo_url, feed_url, apply_reason)
      VALUES (${name}, ${url}, ${email}, ${desc}, ${logo}, ${feed}, ${reason})
    `;

    return new Response(
      JSON.stringify({ success: true, message: '提交成功，等待审核' }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );

  } catch (err) {
    console.error('数据库错误:', err);

    if (err.message?.includes('duplicate key') || err.code === '23505') {
      return new Response(
        JSON.stringify({ message: '该网址已提交过申请' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ message: '服务器错误', error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}