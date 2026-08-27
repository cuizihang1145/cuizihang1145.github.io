const { neon } = require('@neondatabase/serverless');
const { Resend } = require('resend');

const sql = neon(process.env.DATABASE_URL);
const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async function handler(request) {
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
        JSON.stringify({ message: '请填写完整信息（名称、链接、简介、邮箱为必填）' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    await sql`
      INSERT INTO friend_applications (site_name, site_url, contact_email, site_desc, logo_url, feed_url, apply_reason)
      VALUES (${name}, ${url}, ${email}, ${desc}, ${logo}, ${feed}, ${reason})
    `;

    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: '友链系统 <noreply@mail.cuizi.top>',
        to: ['340313894@qq.com'],
        subject: `🔗 新的友链申请：${name}`,
        html: `
          <h2>📬 新的友链申请</h2>
          <p><strong>站点名称：</strong>${name}</p>
          <p><strong>站点链接：</strong><a href="${url}" target="_blank">${url}</a></p>
          <p><strong>站点简介：</strong>${desc}</p>
          <p><strong>联系邮箱：</strong>${email}</p>
          ${logo ? `<p><strong>Logo：</strong><img src="${logo}" width="80" /></p>` : ''}
          ${feed ? `<p><strong>RSS：</strong>${feed}</p>` : ''}
          ${reason ? `<p><strong>申请理由：</strong>${reason}</p>` : ''}
          <hr />
          <p>👉 <a href="https://admin.cuizi.top" target="_blank">点此进入后台审核</a></p>
        `,
      });
    }

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
};