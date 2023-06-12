const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()
var jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jmzo55h.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db('SoundWave').collection('users');
    const classesCollection = client.db('SoundWave').collection('classes');
    const teachersCollection = client.db('SoundWave').collection('teachers');
    const cartCollection = client.db('SoundWave').collection('carts')

    // jwt token
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({token})
    })

    // user api
    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    app.post('/users', async (req, res) => {
      const user = req.body;

      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send('user already exist')
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    app.put('/users/:id', async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: 'instructor'
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    })
    
    app.patch('/users/:id', async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    })


    //   classes api
    app.get('/classes', async (req, res) => {
      const result = await classesCollection.find().sort({ students: -1 }).toArray();
      res.send(result);
    })

    // carts api
    app.get('/carts', async (req, res) => {
      const email = req.query?.email;
      if (!email) {
        res.send([]);
      };
      const query = { email: email }
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/carts', async (req, res) => {
      const selectedClass = req.body;
      const result = await cartCollection.insertOne(selectedClass);
      res.send(result);
    })

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id

      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query)
      res.send(result);
    })

    //   instructors api
    app.get('/instructors', async (req, res) => {
      const result = await teachersCollection.find().limit(6).toArray();
      res.send(result);
    })
    
    app.post('/instructors', async (req, res) => {
      const user = req.body;

      const query = { email: user.email }
      const existingUser = await teachersCollection.findOne(query);
      if (existingUser) {
        return res.send('user already exist')
      }

      const result = await teachersCollection.insertOne(user);
      res.send(result);
    })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('sound wave server is running')
})

app.listen(port, () => {
  console.log('server is running on ', port);
})