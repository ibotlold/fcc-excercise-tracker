const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const uri = process.env.MONGODB_URL;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  await client.connect();
  const db = client.db('FREECODECAMP');
  await db.command({ ping: 1 });
}

app.use(cors());
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(function (req, res, next) {
  const db = client.db('FREECODECAMP');
  db.command({ ping: 1 })
    .catch(() => {
      return run();
    })
    .then(() => {
      req.db = db;
      next();
      return;
    });
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

app.post('/api/users', function (req, res) {
  const { username } = req.body;
  const collection = req.db.collection('users');
  collection
    .insertOne({
      username,
    })
    .then((document) => {
      return res.json({
        _id: document.insertedId,
        username,
      });
    })
    .catch((error) => {
      return res.json({
        error: error.message,
      });
    });
});

app.get('/api/users', function (req, res) {
  const collection = req.db.collection('users');
  collection
    .find()
    .toArray()
    .then((users) => {
      return res.json(users);
    })
    .catch((error) => {
      return res.json({
        error: error.message,
      });
    });
});

app.post('/api/users/:_id/exercises', function (req, res) {
  const { _id } = req.params;
  const { description, duration, date: dateString } = req.body;
  const collection = req.db.collection('users');
  collection
    .findOne({ _id: new ObjectId(_id) })
    .then((user) => {
      if (!user) {
        return res.json({
          error: 'User not found',
        });
      }
      const { _id, username } = user;
      const collection = req.db.collection('exercises');
      let date;
      if (dateString) {
        date = new Date(dateString);
      } else {
        date = new Date();
      }
      return collection
        .insertOne({
          username,
          description,
          duration: +duration,
          date,
        })
        .then((document) => {
          return res.json({
            _id,
            username,
            description,
            date: date.toDateString(),
            duration: +duration,
          });
        });
    })
    .catch((error) => {
      res.json({ error: error.message });
    });
});

app.get('/api/users/:_id/logs', function (req, res) {
  const { _id } = req.params;
  const { from, to } = req.query;
  let limit = req.query.limit ?? 0;
  limit = +limit;
  const collection = req.db.collection('users');
  collection
    .findOne({
      _id: new ObjectId(_id),
    })
    .then((user) => {
      if (!user) {
        return res.json({
          error: 'User not found',
        });
      }
      const { _id, username } = user;
      const collection = req.db.collection('exercises');
      const query = {
        username,
      };
      if (from || to) {
        const date = {};
        if (from) {
          date['$gte'] = new Date(from);
        }
        if (to) {
          date['$lte'] = new Date(to);
        }
        query.date = date;
      }
      Promise.all([
        collection.countDocuments({ username }).then((count) => {
          if (count === 0) {
            res.json({
              _id,
              username,
              count,
              log: [],
            });
          }
          return count;
        }),
        collection.find(query).limit(limit).toArray(),
      ]).then(([count, logs]) => {
        if (count === 0) {
          return;
        }
        for (let i = 0; i < logs.length; i++) {
          logs[i].date = logs[i].date.toDateString();
          delete logs[i].username;
          delete logs[i]._id;
        }
        res.json({
          _id,
          username,
          count,
          log: logs,
        });
        return;
      });
    });
});

run().then(() => {
  const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener.address().port);
  });
});

module.exports = app;
