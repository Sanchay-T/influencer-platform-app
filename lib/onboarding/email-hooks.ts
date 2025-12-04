import {
	scheduleEmail,
	shouldSendEmail,
	updateEmailScheduleStatus,
} from '@/lib/email/email-service';

interface EmailProps {
	userId: string;
	email: string;
	fullName: string;
	businessName: string;
	dashboardUrl: string;
}

export async function queueWelcomeAndAbandonment({
	userId,
	email,
	fullName,
	businessName,
	dashboardUrl,
}: EmailProps) {
	const results: Record<string, { success: boolean; messageId?: string; error?: string }> = {};

	if (await shouldSendEmail(userId, 'welcome')) {
		const res = await scheduleEmail({
			userId,
			emailType: 'welcome',
			userEmail: email,
			templateProps: { fullName, businessName, dashboardUrl },
		});
		if (res.success) {
			await updateEmailScheduleStatus(userId, 'welcome', 'scheduled', res.messageId);
			results.welcome = { success: true, messageId: res.messageId };
		} else {
			results.welcome = { success: false, error: res.error };
		}
	}

	if (await shouldSendEmail(userId, 'abandonment')) {
		const res = await scheduleEmail({
			userId,
			emailType: 'abandonment',
			userEmail: email,
			templateProps: { fullName, businessName, dashboardUrl },
		});
		if (res.success) {
			await updateEmailScheduleStatus(userId, 'abandonment', 'scheduled', res.messageId);
			results.abandonment = { success: true, messageId: res.messageId };
		} else {
			results.abandonment = { success: false, error: res.error };
		}
	}

	return results;
}
