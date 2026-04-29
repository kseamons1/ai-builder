const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DATABASE_ID;

const COL_TO_STATUS = {
  suggested:  'Suggested',
  tobuild:    'To Build',
  inprogress: 'In Progress',
  done:       'Done',
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const response = await notion.databases.query({ database_id: DB_ID });
    const cards = response.results.map(page => ({
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
    await notion.pages.update({
      page_id: id,
      properties: {
        Status: { select: { name: notionStatus } },
      },
    });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
