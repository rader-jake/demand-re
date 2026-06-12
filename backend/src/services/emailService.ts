import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;
// Initialize the Resend client. Falls back to null if no API key is present or is placeholder
export const resend = resendApiKey && resendApiKey !== 're_1234567890' && resendApiKey.trim() !== '' 
  ? new Resend(resendApiKey) 
  : null;

export interface SendActivationEmailOptions {
  email: string;
  fullName: string;
  activationLink: string;
}

/**
 * Sends an account activation email using the Resend API.
 * Parses the recipient's first name from their full name, or falls back to 'there'.
 */
export async function sendActivationEmail({
  email,
  fullName,
  activationLink,
}: SendActivationEmailOptions): Promise<{ id: string }> {
  const emailFrom = process.env.EMAIL_FROM || 'Demand RE <insights@demand-re.com>';
  
  let firstName = 'there';
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length > 0 && parts[0]) {
      firstName = parts[0];
    }
  }

  const subject = 'Your Demand RE space request is ready';

  const textContent = `Hi ${firstName},

Thanks for submitting your commercial space requirements through Demand RE.

We’ve securely saved your request and created a profile where you can review your space needs, update your search criteria, and receive matching opportunities from landlords and property owners.

Activate your profile here:

${activationLink}

Please use the same email you submitted with your space request.

Best,
Demand RE`;

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
      <p>Hi ${firstName},</p>
      <p>Thanks for submitting your commercial space requirements through Demand RE.</p>
      <p>We’ve securely saved your request and created a profile where you can review your space needs, update your search criteria, and receive matching opportunities from landlords and property owners.</p>
      <p>Activate your profile here:</p>
      <p style="margin: 24px 0;">
        <a href="${activationLink}" target="_blank" style="display: inline-block; padding: 12px 24px; font-size: 15px; font-weight: bold; color: #fff; background-color: #2563eb; text-decoration: none; border-radius: 8px;">Activate Profile</a>
      </p>
      <p>Please use the same email you submitted with your space request.</p>
      <p>Best,<br/>Demand RE</p>
    </div>
  `;

  if (!resend) {
    console.warn(`Resend API key is missing or configured as a placeholder. Logging activation email to console:
To: ${email}
Subject: ${subject}
Link: ${activationLink}`);
    
    // Return a mock message ID so the flows can complete in dev
    return { id: `mock-msg-${Date.now()}` };
  }

  const response = await resend.emails.send({
    from: emailFrom,
    to: [email],
    subject: subject,
    text: textContent,
    html: htmlContent,
  });

  if (response.error) {
    console.error('Resend SDK returned an error:', response.error);
    throw new Error(response.error.message || 'Unknown Resend error');
  }

  return { id: response.data?.id || `msg-${Date.now()}` };
}
