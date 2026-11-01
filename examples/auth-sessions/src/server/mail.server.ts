// Mail transport stand-in: logs the message (set `MAIL_LOG=0` to silence it) and keeps the last 50 in an in-process
// outbox. Replace `sendMail` with a real provider (SMTP, an HTTP mail API) in an application. The outbox lives on
// `globalThis` so one process shares it across module copies (the tests run the server in-process and read it).
export interface Mail {
  to: string;
  subject: string;
  text: string;
  at: number;
}
const KEY = Symbol.for("rivet.example.auth-sessions.outbox");
export const outbox = ((globalThis as Record<symbol, Mail[] | undefined>)[KEY] ??= []);

export function sendMail(mail: Omit<Mail, "at">): void {
  outbox.push({ ...mail, at: Date.now() });
  if (outbox.length > 50) outbox.splice(0, outbox.length - 50);
  if (process.env.MAIL_LOG !== "0") console.log(`[mail] to ${mail.to}: ${mail.subject}\n${mail.text}`);
}
