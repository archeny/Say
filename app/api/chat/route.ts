// by Stenly
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

const API = "https://api.overchat.ai/v1/chat/completions";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { chatId, deviceId, messages } = body;

    if (!chatId || !deviceId || !messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const latestMessage = messages[messages.length - 1];
    
    // Check if session exists
    const [sessions]: any = await pool.execute('SELECT id FROM sessions WHERE id = ?', [chatId]);
    if (sessions.length === 0) {
      await pool.execute('INSERT INTO sessions (id, device_id) VALUES (?, ?)', [chatId, deviceId]);
    }

    // Save user message
    const userMsgId = uuidv4();
    await pool.execute(
      'INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)',
      [userMsgId, chatId, 'user', latestMessage.content]
    );

    const systemMessage = {
      id: uuidv4(),
      role: "system",
      content: "Ikuti bahasa user dan jawab dengan gaya natural, singkat, dan jelas.",
    };

    // Extract history to pass to API
    const [historyRows]: any = await pool.execute(
      'SELECT id, role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC',
      [chatId]
    );

    const formattedHistory = historyRows.map((msg: any) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content
    }));

    const apiBody = {
      chatId: chatId,
      model: "claude-haiku-4-5-20251001",
      messages: [...formattedHistory, systemMessage],
      personaId: "claude-haiku-4-5-landing",
      frequency_penalty: 0,
      max_tokens: 4000,
      presence_penalty: 0,
      stream: true,
      temperature: 0.5,
      top_p: 0.95,
    };

    const headers = {
      "sec-ch-ua-platform": `"Android"`,
      "x-device-uuid": deviceId,
      "sec-ch-ua": `"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"`,
      "sec-ch-ua-mobile": "?1",
      "x-device-language": "id-ID",
      "x-device-platform": "web",
      "x-device-version": "1.0.44",
      "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36",
      "accept": "*/*",
      "content-type": "application/json",
      "origin": "https://overchat.ai",
      "referer": "https://overchat.ai/",
      "accept-language": "id-ID,id;q=0.9",
      "priority": "u=1, i",
    };

    const response = await fetch(API, {
      method: 'POST',
      headers,
      body: JSON.stringify(apiBody)
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: text }, { status: response.status });
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const reader = response.body?.getReader();
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    let assistantAnswer = "";

    (async () => {
      try {
        if (!reader) throw new Error("No reader");
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const rawLine of lines) {
            const line = rawLine.trim();

            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();

            if (!data || data === "[DONE]") continue;

            try {
              const json = JSON.parse(data);
              const content = json.choices?.[0]?.delta?.content;

              if (typeof content === "string") {
                assistantAnswer += content;
                await writer.write(encoder.encode(content));
              }
            } catch (e) {
              // ignore parse errors
            }
          }
        }

        // Save assistant message after stream is done
        const assistantMsgId = uuidv4();
        await pool.execute(
          'INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)',
          [assistantMsgId, chatId, 'assistant', assistantAnswer]
        );

        await writer.close();
      } catch (err) {
        await writer.abort(err);
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
