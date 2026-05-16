import { messagingApi, middleware } from '@line/bot-sdk'
import express from 'express'
import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const app = express();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || ''
};

const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: config.channelAccessToken
});

const lineBlobClient = new messagingApi.MessagingApiBlobClient({
  channelAccessToken: config.channelAccessToken
});

async function handleImageMessage(event) {
  const messageId = event.message.id;

  try {
    // ดึงไฟล์จาก LINE
    const stream = await lineBlobClient.getMessageContent(messageId);

    // แปลง stream → buffer
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // อัพโหลดเข้า Supabase Storage
    const fileName = `line_images/${messageId}.jpg`;
    const { data, error } = await supabase.storage
      .from("uploads") // ชื่อ bucket
      .upload(fileName, buffer, {
        contentType: "image/jpeg",
        upsert: true, // ถ้ามีไฟล์ชื่อซ้ำ จะเขียนทับ
      });

    if (error) {
      console.error("❌ Upload error:", error);
      return client.replyMessage(event.replyToken, {
        type: "text",
        text: "อัปโหลดรูปไป Supabase ไม่สำเร็จ",
      });
    }

    console.log("✅ Uploaded to Supabase:", data);

    // --- ส่วนที่เพิ่ม: ใช้ Gemini จำแนกรูปภาพสัตว์ ---
    let animalName = "ไม่สามารถระบุได้";
    try {
      const aiResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: "ช่วยบอกชื่อสัตว์ในรูปภาพนี้หน่อย (ตอบเฉพาะชื่อสัตว์เป็นภาษาไทย)" },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: buffer.toString('base64')
                }
              }
            ]
          }
        ]
      });
      animalName = aiResponse.text;
    } catch (aiErr) {
      console.error("❌ Gemini Vision Error:", aiErr);
      animalName = "เกิดข้อผิดพลาดในการวิเคราะห์รูปภาพ";
    }

    // ตอบกลับ User ด้วยชื่อสัตว์ที่ AI วิเคราะห์ได้
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: "text",
        text: `🐾 AI วิเคราะห์ว่าคือ: ${animalName}`,
      }]
    });
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

// 4. ฟังก์ชันหลักในการจัดการ Event และบันทึกข้อมูล
async function handleEvent(event) {
  // รองรับเฉพาะ Event ประเภทข้อความ (Message Event) เท่านั้น
  if (event.type === "message" && event.message.type === "image") {
    return handleImageMessage(event);
  }

  if (event.type !== "message" || event.message.type !== "text") {
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [{
        type: "text",
        text: "ขออภัย รองรับเฉพาะข้อความและรูปภาพเท่านั้นครับ",
      }]
    });
  }

  const userId = event.source.userId || 'unknown';
  const replyToken = event.replyToken || '';
 
  // ดึงข้อมูลพื้นฐานจาก Message Object ของ LINE
  const messageId = event.message.id;
  const messageType = event.message.type; // text, image, sticker, video, etc.
 
  let content = null;
  let botReplyText = '';

  // ตรวจสอบเงื่อนไขตามประเภทข้อความ
  if (event.message.type === 'text') {
    content = event.message.text;
    try {
      // เรียกใช้ Gemini API ตามโจทย์
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: content,
      });
      botReplyText = response.text;
    } catch (e) {
      console.error('Gemini API Error:', e);
      botReplyText = 'ขออภัย ระบบตอบกลับอัตโนมัติมีปัญหาครับ';
    }
  } else {
    // หากเป็นประเภทอื่น เช่น image, sticker, video
    content = `[Received ${messageType} message]`;
    botReplyText = `ได้รับข้อความประเภท ${messageType} แล้วครับ`;
  }

  try {
    // บันทึกข้อมูลลงตาราง messages ใน Supabase (บันทึกคู่ทั้งคำถามและคำตอบที่เตรียมไว้)
    const { error } = await supabase
      .from('messages')
      .insert([
        {
          user_id: userId,
          message_id: messageId,
          type: messageType,
          content: content,
          reply_token: replyToken,
          reply_content: botReplyText
        }
      ]);

    if (error) {
      console.error('Supabase Insert Error:', error.message);
    }

    // ตอบกลับข้อความไปยังผู้ใช้ใน LINE
    return await lineClient.replyMessage({
      replyToken: replyToken,
      messages: [
        {
          type: 'text',
          text: botReplyText,
        },
      ],
    });

  } catch (error) {
    console.error('เกิดข้อผิดพลาดในการประมวลผลระบบ:', error);
  }
}


app.post('/callback', middleware(config), (req, res) => {
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
  res.send('LINE Bot Server is running Chotikun Welcome to my world');
});

const PORT = process.env.PORT || 3023;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});