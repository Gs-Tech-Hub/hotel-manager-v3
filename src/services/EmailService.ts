/**
 * Email Service
 * Handles sending emails for bookings, confirmations, and receipts
 * Supports multiple providers: SMTP, SendGrid, Resend
 */

export interface EmailTemplateData {
  recipientName?: string;
  recipientEmail: string;
  confirmationNumber?: string;
  checkInDate?: string;
  checkOutDate?: string;
  roomNumber?: string;
  roomType?: string;
  totalPrice?: string;
  guestName?: string;
  phone?: string;
  hotelName?: string;
  hotelAddress?: string;
  hotelPhone?: string;
  hotelEmail?: string;
  [key: string]: any;
}

class EmailService {
  private transporter: any = null;
  private provider: string;
  private isConfigured: boolean = false;

  constructor() {
    this.provider = process.env.EMAIL_PROVIDER || 'smtp';
    this.initializeTransporter();
  }

  private initializeTransporter() {
    try {
      if (this.provider === 'sendgrid') {
        // SendGrid configuration (API-based, no npm install of sgMail needed)
        console.log('Email service configured for SendGrid');
        this.isConfigured = !!process.env.SENDGRID_API_KEY;
      } else if (this.provider === 'resend') {
        // Resend configuration (API-based)
        console.log('Email service configured for Resend');
        this.isConfigured = !!process.env.RESEND_API_KEY;
      } else {
        // Default SMTP configuration (nodemailer)
        if (process.env.SMTP_HOST) {
          // Only try to load nodemailer if SMTP is configured
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const nodemailer = require('nodemailer');
            this.transporter = nodemailer.createTransport({
              host: process.env.SMTP_HOST,
              port: parseInt(process.env.SMTP_PORT || '587'),
              secure: process.env.SMTP_SECURE === 'true',
              auth: process.env.SMTP_USER && process.env.SMTP_PASSWORD ? {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
              } : undefined,
            });
            this.isConfigured = true;
            console.log('Email service configured for SMTP');
          } catch (error) {
            console.warn('nodemailer not installed. Install with: npm install nodemailer');
            console.warn('Emails will be logged to console instead.');
            this.isConfigured = false;
          }
        } else {
          console.warn('Email service: No SMTP_HOST configured. Emails will be logged to console.');
          this.isConfigured = false;
        }
      }
    } catch (error) {
      console.error('Failed to initialize email service:', error);
      this.isConfigured = false;
    }
  }

  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmation(data: EmailTemplateData): Promise<boolean> {
    try {
      const html = this.generateBookingConfirmationHTML(data);
      await this.send({
        to: data.recipientEmail,
        subject: `Booking Confirmation - ${data.confirmationNumber || 'Reservation'}`,
        html,
      });
      return true;
    } catch (error) {
      console.error('Failed to send booking confirmation email:', error);
      return false;
    }
  }

  /**
   * Send booking receipt email
   */
  async sendBookingReceipt(data: EmailTemplateData): Promise<boolean> {
    try {
      const html = this.generateBookingReceiptHTML(data);
      await this.send({
        to: data.recipientEmail,
        subject: `Booking Receipt - ${data.confirmationNumber || 'Reservation'}`,
        html,
      });
      return true;
    } catch (error) {
      console.error('Failed to send booking receipt email:', error);
      return false;
    }
  }

  /**
   * Send booking cancellation email
   */
  async sendBookingCancellation(data: EmailTemplateData): Promise<boolean> {
    try {
      const html = this.generateBookingCancellationHTML(data);
      await this.send({
        to: data.recipientEmail,
        subject: `Booking Cancellation Confirmation - ${data.confirmationNumber || 'Reservation'}`,
        html,
      });
      return true;
    } catch (error) {
      console.error('Failed to send cancellation email:', error);
      return false;
    }
  }

  /**
   * Send notification SMS/text (if provider supports it)
   */
  async sendPhoneNotification(phone: string, message: string): Promise<boolean> {
    try {
      // TODO: Implement SMS provider integration (Twilio, AWS SNS, etc.)
      console.log(`Phone notification to ${phone}: ${message}`);
      return true;
    } catch (error) {
      console.error('Failed to send phone notification:', error);
      return false;
    }
  }

  /**
   * Generic send email method
   */
  private async send(options: {
    to: string;
    subject: string;
    html: string;
  }): Promise<any> {
    if (!this.isConfigured) {
      console.warn(`[EMAIL] Email service not configured. In production, configure EMAIL_PROVIDER.`);
      console.warn(`[EMAIL] To: ${options.to}`);
      console.warn(`[EMAIL] Subject: ${options.subject}`);
      console.warn(`[EMAIL] HTML length: ${options.html.length} chars`);
      return { status: 'logged-to-console' };
    }

    const from = process.env.EMAIL_FROM || 'noreply@hotelmanager.local';

    if (this.provider === 'sendgrid') {
      return this.sendViaFetch(
        'https://api.sendgrid.com/v3/mail/send',
        {
          personalizations: [{ to: [{ email: options.to }] }],
          from: { email: from },
          subject: options.subject,
          content: [{ type: 'text/html', value: options.html }],
        },
        process.env.SENDGRID_API_KEY || ''
      );
    } else if (this.provider === 'resend') {
      return this.sendViaFetch(
        'https://api.resend.com/emails',
        {
          to: options.to,
          from,
          subject: options.subject,
          html: options.html,
        },
        process.env.RESEND_API_KEY || ''
      );
    } else {
      // SMTP via nodemailer
      if (!this.transporter) {
        throw new Error('Email transporter not initialized');
      }
      return this.transporter.sendMail({
        to: options.to,
        from,
        subject: options.subject,
        html: options.html,
      });
    }
  }

  /**
   * Generic fetch-based email sending (for API providers)
   */
  private async sendViaFetch(
    url: string,
    payload: any,
    apiKey: string
  ): Promise<any> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Email provider error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  /**
   * Generate booking confirmation HTML
   */
  private generateBookingConfirmationHTML(data: EmailTemplateData): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .header h1 { margin: 0; font-size: 28px; }
            .content { background: #f9f9f9; padding: 30px; border-left: 4px solid #667eea; }
            .section { margin-bottom: 25px; }
            .section-title { font-weight: bold; color: #667eea; margin-bottom: 10px; font-size: 14px; text-transform: uppercase; }
            .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #ddd; }
            .info-row:last-child { border-bottom: none; }
            .label { font-weight: bold; }
            .footer { background: #333; color: white; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
            .total { font-size: 24px; font-weight: bold; color: #667eea; padding: 20px 0; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Booking Confirmation</h1>
            </div>
            
            <div class="content">
              <div class="section">
                <p>Dear ${data.recipientName || 'Guest'},</p>
                <p>Thank you for booking with us! Your reservation has been confirmed.</p>
              </div>

              <div class="section">
                <div class="section-title">Booking Details</div>
                <div class="info-row">
                  <span class="label">Confirmation Number:</span>
                  <span>${data.confirmationNumber || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="label">Room Number:</span>
                  <span>${data.roomNumber || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="label">Room Type:</span>
                  <span>${data.roomType || 'N/A'}</span>
                </div>
              </div>

              <div class="section">
                <div class="section-title">Stay Dates</div>
                <div class="info-row">
                  <span class="label">Check-in:</span>
                  <span>${data.checkInDate || 'N/A'}</span>
                </div>
                <div class="info-row">
                  <span class="label">Check-out:</span>
                  <span>${data.checkOutDate || 'N/A'}</span>
                </div>
              </div>

              <div class="section">
                <div class="section-title">Total Price</div>
                <div class="total">$${data.totalPrice || '0.00'}</div>
              </div>

              ${data.hotelPhone || data.hotelEmail ? `
              <div class="section">
                <div class="section-title">Contact Information</div>
                ${data.hotelPhone ? `<div class="info-row"><span class="label">Phone:</span><span>${data.hotelPhone}</span></div>` : ''}
                ${data.hotelEmail ? `<div class="info-row"><span class="label">Email:</span><span>${data.hotelEmail}</span></div>` : ''}
              </div>
              ` : ''}

              <p style="color: #666; font-size: 12px; margin-top: 30px;">
                If you have any questions about your booking, please don't hesitate to contact us.
              </p>
            </div>

            <div class="footer">
              <p>&copy; ${data.hotelName || 'Hotel Manager'}. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate booking receipt HTML
   */
  private generateBookingReceiptHTML(data: EmailTemplateData): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: 'Courier New', monospace; color: #333; background: #f5f5f5; }
            .receipt { max-width: 400px; margin: 20px auto; background: white; padding: 20px; border: 1px solid #ddd; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .receipt-header { text-align: center; border-bottom: 1px dashed #ddd; padding-bottom: 10px; margin-bottom: 10px; }
            .receipt-header h2 { margin: 0; font-size: 18px; font-weight: bold; }
            .receipt-section { border-bottom: 1px dashed #ddd; padding: 10px 0; margin-bottom: 10px; }
            .receipt-line { display: flex; justify-content: space-between; font-size: 12px; }
            .receipt-total { font-weight: bold; font-size: 16px; text-align: right; }
            .receipt-footer { text-align: center; font-size: 10px; color: #999; margin-top: 10px; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="receipt-header">
              <h2>BOOKING RECEIPT</h2>
              <p>${data.hotelName || 'Hotel Manager'}</p>
              <p style="font-size: 10px; color: #999;">Confirmation: ${data.confirmationNumber || 'N/A'}</p>
            </div>

            <div class="receipt-section">
              <div class="receipt-line"><span>Guest Name:</span><span>${data.guestName || 'N/A'}</span></div>
              <div class="receipt-line"><span>Room:</span><span>${data.roomNumber || 'N/A'}</span></div>
              <div class="receipt-line"><span>Type:</span><span>${data.roomType || 'N/A'}</span></div>
            </div>

            <div class="receipt-section">
              <div class="receipt-line"><span>Check-in:</span><span>${data.checkInDate || 'N/A'}</span></div>
              <div class="receipt-line"><span>Check-out:</span><span>${data.checkOutDate || 'N/A'}</span></div>
            </div>

            <div class="receipt-section">
              <div class="receipt-line"><span>Total Amount:</span><span class="receipt-total">$${data.totalPrice || '0.00'}</span></div>
            </div>

            <div class="receipt-footer">
              <p>Thank you for your booking!</p>
              <p>Generated: ${new Date().toLocaleString()}</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate booking cancellation HTML
   */
  private generateBookingCancellationHTML(data: EmailTemplateData): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #e74c3c; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-left: 4px solid #e74c3c; }
            .footer { background: #333; color: white; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Booking Cancellation Confirmation</h1>
            </div>
            
            <div class="content">
              <p>Dear ${data.recipientName || 'Guest'},</p>
              <p>Your booking has been successfully cancelled.</p>
              <p><strong>Confirmation Number:</strong> ${data.confirmationNumber || 'N/A'}</p>
              <p>If you have any questions about this cancellation, please contact us.</p>
            </div>

            <div class="footer">
              <p>&copy; ${data.hotelName || 'Hotel Manager'}. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }
}

// Export singleton instance
export const emailService = new EmailService();
