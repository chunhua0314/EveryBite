// 真实链接抓取自测：node scripts/test-scrape.js
const { scrapeNote } = require('../src/scrape');

const url = process.argv[2] || 'https://xhslink.cn/o/8eog0wr6ce4';

scrapeNote(url)
  .then(note => {
    console.log('抓取成功');
    console.log('标题:', note.title);
    console.log('封面:', note.cover ? note.cover.slice(0, 80) + '...' : '(无)');
    console.log('标签:', (note.tags || []).join(', ') || '(无)');
    console.log('正文前 200 字:', (note.desc || '').slice(0, 200));
    if (!note.title && !note.desc) {
      console.error('标题和正文均为空，视为失败');
      process.exit(1);
    }
  })
  .catch(e => {
    console.error('抓取失败:', e.message);
    process.exit(1);
  });
