const express = require("express");
const router = express.Router();
const Subscriber = require("../models/subscriber.model");
const sendEmail = require("../utils/sendEmail");
const Newsletter = require("../models/newsletter");

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

// router.post("/send-newsletter", async (req, res) => {
//   const { subject, message } = req.body;

//   if (!subject || !message) {
//     return res.status(400).json({ error: "Subject and message required" });
//   }

//   try {
//     const subscribers = await Subscriber.find({}, "email");
//     const emailList = subscribers.map((sub) => sub.email);

//     if (emailList.length === 0) {
//       return res.status(404).json({ error: "No subscribers found" });
//     }

//     // Send to all
//     await sendEmail({
//       to: emailList,
//       subject,
//       text: message,
//     });

//     res
//       .status(200)
//       .json({ success: true, message: "Newsletter sent to all subscribers" });
//   } catch (error) {
//     console.error("Error sending newsletter:", error);
//     res.status(500).json({ error: "Failed to send newsletter" });
//   }
// });

router.post("/send-newsletter", async (req, res) => {
  const {
    emails, // optional if sendToAll is true
    sendToAll, // true to send to all subscribers
    subject,
    title,
    content,
    ctaText,
    ctaUrl,
    imageUrl,
    scheduleAt, // optional datetime in ISO string
  } = req.body;

  // Validate core fields
  if (
    !subject ||
    !title ||
    !content ||
    !ctaText ||
    !ctaUrl ||
    (sendToAll !== true && (!Array.isArray(emails) || emails.length === 0))
  ) {
    return res.status(400).json({
      error:
        "Required: subject, title, content, ctaText, ctaUrl. Provide emails array if sendToAll is false.",
    });
  }

  try {
    let targetSubscribers;

    if (sendToAll) {
      targetSubscribers = await Subscriber.find({});
    } else {
      targetSubscribers = await Subscriber.find({
        email: { $in: emails },
      });
    }

    const existingEmails = targetSubscribers.map((sub) => sub.email);

    if (existingEmails.length === 0) {
      return res.status(404).json({ error: "No matching subscribers found" });
    }

    const notFound = !sendToAll
      ? emails.filter((email) => !existingEmails.includes(email))
      : [];

    // Save to DB
    const newsletter = new Newsletter({
      emails: existingEmails,
      subject,
      title,
      content,
      ctaText,
      ctaUrl,
      imageUrl,
      sent: false,
      scheduleAt: scheduleAt ? new Date(scheduleAt) : null,
    });
    await newsletter.save();

    // If no scheduling => send now
    if (!scheduleAt || new Date(scheduleAt) <= new Date()) {
      const html = generateHtml({ imageUrl, title, content, ctaText, ctaUrl });

      await sendEmail({
        to: existingEmails,
        subject,
        text: content.replace(/<[^>]+>/g, ""),
        html,
      });

      newsletter.sent = true;
      newsletter.sentAt = new Date();
      await newsletter.save();

      return res.status(200).json({
        success: true,
        message: `Newsletter sent immediately to ${existingEmails.length} subscribers`,
        sentTo: existingEmails,
        notFound,
      });
    }

    // Scheduled
    return res.status(200).json({
      success: true,
      message: `Newsletter scheduled for ${scheduleAt}`,
      newsletterId: newsletter._id,
      notFound,
    });
  } catch (error) {
    console.error("❌ Error sending newsletter:", error.message);
    res.status(500).json({ error: "Failed to send newsletter" });
  }
});

module.exports = router;
