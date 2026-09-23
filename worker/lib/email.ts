import { emailFromAddress, requireEnv, type WorkerEnv } from "./env";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends through Resend. Returns false instead of throwing so a delivery
 * failure can be handled (and retried by a later webhook) rather than
 * turning into a 500 on a payment that already succeeded. Unchanged from
 * supabase/functions/_shared/email.ts.
 */
export async function sendEmail(env: WorkerEnv, message: EmailMessage): Promise<boolean> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireEnv(env, "RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFromAddress(env),
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!response.ok) {
      console.error(`Resend ${response.status}: ${await response.text()}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Resend request threw:", error);
    return false;
  }
}
