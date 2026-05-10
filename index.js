require('dotenv').config();

const express = require('express');
const { messagingApi, middleware } = require('@line/bot-sdk');

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || ''
};

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken
});


async function handleEvent(event) {
  
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'text',
      text: 'สวัสดีครับ 👋 นี้โชติเองครับ ยินดีที่ได้รู้จัก 😊 โปรดรอการตอบกลับของผม ขอบคุณที่รอนะครับ 🙏 เราจะตอบกลับคุณให้เร็วที่สุดเท่าที่จะทำได้ ⏳'
    }]
  });
}


app.post('/webhook', middleware(config), (req, res) => {
  const events = req.body.events;


  if (!events || events.length === 0) {
    return res.status(200).send('OK');
  }

  Promise
    .all(events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error('Error in /webhook:', err);
      res.status(500).end();
    });
});


app.get('/', (req, res) => {
  res.send('LINE Bot Server is running Chotikun Wellcome to my word');
});

const PORT = process.env.PORT || 3023;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});