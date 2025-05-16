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

module.exports = router;
