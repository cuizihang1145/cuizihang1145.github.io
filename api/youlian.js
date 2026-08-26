import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
        },
    });
}

export default async function handler(request) {
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
        return json({ error: 'Method not allowed' }, 405);
    }

    try {
        const { name, url, email, logo = '', feed = '', reason = '' } = await request.json();

        if (!name || !url || !email) {
            return json({ message: '请填写完整信息' }, 400);
        }

        await sql`
            INSERT INTO friend_applications (site_name, site_url, contact_email, logo_url, feed_url, apply_reason)
            VALUES (${name}, ${url}, ${email}, ${logo}, ${feed}, ${reason})
        `;

        return json({ success: true, message: '提交成功，等待审核' });
    } catch (err) {
        console.error(err);
        if (err.message?.includes('duplicate key') || err.code === '23505') {
            return json({ message: '该网址已提交过申请' }, 409);
        }
        return json({ message: '服务器错误' }, 500);
    }
}