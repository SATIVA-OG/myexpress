const express = require('express');
const { messagingApi, middleware } = require('@line/bot-sdk');

const app = express();

const config = {
  channelAccessToken: 'OgyNcZkBmyTBECdvOuFL77LzApWqboI8eLffl870/eH1lj1xoQ+Or0OND0X3ZW/oJWWr+wTXbpFHWZCAXaGp9hEblnVlkyimWs8WP7nCPFbDJylIJ0bRD0Y3hcpbUY9YUWHJH3kCNrdBZIK+aTJ9igdB04t89/1O/w1cDnyilFU=',
  channelSecret: '53d5f7a441019b28470c0fa863a875fb'
};


const client = new messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken
});


app.post('/webhook', middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error('Error in /webhook:', err);
      res.status(500).end();
    });
});


async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }


  return client.replyMessage({
    replyToken: event.replyToken,
    messages: [{
      type: 'text',
      text: 'สวัสดีนี้โชติเองครับ'
    }]
  });
}

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});