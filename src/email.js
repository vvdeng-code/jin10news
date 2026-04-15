import nodemailer from "nodemailer";

const DEFAULT_SUBJECT = "新闻通知";

function buildSubject(subject, prefix) {
  const title = subject?.trim() || DEFAULT_SUBJECT;
  return [prefix, title].filter(Boolean).join(" ").trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createEmailSender(config) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    connectionTimeout: config.emailSendTimeoutMs,
    greetingTimeout: config.emailSendTimeoutMs,
    socketTimeout: config.emailSendTimeoutMs,
    auth: {
      type: "OAuth2",
      user: config.gmailUser,
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
      refreshToken: config.googleRefreshToken
    }
  });

  const to = config.emailTo.join(", ");
  const from = config.emailFrom || config.gmailUser;

  return async function sendEmail(message) {
    const payload = typeof message === "string" ? { text: message } : message;
    const retries = Math.max(0, config.emailSendRetries ?? 2);
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await transporter.sendMail({
          from,
          to,
          subject: buildSubject(payload.subject, config.emailSubjectPrefix),
          text: payload.text
        });
      } catch (error) {
        lastError = error;
        if (attempt === retries) break;
        await sleep(1000 * (attempt + 1));
      }
    }

    throw lastError;
  };
}
