const { Client } = require("@notionhq/client");
require("dotenv").config();

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

module.exports = notion;
