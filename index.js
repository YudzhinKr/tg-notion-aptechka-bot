const notion = require("./notion");

async function getDatabase() {
  const databaseId = "1f3dcb93e6258028a2d5cf17f6ea86af";

  const response = await notion.databases.query({
    database_id: databaseId,
  });

  console.log(response);
}

getDatabase();
