const express = require("express");
const router = express.Router();
const Subscriber = require("../models/subscriber.model");
const sendEmail = require("../utils/sendEmail");

// POST /subscribe
router.post("/subscribe", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    const existing = await Subscriber.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "Email already subscribed" });
    }

    const subscriber = new Subscriber({ email });
    await subscriber.save();

    // Send confirmation email
    await sendEmail({
      to: email,
      subject: "🎉 You are subscribed to our Newsletter",
      text: "Thank you for subscribing",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2>✅ Subscription Confirmed</h2>
          <p>Hi there,</p>
          <p>Thank you for subscribing to our newsletter We'll keep you updated with the latest news, offers, and insights.</p>
          <hr style="margin: 20px 0;" />
          <p style="font-size: 14px; color: #888;">If you didn’t subscribe, please ignore this email.</p>
          <p>Best regards,<br>The Team</p>
        </div>
      `,
    });

    res.status(201).json({ success: true, message: "Subscribed successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /subscribers (optional testing route)
router.get("/subscribers", async (req, res) => {
  try {
    const subscribers = await Subscriber.find().sort({ createdAt: -1 });
    res.json(subscribers);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/send-newsletter", async (req, res) => {
  const { subject, message } = req.body;

  if (!subject || !message) {
    return res.status(400).json({ error: "Subject and message required" });
  }

  try {
    const subscribers = await Subscriber.find({}, "email");
    const emailList = subscribers.map((sub) => sub.email);

    if (emailList.length === 0) {
      return res.status(404).json({ error: "No subscribers found" });
    }

    // Send to all
    await sendEmail({
      to: emailList,
      subject,
      text: message,
    });

    res
      .status(200)
      .json({ success: true, message: "Newsletter sent to all subscribers" });
  } catch (error) {
    console.error("Error sending newsletter:", error);
    res.status(500).json({ error: "Failed to send newsletter" });
  }
});

// POST /send-newsletter-to-some
router.post("/send-newsletter-to-some", async (req, res) => {
  const { emails, subject, message } = req.body;

  if (!Array.isArray(emails) || emails.length === 0 || !subject || !message) {
    return res.status(400).json({
      error: "Emails (array), subject, and message are required",
    });
  }

  try {
    const existingSubscribers = await Subscriber.find({
      email: { $in: emails },
    });
    const existingEmails = existingSubscribers.map((sub) => sub.email);

    if (existingEmails.length === 0) {
      return res.status(404).json({ error: "No matching subscribers found" });
    }

    const notFound = emails.filter((email) => !existingEmails.includes(email));
    if (notFound.length > 0) {
      console.warn(`These emails were not found in DB: ${notFound.join(", ")}`);
    }

    const html = `
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4; padding: 30px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; padding: 40px; font-family: Arial, sans-serif; border-radius: 8px;">
              <tr>
                <td align="center">
                  <img src="https://cdn.pixabay.com/photo/2016/01/10/22/52/letters-1132703_1280.png" alt="Company Logo" width="120" style="margin-bottom: 20px;" />
                </td>
              </tr>
              <tr>
                <td>
                  <h2 style="color: #333333;">🌟 ${subject}</h2>
                  <p style="font-size: 16px; color: #555555; line-height: 1.6;">
                    Hello,<br><br>
                    ${message}
                  </p>

                  <img src="https://cdn.pixabay.com/photo/2016/04/24/15/13/newsletter-1349774_1280.jpg" alt="Banner" width="100%" style="margin: 20px 0; border-radius: 6px;" />

                  <a href="https://niyamo.vercel.app/" style="display:inline-block; padding: 12px 24px; background-color: #007bff; color: #fff; text-decoration: none; border-radius: 4px; margin-top: 20px;">🎁 See the Offer</a>

                  <hr style="margin: 30px 0;" />

                  <p style="font-size: 14px; color: #999999;">If you’d prefer not to receive emails like this, you can <a href="#" style="color: #999;">unsubscribe</a> at any time.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;

    await sendEmail({
      to: existingEmails,
      subject,
      text: message, // Fallback
      html,
    });

    res.status(200).json({
      success: true,
      message: `Newsletter sent to ${existingEmails.length} subscribers`,
      sentTo: existingEmails,
      notFound,
    });
  } catch (error) {
    console.error("Error sending newsletter to some:", error);
    res.status(500).json({ error: "Failed to send newsletter" });
  }
});

module.exports = router;
