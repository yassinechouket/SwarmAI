import { google } from "googleapis";

const oauth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  process.env.GMAIL_REDIRECT_URI
);

const { tokens } = await oauth2Client.getToken("4/0AfrIepAzzNPXKZj5hfuUY1-N-xGhFXR5DCnzTQ2WbDmrR-NnI2v0frg5Kl1r9jC7AZL5Yg");
console.log("Refresh Token:", tokens.refresh_token);