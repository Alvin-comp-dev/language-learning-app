import { Platform } from 'react-native';
import * as MailComposer from 'expo-mail-composer';
import * as Linking from 'expo-linking';
import monitoring from './monitoring';

// Support configuration
export const SUPPORT_CONFIG = {
  EMAIL: {
    address: 'beta@speakflow.app',
    subject: '[BETA] SpeakFlow Support Request',
    signature: `

------------------
Device Info:
Platform: ${Platform.OS}
Version: ${Platform.Version}
App Version: 1.0.0-beta
------------------`
  },
  DISCORD: {
    inviteLink: 'https://discord.gg/speakflow-beta',
    supportChannel: '#beta-support',
    feedbackChannel: '#beta-feedback',
    generalChannel: '#general-discussion'
  }
};

// Support service class
class SupportService {
  // Send support email
  public sendSupportEmail = async (
    subject: string,
    body: string,
    attachments: string[] = []
  ): Promise<boolean> => {
    try {
      const isAvailable = await MailComposer.isAvailableAsync();
      
      if (!isAvailable) {
        // Fallback to mailto link if mail composer is not available
        const mailtoUrl = `mailto:${SUPPORT_CONFIG.EMAIL.address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        await Linking.openURL(mailtoUrl);
        return true;
      }

      await MailComposer.composeAsync({
        recipients: [SUPPORT_CONFIG.EMAIL.address],
        subject: `${SUPPORT_CONFIG.EMAIL.subject} - ${subject}`,
        body: body + SUPPORT_CONFIG.EMAIL.signature,
        attachments
      });

      monitoring.trackEvent('support_email_sent', { subject });
      return true;
    } catch (error) {
      monitoring.trackError(error as Error, { 
        context: 'sendSupportEmail',
        subject,
        body_length: body.length
      });
      return false;
    }
  };

  // Open Discord invite
  public openDiscordInvite = async (): Promise<boolean> => {
    try {
      const supported = await Linking.canOpenURL(SUPPORT_CONFIG.DISCORD.inviteLink);
      
      if (supported) {
        await Linking.openURL(SUPPORT_CONFIG.DISCORD.inviteLink);
        monitoring.trackEvent('discord_invite_opened');
        return true;
      }

      return false;
    } catch (error) {
      monitoring.trackError(error as Error, { context: 'openDiscordInvite' });
      return false;
    }
  };

  // Format bug report
  public formatBugReport = (
    title: string,
    description: string,
    stepsToReproduce: string[],
    expectedBehavior: string,
    actualBehavior: string
  ): string => {
    return `Bug Report: ${title}

Description:
${description}

Steps to Reproduce:
${stepsToReproduce.map((step, index) => `${index + 1}. ${step}`).join('\n')}

Expected Behavior:
${expectedBehavior}

Actual Behavior:
${actualBehavior}`;
  };

  // Format feature request
  public formatFeatureRequest = (
    title: string,
    description: string,
    useCase: string,
    additionalContext?: string
  ): string => {
    return `Feature Request: ${title}

Description:
${description}

Use Case:
${useCase}

${additionalContext ? `Additional Context:\n${additionalContext}` : ''}`;
  };

  // Get support resources
  public getSupportResources = () => {
    return {
      faq: 'https://speakflow.app/beta/faq',
      documentation: 'https://speakflow.app/beta/docs',
      knownIssues: 'https://speakflow.app/beta/known-issues',
      contactInfo: {
        email: SUPPORT_CONFIG.EMAIL.address,
        discord: SUPPORT_CONFIG.DISCORD.inviteLink,
        supportHours: '9 AM - 5 PM EST, Monday-Friday'
      }
    };
  };

  // Check if within support hours
  public isWithinSupportHours = (): boolean => {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    // Support hours: 9 AM - 5 PM EST, Monday-Friday
    return day >= 1 && day <= 5 && hour >= 9 && hour < 17;
  };

  // Get estimated response time
  public getEstimatedResponseTime = (): string => {
    if (this.isWithinSupportHours()) {
      return 'within 2 hours';
    }
    return 'by next business day';
  };
}

export const supportService = new SupportService();
export default supportService; 