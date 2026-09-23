const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendResetCodeEmail = async (toEmail, code) => {
  await transporter.sendMail({
    from: `"SIGHTA Guardian" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Your SIGHTA Guardian password reset code",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 24px; background: #eef1ff;">
        <div style="max-width: 420px; margin: auto; background: #ffffff; border-radius: 12px; padding: 32px; text-align: center;">
          <h2 style="color: #000666; margin-bottom: 8px;">SIGHTA Guardian</h2>
          <p style="color: #454652; margin-bottom: 24px;">Use this code to reset your password. It expires in 10 minutes.</p>
          <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #000666; background: #eef1ff; padding: 16px; border-radius: 8px;">
            ${code}
          </div>
          <p style="color: #767683; font-size: 12px; margin-top: 24px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      </div>
    `,
  });
};

module.exports = { sendResetCodeEmail };