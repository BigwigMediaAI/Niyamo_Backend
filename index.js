const express = require("express");
const cors = require("cors");
const { connect } = require("./config/db");

require("dotenv").config();

const app = express();

app.use(express.json());
app.use(cors());

app.listen(process.env.PORT, async () => {
  try {
    await connect;
    console.log("Connected to DB");
  } catch (error) {}
  console.log("Server is listening");
});
