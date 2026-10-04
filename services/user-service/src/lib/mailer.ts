import nodemailer from 'nodemailer';
import { config } from '../config/env';

export interface MailResult {
	ok: boolean;
	error?: string;
}

const transporter = config.smtp.host
	? nodemailer.createTransport({
			host: config.smtp.host,
			port: config.smtp.port,
			secure: config.smtp.port === 465,
			auth:
				config.smtp.user && config.smtp.password
					? { user: config.smtp.user, pass: config.smtp.password }
					: undefined,
		})
	: null;

export async function verifyMailer(log: (message: string) => void) {
	if (!transporter) {
		log('SMTP_HOST is not set: verification links will be printed to the console.');
		return;
	}

	try {
		await transporter.verify();
		log(`SMTP connection to ${config.smtp.host}:${config.smtp.port} is OK.`);
	} catch (error) {
		log(`SMTP check failed: ${error instanceof Error ? error.message : 'unknown error'}`);
	}
}

function buildHtml(url: string) {
	return `<div style="font-family:sans-serif;max-width:480px;margin:auto">
<h2>Confirm your email</h2>
<p>Press the button to finish creating your The Scroll account.</p>
<p><a href="${url}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px">Confirm email</a></p>
<p style="color:#64748b;font-size:13px">If the button does not work, open this link:<br>${url}</p>
<p style="color:#64748b;font-size:13px">If you did not register, just ignore this email.</p>
</div>`;
}

export async function sendVerificationEmail(to: string, url: string): Promise<MailResult> {
	if (!transporter) {
		if (config.isProd) {
			return { ok: false, error: 'Mail transport is not configured.' };
		}

		console.log(`[dev mail] verification link for ${to}: ${url}`);
		return { ok: true };
	}

	try {
		const info = await transporter.sendMail({
			from: config.smtp.from,
			to,
			subject: 'Confirm your email - The Scroll',
			text: `Confirm your email to finish registration: ${url}`,
			html: buildHtml(url),
		});

		if (info.rejected.length > 0 || !info.accepted.includes(to)) {
			return { ok: false, error: 'The mail server rejected the recipient address.' };
		}

		return { ok: true };
	} catch (error) {
		console.error('Failed to send verification email:', error);
		return { ok: false, error: 'Could not send the email. Try again later.' };
	}
}
