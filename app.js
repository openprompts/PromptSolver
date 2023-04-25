let fs = require("fs");
let mongoose = require("mongoose");
let async = require("async");
let process = require("process");
let path = require("path");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const rootPath = path.join(__dirname, "/promptify/prompts/text2text");
const getDirectories = (source) =>
  fs
    .readdirSync(source, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
const directories = getDirectories(rootPath);

mongoose.pluralize(null);

const text2textSchema = new mongoose.Schema(
  {
    models: Array,
    language: String,
    task: String,
    authors: String,
    file_name: String,
    created: String,
  },
  { strict: false }
);

const text2text = mongoose.model("text2text", text2textSchema);

async function initMongo(mongoose, mongoURI) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(mongoURI, {
    useUnifiedTopology: false,
    useNewUrlParser: true,
  });
  console.log(`Starting data pull at ${new Date().toLocaleString()}`);
  return mongoose;
}

async function inserter(file, cb) {
  try {
    await text2text.updateOne(
      { task: file.task },
      { $set: file },
      { upsert: true }
    );
    cb(null);
  } catch (err) {
    cb(err);
  }
}

function main() {
  const data = directories
    .map((t) => {
      if (!fs.existsSync(`${rootPath}/${t}/metadata.json`)) {
        return;
      }
      try {
        let file = require(`${rootPath}/${t}/metadata.json`);
        file=file[0]
        return file;
      } catch {}
    })
    .filter((t) => t);
  async.parallel(
    data.map(
      (t) =>
        function (cb) {
          inserter(t, cb);
        }
    ),
    function (err) {
      if (err) {
        console.log("FINAL ERR: " + err);
      } else {
        console.log(`Data pulled at ${new Date().toLocaleString()}`);
      }
      mongoose.connection.close();
    }
  );
}

function createUniqueId() {
  directories.forEach((t) => {
    if (fs.existsSync(`${rootPath}/${t}/metadata.json`)) {
      try {
        let metaJson = require(`${rootPath}/${t}/metadata.json`);
        metaJson = metaJson[0];
        if (!metaJson.promptId) {
          metaJson.promptId = uuidv4();
        }
        metaJson = [metaJson];
        metaJson = JSON.stringify(metaJson, null, 3);
        fs.writeFileSync(`${rootPath}/${t}/metadata.json`, metaJson);
      } catch {}
    }
  });
}

async function init() {
  let mongoURI = `mongodb+srv://${process.env.MONGODB_USERNAME}:${process.env.MONGODB_PASSWORD}@promptify.lfu9er5.mongodb.net/promptify`;
  createUniqueId();
  await initMongo(mongoose, mongoURI);
  await main();
}

init();