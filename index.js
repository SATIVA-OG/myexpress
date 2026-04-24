const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const TOKEN = 'OgyNcZkBmyTBECdvOuFL77LzApWqboI8eLffl870/eH1lj1xoQ+Or0OND0X3ZW/oJWWr+wTXbpFHWZCAXaGp9hEblnVlkyimWs8WP7nCPFbDJylIJ0bRD0Y3hcpbUY9YUWHJH3kCNrdBZIK+aTJ9igdB04t89/1O/w1cDnyilFU=';

app.post('/webhook', async (req, res) => {
  try {
    console.log(JSON.stringify(req.body, null, 2));

    const events = req.body.events;

    for (let event of events) {
      if (event.type === 'message') {

        const response = await axios.post(
          'https://api.line.me/v2/bot/message/reply',
          {
            replyToken: event.replyToken,
            messages: [
              { type: 'text', text: 'สวัสดีนี้โชติเองครับ' }
            ]
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${TOKEN}`
            }
          }
        );

        console.log('Reply success:', response.data);
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('ERROR:', err.response?.data || err.message);
    res.sendStatus(500);
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));