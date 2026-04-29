const https = require('https');

const TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_DATABASE_ID;

const COL_TO_STATUS = {
  suggested:  'Suggested',
  tobuild:    'To Build',
  inprogress: 'In Progress',
  done:       'Done',
};

function notionRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.notion.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const data = await notionRequest('POST', `/v1/databases/${DB_ID}/query`, {});
      const cards = (data.results || []).map(page => ({
        id: page.id,
        name: page.properties.Name.title[0]?.plain_text || '(untitled)',
        desc: page.properties.Description.rich_text[0]?.plain_text || '',
        priority: page.properties.Priority.select?.name || 'Medium',
        status: page.properties.Status.select?.name || 'To Build',
      }));
      return res.json(cards);
    }

    if (req.method === 'PATCH') {
      const { id, status } = req.body;
      const notionStatus = COL_TO_STATUS[status] || status;
      await notionRequest('PATCH', `/v1/pages/${id}`, {
        properties: {
          Status: { select: { name: notionStatus } },
        },
      });
      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
};
