import { tool } from "ai";
import { z } from "zod";
import { google } from "googleapis";



const auth = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID!,
  process.env.GMAIL_CLIENT_SECRET!,
  process.env.GMAIL_REDIRECT_URI!
);

auth.setCredentials({
  refresh_token: process.env.GMAIL_REFRESH_TOKEN!
});

const gmail = google.gmail({ version: "v1", auth });

export const sendEmailTool = tool({
  name: "sendEmail",
  description: "Send an email",
  inputSchema: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string()
  }),

  execute: async ({ to, subject, body }) => {

    const raw = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "",
      body
    ].join("\n");

    const encoded = Buffer.from(raw)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encoded
      }
    });

    return "Email sent successfully";
  }
});


export const readEmailsTool = tool({
  name: "readEmails",
  description: "Read emails",
  inputSchema: z.object({
    maxResults: z.number().default(5)
  }),

  execute: async ({ maxResults }) => {

    const res = await gmail.users.messages.list({
      userId: "me",
      maxResults
    });

    const emails = [];

    for (const msg of res.data.messages || []) {

      const full = await gmail.users.messages.get({
        userId: "me",
        id: msg.id!
      });

      emails.push(full.data);
    }

    return emails;
  }
});

export const searchEmailsTool = tool({
  name: "searchEmails",
  description: "Search emails",
  inputSchema: z.object({
    query: z.string()
  }),

  execute: async ({ query }) => {

    const res = await gmail.users.messages.list({
      userId: "me",
      q: query
    });

    return res.data.messages || [];
  }
});

export const summarizeEmailsTool = tool({
  name: "summarizeEmails",
  description: "Summarize emails",
  inputSchema: z.object({
    emails: z.array(z.object({
      subject: z.string(),
      body: z.string()
    }))
  }),

  execute: async ({ emails }) => {

    return emails.map(e => ({
      subject: e.subject,
      summary: e.body.slice(0, 100)
    }));
  }
});
