const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()
const stripe = require("stripe")(process.env.PAYMENT_SK);
var jwt = require('jsonwebtoken');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' })
  }

  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decode;
    next();
  })
}


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
    // await client.connect();

    const usersCollection = client.db('SoundWave').collection('users');
    const classesCollection = client.db('SoundWave').collection('classes');
    const teachersCollection = client.db('SoundWave').collection('teachers');
    const cartCollection = client.db('SoundWave').collection('carts')
    const paymentCollection = client.db('SoundWave').collection('payments')

    // jwt token
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })

    // Verify Admin Check middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
      next();
    }

    // verify Instructor middleware
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'instructor') {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }
      next();
    }

    // user api
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
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

    app.put('/users/instructors/:id', async (req, res) => {
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

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        return res.send({ admin: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })



    app.patch('/users/admin/:id', async (req, res) => {
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
    
    

    app.post('/classes', verifyJWT, verifyInstructor, async (req, res) => {
      const newClass = req.body;
      const result = await classesCollection.insertOne(newClass);
      res.send(result)
    })

    app.put('/classes/approved/:id', async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          status: 'approved'
        },
      };
      const result = await classesCollection.updateOne(query, updateDoc);
      res.send(result);
    })

    app.put('/classes/denied/:id', async (req, res) => {
      const id = req.params.id;

      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          status: 'denied'
        },
      };
      const result = await classesCollection.updateOne(query, updateDoc);
      res.send(result);
    })

    // carts api
    app.get('/carts', verifyJWT, async (req, res) => {
      const email = req.query?.email;
      if (!email) {
        res.send([]);
      };

      app.get('/carts/:id', async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }
        console.log(id);
        const result = await cartCollection.findOne(query);
        res.send(result);
      })

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }

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

    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        return res.send({ instructor: false })
      }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' }
      res.send(result);
    })

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

    // Payment api
    app.post('/create-payment-intent',verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    })

    // payment collection api's
    app.post('/payments', async (req, res) => {
      const item = req.body;
      const InsertedResult = await paymentCollection.insertOne(item)

      const updateQuery = { _id: new ObjectId(item.cartClassId) }
      const updateDoc = {
        $inc: {
          students: 1
        },
      }
      const updatedResult = await classesCollection(updateQuery, updateDoc);

      const query = { _id: new ObjectId(item.classId),}
      const deletedResult = await cartCollection.deleteOne(query);

      res.send({InsertedResult, updatedResult, deletedResult});
    })

    app.get('/payments', async (req, res) => {
      const result = await paymentCollection.find().toArray();
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